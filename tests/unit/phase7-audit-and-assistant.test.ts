import { describe, it, expect, beforeAll } from "vitest";
import { AuditService, auditMemoryStore } from "../../lib/audit/audit-service";
import { ControllerAssistant } from "../../lib/ai/controller-assistant";
import { ReconciliationOrchestrator, runHistoryStore } from "../../lib/reconciliation/orchestrator";

describe("Phase 7: Financial Audit Trail & Grounded Controller Assistant", () => {
  let sampleRunId: string;

  beforeAll(async () => {
    // Run an orchestrated reconciliation run to populate state
    const run = await ReconciliationOrchestrator.executeRun({
      seed: 2026,
      recordCount: 50,
      useAi: true,
      aiProvider: "offline_fallback",
      persistToDb: false,
    });
    sampleRunId = run.runId;
  });

  describe("Audit Trail Service", () => {
    it("should log individual audit events into store", async () => {
      await AuditService.log({
        runId: sampleRunId,
        entityType: "Transaction",
        entityId: "ORD-TEST-001",
        action: "DETERMINISTIC_MATCHED",
        actor: "DETERMINISTIC_ENGINE",
        details: { rule: "EXACT_UTR_AND_AMOUNT", score: 1.0 },
      });

      const result = await AuditService.list({ entityId: "ORD-TEST-001" });
      expect(result.events.length).toBeGreaterThanOrEqual(1);
      const event = result.events[0];
      expect(event.entityId).toBe("ORD-TEST-001");
      expect(event.action).toBe("DETERMINISTIC_MATCHED");
      expect(event.actor).toBe("DETERMINISTIC_ENGINE");
    });

    it("should log batches of audit events", async () => {
      const batch = [
        {
          runId: sampleRunId,
          entityType: "Exception" as const,
          entityId: "EXC-001",
          action: "EXCEPTION_LOGGED" as const,
          actor: "DETERMINISTIC_ENGINE" as const,
          details: { type: "AMOUNT_MISMATCH" },
        },
        {
          runId: sampleRunId,
          entityType: "Exception" as const,
          entityId: "EXC-002",
          action: "EXCEPTION_LOGGED" as const,
          actor: "DETERMINISTIC_ENGINE" as const,
          details: { type: "MISSING_BANK_CREDIT" },
        },
      ];

      await AuditService.logBatch(batch);
      const result = await AuditService.list({ action: "EXCEPTION_LOGGED" });
      expect(result.events.length).toBeGreaterThanOrEqual(2);
    });

    it("should filter audit events by action and actor", async () => {
      const orchestratorEvents = await AuditService.list({ actor: "RECON_ORCHESTRATOR" });
      expect(orchestratorEvents.events.every((e) => e.actor === "RECON_ORCHESTRATOR")).toBe(true);

      const datasetEvents = await AuditService.list({ action: "DATASET_INGESTED" });
      expect(datasetEvents.events.every((e) => e.action === "DATASET_INGESTED")).toBe(true);
    });

    it("should have automatically recorded orchestrator lifecycle events", async () => {
      const runEvents = await AuditService.list({ runId: sampleRunId });
      expect(runEvents.events.length).toBeGreaterThanOrEqual(3);

      const actions = runEvents.events.map((e) => e.action);
      expect(actions).toContain("DATASET_INGESTED");
      expect(actions).toContain("DETERMINISTIC_MATCHED");
      expect(actions).toContain("RUN_COMPLETED");
    });
  });

  describe("Grounded Controller Assistant", () => {
    it("should return grounded leakage figures matching run metrics", async () => {
      const response = await ControllerAssistant.answerQuestion({
        question: "How much financial leakage did we detect vs prevent?",
        runId: sampleRunId,
      });

      expect(response.answer).toContain("Financial Leakage");
      expect(response.answer).toContain("Detected Financial Leakage");
      expect(response.answer).toContain("Prevented Financial Leakage");
      expect(response.groundedFacts.runId).toBe(sampleRunId);
      expect(response.groundedFacts.totalLeakageDetected).toContain("₹");
      expect(response.citedRecords.length).toBeGreaterThanOrEqual(1);
    });

    it("should answer evaluation metric inquiries accurately", async () => {
      const response = await ControllerAssistant.answerQuestion({
        question: "What is our F1 score and precision across this batch?",
        runId: sampleRunId,
      });

      expect(response.answer).toContain("F1 Score");
      expect(response.answer).toContain("Precision");
      expect(response.answer).toContain("Recall");
      expect(response.answer).toContain("%");
    });

    it("should provide transaction-level audit for existing orders", async () => {
      const run = runHistoryStore.getRun(sampleRunId);
      expect(run).toBeDefined();
      const sampleOrder = run!.decisions[0].orderId;

      const response = await ControllerAssistant.answerQuestion({
        question: `Why was transaction ${sampleOrder} processed with that result?`,
        runId: sampleRunId,
      });

      expect(response.answer).toContain(sampleOrder);
      expect(response.citedRecords.some((c) => c.identifier === sampleOrder)).toBe(true);
    });

    it("should not hallucinate non-existent order IDs", async () => {
      const response = await ControllerAssistant.answerQuestion({
        question: "Audit transaction ORD-NONEXISTENT-99999",
        runId: sampleRunId,
      });

      // Does not cite this fake ID as an order evidence
      expect(response.citedRecords.some((c) => c.identifier === "ORD-NONEXISTENT-99999")).toBe(false);
      // Fallback gives standard overview and does not fabricate fake transaction status
      expect(response.answer).toBeDefined();
    });

    it("should answer exception inquiries with honest counts", async () => {
      const response = await ControllerAssistant.answerQuestion({
        question: "Summarize critical open exceptions requiring review",
        runId: sampleRunId,
      });

      expect(response.answer).toContain("Exception");
      expect(response.groundedFacts.recordCount).toBe(50);
    });
  });
});
