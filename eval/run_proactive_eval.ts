// 1️⃣ Load environment FIRST
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// 2️⃣ Imports
import fs from "node:fs";
import OpenAI from "openai";
import { PROACTIVE_SYSTEM_PROMPT } from "../src/lib/proactivePrompt";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Pricing ──────────────────────────────────────────────────────────────────
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4.1-mini": { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
};

// ── Schema ───────────────────────────────────────────────────────────────────
const PROACTIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["PROACTIVE_DRAFT", "INTERNAL_NOTE", "alert_summary", "recommended_action"],
  properties: {
    PROACTIVE_DRAFT: {
      type: "object",
      additionalProperties: false,
      required: ["subject", "body"],
      properties: { subject: { type: "string" }, body: { type: "string" } },
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

// ── Types ────────────────────────────────────────────────────────────────────
type ProactiveCase = {
  id: string;
  category: string;
  difficulty: string;
  input: { type: string; erp_context: string };
  expected: {
    recommended_action: "send" | "review";
    must_mention: string[];
    mustNot: string[];
  };
};

type ProactiveOutput = {
  PROACTIVE_DRAFT?: { subject?: string; body?: string };
  INTERNAL_NOTE?: { to?: string[]; cc?: string[]; subject?: string; body?: string };
  alert_summary?: string;
  recommended_action?: string;
};

// ── Scoring ──────────────────────────────────────────────────────────────────
function scoreProactive(c: ProactiveCase, out: ProactiveOutput) {
  const allText = JSON.stringify(out).toLowerCase();

  const actionOk = out.recommended_action === c.expected.recommended_action;

  const mentionHits = c.expected.must_mention.filter((kw) =>
    allText.includes(kw.toLowerCase())
  );
  const mentionOk = mentionHits.length === c.expected.must_mention.length;

  const mustNotHits = c.expected.mustNot.filter((kw) =>
    allText.includes(kw.toLowerCase())
  );
  const mustNotOk = mustNotHits.length === 0;

  // Check sign-off present in draft body
  const signoffOk = (out.PROACTIVE_DRAFT?.body ?? "").toLowerCase().includes("accounts payable team");

  const passed = actionOk && mentionOk && mustNotOk && signoffOk;

  return {
    passed,
    checks: { actionOk, mentionOk, mustNotOk, signoffOk },
    mentionMissing: c.expected.must_mention.filter((kw) => !allText.includes(kw.toLowerCase())),
    mustNotHits,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function readJsonl(filePath: string): ProactiveCase[] {
  return fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

function nowIso() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function safeJsonParse(text: string) {
  try { return JSON.parse(text); } catch { return {}; }
}

// ── Runner ───────────────────────────────────────────────────────────────────
async function callAgent(c: ProactiveCase) {
  const userContent = `Alert Type: ${c.input.type}\n\n${c.input.erp_context}`;
  const t0 = Date.now();

  const response = await client.responses.create({
    model: process.env.EVAL_MODEL || "gpt-4.1-mini",
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

  const latencyMs = Date.now() - t0;
  const parsed = safeJsonParse(response.output_text || "{}");
  const usage = (response as any).usage ?? null;
  return { parsed, latencyMs, usage };
}

async function main() {
  const casesPath = path.join(process.cwd(), "eval", "proactive-cases.jsonl");
  const cases = readJsonl(casesPath);

  const resultsDir = path.join(process.cwd(), "eval", "results");
  fs.mkdirSync(resultsDir, { recursive: true });

  const runId = nowIso();
  const outPath = path.join(resultsDir, `proactive-eval-${runId}.json`);

  let totalLatencyMs = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let hardFails = 0;
  const rows: any[] = [];

  console.log(`\n🔔 Orchestrai Proactive Eval — ${cases.length} cases\n${"─".repeat(50)}`);

  for (const c of cases) {
    const { parsed, latencyMs, usage } = await callAgent(c);
    const score = scoreProactive(c, parsed);

    if (!score.checks.mustNotOk) hardFails++;

    rows.push({ id: c.id, category: c.category, difficulty: c.difficulty, input: c.input, expected: c.expected, output: parsed, score, metrics: { latencyMs, usage } });

    console.log(`${score.passed ? "✅" : "❌"} ${c.id} [${c.difficulty}] (${latencyMs}ms)`);
    if (!score.passed) {
      if (!score.checks.actionOk) console.log(`   recommended_action: expected ${c.expected.recommended_action}, got ${parsed.recommended_action}`);
      if (!score.checks.mentionOk) console.log(`   missing keywords: ${score.mentionMissing.join(", ")}`);
      if (!score.checks.mustNotOk) console.log(`   ⚠️  mustNot hits: ${score.mustNotHits.join(", ")}`);
      if (!score.checks.signoffOk) console.log(`   missing sign-off: "Accounts Payable Team"`);
    }

    totalLatencyMs += latencyMs;
    if (usage) {
      totalInputTokens += usage.input_tokens || 0;
      totalOutputTokens += usage.output_tokens || 0;
    }
  }

  const passRate = rows.filter((r) => r.score.passed).length / rows.length;
  const modelName = process.env.EVAL_MODEL || "gpt-4.1-mini";
  const pricing = PRICING[modelName];
  const inputCost = pricing ? totalInputTokens * pricing.input : 0;
  const outputCost = pricing ? totalOutputTokens * pricing.output : 0;
  const totalCost = inputCost + outputCost;

  const summary = {
    runId,
    total: rows.length,
    passRate,
    hardFails,
    avgLatencyMs: Math.round(totalLatencyMs / rows.length),
    tokens: { input: totalInputTokens, output: totalOutputTokens, total: totalInputTokens + totalOutputTokens },
    costUsd: { total: Number(totalCost.toFixed(6)), perCase: Number((totalCost / rows.length).toFixed(6)) },
  };

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Pass Rate : ${(passRate * 100).toFixed(1)}% (${rows.filter((r) => r.score.passed).length}/${rows.length})`);
  console.log(`Hard Fails: ${hardFails}`);
  console.log(`Avg Latency: ${summary.avgLatencyMs}ms`);
  console.log(`Total Cost: $${summary.costUsd.total} ($${summary.costUsd.perCase}/case)`);

  // Check stats breakdown
  const checks = ["actionOk", "mentionOk", "mustNotOk", "signoffOk"] as const;
  const labels: Record<typeof checks[number], string> = { actionOk: "Recommended Action", mentionOk: "Must-Mention Keywords", mustNotOk: "Safety (mustNot)", signoffOk: "Sign-off Present" };
  console.log("\nCheck breakdown:");
  for (const key of checks) {
    const n = rows.filter((r) => r.score.checks[key]).length;
    console.log(`  ${labels[key]}: ${n}/${rows.length} (${((n / rows.length) * 100).toFixed(0)}%)`);
  }

  fs.writeFileSync(outPath, JSON.stringify({ summary, rows }, null, 2), "utf8");
  console.log(`\nResults: ${outPath}`);

  const minPassRate = Number(process.env.EVAL_MIN_PASSRATE || "0.75");
  if (hardFails > 0) process.exit(2);
  if (passRate < minPassRate) process.exit(3);
}

main().catch((err) => { console.error(err); process.exit(1); });
