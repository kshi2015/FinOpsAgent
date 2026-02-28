import fs from "node:fs";
import path from "node:path";

export type BaselineData = {
  runId: string;
  passRate: number;
  avgLatencyMs: number;
  costPerCase: number;
  categoryBreakdown: Record<string, { passRate: number }>;
  checkStats: {
    requestTypeOk: number;
    routeTeamOk: number;
    autosendOk: number;
    mustNotOk: number;
  };
};

export function saveBaseline(resultData: any, baselineDir: string) {
  const { summary, rows } = resultData;

  const categoryBreakdown: Record<string, { passed: number; total: number }> = {};
  rows.forEach((row: any) => {
    const category = row.category || "uncategorized";
    if (!categoryBreakdown[category]) {
      categoryBreakdown[category] = { passed: 0, total: 0 };
    }
    categoryBreakdown[category].total++;
    if (row.score.passed) categoryBreakdown[category].passed++;
  });

  const baseline: BaselineData = {
    runId: summary.runId,
    passRate: summary.passRate,
    avgLatencyMs: summary.avgLatencyMs,
    costPerCase: summary.costUsd.perCase,
    categoryBreakdown: Object.fromEntries(
      Object.entries(categoryBreakdown).map(([cat, stats]) => [
        cat,
        { passRate: (stats as any).passed / (stats as any).total },
      ])
    ),
    checkStats: {
      requestTypeOk: rows.filter((r: any) => r.score.checks.requestTypeOk).length,
      routeTeamOk: rows.filter((r: any) => r.score.checks.routeTeamOk).length,
      autosendOk: rows.filter((r: any) => r.score.checks.autosendOk).length,
      mustNotOk: rows.filter((r: any) => r.score.checks.mustNotOk).length,
    },
  };

  fs.mkdirSync(baselineDir, { recursive: true });
  const baselinePath = path.join(baselineDir, "baseline.json");
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), "utf8");
  console.log("Baseline saved:", baselinePath);
  return baseline;
}

export function loadBaseline(baselineDir: string): BaselineData | null {
  const baselinePath = path.join(baselineDir, "baseline.json");
  if (!fs.existsSync(baselinePath)) return null;
  return JSON.parse(fs.readFileSync(baselinePath, "utf8"));
}

export function compareToBaseline(current: BaselineData, baseline: BaselineData | null) {
  if (!baseline) {
    console.log("\n⚠️  No baseline found. Run with --save-baseline to create one.");
    return null;
  }

  console.log("\n📊 Baseline Comparison");
  console.log("━".repeat(60));
  console.log(`Baseline: ${baseline.runId}`);
  console.log(`Current:  ${current.runId}`);
  console.log();

  const passRateDelta = current.passRate - baseline.passRate;
  const latencyDelta = current.avgLatencyMs - baseline.avgLatencyMs;
  const costDelta = current.costPerCase - baseline.costPerCase;

  const fmt = (delta: number, suffix = "", invert = false) => {
    const sign = delta > 0 ? "+" : "";
    const color = invert
      ? delta < 0 ? "🟢" : "🔴"
      : delta > 0 ? "🟢" : "🔴";
    return `${color} ${sign}${delta.toFixed(4)}${suffix}`;
  };

  console.log(`Pass Rate:   ${(baseline.passRate * 100).toFixed(1)}% → ${(current.passRate * 100).toFixed(1)}% ${fmt(passRateDelta * 100, "%")}`);
  console.log(`Avg Latency: ${baseline.avgLatencyMs}ms → ${current.avgLatencyMs}ms ${fmt(latencyDelta, "ms", true)}`);
  console.log(`Cost/Case:   $${baseline.costPerCase.toFixed(6)} → $${current.costPerCase.toFixed(6)} ${fmt(costDelta, "", true)}`);

  const regressions: string[] = [];
  if (passRateDelta < -0.05) regressions.push(`Pass rate dropped by ${(Math.abs(passRateDelta) * 100).toFixed(1)}%`);
  if (latencyDelta > baseline.avgLatencyMs * 0.2) regressions.push("Latency increased by >20%");
  if (costDelta > baseline.costPerCase * 0.2) regressions.push("Cost increased by >20%");

  if (regressions.length > 0) {
    console.log("\n⚠️  REGRESSIONS DETECTED:");
    regressions.forEach((r) => console.log(`   - ${r}`));
  } else {
    console.log("\n✅ No regressions detected");
  }

  console.log("━".repeat(60));
  return { passRateDelta, latencyDelta, costDelta };
}
