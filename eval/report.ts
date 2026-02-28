import fs from "node:fs";

export type EvalResult = {
  summary: {
    runId: string;
    total: number;
    passRate: number;
    hardFails: number;
    avgLatencyMs: number;
    tokens: { input: number; output: number; total: number };
    costUsd: { input: number; output: number; total: number; perCase: number };
  };
  rows: any[];
};

export function generateReport(result: EvalResult, outPath: string) {
  const { summary, rows } = result;

  const categoryBreakdown: Record<string, { passed: number; total: number }> = {};
  rows.forEach((row) => {
    const cat = row.category || "uncategorized";
    if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { passed: 0, total: 0 };
    categoryBreakdown[cat].total++;
    if (row.score.passed) categoryBreakdown[cat].passed++;
  });

  const checkStats = {
    requestTypeOk: rows.filter((r) => r.score.checks.requestTypeOk).length,
    routeTeamOk: rows.filter((r) => r.score.checks.routeTeamOk).length,
    autosendOk: rows.filter((r) => r.score.checks.autosendOk).length,
    mustNotOk: rows.filter((r) => r.score.checks.mustNotOk).length,
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orchestrai Evaluation Report — ${summary.runId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 2rem; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #065f46 0%, #10b981 100%); color: white; padding: 2rem; border-radius: 8px; margin-bottom: 2rem; }
    .header h1 { font-size: 2rem; margin-bottom: 0.25rem; }
    .header .subtitle { opacity: 0.9; font-size: 0.9rem; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card-title { font-size: 0.875rem; color: #666; margin-bottom: 0.5rem; }
    .card-value { font-size: 2rem; font-weight: bold; color: #333; }
    .card-subtitle { font-size: 0.75rem; color: #999; margin-top: 0.25rem; }
    .pass-rate { color: ${summary.passRate >= 0.75 ? "#10b981" : summary.passRate >= 0.5 ? "#f59e0b" : "#ef4444"}; }
    .section { background: white; padding: 2rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .section-title { font-size: 1.25rem; margin-bottom: 1rem; color: #333; border-bottom: 2px solid #10b981; padding-bottom: 0.5rem; }
    .breakdown-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .breakdown-item { padding: 1rem; background: #f9fafb; border-radius: 6px; }
    .breakdown-item-title { font-weight: 600; margin-bottom: 0.5rem; text-transform: capitalize; }
    .breakdown-bar { height: 24px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin: 0.5rem 0; }
    .breakdown-bar-fill { height: 100%; background: linear-gradient(90deg, #065f46, #10b981); display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .test-case { padding: 1rem; margin-bottom: 1rem; border-radius: 6px; border-left: 4px solid #e5e7eb; }
    .test-case.passed { background: #f0fdf4; border-left-color: #10b981; }
    .test-case.failed { background: #fef2f2; border-left-color: #ef4444; }
    .test-case-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .test-case-id { font-weight: 600; }
    .badge { font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600; }
    .badge-passed { background: #d1fae5; color: #065f46; }
    .badge-failed { background: #fee2e2; color: #991b1b; }
    .test-case-meta { font-size: 0.875rem; color: #666; margin-bottom: 0.25rem; }
    .test-case-checks { display: flex; gap: 1rem; font-size: 0.75rem; margin-top: 0.5rem; }
    .check.ok { color: #10b981; }
    .check.fail { color: #ef4444; }
    .footer { text-align: center; color: #666; font-size: 0.875rem; margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Orchestrai Evaluation Report</h1>
      <div class="subtitle">AP Triage Agent — Run ID: ${summary.runId}</div>
    </div>

    <div class="summary-grid">
      <div class="card">
        <div class="card-title">Pass Rate</div>
        <div class="card-value pass-rate">${(summary.passRate * 100).toFixed(1)}%</div>
        <div class="card-subtitle">${rows.filter((r) => r.score.passed).length}/${summary.total} tests passed</div>
      </div>
      <div class="card">
        <div class="card-title">Hard Failures</div>
        <div class="card-value" style="color: ${summary.hardFails > 0 ? "#ef4444" : "#10b981"};">${summary.hardFails}</div>
        <div class="card-subtitle">Safety violations (mustNot)</div>
      </div>
      <div class="card">
        <div class="card-title">Avg Latency</div>
        <div class="card-value">${summary.avgLatencyMs}ms</div>
        <div class="card-subtitle">Per test case</div>
      </div>
      <div class="card">
        <div class="card-title">Total Cost</div>
        <div class="card-value">$${summary.costUsd.total.toFixed(4)}</div>
        <div class="card-subtitle">$${summary.costUsd.perCase.toFixed(6)}/case</div>
      </div>
      <div class="card">
        <div class="card-title">Total Tokens</div>
        <div class="card-value">${summary.tokens.total.toLocaleString()}</div>
        <div class="card-subtitle">${summary.tokens.input.toLocaleString()} in / ${summary.tokens.output.toLocaleString()} out</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Performance by Category</h2>
      <div class="breakdown-grid">
        ${Object.entries(categoryBreakdown).map(([cat, stats]) => `
          <div class="breakdown-item">
            <div class="breakdown-item-title">${cat}</div>
            <div class="breakdown-bar">
              <div class="breakdown-bar-fill" style="width: ${(stats.passed / stats.total) * 100}%">
                ${stats.passed}/${stats.total}
              </div>
            </div>
            <div style="font-size:0.75rem;color:#666;">${((stats.passed / stats.total) * 100).toFixed(1)}%</div>
          </div>`).join("")}
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Check Statistics</h2>
      <table>
        <thead>
          <tr><th>Check</th><th>Passed</th><th>Pass Rate</th></tr>
        </thead>
        <tbody>
          <tr><td>Request Type</td><td>${checkStats.requestTypeOk}/${summary.total}</td><td>${((checkStats.requestTypeOk / summary.total) * 100).toFixed(1)}%</td></tr>
          <tr><td>Route Team</td><td>${checkStats.routeTeamOk}/${summary.total}</td><td>${((checkStats.routeTeamOk / summary.total) * 100).toFixed(1)}%</td></tr>
          <tr><td>Autosend Decision</td><td>${checkStats.autosendOk}/${summary.total}</td><td>${((checkStats.autosendOk / summary.total) * 100).toFixed(1)}%</td></tr>
          <tr><td>Safety Constraints</td><td>${checkStats.mustNotOk}/${summary.total}</td><td>${((checkStats.mustNotOk / summary.total) * 100).toFixed(1)}%</td></tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">Test Results</h2>
      ${rows.map((row) => `
        <div class="test-case ${row.score.passed ? "passed" : "failed"}">
          <div class="test-case-header">
            <span class="test-case-id">${row.id}</span>
            <span class="badge ${row.score.passed ? "badge-passed" : "badge-failed"}">${row.score.passed ? "✓ PASSED" : "✗ FAILED"}</span>
          </div>
          <div class="test-case-meta"><strong>Subject:</strong> ${row.input.subject}</div>
          <div class="test-case-meta"><strong>Category:</strong> ${row.category || "—"} | <strong>Difficulty:</strong> ${row.difficulty || "—"} | <strong>Latency:</strong> ${row.metrics.latencyMs}ms</div>
          <div class="test-case-meta"><strong>Expected:</strong> ${row.expected.request_type} → ${row.expected.route_team} (autosend: ${row.expected.autosend})</div>
          <div class="test-case-meta"><strong>Got:</strong> ${row.output?.TRIAGE_JSON?.request_type || "?"} → ${row.output?.TRIAGE_JSON?.route_team || "?"} (autosend: ${row.output?.TRIAGE_JSON?.autosend})</div>
          <div class="test-case-checks">
            <span class="check ${row.score.checks.requestTypeOk ? "ok" : "fail"}">${row.score.checks.requestTypeOk ? "✓" : "✗"} RequestType</span>
            <span class="check ${row.score.checks.routeTeamOk ? "ok" : "fail"}">${row.score.checks.routeTeamOk ? "✓" : "✗"} RouteTeam</span>
            <span class="check ${row.score.checks.autosendOk ? "ok" : "fail"}">${row.score.checks.autosendOk ? "✓" : "✗"} Autosend</span>
            <span class="check ${row.score.checks.mustNotOk ? "ok" : "fail"}">${row.score.checks.mustNotOk ? "✓" : "✗"} Safety</span>
          </div>
          ${!row.score.passed && row.score.mustNotHits?.length > 0
            ? `<div style="margin-top:0.5rem;font-size:0.875rem;color:#ef4444;font-weight:600;">⚠️ Safety violation: ${row.score.mustNotHits.join(", ")}</div>`
            : ""}
        </div>`).join("")}
    </div>

    <div class="footer">
      Generated by Orchestrai Evaluation Harness — ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>`;

  const reportPath = outPath.replace(".json", ".html");
  fs.writeFileSync(reportPath, html, "utf8");
  console.log("HTML report:", reportPath);
}
