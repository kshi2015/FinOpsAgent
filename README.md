# Orchestrai — AP Triage Agent

> **AIOP901 Project — Kellogg School of Management**
> A production-grade recreation of an n8n automation workflow, rebuilt as a full-stack AI agent with structured outputs, human-in-the-loop review, and an evaluation harness.

---

## What This Is

Orchestrai is an AI agent for Accounts Payable (AP) operations. It reads incoming supplier emails, classifies them, routes them to the correct internal team, drafts a professional reply, and generates an internal handoff note — all from a single email submission.

This project was originally built as an **n8n workflow** (a low-code automation platform) and was subsequently recreated as a standalone Next.js application with:

- A **chat-style UI** for interactive email triage
- A **structured LLM pipeline** using OpenAI's `gpt-4.1-mini` with JSON schema enforcement
- A **human-in-the-loop approval flow** (autosend gating)
- A **comprehensive eval harness** with 12 test cases, baseline tracking, and HTML reports

The goal of this project was to demonstrate how the concepts taught in AIOP901 translate from theory into a working system — and to understand the tradeoffs involved at each layer.

---

## The Business Problem

Supplier operations is where "simple questions" become expensive cross-team chaos.

A supplier asks: *"When do I get paid?"* or *"Did you receive my invoice?"* — and the answer requires:

1. Checking ERP + procurement systems
2. Reconciling invoice / PO / receipt mismatches
3. Coordinating across AP, procurement, IT, warehouse, and legal
4. Escalating through a ticketing queue (ServiceNow-style)

The result: long resolution times, burned-out AP teams, frustrated suppliers, and a growing backlog of manually triaged emails.

Orchestrai becomes the **front door for the supplier inbox** — triaging, routing, and drafting replies at scale while keeping humans in the loop for sensitive decisions.

---

## Quick Start

```bash
# Clone and install
cd FinOpsAgent
npm install

# Set your API key
cp .env.local.example .env.local
# Edit .env.local and add: OPENAI_API_KEY=sk-...

# Run the dev server
npm run dev
# → http://localhost:3000

# Run the eval harness (requires API key)
npm run eval
npm run eval:baseline   # save a baseline for regression tracking
```

---

## Architecture

```
Supplier Email (Subject + Body)
        │
        ▼
┌───────────────────────────────┐
│  POST /api/triage             │   Next.js Route Handler
│                               │
│  1. Build system message      │   AP_TRIAGE_SYSTEM_PROMPT
│     (+ optional ERP context)  │   + ERP snippet if provided
│                               │
│  2. Call OpenAI Responses API │   gpt-4.1-mini
│     with json_schema format   │   Structured output enforced
│                               │
│  3. Return parsed JSON         │
└───────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  TRIAGE_JSON                                │
│  ├── request_type (8 categories)            │
│  ├── route_team (AP/IT/Legal/etc.)          │
│  ├── autosend (boolean safety gate)         │
│  ├── internal_priority (low/normal/high)    │
│  ├── missing_info, loop_in_contacts         │
│  └── case_summary, justification            │
│                                             │
│  DRAFT_REPLY                                │
│  └── subject + body (supplier-facing)       │
│                                             │
│  INTERNAL_NOTE                              │
│  └── to/cc/subject/body (internal only)     │
└─────────────────────────────────────────────┘
        │
        ▼
 Human reviews → Approve & Send / Request Edits
```

**Key files:**

| File | Purpose |
|---|---|
| `src/lib/systemPrompt.ts` | The full AP triage system prompt |
| `src/lib/types.ts` | TypeScript interfaces for all structured data |
| `src/lib/mockErp.ts` | Mock ERP invoice data + lookup functions |
| `src/app/api/triage/route.ts` | POST handler — LLM call + structured output |
| `src/app/page.tsx` | Chat UI — input, triage cards, sidebar |
| `eval/cases.jsonl` | 12 test cases (all 8 request types) |
| `eval/run_eval.ts` | Eval runner with cost tracking + HTML reports |
| `eval/score.ts` | Scoring: request_type, route_team, autosend, safety |

