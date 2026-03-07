export type RequestType =
  | "invoice_received_check"
  | "payment_status"
  | "missing_invoice"
  | "reconciliation"
  | "technical_upload_issue"
  | "legal_terms"
  | "other"
  | "spam";

export type RouteTeam =
  | "AP"
  | "SupplierOnboarding"
  | "IT"
  | "SupplyChain"
  | "Legal"
  | "Unknown";

export type InternalPriority = "low" | "normal" | "high";

export interface TriageJSON {
  request_type: RequestType;
  supplier_name: string;
  invoice_number: string;
  po_number: string;
  route_team: RouteTeam;
  autosend: boolean;
  missing_info: string[];
  supporting_docs: string[];
  justification: string;
  loop_in_contacts: string[];
  internal_request: string[];
  internal_priority: InternalPriority;
  case_summary: string;
}

export interface DraftReply {
  subject: string;
  body: string;
}

export interface InternalNote {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

export interface TriageResponse {
  TRIAGE_JSON: TriageJSON;
  DRAFT_REPLY: DraftReply;
  INTERNAL_NOTE: InternalNote;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  triageResult?: TriageResponse;
  timestamp: Date;
}

// ── Proactive Types ──────────────────────────────────────────────────────────

export type ProactiveAlertType = "missing_invoice" | "payment_upcoming";

export interface ProactiveAlert {
  id: string;
  type: ProactiveAlertType;
  priority: InternalPriority;
  supplier_name: string;
  po_number: string;
  invoice_number: string;
  amount: number;
  trigger_date: string;        // date that triggered the alert
  days_overdue?: number;       // missing_invoice: days past expected_invoice_by
  days_until_payment?: number; // payment_upcoming: days until scheduled_payment
  details: string;             // human-readable one-liner for the UI card
  erp_context: string;         // formatted context string to pass to the LLM
}

export interface ProactiveDraft {
  subject: string;
  body: string;
}

export interface ProactiveResponse {
  PROACTIVE_DRAFT: ProactiveDraft;
  INTERNAL_NOTE: InternalNote;
  alert_summary: string;
  recommended_action: "send" | "review";
}

// ── Mock Data Types ──────────────────────────────────────────────────────────

export interface MockPO {
  po_number: string;
  supplier_name: string;
  amount: number;
  issued_date: string;
  expected_invoice_by: string;
  invoice_received: boolean;
  invoice_number: string | null;
  line_items: string;
}

export interface MockPaymentSchedule {
  invoice_number: string;
  supplier_name: string;
  po_number: string;
  amount: number;
  invoice_date: string;
  payment_due_date: string;
  scheduled_payment_date: string | null;
  status: "scheduled" | "pending_approval" | "paid" | "overdue";
}
