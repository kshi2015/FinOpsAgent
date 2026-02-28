interface MockInvoice {
  invoice_number: string;
  supplier_name: string;
  po_number: string;
  amount: number;
  status: "received" | "scheduled" | "pending_approval" | "rejected" | "paid";
  received_date: string | null;
  payment_due: string | null;
  scheduled_payment: string | null;
  notes?: string;
}

const MOCK_INVOICES: MockInvoice[] = [
  {
    invoice_number: "INV-12345",
    supplier_name: "Acme Audio LLC",
    po_number: "PO-98765",
    amount: 15000,
    status: "scheduled",
    received_date: "2025-01-10",
    payment_due: "2025-02-10",
    scheduled_payment: "2025-02-08",
    notes: "Net-30 terms. Invoice matched to PO-98765, 3-way match complete.",
  },
  {
    invoice_number: "INV-67890",
    supplier_name: "Bolt Electronics",
    po_number: "PO-11223",
    amount: 3500,
    status: "received",
    received_date: "2025-01-20",
    payment_due: "2025-02-20",
    scheduled_payment: "2025-02-18",
    notes: "Invoice received and logged. Pending final approval.",
  },
  {
    invoice_number: "INV-55501",
    supplier_name: "Globex Components",
    po_number: "PO-44556",
    amount: 8200,
    status: "pending_approval",
    received_date: "2025-01-28",
    payment_due: "2025-02-28",
    scheduled_payment: null,
    notes: "Awaiting department head approval. Budget variance of $200 flagged.",
  },
  {
    invoice_number: "INV-99001",
    supplier_name: "Apex Cables Inc",
    po_number: "",
    amount: 1200,
    status: "rejected",
    received_date: null,
    payment_due: null,
    scheduled_payment: null,
    notes: "Rejected: no matching PO found. Supplier must resubmit with valid PO number.",
  },
];

export function lookupInvoice(invoiceNumber: string): MockInvoice | null {
  return (
    MOCK_INVOICES.find(
      (inv) => inv.invoice_number.toLowerCase() === invoiceNumber.toLowerCase()
    ) ?? null
  );
}

export function formatErpSnippet(invoiceNumber: string): string {
  const inv = lookupInvoice(invoiceNumber);
  if (!inv) {
    return `ERP LOOKUP: No record found for invoice number ${invoiceNumber}.`;
  }
  const lines = [
    `ERP LOOKUP — Invoice ${inv.invoice_number}`,
    `Supplier: ${inv.supplier_name}`,
    `PO Number: ${inv.po_number || "N/A"}`,
    `Amount: $${inv.amount.toLocaleString()}`,
    `Status: ${inv.status}`,
    inv.received_date ? `Received Date: ${inv.received_date}` : "Received Date: Not yet received",
    inv.payment_due ? `Payment Due: ${inv.payment_due}` : "Payment Due: N/A",
    inv.scheduled_payment
      ? `Scheduled Payment: ${inv.scheduled_payment}`
      : "Scheduled Payment: Not yet scheduled",
    inv.notes ? `Notes: ${inv.notes}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}