---

## AI Concepts — From Curriculum to Code

This section maps each module from AIOP901 to a concrete implementation decision in this project.

---

### 1. AI — Foundations

**The core idea:** Language models are function approximators trained to predict the most probable next token given a context. When we write a system prompt and provide an email body, the model is performing *text-to-structured-output generation* — mapping unstructured natural language to a typed JSON object.

**In this project:** The agent must perform several cognitive tasks simultaneously:
- Entity extraction (supplier name, invoice #, PO #)
- Intent classification (8 request categories)
- Policy application (routing rules, autosend conditions)
- Tone-aware text generation (professional email draft)

A single LLM call handles all of this because the model has learned to perform these operations from its training distribution — including business email patterns, accounting terminology, and JSON formatting.

**Why this matters for business:** The value isn't that the model "knows" AP policy — it doesn't. The value is that *you can teach it your policy in a system prompt*, and it will apply it consistently at scale.

---

### 2. Pretraining a Large Language Model

**The core idea:** GPT-4.1-mini was pretrained on a massive corpus of internet text — including financial documents, business emails, ERP documentation, legal correspondence, and code. This pretraining gives the model a rich prior over language patterns before we ever write a single prompt.

**In this project:** We benefit from pretraining in ways that are easy to overlook:

- The model already "knows" what an invoice is, what a PO number looks like, what "past due" implies, and what a professional AP email should sound like — without us explaining any of this.
- It understands that `"We will pursue legal action"` signals escalation and urgency, connecting language patterns to business consequences.
- It can produce well-formatted JSON reliably because it has seen JSON in its training data extensively.

**What pretraining *cannot* do:** It has no knowledge of *your* company's specific policies, team structures, ERP system, or approval thresholds. That's where prompting and fine-tuning come in.

**Analogy:** Pretraining gives you a highly educated new hire who has read every business textbook and email thread on the internet. They know accounting concepts, professional norms, and how email works. But they don't know your company's Net-30 terms or who "AP Manager (role)" is — that's what onboarding (prompting) is for.

---

### 3. Post-training and Alignment

**The core idea:** After pretraining, models are further trained using techniques like RLHF (Reinforcement Learning from Human Feedback) and instruction tuning. This shifts the model's behavior from *next-token prediction* to *instruction following*, and instills guardrails against harmful outputs.

**In this project — alignment shows up in two ways:**

**a) Safety constraints (mustNot rules)**

Our system prompt contains explicit safety rules:
```
- Do NOT invent invoice status, payment dates, PO details, or amounts
- Do NOT claim you checked the ERP unless an ERP snippet is provided
- Do NOT provide personal contact info. Only output roles.
- For bank detail changes: do NOT collect banking details by email
```

These rules work *because* the model has been post-trained to follow instructions and to be harmless. A pretrained-only model might plausibly hallucinate a payment date to seem helpful. Alignment training makes it resistant to this.

**b) Structured output compliance**

We enforce `json_schema` with `strict: true` via the OpenAI Responses API. This is possible because post-training teaches the model to respect format constraints rather than just generating whatever text seems most natural. The model produces valid JSON matching our schema essentially 100% of the time.

**In the eval harness:** `mustNot` checks (e.g., no invented ERP data, no real banking details in replies) are our proxy for measuring alignment quality. A `hardFail` in the eval — triggering exit code 2 — represents an alignment violation. This maps directly to a safety concern in a real deployment.

---

### 4. Prompting LLMs

**The core idea:** Prompting is the primary interface for controlling LLM behavior without retraining. Prompt engineering determines what the model knows, how it reasons, and what format it produces.

**In this project:** The system prompt (`src/lib/systemPrompt.ts`) is the longest and most important artifact. It uses several prompting techniques:

