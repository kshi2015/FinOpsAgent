// 1️⃣ Load environment FIRST
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
});

// 2️⃣ Imports
import fs from "node:fs";
import OpenAI from "openai";
import { scoreOne, type EvalCase } from "./score";
import { generateReport } from "./report";
import { saveBaseline, loadBaseline, compareToBaseline, type BaselineData } from "./baseline";
import { AP_TRIAGE_SYSTEM_PROMPT } from "../src/lib/systemPrompt";

// 3️⃣ Pricing config
type ModelPricing = { input: number; output: number };

const PRICING: Record<string, ModelPricing> = {
  "gpt-4.1-mini": {
    input: 0.15 / 1_000_000,
    output: 0.60 / 1_000_000,
  },
};

// 4️⃣ OpenAI client (after env load)
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TRIAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["TRIAGE_JSON", "DRAFT_REPLY", "INTERNAL_NOTE"],
  properties: {
    TRIAGE_JSON: {
      type: "object",
      additionalProperties: false,
      required: [
        "request_type", "supplier_name", "invoice_number", "po_number",
        "route_team", "autosend", "missing_info", "supporting_docs",
        "justification", "loop_in_contacts", "internal_request",
        "internal_priority", "case_summary",
      ],
      properties: {
        request_type: {
          type: "string",
          enum: [
            "invoice_received_check", "payment_status", "missing_invoice",
            "reconciliation", "technical_upload_issue", "legal_terms",
            "other", "spam",
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
        internal_priority: { type: "string", enum: ["low", "normal", "high"] },
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

/* -------------------- helpers -------------------- */

function readJsonl(filePath: string): EvalCase[] {
  const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
  return lines.map((l) => JSON.parse(l));
}

function nowIso() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* -------------------- agent call -------------------- */

async function callAgent(c: EvalCase) {
  const systemContent = c.input.erpContext
    ? `${AP_TRIAGE_SYSTEM_PROMPT}\n\nERP LOOKUP RESULT:\n${c.input.erpContext}`
    : AP_TRIAGE_SYSTEM_PROMPT;

  const userContent = `Subject: ${c.input.subject}\n\n${c.input.body}`;

  const t0 = Date.now();

  const response = await client.responses.create({
    model: process.env.EVAL_MODEL || "gpt-4.1-mini",
    input: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
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

  const latencyMs = Date.now() - t0;
  const rawText = response.output_text || "";
  const parsed = safeJsonParse(rawText) ?? {};

  const usage =
    (response as any).usage ??
    (response as any).response?.usage ??
    null;

  return { parsed, rawText, latencyMs, usage };
}

/* -------------------- main runner -------------------- */

async function main() {
  let totalLatencyMs = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const casesPath = path.join(process.cwd(), "eval", "cases.jsonl");
  const cases = readJsonl(casesPath);

  const resultsDir = path.join(process.cwd(), "eval", "results");
  fs.mkdirSync(resultsDir, { recursive: true });

  const runId = nowIso();
  const outPath = path.join(resultsDir, `eval-${runId}.json`);

  const rows: any[] = [];
  let hardFails = 0;

  for (const c of cases) {
    const { parsed, rawText, latencyMs, usage } = await callAgent(c);
    const scored = scoreOne(c, parsed);

    if (!scored.checks.mustNotOk) hardFails += 1;

    rows.push({
      id: c.id,
      input: c.input,
      expected: c.expected,
      output: parsed,
      rawText,
      score: scored,
      category: c.category,
      difficulty: c.difficulty,
      metrics: { latencyMs, usage },
    });

    console.log(`${scored.passed ? "✅" : "❌"} ${c.id} (${latencyMs}ms)`);

    if (!scored.passed) {
      const { checks } = scored;
      if (!checks.requestTypeOk) {
        console.log(`   request_type: expected ${c.expected.request_type}, got ${parsed.TRIAGE_JSON?.request_type}`);
      }
      if (!checks.routeTeamOk) {
        console.log(`   route_team: expected ${c.expected.route_team}, got ${parsed.TRIAGE_JSON?.route_team}`);
      }
      if (!checks.autosendOk) {
        console.log(`   autosend: expected ${c.expected.autosend}, got ${parsed.TRIAGE_JSON?.autosend}`);
      }
      if (!checks.mustNotOk) {
        console.log(`   ⚠️  mustNot violations: ${scored.mustNotHits.join(", ")}`);
      }
    }

    totalLatencyMs += latencyMs;
    if (usage) {
      totalInputTokens += usage.input_tokens || 0;
      totalOutputTokens += usage.output_tokens || 0;
    }
  }

  // Cost calculation
  const modelName = process.env.EVAL_MODEL || "gpt-4.1-mini";
  const pricing = PRICING[modelName];

  const inputCost = pricing ? totalInputTokens * pricing.input : 0;
  const outputCost = pricing ? totalOutputTokens * pricing.output : 0;
  const totalCost = inputCost + outputCost;

  const passRate = rows.filter((r) => r.score.passed).length / rows.length;

  const summary = {
    runId,
    total: rows.length,
    passRate,
    hardFails,
    avgLatencyMs: Math.round(totalLatencyMs / rows.length),
    tokens: {
      input: totalInputTokens,
      output: totalOutputTokens,
      total: totalInputTokens + totalOutputTokens,
    },
    costUsd: {
      input: Number(inputCost.toFixed(6)),
      output: Number(outputCost.toFixed(6)),
      total: Number(totalCost.toFixed(6)),
      perCase: Number((totalCost / rows.length).toFixed(6)),
    },
  };

  console.log(`\nPass Rate: ${(passRate * 100).toFixed(1)}% (${rows.filter((r) => r.score.passed).length}/${rows.length})`);
  console.log(`Cost: $${summary.costUsd.total} total ($${summary.costUsd.perCase}/case)`);

  const resultData = { summary, rows };

  fs.writeFileSync(outPath, JSON.stringify(resultData, null, 2), "utf8");
  console.log("\nSummary:", summary);
  console.log("Wrote:", outPath);

  generateReport(resultData, outPath);

  const baselineDir = path.join(process.cwd(), "eval");
  const shouldSaveBaseline = process.argv.includes("--save-baseline");

  const currentBaseline: BaselineData = {
    runId,
    passRate,
    avgLatencyMs: summary.avgLatencyMs,
    costPerCase: summary.costUsd.perCase,
    categoryBreakdown: {},
    checkStats: {
      requestTypeOk: rows.filter((r) => r.score.checks.requestTypeOk).length,
      routeTeamOk: rows.filter((r) => r.score.checks.routeTeamOk).length,
      autosendOk: rows.filter((r) => r.score.checks.autosendOk).length,
      mustNotOk: rows.filter((r) => r.score.checks.mustNotOk).length,
    },
  };

  if (shouldSaveBaseline) {
    saveBaseline(resultData, baselineDir);
  } else {
    const baseline = loadBaseline(baselineDir);
    compareToBaseline(currentBaseline, baseline);
  }

  const minPassRate = Number(process.env.EVAL_MIN_PASSRATE || "0.75");
  if (hardFails > 0) process.exit(2);
  if (passRate < minPassRate) process.exit(3);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
