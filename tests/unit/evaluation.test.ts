import { describe, it, expect } from "vitest";
import { ObjectiveEvaluator, EvaluationOptions } from "../../lib/evaluation/evaluator";
import { SyntheticDataGenerator } from "../../lib/generator/synthetic-generator";
import { DeterministicReconciliationEngine, ReconciliationResultItem } from "../../lib/reconciliation/deterministic-engine";
import { RawGroundTruth } from "../../lib/generator/types";
import { DecisionState, ExceptionType, Severity } from "@prisma/client";

describe("ObjectiveEvaluator & Financial Leakage Engine", () => {
  it("should compute perfect precision, recall, and F1 on a clean synthetic batch", () => {
    const decisions: ReconciliationResultItem[] = [
      {
        orderId: "ORD-101",
        state: DecisionState.MATCHED,
        method: "DETERMINISTIC_EXACT",
        confidence: 1.0,
        varianceMinorUnits: 0n,
        explanation: "Clean match",
        evidenceItems: [],
        exceptions: [],
        candidates: [],
        requiresAiInvestigation: false,
        bankRecord: {
          id: "bk_1",
          utrReference: "UTRBK202608000101",
          accountNumberMasked: "XXXXXX1234",
          rawDescription: "CMS/UTRBK202608000101",
          creditAmountMinorUnits: 100000n,
          currency: "INR",
          valueDate: new Date("2026-08-02"),
          bookingDate: new Date("2026-08-02"),
          isBatched: false,
          batchCount: 1,
        },
      },
    ];

    const groundTruths: RawGroundTruth[] = [
      {
        id: "gt_101",
        orderId: "ORD-101",
        expectedStatus: DecisionState.MATCHED,
        expectedCategory: "EXACT_MATCH",
        matchedBankUtr: "UTRBK202608000101",
        supportingEventIds: [],
        unexplainedVarianceMinorUnits: 0n,
        expectedExplanation: "Exact 1-to-1 match",
      },
    ];

    const result = ObjectiveEvaluator.evaluate({
      decisions,
      groundTruths,
      totalProcessingTimeMs: 50,
      deterministicDurationMs: 50,
      throughputPerSecond: 20,
    });

    expect(result.precision).toBe(1.0);
    expect(result.recall).toBe(1.0);
    expect(result.f1Score).toBe(1.0);
    expect(result.falseAutoResolutionRate).toBe(0.0);
    expect(result.correctDecisions).toBe(1);
    expect(result.falsePositives).toBe(0);
    expect(result.falseNegatives).toBe(0);
  });

  it("should detect false auto-resolutions when engine matches wrong bank records", () => {
    // Deliberate wrong match: Ground truth expected UTR-A, engine matched UTR-B
    const decisions: ReconciliationResultItem[] = [
      {
        orderId: "ORD-TRAP-1",
        state: DecisionState.MATCHED,
        method: "DETERMINISTIC_EXACT",
        confidence: 1.0,
        varianceMinorUnits: 0n,
        explanation: "Falsely matched trap",
        evidenceItems: [],
        exceptions: [],
        candidates: [],
        requiresAiInvestigation: false,
        bankRecord: {
          id: "bk_wrong",
          utrReference: "UTRBK202608999999", // WRONG UTR!
          accountNumberMasked: "XXXXXX1234",
          rawDescription: "CMS/WRONG",
          creditAmountMinorUnits: 100000n,
          currency: "INR",
          valueDate: new Date("2026-08-02"),
          bookingDate: new Date("2026-08-02"),
          isBatched: false,
          batchCount: 1,
        },
      },
    ];

    const groundTruths: RawGroundTruth[] = [
      {
        id: "gt_trap_1",
        orderId: "ORD-TRAP-1",
        expectedStatus: DecisionState.MATCHED,
        expectedCategory: "EXACT_MATCH",
        matchedBankUtr: "UTRBK202608000101", // EXPECTED UTR
        supportingEventIds: [],
        unexplainedVarianceMinorUnits: 0n,
        expectedExplanation: "Expected UTRBK202608000101",
      },
    ];

    const result = ObjectiveEvaluator.evaluate({
      decisions,
      groundTruths,
    });

    expect(result.falsePositives).toBe(1);
    expect(result.correctDecisions).toBe(0);
    expect(result.precision).toBe(0.0);
    expect(result.falseAutoResolutionRate).toBe(1.0); // 100% of auto-resolved were false positives
  });

  it("should accurately track false auto-resolution rate when a trap is incorrectly auto-resolved", () => {
    const decisions: ReconciliationResultItem[] = [
      {
        orderId: "ORD-TRAP-2",
        state: DecisionState.RESOLVED, // Erroneously resolved a trap
        method: "MOCK_BAD_RESOLVER",
        confidence: 0.9,
        varianceMinorUnits: 0n,
        explanation: "Falsely resolved trap",
        evidenceItems: [],
        exceptions: [],
        candidates: [],
        requiresAiInvestigation: false,
      },
    ];

    const groundTruths: RawGroundTruth[] = [
      {
        id: "gt_trap_2",
        orderId: "ORD-TRAP-2",
        expectedStatus: DecisionState.CONFLICT, // Ground truth was CONFLICT
        expectedCategory: "FALSE_MATCH_TRAP",
        supportingEventIds: [],
        unexplainedVarianceMinorUnits: 0n,
        expectedExplanation: "Adversarial trap",
      },
    ];

    const result = ObjectiveEvaluator.evaluate({
      decisions,
      groundTruths,
    });

    expect(result.falsePositives).toBe(1);
    expect(result.falseAutoResolutionRate).toBe(1.0);
    expect(result.adversarialRobustnessRate).toBe(0.0); // 0% traps blocked
  });

  it("should compute exact financial leakage breakdown (MDR overcharge, duplicate, missing settlement)", () => {
    const decisions: ReconciliationResultItem[] = [
      {
        orderId: "ORD-EXC-1",
        state: DecisionState.REVIEW,
        method: "DETERMINISTIC_FEE_CHECK",
        confidence: 0.8,
        varianceMinorUnits: 4520n, // ₹45.20
        explanation: "Fee overcharge detected",
        evidenceItems: [],
        exceptions: [
          {
            exceptionType: ExceptionType.FEE_DISCREPANCY,
            severity: Severity.HIGH,
            monetaryImpactMinorUnits: 4520n,
            orderId: "ORD-EXC-1",
            title: "MDR Fee Overcharge",
            description: "Gateway charged 2.5% instead of contracted 1.8%",
            recommendedAction: "Claim refund from gateway",
          },
        ],
        candidates: [],
        requiresAiInvestigation: false,
      },
      {
        orderId: "ORD-EXC-2",
        state: DecisionState.DUPLICATE,
        method: "DETERMINISTIC_DUPLICATE_CHECK",
        confidence: 1.0,
        varianceMinorUnits: 250000n, // ₹2,500.00
        explanation: "Duplicate payment captured",
        evidenceItems: [],
        exceptions: [
          {
            exceptionType: ExceptionType.DUPLICATE_PAYMENT,
            severity: Severity.CRITICAL,
            monetaryImpactMinorUnits: 250000n,
            orderId: "ORD-EXC-2",
            title: "Duplicate Payment Detected",
            description: "Double capture on same order",
            recommendedAction: "Initiate customer refund or hold fulfillment",
          },
        ],
        candidates: [],
        requiresAiInvestigation: false,
      },
      {
        orderId: "ORD-EXC-3",
        state: DecisionState.CONFLICT,
        method: "DETERMINISTIC_TRAP_QUARANTINE",
        confidence: 1.0,
        varianceMinorUnits: 0n,
        explanation: "Adversarial trap quarantined",
        gatewayRecord: {
          id: "gw_trap",
          orderId: "ORD-EXC-3",
          transactionId: "pay_trap",
          grossAmountMinorUnits: 1500000n, // ₹15,000.00
          feeMinorUnits: 30000n,
          taxMinorUnits: 5400n,
          netAmountMinorUnits: 1464600n,
          currency: "INR",
          paymentStatus: "CAPTURED",
          paymentMethod: "UPI",
          transactionTime: new Date("2026-08-01"),
        },
        evidenceItems: [],
        exceptions: [],
        candidates: [],
        requiresAiInvestigation: false,
      },
    ];

    const groundTruths: RawGroundTruth[] = [
      {
        id: "gt_exc_1",
        orderId: "ORD-EXC-1",
        expectedStatus: DecisionState.REVIEW,
        expectedCategory: "FEE_DISCREPANCY",
        supportingEventIds: [],
        unexplainedVarianceMinorUnits: 4520n,
        expectedExplanation: "Fee discrepancy",
      },
      {
        id: "gt_exc_2",
        orderId: "ORD-EXC-2",
        expectedStatus: DecisionState.DUPLICATE,
        expectedCategory: "DUPLICATE_PAYMENT",
        supportingEventIds: [],
        unexplainedVarianceMinorUnits: 250000n,
        expectedExplanation: "Duplicate payment",
      },
      {
        id: "gt_exc_3",
        orderId: "ORD-EXC-3",
        expectedStatus: DecisionState.CONFLICT,
        expectedCategory: "FALSE_MATCH_TRAP",
        supportingEventIds: [],
        unexplainedVarianceMinorUnits: 0n,
        expectedExplanation: "Trap",
      },
    ];

    const result = ObjectiveEvaluator.evaluate({
      decisions,
      groundTruths,
    });

    // Detected leakage: ₹45.20 (MDR) + ₹2,500.00 (Duplicate) = 254520 paise
    expect(result.detectedLeakageMinorUnits).toBe(254520n);
    expect(result.leakageBreakdown.MDR_OVERCHARGE.count).toBe(1);
    expect(result.leakageBreakdown.MDR_OVERCHARGE.monetaryMinorUnits).toBe(4520n);
    expect(result.leakageBreakdown.DUPLICATE_PAYMENT.count).toBe(1);
    expect(result.leakageBreakdown.DUPLICATE_PAYMENT.monetaryMinorUnits).toBe(250000n);

    // Prevented leakage: Duplicate (₹2,500) + Quarantined Trap (₹15,000) = ₹17,500 (1750000 paise)
    expect(result.preventedLeakageMinorUnits).toBe(1750000n);

    // Adversarial trap robustness: 100%
    expect(result.adversarialRobustnessRate).toBe(1.0);
  });

  it("should evaluate a full 500-record synthetic batch through the deterministic engine", () => {
    // Generate 500 records with fixed seed 2026
    const generator = new SyntheticDataGenerator({ seed: 2026, recordCount: 500 });
    const dataset = generator.generate();

    // Reconcile via deterministic engine
    const batchResult = DeterministicReconciliationEngine.reconcileBatch(
      dataset.datasetId,
      dataset.gatewayRecords,
      dataset.bankRecords,
      dataset.ledgerRecords,
      dataset.supportingEvents
    );

    // Evaluate against isolated ground truth
    const evaluation = ObjectiveEvaluator.evaluate({
      runId: batchResult.runId,
      decisions: batchResult.decisions,
      groundTruths: dataset.groundTruths,
      totalProcessingTimeMs: batchResult.durationMs,
      deterministicDurationMs: batchResult.durationMs,
      aiDurationMs: 0,
      throughputPerSecond: batchResult.throughputPerSecond,
    });

    // Verify key financial integrity invariants:
    // 1. High precision (clean matches must be truly clean)
    expect(evaluation.precision).toBeGreaterThanOrEqual(0.95);

    // 2. False Auto-Resolution Rate must be near zero / well below 1%
    expect(evaluation.falseAutoResolutionRate).toBeLessThan(0.01);

    // 3. Adversarial trap robustness: Traps must not be auto-resolved
    expect(evaluation.adversarialRobustnessRate).toBeGreaterThanOrEqual(0.95);

    // 4. Financial leakage must be detected
    expect(evaluation.detectedLeakageMinorUnits).toBeGreaterThan(0n);
    expect(evaluation.preventedLeakageMinorUnits).toBeGreaterThan(0n);

    // 5. Total cases evaluated matches ground truth count
    expect(evaluation.totalGroundTruthCases).toBe(dataset.groundTruths.length);

    // 6. Confusion matrix contains values
    expect(evaluation.confusionMatrix.matrix[DecisionState.MATCHED][DecisionState.MATCHED]).toBeGreaterThan(0);
  });
});