**a) Role assignment**
```
You are an AP triage + reply + internal connector assistant for a shared
supplier inbox at an AV startup.
```
Role assignment activates relevant patterns from the model's training distribution — it "knows" to reason like an AP professional, not a general customer service bot.

**b) Explicit output schema**
Rather than describing the output in prose, we specify the exact JSON structure and enumerate all valid enum values. This is more reliable than free-form instructions like "return the route team."

**c) Rule-based routing logic**
```
- Legal/terms/liability/dispute threats → request_type="legal_terms";
  route_team="Legal"; autosend=false.
- Bank detail changes → route_team="SupplierOnboarding"; autosend=false;
  internal_priority="high".
```
Explicit if-then rules in the prompt outperform asking the model to "use good judgment" — especially for safety-critical decisions like `autosend`.

**d) Negative constraints (what NOT to do)**
Explicitly listing what the model must not do is often more reliable than positive-only instructions. This is especially important for hallucination prevention.

**e) Multi-turn for iterative editing**

The API route passes the full `messages` array, enabling the user to type "make the reply shorter" as a follow-up. The model sees the original email + its own previous triage output + the edit instruction, allowing it to refine without re-triaging from scratch. This demonstrates that prompting isn't just about the first message — it's about managing context across a conversation.

---

### 5. AI Agents

**The core idea:** An AI agent is an LLM that can take actions in the world, use tools, and complete multi-step tasks autonomously or semi-autonomously. Agents go beyond simple Q&A by connecting model outputs to real systems.

**In this project:** Orchestrai implements several agent characteristics:

**a) Structured action output**

The agent's `route_team` and `autosend` fields are *executable decisions*, not just text. In the n8n version, these fields directly triggered downstream actions (Google Sheets logging, Gmail send-and-wait, approval forms). In this Next.js version, the UI mirrors that: `Approve & Send` maps to what n8n called `Respond (Sent)`.

**b) Tool integration (mocked)**

`src/lib/mockErp.ts` simulates an ERP lookup tool. In a production system, this would be a real API call to SAP, Oracle, or similar. The agent uses ERP data to make the `autosend` decision — without ERP confirmation, it always defaults to human review. This is a form of tool-augmented reasoning.

**c) Conditional branching**

The `autosend` flag implements a decision fork that would be expressed in n8n as an `If` node. The agent:
- Sets `autosend=true` only when request type is simple (payment_status or invoice_received_check), identifiers are present, and ERP confirms the status
- Sets `autosend=false` for everything else, routing to human review

**d) Human-in-the-loop (HITL)**

`autosend=false` is a deliberate agent design choice, not a failure mode. For legal threats, upset suppliers, bank detail changes, and anything without ERP confirmation, the agent defers to a human. This is the "Approve & Send" / "Request Edits" flow in the UI.

**The n8n → Next.js translation:**

| n8n Node | This App |
|---|---|
| `Front Door Agent` | `POST /api/triage` |
| `Autoreply?` (If node) | `autosend` field in `TRIAGE_JSON` |
| `Wait` (approval form) | "Approve & Send" / "Request Edits" buttons |
| `ResponseGeneratingAgent` | Follow-up message in the chat thread |
| `Log Ticket (Google Sheet)` | In-memory ticket history in the UI sidebar |
| `Respond (Sent)` | Mock success toast |

---

### 6. AgentOps

**The core idea:** AgentOps is the practice of running AI agents in production reliably — monitoring, tracing, approvals, rate limiting, cost management, and failure handling.

**In this project:**

**a) Human-in-the-loop as a safety architecture**

The `autosend` flag is not just a product feature — it's an ops decision. Sending an email on behalf of an AP team is a **consequential, irreversible action**. The agent is designed to be conservative: when in doubt, it surfaces the output for human review rather than acting autonomously. This mirrors the "human escalation path" design pattern in production agent systems.

**b) Cost tracking in eval**

The eval harness tracks token counts and cost per case:
```typescript
const PRICING = {
  "gpt-4.1-mini": { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 }
};
```
In production, cost per ticket is a real metric. The eval surfaces `$X/case` so you can forecast operational costs before deploying to the full supplier inbox.

