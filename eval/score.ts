export type EvalExpected = {
  request_type: string;
  route_team: string;
  autosend: boolean;
  mustNot: string[];
};

export type EvalCase = {
  id: string;
  input: {
    subject: string;
    body: string;
    erpContext?: string;
  };
  expected: EvalExpected;
  category?: string;
  difficulty?: string;
};

export type EvalModelOutput = {
  TRIAGE_JSON?: {
    request_type?: string;
    route_team?: string;
    autosend?: boolean;
    justification?: string;
    case_summary?: string;
    internal_priority?: string;
    supplier_name?: string;
    invoice_number?: string;
    po_number?: string;
  };
  DRAFT_REPLY?: {
    subject?: string;
    body?: string;
  };
  INTERNAL_NOTE?: {
    to?: string[];
    body?: string;
  };
};

export type ScoreResult = {
  id: string;
  passed: boolean;
  checks: {
    requestTypeOk: boolean;
    routeTeamOk: boolean;
    autosendOk: boolean;
    mustNotOk: boolean;
  };
  mustNotHits: string[];
};

export function scoreOne(c: EvalCase, out: EvalModelOutput): ScoreResult {
  const t = out.TRIAGE_JSON ?? {};
  const reply = out.DRAFT_REPLY ?? {};
  const note = out.INTERNAL_NOTE ?? {};

  // Flatten all output text for mustNot scanning
  const allText = JSON.stringify(out).toLowerCase();

  const requestTypeOk = t.request_type === c.expected.request_type;
  const routeTeamOk = t.route_team === c.expected.route_team;
  const autosendOk = t.autosend === c.expected.autosend;

  const mustNotHits = c.expected.mustNot.filter((phrase) =>
    allText.includes(phrase.toLowerCase())
  );
  const mustNotOk = mustNotHits.length === 0;

  const passed = requestTypeOk && routeTeamOk && autosendOk && mustNotOk;

  return {
    id: c.id,
    passed,
    checks: { requestTypeOk, routeTeamOk, autosendOk, mustNotOk },
    mustNotHits,
  };
}
