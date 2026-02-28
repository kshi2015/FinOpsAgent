import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { AP_TRIAGE_SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { TriageResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

const TRIAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["TRIAGE_JSON", "DRAFT_REPLY", "INTERNAL_NOTE"],
  properties: {
    TRIAGE_JSON: {
      type: "object",
      additionalProperties: false,
      required: [
        "request_type",
        "supplier_name",
        "invoice_number",
        "po_number",
        "route_team",
        "autosend",
        "missing_info",
        "supporting_docs",
        "justification",
        "loop_in_contacts",
        "internal_request",
        "internal_priority",
        "case_summary",
      ],
      properties: {
        request_type: {
          type: "string",
          enum: [
            "invoice_received_check",
            "payment_status",
            "missing_invoice",
            "reconciliation",
            "technical_upload_issue",
            "legal_terms",
            "other",
            "spam",
          ],
        },
        supplier_name: { type: "string" },
        invoice_number: { type: "string" },
        po_number: { type: "string" },
        route_team: {
          type: "string",
          enum: ["AP", "SupplierOnboarding", "IT", "SupplyChain", "Legal", "Unknown"],
        },
        autosend: { type: "boolean" },
        missing_info: { type: "array", items: { type: "string" } },
        supporting_docs: { type: "array", items: { type: "string" } },
        justification: { type: "string" },
        loop_in_contacts: { type: "array", items: { type: "string" } },
        internal_request: { type: "array", items: { type: "string" } },
        internal_priority: {
          type: "string",
          enum: ["low", "normal", "high"],
        },
        case_summary: { type: "string" },
      },
    },
    DRAFT_REPLY: {
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
  },
};

export async function POST(req: NextRequest) {
  try {
    const { messages, erpContext } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const systemContent = erpContext
      ? `${AP_TRIAGE_SYSTEM_PROMPT}\n\nERP LOOKUP RESULT:\n${erpContext}`
      : AP_TRIAGE_SYSTEM_PROMPT;

    const response = await getClient().responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: systemContent },
        ...messages,
      ],
      text: {
        format: {
          type: "json_schema",
          name: "triage_response",
          schema: TRIAGE_SCHEMA,
          strict: true,
        },
      },
    });

    const result: TriageResponse = JSON.parse(response.output_text);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("POST /api/triage error:", err);
    return NextResponse.json(
      { error: "Failed to process triage request" },
      { status: 500 }
    );
  }
}