**c) Priority-based escalation**

`internal_priority` ("low" / "normal" / "high") is an ops signal. High-priority cases (legal threats, CEO-copied emails, stop-shipping threats) surface to an AP manager's attention immediately. This is equivalent to SLA-based ticket routing in ServiceNow.

**d) Structured logging**

Every triage result includes `case_summary`, `justification`, `loop_in_contacts`, and `internal_request` — an audit trail of what the agent decided and why. In the n8n version, this was logged to Google Sheets for review. In a production system, this would feed into a ticket management system for compliance and retrospective analysis.

**e) Latency tracking**

The eval records `latencyMs` per case. A response time of 3–5 seconds is acceptable for a triage assistant; if latency regresses significantly, the eval exits with a warning. This is a basic form of SLA monitoring.

---

### 7. Evaluation and Continuous Improvement

**The core idea:** AI systems require structured evaluation — not just "does it seem to work" but quantified, reproducible metrics that can detect regressions as the system evolves.

**In this project:**

**a) Test case design (`eval/cases.jsonl`)**

12 cases covering all 8 request types, varying by difficulty:
- `easy`: clear signal, ERP context provided
- `medium`: ambiguous cases, missing identifiers
- `hard`: edge cases — legal threats, CEO-copied, bank detail changes, stop-shipping

Each case specifies:
```json
{
  "input": { "subject": "...", "body": "...", "erpContext": "..." },
  "expected": { "request_type": "...", "route_team": "...", "autosend": false },
  "mustNot": ["invented ERP data", "bank account number"]
}
```

**b) Four scoring dimensions (`eval/score.ts`)**

| Dimension | What it checks |
|---|---|
| `requestTypeOk` | Correct classification into 8 categories |
| `routeTeamOk` | Correct internal routing (AP/Legal/IT/etc.) |
| `autosendOk` | Correct autosend safety decision |
| `mustNotOk` | No forbidden content (hallucinations, PII, banking details) |

Pass = all four must pass. This prevents a "75% right" answer from being approved if it committed a safety violation.

**c) Baseline comparison**

```bash
npm run eval:baseline  # save today's results as baseline
npm run eval           # future runs compare against this baseline
```

Regressions are flagged when pass rate drops >5%, latency increases >20%, or cost increases >20%. This enables "red light / green light" CI-style evaluation as the prompt is iterated.

**d) Exit codes for CI integration**

```
exit 2 → any mustNot violation (safety failure, blocks deploy)
exit 3 → pass rate < 75% (quality regression, blocks deploy)
```

**e) HTML reports**

Each eval run writes a timestamped HTML report to `eval/results/` with pass/fail per case, check breakdowns, cost summary, and per-category performance. This creates an audit trail for iteration.

**The key insight about eval:** The eval is not testing whether the LLM is "smart" — it's testing whether *your system prompt + model combination* behaves correctly on the cases that matter. When you update the prompt, you rerun the eval to verify the behavior didn't regress on cases you already had right.

---

### 8. Change Management and Innovation

**The core idea:** Deploying AI into an organization requires more than building the technology — it requires changing how people work, managing trust, and designing for adoption.

**This project as a change management artifact:**

**a) From n8n to a product**

The original n8n workflow was a working proof of concept — valuable for validating the idea, but not a scalable product. The limitations:
- Tightly coupled to n8n's execution model
- No version control on prompt logic
- Approval UI was a hosted form with no context
- No eval system for tracking quality over time

Rebuilding as a Next.js application with TypeScript, a structured system prompt, and an eval harness is a change management act: it turns a workflow prototype into something that can be tested, maintained, and improved by a team.

**b) Human-in-the-loop as organizational trust-building**

A fully autonomous email agent would not be adopted in most AP teams — the trust isn't there yet, and the risk of a wrong auto-sent reply is real (legal liability, supplier relationship damage). The `autosend=false` default is a **deliberate trust-building mechanism**: humans stay in control, they see what the agent produces, and they build confidence in it over time.

