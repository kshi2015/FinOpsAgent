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
