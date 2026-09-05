import { describe, it, expect } from "vitest";
import { GET as getExceptions } from "../../app/api/exceptions/route";
import { GET as getRun } from "../../app/api/reconciliation/runs/[runId]/route";
import { GET as getRunsList } from "../../app/api/reconciliation/runs/route";
import { NextRequest } from "next/server";

describe("Dashboard & Exception Center Consistency", () => {
  it("should ensure Dashboard active run exceptions count strictly matches Exception Center count", async () => {
    // 1. Fetch latest runs as Dashboard does
    const dashReq = new NextRequest("http://localhost:3000/api/reconciliation/runs");
    const dashRes = await getRunsList(dashReq);
    expect(dashRes.status).toBe(200);
    const dashData = await dashRes.json();
    expect(dashData.success).toBe(true);
    expect(dashData.runs.length).toBeGreaterThan(0);

    const activeRun = dashData.runs[0];
    const activeRunId = activeRun.runId;
    const dashboardExceptionCount = activeRun.exceptionCount;

    // 2. Fetch run details via runId route
    const runReq = new NextRequest(`http://localhost:3000/api/reconciliation/runs/${activeRunId}`);
    const runRes = await getRun(runReq, { params: { runId: activeRunId } });
    expect(runRes.status).toBe(200);
    const runDetailData = await runRes.json();
    expect(runDetailData.success).toBe(true);
    expect(runDetailData.run.metrics.exceptionCount).toBe(dashboardExceptionCount);

    // Also specifically test run_1788627754449 if present
    const specificReq = new NextRequest("http://localhost:3000/api/reconciliation/runs/run_1788627754449");
    const specificRes = await getRun(specificReq, { params: { runId: "run_1788627754449" } });
    const specificData = await specificRes.json();
    console.log("specificRes for run_1788627754449:", specificRes.status, specificData.success);
    if (specificRes.status !== 404) {
      expect(specificRes.status).toBe(200);
      expect(specificData.success).toBe(true);
    }

    // 3. Fetch exceptions for this specific runId as /exceptions?runId=... does
    const excReq = new NextRequest(`http://localhost:3000/api/exceptions?runId=${activeRunId}`);
    const excRes = await getExceptions(excReq);
    expect(excRes.status).toBe(200);
    const excData = await excRes.json();
    expect(excData.success).toBe(true);

    // Verify consistency between Dashboard and Exception Center
    expect(excData.exceptions.length).toBe(dashboardExceptionCount);
    expect(excData.stats.totalCount).toBe(dashboardExceptionCount);
    expect(excData.stats.openCount + excData.stats.resolvedCount).toBe(dashboardExceptionCount);
  });

  it("should default to the latest run when /api/exceptions is called without runId", async () => {
    const excReq = new NextRequest("http://localhost:3000/api/exceptions");
    const excRes = await getExceptions(excReq);
    expect(excRes.status).toBe(200);
    const excData = await excRes.json();
    expect(excData.success).toBe(true);
    expect(excData.runId).toBeDefined();
    expect(excData.exceptions.length).toBeGreaterThanOrEqual(0);
    expect(typeof excData.stats.totalMonetaryImpactMinorUnits).toBe("string");
  });

  it("should filter exceptions by severity without BigInt error", async () => {
    const excReq = new NextRequest("http://localhost:3000/api/exceptions?severity=CRITICAL");
    const excRes = await getExceptions(excReq);
    expect(excRes.status).toBe(200);
    const excData = await excRes.json();
    expect(excData.success).toBe(true);
    for (const e of excData.exceptions) {
      expect(e.severity).toBe("CRITICAL");
      expect(typeof e.monetaryImpactMinorUnits).toBe("string");
      if (e.decision) {
        expect(typeof e.decision.varianceMinorUnits).toBe("string");
      }
    }
  });
});