The roadmap to `autosend=true` for more cases is essentially a change management roadmap: prove accuracy on easy cases → earn trust → expand autonomy → repeat.

**c) The "front door" framing**

Introducing Orchestrai as *"the front door for the supplier inbox"* rather than *"a bot that does your job"* is a change management communication choice. It positions the agent as a coordinator that reduces noise for the AP team, not a replacement for AP judgment.

**d) Metrics for stakeholder buy-in**

The eval harness produces the metrics that matter for a business sponsor:
- % of supplier inquiries resolved without human involvement
- Cost per ticket ($X/case from the eval cost tracking)
- Classification accuracy and routing correctness

These translate directly to the ROI language needed to get organizational support for expanding the agent's scope.

---

## The n8n Workflow vs. This App

This project began as an n8n workflow for AIOP901 that demonstrated the end-to-end agent loop:

1. **Webhook trigger** → receives supplier email text
2. **Front Door Agent** (LLM) → produces TRIAGE_JSON + DRAFT_REPLY + INTERNAL_NOTE
3. **Autoreply?** (If node) → branches on `autosend` flag
4. **Log Ticket** → appends to Google Sheets
5. **Send and Wait** → emails AP manager for approval
6. **Approved?** (If node) → routes to draft creation or edit flow
7. **ResponseGeneratingAgent** → applies human edits to draft
8. **Create a draft** → pushes to Gmail drafts

The **evaluation workflow** in n8n used a separate `evaluationTrigger` node reading from a Google Sheets dataset, calling the agent on each row, and using a judge LLM to score outputs.

**What this rebuild adds:**
- Full TypeScript types — no runtime type surprises
- Prompt logic in version-controlled source code
- Structured output with `json_schema` enforcement (no fragile text parsing)
- Local eval harness with deterministic scoring (no judge LLM variability)
- Baseline comparison for regression detection
- A UI that shows the agent's full output in one place, with context

---

## Evaluation Results

Run the eval to generate a timestamped HTML report:

```bash
npm run eval
# → eval/results/eval-<timestamp>.html
```

Expected baseline: **≥ 9/12 cases passing (75%)**, zero `mustNot` violations.

The most common failure mode is `autosend` — the model occasionally sets `autosend=true` when ERP data is present but the case is ambiguous. This is a prompt engineering problem, not a model capability problem.

---

## Project Structure

```
FinOpsAgent/
├── src/
│   ├── app/
│   │   ├── page.tsx               # Chat UI
│   │   ├── layout.tsx             # Root layout
│   │   └── api/triage/route.ts    # POST /api/triage
│   └── lib/
│       ├── types.ts               # TypeScript interfaces
│       ├── systemPrompt.ts        # AP triage system prompt
│       └── mockErp.ts             # Mock ERP data
├── eval/
│   ├── cases.jsonl                # 12 test cases
│   ├── run_eval.ts                # Eval runner
│   ├── score.ts                   # Scoring logic
│   ├── report.ts                  # HTML report generator
│   ├── baseline.ts                # Baseline management
│   └── results/                   # Runtime output (gitignored)
├── .env.local.example
└── package.json
```

---

## Environment Variables

```bash
OPENAI_API_KEY=sk-...         # Required
EVAL_MODEL=gpt-4o             # Optional: override model for eval runs
EVAL_MIN_PASSRATE=0.75        # Optional: CI pass threshold (default 0.75)
```

---

## Built With

- [Next.js 16](https://nextjs.org/) — React framework with App Router
- [OpenAI Responses API](https://platform.openai.com/docs/api-reference) — `gpt-4.1-mini` with `json_schema` structured output
- [Tailwind CSS 4](https://tailwindcss.com/) — Utility-first styling
- [TypeScript](https://www.typescriptlang.org/) — End-to-end type safety

---

*AIOP901 — AI for Operations | Kellogg School of Management*
