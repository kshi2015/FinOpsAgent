import { ProactiveAlert } from "./types";
import { MOCK_POS, MOCK_PAYMENT_SCHEDULES, SCANNER_REFERENCE_DATE } from "./mockData";

// Number of days before a scheduled payment to send the supplier notification
const PAYMENT_UPCOMING_WINDOW_DAYS = 7;

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatAmount(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

// ── Scanner: missing invoices ────────────────────────────────────────────────

function scanMissingInvoices(referenceDate: string): ProactiveAlert[] {
  return MOCK_POS
    .filter((po) => !po.invoice_received && po.expected_invoice_by < referenceDate)
    .map((po) => {
      const daysOverdue = daysBetween(po.expected_invoice_by, referenceDate);
      const priority = daysOverdue >= 10 ? "high" : daysOverdue >= 5 ? "normal" : "low";

      const erp_context = [
        `PO Record — ${po.po_number}`,
        `Supplier: ${po.supplier_name}`,
        `PO Amount: ${formatAmount(po.amount)}`,
        `Issued Date: ${po.issued_date}`,
        `Expected Invoice By: ${po.expected_invoice_by}`,
        `Invoice Received: No`,
        `Days Overdue: ${daysOverdue}`,
        `Line Items: ${po.line_items}`,
      ].join("\n");

      return {
        id: `missing-${po.po_number}`,
        type: "missing_invoice" as const,
        priority,
        supplier_name: po.supplier_name,
        po_number: po.po_number,
        invoice_number: "",
        amount: po.amount,
        trigger_date: po.expected_invoice_by,
        days_overdue: daysOverdue,
        details: `Invoice overdue ${daysOverdue}d — ${po.po_number} for ${formatAmount(po.amount)} issued ${po.issued_date}`,
        erp_context,
      };
    });
}

// ── Scanner: upcoming payments ───────────────────────────────────────────────

function scanUpcomingPayments(referenceDate: string): ProactiveAlert[] {
  return MOCK_PAYMENT_SCHEDULES
    .filter((sched) => {
      if (sched.status !== "scheduled" || !sched.scheduled_payment_date) return false;
      const daysUntil = daysBetween(referenceDate, sched.scheduled_payment_date);
      return daysUntil >= 0 && daysUntil <= PAYMENT_UPCOMING_WINDOW_DAYS;
    })
    .map((sched) => {
      const daysUntil = daysBetween(referenceDate, sched.scheduled_payment_date!);
      const priority = daysUntil <= 2 ? "high" : "normal";

      const erp_context = [
        `Payment Schedule — ${sched.invoice_number}`,
        `Supplier: ${sched.supplier_name}`,
        `PO Number: ${sched.po_number}`,
        `Invoice Amount: ${formatAmount(sched.amount)}`,
        `Invoice Date: ${sched.invoice_date}`,
        `Payment Due Date: ${sched.payment_due_date}`,
        `Scheduled Payment Date: ${sched.scheduled_payment_date}`,
        `Days Until Payment: ${daysUntil}`,
        `Status: scheduled`,
      ].join("\n");

      return {
        id: `payment-${sched.invoice_number}`,
        type: "payment_upcoming" as const,
        priority,
        supplier_name: sched.supplier_name,
        po_number: sched.po_number,
        invoice_number: sched.invoice_number,
        amount: sched.amount,
        trigger_date: sched.scheduled_payment_date!,
        days_until_payment: daysUntil,
        details: `Payment in ${daysUntil}d — ${sched.invoice_number} for ${formatAmount(sched.amount)} scheduled ${sched.scheduled_payment_date}`,
        erp_context,
      };
    });
}

// ── Public API ───────────────────────────────────────────────────────────────

export function runProactiveScan(referenceDate?: string): ProactiveAlert[] {
  const date = referenceDate ?? SCANNER_REFERENCE_DATE;

  const alerts: ProactiveAlert[] = [
    ...scanMissingInvoices(date),
    ...scanUpcomingPayments(date),
  ];

  // Sort: high priority first, then by days_overdue desc / days_until_payment asc
  return alerts.sort((a, b) => {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const pa = priorityOrder[a.priority];
    const pb = priorityOrder[b.priority];
    if (pa !== pb) return pa - pb;
    // Within same priority: most urgent first
    if (a.type === "missing_invoice" && b.type === "missing_invoice") {
      return (b.days_overdue ?? 0) - (a.days_overdue ?? 0);
    }
    if (a.type === "payment_upcoming" && b.type === "payment_upcoming") {
      return (a.days_until_payment ?? 99) - (b.days_until_payment ?? 99);
    }
    return 0;
  });
}
