import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PROACTIVE_SYSTEM_PROMPT } from "@/lib/proactivePrompt";
import { ProactiveAlert, ProactiveResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

const PROACTIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["PROACTIVE_DRAFT", "INTERNAL_NOTE", "alert_summary", "recommended_action"],
  properties: {
    PROACTIVE_DRAFT: {
      type: "object",
      additionalProperties: false,
      required: ["subject", "body"],
      properties: {
        subject: { type: "string" },
        body: { type: "string" },
      },
    },
    INTERNAL_NOTE: {
      type: "object",
      additionalProperties: false,
      required: ["to", "cc", "subject", "body"],
      properties: {
        to: { type: "array", items: { type: "string" } },
        cc: { type: "array", items: { type: "string" } },
        subject: { type: "string" },
        body: { type: "string" },
      },
    },
    alert_summary: { type: "string" },
    recommended_action: { type: "string", enum: ["send", "review"] },
  },
};

export async function POST(req: NextRequest) {
  try {
    const alert: ProactiveAlert = await req.json();

    if (!alert || !alert.type || !alert.erp_context) {
      return NextResponse.json(
        { error: "alert with type and erp_context is required" },
        { status: 400 }
      );
    }

    const userContent = `Alert Type: ${alert.type}\n\n${alert.erp_context}`;

    const response = await getClient().responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: PROACTIVE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "proactive_response",
          schema: PROACTIVE_SCHEMA,
          strict: true,
        },
      },
    });

    const result: ProactiveResponse = JSON.parse(response.output_text);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("POST /api/proactive/draft error:", err);
    return NextResponse.json(
      { error: "Failed to generate proactive draft" },
      { status: 500 }
    );
  }
}
