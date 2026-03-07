import { MockPO, MockPaymentSchedule } from "./types";

// Reference date for scanner ("today" in the demo)
// Using 2025-02-05 so that:
//   - POs with expected_invoice_by before 2025-02-05 and no invoice → overdue
//   - Payments scheduled within 7 days (≤ 2025-02-12) → upcoming alerts
export const SCANNER_REFERENCE_DATE = "2025-02-05";

// ── Purchase Orders ──────────────────────────────────────────────────────────

export const MOCK_POS: MockPO[] = [
  {
    po_number: "PO-98765",
    supplier_name: "Acme Audio LLC",
    amount: 15000,
    issued_date: "2025-01-05",
    expected_invoice_by: "2025-01-20",
    invoice_received: true,
    invoice_number: "INV-12345",
    line_items: "AV display panels x10 @ $1,500/ea",
  },
  {
    // Missing invoice — 6 days overdue as of 2025-02-05
    po_number: "PO-11223",
    supplier_name: "Bolt Electronics",
    amount: 3500,
    issued_date: "2025-01-15",
    expected_invoice_by: "2025-01-30",
    invoice_received: false,
    invoice_number: null,
    line_items: "HDMI cable assemblies x50 @ $70/ea",
  },
  {
    // Missing invoice — 4 days overdue as of 2025-02-05
    po_number: "PO-77341",
    supplier_name: "Vertex Audio Systems",
    amount: 22000,
    issued_date: "2025-01-18",
    expected_invoice_by: "2025-02-01",
    invoice_received: false,
    invoice_number: null,
    line_items: "Amplifier units x4 @ $5,500/ea",
  },
  {
    // Received — no alert needed
    po_number: "PO-44556",
    supplier_name: "Globex Components",
    amount: 8200,
    issued_date: "2025-01-25",
    expected_invoice_by: "2025-02-10",
    invoice_received: true,
    invoice_number: "INV-55501",
    line_items: "Signal converters x20 @ $410/ea",
  },
  {
    // Future — not yet due, no alert
    po_number: "PO-30012",
    supplier_name: "Apex Cables Inc",
    amount: 4800,
    issued_date: "2025-01-28",
    expected_invoice_by: "2025-02-15",
    invoice_received: false,
    invoice_number: null,
    line_items: "Cat6 cable bundles x200 @ $24/ea",
  },
];

// ── Payment Schedules ────────────────────────────────────────────────────────

export const MOCK_PAYMENT_SCHEDULES: MockPaymentSchedule[] = [
  {
    // Payment in 3 days — upcoming alert
    invoice_number: "INV-12345",
    supplier_name: "Acme Audio LLC",
    po_number: "PO-98765",
    amount: 15000,
    invoice_date: "2025-01-10",
    payment_due_date: "2025-02-10",
    scheduled_payment_date: "2025-02-08",
    status: "scheduled",
  },
  {
    // Payment in 13 days — outside 7-day window, no alert
    invoice_number: "INV-67890",
    supplier_name: "Bolt Electronics",
    po_number: "PO-11223",
    amount: 3500,
    invoice_date: "2025-01-20",
    payment_due_date: "2025-02-20",
    scheduled_payment_date: "2025-02-18",
    status: "scheduled",
  },
  {
    // Payment in 7 days — exactly on threshold, alert triggered
    invoice_number: "INV-88102",
    supplier_name: "Vertex Audio Systems",
    po_number: "PO-77341",
    amount: 22000,
    invoice_date: "2025-01-22",
    payment_due_date: "2025-02-12",
    scheduled_payment_date: "2025-02-12",
    status: "scheduled",
  },
  {
    // Pending approval — not scheduled yet, no payment alert
    invoice_number: "INV-55501",
    supplier_name: "Globex Components",
    po_number: "PO-44556",
    amount: 8200,
    invoice_date: "2025-01-28",
    payment_due_date: "2025-02-28",
    scheduled_payment_date: null,
    status: "pending_approval",
  },
  {
    // Already paid — no alert
    invoice_number: "INV-00441",
    supplier_name: "Apex Cables Inc",
    po_number: "PO-30012",
    amount: 4800,
    invoice_date: "2025-01-08",
    payment_due_date: "2025-02-08",
    scheduled_payment_date: "2025-02-05",
    status: "paid",
  },
];
