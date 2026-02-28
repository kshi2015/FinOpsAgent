"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChatMessage,
  TriageResponse,
  TriageJSON,
  RouteTeam,
  InternalPriority,
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
  return t
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Triage Result Card ────────────────────────────────────────────────────────

type Tab = "triage" | "reply" | "note";

function TriageCard({
  result,
  onApprove,
  onRequestEdits,
}: {
  result: TriageResponse;
  onApprove: () => void;
  onRequestEdits: () => void;
}) {
  const [tab, setTab] = useState<Tab>("triage");
  const [approved, setApproved] = useState(false);
  const [editableReply, setEditableReply] = useState(result.DRAFT_REPLY.body);

  const { TRIAGE_JSON: t, DRAFT_REPLY: reply, INTERNAL_NOTE: note } = result;
  const isSpam = t.request_type === "spam";

  function handleApprove() {
    setApproved(true);
    onApprove();
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden w-full max-w-2xl">
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-750 border-b border-slate-700 flex-wrap">
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${priorityColor(t.internal_priority)}`}
        >
          {t.internal_priority}
        </span>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${routeColor(t.route_team)}`}
        >
          {t.route_team}
        </span>
        <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full">
          {requestTypeLabel(t.request_type)}
        </span>
        <span className="ml-auto text-xs font-medium">
          {t.autosend ? (
            <span className="text-emerald-400">✓ autosend</span>
          ) : (
            <span className="text-red-400">✗ manual review</span>
          )}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {(["triage", "reply", "note"] as Tab[]).map((tabName) => {
          const labels: Record<Tab, string> = {
            triage: "Triage",
            reply: "Draft Reply",
            note: "Internal Note",
          };
          return (
            <button
              key={tabName}
              onClick={() => setTab(tabName)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === tabName
                  ? "border-b-2 border-emerald-400 text-emerald-400 bg-slate-800"
                  : "text-slate-400 hover:text-slate-200 bg-slate-800"
              }`}
            >
              {labels[tabName]}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-4 min-h-48 text-sm">
        {tab === "triage" && (
          <div className="space-y-3">
            {/* Key fields grid */}
            <div className="grid grid-cols-2 gap-2">
              {t.supplier_name && (
                <div className="bg-slate-750 rounded p-2">
                  <div className="text-xs text-slate-400 mb-0.5">Supplier</div>
                  <div className="text-slate-200 font-medium">{t.supplier_name}</div>
                </div>
              )}
              {t.invoice_number && (
                <div className="bg-slate-750 rounded p-2">
                  <div className="text-xs text-slate-400 mb-0.5">Invoice</div>
                  <div className="text-slate-200 font-medium">{t.invoice_number}</div>
                </div>
              )}
              {t.po_number && (
                <div className="bg-slate-750 rounded p-2">
                  <div className="text-xs text-slate-400 mb-0.5">PO Number</div>
                  <div className="text-slate-200 font-medium">{t.po_number}</div>
                </div>
              )}
            </div>

            {/* Case summary */}
            {t.case_summary && (
              <div>
                <div className="text-xs text-slate-400 mb-1">Case Summary</div>
                <div className="text-slate-300 bg-slate-900 rounded p-2 leading-relaxed">
                  {t.case_summary}
                </div>
              </div>
            )}

            {/* Justification */}
            {t.justification && (
              <div>
                <div className="text-xs text-slate-400 mb-1">Routing Justification</div>
                <div className="text-slate-300 italic">{t.justification}</div>
              </div>
            )}

            {/* Missing info */}
            {t.missing_info.length > 0 && (
              <div>
                <div className="text-xs text-yellow-400 mb-1">Missing Information</div>
                <ul className="space-y-0.5">
                  {t.missing_info.map((item, i) => (
                    <li key={i} className="text-yellow-300 flex gap-1.5">
                      <span className="text-yellow-500 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Loop-in contacts */}
            {t.loop_in_contacts.length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-1">Loop-in Contacts</div>
                <div className="flex flex-wrap gap-1">
                  {t.loop_in_contacts.map((c, i) => (
                    <span
                      key={i}
                      className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Internal request checklist */}
            {t.internal_request.length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-1">Action Items</div>
                <ul className="space-y-0.5">
                  {t.internal_request.map((item, i) => (
                    <li key={i} className="text-slate-300 flex gap-1.5">
                      <span className="text-emerald-500 mt-0.5">☐</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Supporting docs */}
            {t.supporting_docs.length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-1">Supporting Docs</div>
                <div className="flex flex-wrap gap-1">
                  {t.supporting_docs.map((doc, i) => (
                    <span
                      key={i}
                      className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full"
                    >
                      {doc}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "reply" && (
          <div className="space-y-3">
            {isSpam ? (
              <div className="text-slate-500 italic">No reply generated for spam.</div>
            ) : (
              <>
                {reply.subject && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Subject</div>
                    <div className="text-slate-200 font-medium bg-slate-900 rounded px-3 py-2">
                      {reply.subject}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-slate-400 mb-1">Body</div>
                  <textarea
                    value={editableReply}
                    onChange={(e) => setEditableReply(e.target.value)}
                    rows={10}
                    className="w-full bg-slate-900 text-slate-200 rounded px-3 py-2 text-sm leading-relaxed border border-slate-700 focus:outline-none focus:border-emerald-500 resize-y font-mono"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {tab === "note" && (
          <div className="space-y-3">
            {isSpam ? (
              <div className="text-slate-500 italic">No internal note generated for spam.</div>
            ) : (
              <>
                {note.to.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1">To</div>
                    <div className="text-slate-200">{note.to.join(", ")}</div>
                  </div>
                )}
                {note.cc.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Cc</div>
                    <div className="text-slate-200">{note.cc.join(", ")}</div>
                  </div>
                )}
                {note.subject && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Subject</div>
                    <div className="text-slate-200 font-medium bg-slate-900 rounded px-3 py-2">
                      {note.subject}
                    </div>
                  </div>
                )}
                {note.body && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Body</div>
                    <div className="text-slate-300 bg-slate-900 rounded px-3 py-2 leading-relaxed whitespace-pre-wrap font-mono text-xs">
                      {note.body}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!isSpam && (
        <div className="flex gap-2 px-4 py-3 border-t border-slate-700 bg-slate-800">
          {approved ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <span>✓</span>
              <span>Approved — reply queued</span>
            </div>
          ) : (
            <>
              <button
                onClick={handleApprove}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                Approve &amp; Send
              </button>
              <button
                onClick={onRequestEdits}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                Request Edits
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sidebar Ticket Item ───────────────────────────────────────────────────────

function SidebarTicket({
  msg,
  index,
  active,
  onClick,
}: {
  msg: ChatMessage;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const t = msg.triageResult?.TRIAGE_JSON;
  const preview = msg.content.slice(0, 60) + (msg.content.length > 60 ? "…" : "");

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
        active ? "bg-slate-700" : "hover:bg-slate-800"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-slate-400 font-mono">#{index + 1}</span>
        {t && (
          <>
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-semibold ${routeColor(t.route_team)}`}
            >
              {t.route_team}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-bold ml-auto ${priorityColor(t.internal_priority)}`}
            >
              {t.internal_priority.toUpperCase()}
            </span>
          </>
        )}
      </div>
      <div className="text-xs text-slate-400 leading-snug truncate">{preview}</div>
      {t?.supplier_name && (
        <div className="text-xs text-slate-500 mt-0.5 truncate">{t.supplier_name}</div>
      )}
    </button>
  );
}

// ── Sample email templates ─────────────────────────────────────────────────

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

export default function Home() {
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
    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Build messages array for the API (only include user/assistant turns, not triage cards)
    const apiMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, erpContext: erpContext.trim() || undefined }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const result: TriageResponse = await res.json();
      const count = ticketCount + 1;
      setTicketCount(count);

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: `Ticket #${count} processed`,
        triageResult: result,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setActiveTicketId(assistantMsg.id);
      setErpContext("");
      setShowErp(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleApprove(ticketNum: number) {
    showToast(`Ticket #${ticketNum} approved — reply queued`);
  }

  function handleRequestEdits() {
    setInput("Please edit the reply to ");
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(
        inputRef.current.value.length,
        inputRef.current.value.length
      );
    }, 50);
  }

  function handleNewTicket() {
    setMessages([]);
    setInput("");
    setErpContext("");
    setShowErp(false);
    setError(null);
    setActiveTicketId(null);
    setTicketCount(0);
  }

  function loadSample(sample: (typeof SAMPLE_EMAILS)[0]) {
    setInput(sample.text);
    if (sample.erpContext) {
      setErpContext(sample.erpContext);
      setShowErp(true);
    }
    inputRef.current?.focus();
  }

  // Sidebar: only show assistant messages that have triage results
  const ticketMessages = messages.filter((m) => m.role === "user");

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-sm font-bold">
              O
            </div>
            <span className="font-semibold text-slate-100">Orchestrai</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">AP Triage Agent</div>
        </div>

        {/* New ticket button */}
        <div className="px-3 py-3">
          <button
            onClick={handleNewTicket}
            className="w-full bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
          >
            + New Session
          </button>
        </div>

        {/* Sample emails */}
        <div className="px-3 pb-2">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1.5 px-1">
            Samples
          </div>
          <div className="space-y-1">
            {SAMPLE_EMAILS.map((s, i) => (
              <button
                key={i}
                onClick={() => loadSample(s)}
                className="w-full text-left px-2 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors truncate"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ticket history */}
        {ticketMessages.length > 0 && (
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1.5 px-1">
              Tickets
            </div>
            <div className="space-y-1">
              {ticketMessages.map((msg, idx) => {
                // Find the assistant response after this user message
                const assistantMsg = messages.find(
                  (m) =>
                    m.role === "assistant" &&
                    messages.indexOf(m) > messages.indexOf(msg)
                );
                return (
                  <SidebarTicket
                    key={msg.id}
                    msg={assistantMsg ?? msg}
                    index={idx}
                    active={
                      assistantMsg ? activeTicketId === assistantMsg.id : false
                    }
                    onClick={() =>
                      assistantMsg && setActiveTicketId(assistantMsg.id)
                    }
                  />
                );
              })}
            </div>
          </div>
        )}
      </aside>

      {/* ── Main chat area ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900">
          <div>
            <h1 className="font-semibold text-slate-100">Supplier Inbox</h1>
            <p className="text-xs text-slate-500">Paste supplier emails to triage and route</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleNewTicket}
              className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              Clear session
            </button>
          )}
        </header>

        {/* Chat thread */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
              <div className="w-16 h-16 rounded-2xl bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center text-3xl">
                📩
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-200 mb-1">
                  AP Triage Agent
                </h2>
                <p className="text-slate-500 text-sm max-w-md">
                  Paste a supplier email below to classify it, route it to the right team, and
                  generate a professional draft reply with an internal handoff note.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {SAMPLE_EMAILS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => loadSample(s)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-full transition-colors"
                  >
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
                      <pre className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                        {msg.content}
                      </pre>
                    </div>
                    <div className="text-xs text-slate-600 text-right mt-1">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              );
            }

            // Assistant message with triage result
            const ticketNum =
              messages.filter((m, i) => m.role === "assistant" && i <= idx).length;

            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-2xl w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center text-xs font-bold">
                      O
                    </div>
                    <span className="text-xs text-slate-400">Orchestrai</span>
                    <span className="text-xs text-slate-600">{formatTime(msg.timestamp)}</span>
                  </div>
                  {msg.triageResult ? (
                    <TriageCard
                      result={msg.triageResult}
                      onApprove={() => handleApprove(ticketNum)}
                      onRequestEdits={handleRequestEdits}
                    />
                  ) : (
                    <div className="bg-slate-800 rounded-2xl px-4 py-3 text-slate-300 text-sm">
                      {msg.content}
                    </div>
                  )}
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
              <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-2">
                Error: {error}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-slate-800 bg-slate-900 px-4 py-3 space-y-2">
          {/* ERP context toggle */}
          <div>
            <button
              onClick={() => setShowErp(!showErp)}
              className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
            >
              <span>{showErp ? "▼" : "▶"}</span>
              <span>ERP Context (optional)</span>
            </button>
            {showErp && (
              <textarea
                value={erpContext}
                onChange={(e) => setErpContext(e.target.value)}
                placeholder="Paste ERP invoice lookup data here (enables autosend for confirmed statuses)…"
                rows={3}
                className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none font-mono"
              />
            )}
          </div>

          {/* Main input */}
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste supplier email (Subject + Body) or type a follow-up edit request…"
              rows={4}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-600 resize-none leading-relaxed"
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-colors self-end"
            >
              {loading ? (
                <span className="flex items-center gap-1.5 text-sm">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                </span>
              ) : (
                <span className="text-sm">Send</span>
              )}
            </button>
          </div>
          <div className="text-xs text-slate-600">Cmd+Enter to send</div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg z-50 transition-opacity">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
