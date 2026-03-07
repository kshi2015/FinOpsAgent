"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChatMessage,
  TriageResponse,
  RouteTeam,
  InternalPriority,
  ProactiveAlert,
  ProactiveResponse,
} from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function priorityColor(p: InternalPriority) {
  if (p === "high") return "bg-red-600 text-white";
  if (p === "normal") return "bg-yellow-500 text-slate-900";
  return "bg-green-600 text-white";
}

function routeColor(r: RouteTeam) {
  const map: Record<RouteTeam, string> = {
    AP: "bg-blue-600 text-white",
    SupplierOnboarding: "bg-purple-600 text-white",
    IT: "bg-slate-500 text-white",
    SupplyChain: "bg-orange-500 text-white",
    Legal: "bg-red-700 text-white",
    Unknown: "bg-slate-600 text-white",
  };
  return map[r] ?? "bg-slate-600 text-white";
}

function requestTypeLabel(t: string) {
  return t.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatAmount(n: number) {
  return `$${n.toLocaleString("en-US")}`;
}

// ── Triage Result Card ────────────────────────────────────────────────────────

type TriageTab = "triage" | "reply" | "note";

function TriageCard({
  result,
  onApprove,
  onRequestEdits,
}: {
  result: TriageResponse;
  onApprove: () => void;
  onRequestEdits: () => void;
}) {
  const [tab, setTab] = useState<TriageTab>("triage");
  const [approved, setApproved] = useState(false);
  const [editableReply, setEditableReply] = useState(result.DRAFT_REPLY.body);
  const { TRIAGE_JSON: t, DRAFT_REPLY: reply, INTERNAL_NOTE: note } = result;
  const isSpam = t.request_type === "spam";

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden w-full max-w-2xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 flex-wrap">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${priorityColor(t.internal_priority)}`}>
          {t.internal_priority}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${routeColor(t.route_team)}`}>
          {t.route_team}
        </span>
        <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full">
          {requestTypeLabel(t.request_type)}
        </span>
        <span className="ml-auto text-xs font-medium">
          {t.autosend
            ? <span className="text-emerald-400">✓ autosend</span>
            : <span className="text-red-400">✗ manual review</span>}
        </span>
      </div>

      <div className="flex border-b border-slate-700">
        {(["triage", "reply", "note"] as TriageTab[]).map((tabName) => {
          const labels: Record<TriageTab, string> = { triage: "Triage", reply: "Draft Reply", note: "Internal Note" };
          return (
            <button key={tabName} onClick={() => setTab(tabName)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === tabName ? "border-b-2 border-emerald-400 text-emerald-400" : "text-slate-400 hover:text-slate-200"}`}>
              {labels[tabName]}
            </button>
          );
        })}
      </div>

      <div className="p-4 min-h-48 text-sm">
        {tab === "triage" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {t.supplier_name && <Field label="Supplier" value={t.supplier_name} />}
              {t.invoice_number && <Field label="Invoice" value={t.invoice_number} />}
              {t.po_number && <Field label="PO Number" value={t.po_number} />}
            </div>
            {t.case_summary && <LabeledBlock label="Case Summary" text={t.case_summary} />}
            {t.justification && (
              <div>
                <div className="text-xs text-slate-400 mb-1">Routing Justification</div>
                <div className="text-slate-300 italic">{t.justification}</div>
              </div>
            )}
            {t.missing_info.length > 0 && (
              <div>
                <div className="text-xs text-yellow-400 mb-1">Missing Information</div>
                <ul className="space-y-0.5">
                  {t.missing_info.map((item, i) => (
                    <li key={i} className="text-yellow-300 flex gap-1.5"><span className="text-yellow-500">•</span><span>{item}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {t.loop_in_contacts.length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-1">Loop-in Contacts</div>
                <div className="flex flex-wrap gap-1">
                  {t.loop_in_contacts.map((c, i) => (
                    <span key={i} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {t.internal_request.length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-1">Action Items</div>
                <ul className="space-y-0.5">
                  {t.internal_request.map((item, i) => (
                    <li key={i} className="text-slate-300 flex gap-1.5"><span className="text-emerald-500">☐</span><span>{item}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {t.supporting_docs.length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-1">Supporting Docs</div>
                <div className="flex flex-wrap gap-1">
                  {t.supporting_docs.map((doc, i) => (
                    <span key={i} className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full">{doc}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "reply" && (
          <div className="space-y-3">
            {isSpam ? <div className="text-slate-500 italic">No reply generated for spam.</div> : (
              <>
                {reply.subject && <LabeledBlock label="Subject" text={reply.subject} mono={false} />}
                <div>
                  <div className="text-xs text-slate-400 mb-1">Body</div>
                  <textarea value={editableReply} onChange={(e) => setEditableReply(e.target.value)} rows={10}
                    className="w-full bg-slate-900 text-slate-200 rounded px-3 py-2 text-sm leading-relaxed border border-slate-700 focus:outline-none focus:border-emerald-500 resize-y font-mono" />
                </div>
              </>
            )}
          </div>
        )}

        {tab === "note" && (
          <div className="space-y-3">
            {isSpam ? <div className="text-slate-500 italic">No internal note for spam.</div> : (
              <>
                {note.to.length > 0 && <div><div className="text-xs text-slate-400 mb-1">To</div><div className="text-slate-200">{note.to.join(", ")}</div></div>}
                {note.cc.length > 0 && <div><div className="text-xs text-slate-400 mb-1">Cc</div><div className="text-slate-200">{note.cc.join(", ")}</div></div>}
                {note.subject && <LabeledBlock label="Subject" text={note.subject} mono={false} />}
                {note.body && <LabeledBlock label="Body" text={note.body} />}
              </>
            )}
          </div>
        )}
      </div>

      {!isSpam && (
        <div className="flex gap-2 px-4 py-3 border-t border-slate-700">
          {approved
            ? <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium"><span>✓</span><span>Approved — reply queued</span></div>
            : <>
              <button onClick={() => { setApproved(true); onApprove(); }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                Approve &amp; Send
              </button>
              <button onClick={onRequestEdits}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold py-2 rounded-lg transition-colors">
                Request Edits
              </button>
            </>}
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/60 rounded p-2">
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div className="text-slate-200 font-medium">{value}</div>
    </div>
  );
}

function LabeledBlock({ label, text, mono = true }: { label: string; text: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-slate-300 bg-slate-900 rounded px-3 py-2 leading-relaxed whitespace-pre-wrap ${mono ? "font-mono text-xs" : ""}`}>
        {text}
      </div>
    </div>
  );
}

// ── Proactive Alert Card ──────────────────────────────────────────────────────

type ProactiveTab = "draft" | "note";

function ProactiveAlertCard({
  alert,
  onApprove,
  onDismiss,
}: {
  alert: ProactiveAlert;
  onApprove: (a: ProactiveAlert) => void;
  onDismiss: (id: string) => void;
}) {
  const [draft, setDraft] = useState<ProactiveResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [tab, setTab] = useState<ProactiveTab>("draft");
  const [editableBody, setEditableBody] = useState("");
  const [approved, setApproved] = useState(false);

  const isMissing = alert.type === "missing_invoice";

  async function generateDraft() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/proactive/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alert),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ProactiveResponse = await res.json();
      setDraft(data);
      setEditableBody(data.PROACTIVE_DRAFT.body);
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : "Failed to generate draft");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${isMissing ? "border-yellow-700/50 bg-yellow-900/10" : "border-blue-700/50 bg-blue-900/10"}`}>
      {/* Alert header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className={`mt-0.5 text-lg flex-shrink-0`}>{isMissing ? "📋" : "💳"}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${isMissing ? "bg-yellow-600 text-white" : "bg-blue-600 text-white"}`}>
              {isMissing ? "Missing Invoice" : "Payment Upcoming"}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${priorityColor(alert.priority)}`}>
              {alert.priority}
            </span>
          </div>
          <div className="text-sm font-semibold text-slate-200">{alert.supplier_name}</div>
          <div className="text-xs text-slate-400 mt-0.5">{alert.details}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-semibold text-slate-200">{formatAmount(alert.amount)}</div>
          {alert.po_number && <div className="text-xs text-slate-500">{alert.po_number}</div>}
          {alert.invoice_number && <div className="text-xs text-slate-500">{alert.invoice_number}</div>}
        </div>
      </div>

      {/* Key metric */}
      <div className={`mx-4 mb-3 px-3 py-2 rounded-lg text-xs font-medium ${isMissing ? "bg-yellow-900/30 text-yellow-300" : "bg-blue-900/30 text-blue-300"}`}>
        {isMissing
          ? `⚠ Invoice ${alert.days_overdue}d overdue — expected by ${alert.trigger_date}`
          : `📅 Payment in ${alert.days_until_payment} day${alert.days_until_payment === 1 ? "" : "s"} — scheduled ${alert.trigger_date}`}
      </div>

      {/* Draft section */}
      {!draft && (
        <div className="flex gap-2 px-4 pb-3">
          <button onClick={generateDraft} disabled={generating}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-colors ${generating ? "bg-slate-700 text-slate-400" : isMissing ? "bg-yellow-600 hover:bg-yellow-500 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"}`}>
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating draft…
              </span>
            ) : "Generate Draft"}
          </button>
          <button onClick={() => onDismiss(alert.id)}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
            Dismiss
          </button>
        </div>
      )}

      {genError && (
        <div className="mx-4 mb-3 text-xs text-red-400 bg-red-900/30 rounded px-3 py-2">Error: {genError}</div>
      )}

      {/* Draft tabs */}
      {draft && (
        <div className="border-t border-slate-700/50">
          {/* Summary + recommended action */}
          <div className="px-4 py-2 flex items-center gap-2 text-xs text-slate-400">
            <span>{draft.alert_summary}</span>
            <span className={`ml-auto font-bold px-2 py-0.5 rounded-full ${draft.recommended_action === "send" ? "bg-emerald-700 text-white" : "bg-yellow-600 text-slate-900"}`}>
              {draft.recommended_action === "send" ? "✓ safe to send" : "⚠ review first"}
            </span>
          </div>

          <div className="flex border-b border-slate-700/50">
            {(["draft", "note"] as ProactiveTab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-1.5 text-sm font-medium transition-colors ${tab === t ? "border-b-2 border-emerald-400 text-emerald-400" : "text-slate-400 hover:text-slate-200"}`}>
                {t === "draft" ? "Outreach Draft" : "Internal Note"}
              </button>
            ))}
          </div>

          <div className="p-4 text-sm space-y-3">
            {tab === "draft" && (
              <>
                <LabeledBlock label="Subject" text={draft.PROACTIVE_DRAFT.subject} mono={false} />
                <div>
                  <div className="text-xs text-slate-400 mb-1">Body</div>
                  <textarea value={editableBody} onChange={(e) => setEditableBody(e.target.value)} rows={8}
                    className="w-full bg-slate-900 text-slate-200 rounded px-3 py-2 text-sm leading-relaxed border border-slate-700 focus:outline-none focus:border-emerald-500 resize-y font-mono" />
                </div>
              </>
            )}
            {tab === "note" && (
              <>
                {draft.INTERNAL_NOTE.to.length > 0 && <div><div className="text-xs text-slate-400 mb-1">To</div><div className="text-slate-200">{draft.INTERNAL_NOTE.to.join(", ")}</div></div>}
                {draft.INTERNAL_NOTE.subject && <LabeledBlock label="Subject" text={draft.INTERNAL_NOTE.subject} mono={false} />}
                {draft.INTERNAL_NOTE.body && <LabeledBlock label="Body" text={draft.INTERNAL_NOTE.body} />}
              </>
            )}
          </div>

          <div className="flex gap-2 px-4 pb-4">
            {approved
              ? <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium"><span>✓</span><span>Approved — outreach queued</span></div>
              : <>
                <button onClick={() => { setApproved(true); onApprove(alert); }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                  Approve &amp; Send
                </button>
                <button onClick={() => onDismiss(alert.id)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-lg transition-colors">
                  Dismiss
                </button>
              </>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Proactive View ────────────────────────────────────────────────────────────

function ProactiveView() {
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function runScan() {
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch("/api/proactive/scan");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAlerts(data.alerts);
      setScanned(true);
    } catch (e: unknown) {
      setScanError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  function dismissAlert(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  function handleApprove(alert: ProactiveAlert) {
    showToast(`Outreach approved for ${alert.supplier_name}`);
  }

  const missing = alerts.filter((a) => a.type === "missing_invoice");
  const upcoming = alerts.filter((a) => a.type === "payment_upcoming");

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Proactive Outreach</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Scan mock ERP data for missing invoices and upcoming payments, then generate outreach drafts.
          </p>
        </div>
        <button onClick={runScan} disabled={scanning}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${scanning ? "bg-slate-700 text-slate-400" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}>
          {scanning ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <span>⟳</span> Run Scan
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {scanError && (
        <div className="mb-4 bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-2">
          Scan error: {scanError}
        </div>
      )}

      {/* Pre-scan empty state */}
      {!scanned && !scanning && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl">🔍</div>
          <div>
            <h3 className="text-slate-300 font-semibold mb-1">No scan run yet</h3>
            <p className="text-slate-500 text-sm max-w-sm">
              Click <strong>Run Scan</strong> to check the mock ERP for overdue invoices and upcoming supplier payments.
            </p>
          </div>
          <div className="text-xs text-slate-600 bg-slate-800 rounded-lg px-4 py-2 border border-slate-700">
            Reference date: <strong className="text-slate-400">2025-02-05</strong> — 5 POs and 5 payment schedules in mock data
          </div>
        </div>
      )}

      {/* Post-scan results */}
      {scanned && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <div className="text-4xl">✅</div>
          <div className="text-slate-300 font-semibold">All clear — no alerts found</div>
          <div className="text-slate-500 text-sm">No missing invoices or upcoming payments in the current window.</div>
        </div>
      )}

      {scanned && alerts.length > 0 && (
        <div className="space-y-6">
          {/* Stats bar */}
          <div className="flex gap-3">
            <div className="flex-1 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-4 py-3">
              <div className="text-2xl font-bold text-yellow-300">{missing.length}</div>
              <div className="text-xs text-yellow-500 mt-0.5">Missing Invoices</div>
            </div>
            <div className="flex-1 bg-blue-900/20 border border-blue-700/40 rounded-lg px-4 py-3">
              <div className="text-2xl font-bold text-blue-300">{upcoming.length}</div>
              <div className="text-xs text-blue-500 mt-0.5">Payments Due Soon</div>
            </div>
            <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
              <div className="text-2xl font-bold text-slate-200">{alerts.length}</div>
              <div className="text-xs text-slate-500 mt-0.5">Total Alerts</div>
            </div>
          </div>

          {/* Missing invoices */}
          {missing.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-3">
                Missing Invoices ({missing.length})
              </div>
              <div className="space-y-3">
                {missing.map((alert) => (
                  <ProactiveAlertCard key={alert.id} alert={alert} onApprove={handleApprove} onDismiss={dismissAlert} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming payments */}
          {upcoming.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-3">
                Upcoming Payments ({upcoming.length})
              </div>
              <div className="space-y-3">
                {upcoming.map((alert) => (
                  <ProactiveAlertCard key={alert.id} alert={alert} onApprove={handleApprove} onDismiss={dismissAlert} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg z-50">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}

// ── Sidebar Ticket Item ───────────────────────────────────────────────────────

function SidebarTicket({ msg, index, active, onClick }: {
  msg: ChatMessage; index: number; active: boolean; onClick: () => void;
}) {
  const t = msg.triageResult?.TRIAGE_JSON;
  const preview = msg.content.slice(0, 60) + (msg.content.length > 60 ? "…" : "");
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${active ? "bg-slate-700" : "hover:bg-slate-800"}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-slate-400 font-mono">#{index + 1}</span>
        {t && (
          <>
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${routeColor(t.route_team)}`}>{t.route_team}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-bold ml-auto ${priorityColor(t.internal_priority)}`}>{t.internal_priority.toUpperCase()}</span>
          </>
        )}
      </div>
      <div className="text-xs text-slate-400 leading-snug truncate">{preview}</div>
      {t?.supplier_name && <div className="text-xs text-slate-500 mt-0.5 truncate">{t.supplier_name}</div>}
    </button>
  );
}

// ── Sample emails ─────────────────────────────────────────────────────────────

const SAMPLE_EMAILS = [
  {
    label: "Payment status (INV-12345)",
    text: `Subject: Payment Status Inquiry — INV-12345\n\nHi,\n\nI'm writing to check on the status of our invoice INV-12345 submitted to your team. It was for $15,000 against PO-98765 and was submitted on January 10th.\n\nCould you please confirm receipt and let us know the expected payment date?\n\nThank you,\nAcme Audio LLC`,
    erpContext: `ERP LOOKUP — Invoice INV-12345\nSupplier: Acme Audio LLC\nPO Number: PO-98765\nAmount: $15,000\nStatus: scheduled\nReceived Date: 2025-01-10\nPayment Due: 2025-02-10\nScheduled Payment: 2025-02-08\nNotes: Net-30 terms. Invoice matched to PO-98765, 3-way match complete.`,
  },
  {
    label: "Legal threat",
    text: `Subject: URGENT: Overdue Payment — Legal Action Notice\n\nDear AP Team,\n\nDespite multiple follow-ups, invoice INV-55501 for $8,200 remains unpaid and is now 45 days past due.\n\nWe have engaged our legal counsel and will pursue formal legal action and report this to our credit agency if payment is not received within 5 business days.\n\nGlobex Components`,
    erpContext: "",
  },
  {
    label: "Portal upload issue",
    text: `Subject: Cannot Upload Invoice to Supplier Portal\n\nHello,\n\nI've been trying to upload our latest invoice through your supplier portal but keep getting an error: "File type not supported." I've tried PDF and XLSX formats and neither works.\n\nCould someone from IT help resolve this? This is blocking our payment submission.\n\nThanks,\nBolt Electronics`,
    erpContext: "",
  },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

type MainView = "triage" | "proactive";

export default function Home() {
  const [mainView, setMainView] = useState<MainView>("triage");

  // Triage state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [erpContext, setErpContext] = useState("");
  const [showErp, setShowErp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ticketCount, setTicketCount] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setError(null);
    const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    const apiMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, erpContext: erpContext.trim() || undefined }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
      const result: TriageResponse = await res.json();
      const count = ticketCount + 1;
      setTicketCount(count);
      const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: `Ticket #${count} processed`, triageResult: result, timestamp: new Date() };
      setMessages((prev) => [...prev, assistantMsg]);
      setActiveTicketId(assistantMsg.id);
      setErpContext("");
      setShowErp(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); }
  }

  function handleNewSession() {
    setMessages([]); setInput(""); setErpContext(""); setShowErp(false);
    setError(null); setActiveTicketId(null); setTicketCount(0);
  }

  function loadSample(sample: (typeof SAMPLE_EMAILS)[0]) {
    setInput(sample.text);
    if (sample.erpContext) { setErpContext(sample.erpContext); setShowErp(true); }
    inputRef.current?.focus();
  }

  const ticketMessages = messages.filter((m) => m.role === "user");

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800">
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-sm font-bold">O</div>
            <span className="font-semibold text-slate-100">Orchestrai</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">AP Operations Agent</div>
        </div>

        {/* Navigation */}
        <div className="px-3 py-3 space-y-1">
          <button onClick={() => setMainView("triage")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mainView === "triage" ? "bg-emerald-700 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}>
            📩 Triage Inbox
          </button>
          <button onClick={() => setMainView("proactive")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mainView === "proactive" ? "bg-emerald-700 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}>
            🔔 Proactive Outreach
          </button>
        </div>

        {mainView === "triage" && (
          <>
            <div className="px-3 pb-2">
              <button onClick={handleNewSession}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold py-2 rounded-lg transition-colors">
                + New Session
              </button>
            </div>
            <div className="px-3 pb-2">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1.5 px-1">Samples</div>
              <div className="space-y-1">
                {SAMPLE_EMAILS.map((s, i) => (
                  <button key={i} onClick={() => loadSample(s)}
                    className="w-full text-left px-2 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors truncate">
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {ticketMessages.length > 0 && (
              <div className="flex-1 overflow-y-auto px-2 py-2">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1.5 px-1">Tickets</div>
                <div className="space-y-1">
                  {ticketMessages.map((msg, idx) => {
                    const assistantMsg = messages.find((m) => m.role === "assistant" && messages.indexOf(m) > messages.indexOf(msg));
                    return (
                      <SidebarTicket key={msg.id} msg={assistantMsg ?? msg} index={idx}
                        active={assistantMsg ? activeTicketId === assistantMsg.id : false}
                        onClick={() => assistantMsg && setActiveTicketId(assistantMsg.id)} />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </aside>

      {/* ── Main area ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900">
          <div>
            <h1 className="font-semibold text-slate-100">
              {mainView === "triage" ? "Supplier Inbox" : "Proactive Outreach"}
            </h1>
            <p className="text-xs text-slate-500">
              {mainView === "triage" ? "Paste supplier emails to triage and route" : "Scan for missing invoices and upcoming payments"}
            </p>
          </div>
          {mainView === "triage" && messages.length > 0 && (
            <button onClick={handleNewSession}
              className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors">
              Clear session
            </button>
          )}
        </header>

        {/* Proactive view */}
        {mainView === "proactive" && <ProactiveView />}

        {/* Triage view */}
        {mainView === "triage" && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center text-3xl">📩</div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-200 mb-1">AP Triage Agent</h2>
                    <p className="text-slate-500 text-sm max-w-md">Paste a supplier email below to classify it, route it to the right team, and generate a professional draft reply with an internal handoff note.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {SAMPLE_EMAILS.map((s, i) => (
                      <button key={i} onClick={() => loadSample(s)}
                        className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-full transition-colors">
                        Try: {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => {
                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-xl">
                        <div className="bg-blue-900/50 border border-blue-800/50 rounded-2xl rounded-tr-sm px-4 py-3">
                          <pre className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">{msg.content}</pre>
                        </div>
                        <div className="text-xs text-slate-600 text-right mt-1">{formatTime(msg.timestamp)}</div>
                      </div>
                    </div>
                  );
                }
                const ticketNum = messages.filter((m, i) => m.role === "assistant" && i <= idx).length;
                return (
                  <div key={msg.id} className="flex justify-start">
                    <div className="max-w-2xl w-full">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center text-xs font-bold">O</div>
                        <span className="text-xs text-slate-400">Orchestrai</span>
                        <span className="text-xs text-slate-600">{formatTime(msg.timestamp)}</span>
                      </div>
                      {msg.triageResult
                        ? <TriageCard result={msg.triageResult} onApprove={() => showToast(`Ticket #${ticketNum} approved — reply queued`)} onRequestEdits={() => { setInput("Please edit the reply to "); setTimeout(() => { inputRef.current?.focus(); }, 50); }} />
                        : <div className="bg-slate-800 rounded-2xl px-4 py-3 text-slate-300 text-sm">{msg.content}</div>}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:300ms]" />
                    </div>
                    <span className="text-xs text-slate-400">Processing email…</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex justify-center">
                  <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-2">Error: {error}</div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-slate-800 bg-slate-900 px-4 py-3 space-y-2">
              <div>
                <button onClick={() => setShowErp(!showErp)}
                  className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                  <span>{showErp ? "▼" : "▶"}</span>
                  <span>ERP Context (optional)</span>
                </button>
                {showErp && (
                  <textarea value={erpContext} onChange={(e) => setErpContext(e.target.value)}
                    placeholder="Paste ERP invoice lookup data here (enables autosend for confirmed statuses)…"
                    rows={3}
                    className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none font-mono" />
                )}
              </div>
              <div className="flex gap-2 items-end">
                <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="Paste supplier email (Subject + Body) or type a follow-up edit request…"
                  rows={4}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-600 resize-none leading-relaxed" />
                <button onClick={handleSubmit} disabled={loading || !input.trim()}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-colors self-end">
                  {loading
                    ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                    : <span className="text-sm">Send</span>}
                </button>
              </div>
              <div className="text-xs text-slate-600">Cmd+Enter to send</div>
            </div>
          </>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg z-50">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
