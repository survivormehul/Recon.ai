import { describe, it, expect } from "vitest";
import { NormalizationEngine } from "../../lib/reconciliation/normalization";
import { CandidateMatcher } from "../../lib/reconciliation/candidate-matcher";
import { DeterministicReconciliationEngine } from "../../lib/reconciliation/deterministic-engine";
import { SyntheticDataGenerator } from "../../lib/generator/synthetic-generator";

describe("Normalization Engine", () => {
  it("normalizes diverse banking prefixes and whitespace", () => {
    const rawUtr = "  CMS/UTRBK202608000123  ";
    const norm = NormalizationEngine.normalizeReference(rawUtr);
    expect(norm.clean).toBe("UTRBK202608000123");
    expect(norm.raw).toBe(rawUtr);
    expect(norm.strippedPrefixes.length).toBeGreaterThan(0);
  });

  it("identifies equivalent references despite case and punctuation differences", () => {
    expect(
      NormalizationEngine.areReferencesEquivalent("CMS-utrbk2026-0800-123", "NEFT/UTRBK20260800123")
    ).toBe(true);

    expect(
      NormalizationEngine.areReferencesEquivalent("UTRBK100", "UTRBK200")
    ).toBe(false);
  });

  it("calculates string similarity correctly with Jaro-Winkler", () => {
    expect(NormalizationEngine.stringSimilarity("UTRBK123456", "UTRBK123456")).toBe(1.0);
    expect(NormalizationEngine.stringSimilarity("UTRBK123456", "UTRBK123999")).toBeGreaterThan(0.7);
    expect(NormalizationEngine.stringSimilarity("AAAAAA", "ZZZZZZ")).toBe(0.0);
  });

  it("validates settlement window compatibility", () => {
    const txnDate = new Date("2026-08-01T10:00:00Z");
    const validSettleDate = new Date("2026-08-03T14:00:00Z"); // T+2
    const lateSettleDate = new Date("2026-08-10T10:00:00Z"); // T+9
    const invalidPriorDate = new Date("2026-07-25T10:00:00Z"); // Before txn

    expect(NormalizationEngine.isWithinSettlementWindow(txnDate, validSettleDate, 4)).toBe(true);
    expect(NormalizationEngine.isWithinSettlementWindow(txnDate, lateSettleDate, 4)).toBe(false);
    expect(NormalizationEngine.isWithinSettlementWindow(txnDate, invalidPriorDate, 4)).toBe(false);
  });
});

describe("Deterministic Reconciliation Engine", () => {
  it("reconciles a full 500-record synthetic batch deterministically", () => {
    const generator = new SyntheticDataGenerator({ seed: 2026, recordCount: 500 });
    const dataset = generator.generate();

    const result = DeterministicReconciliationEngine.reconcileBatch(
      dataset.datasetId,
      dataset.gatewayRecords,
      dataset.bankRecords,
      dataset.ledgerRecords,
      dataset.supportingEvents
    );

    expect(result.totalRecordsProcessed).toBeGreaterThanOrEqual(500);
    expect(result.matchedCount).toBeGreaterThan(250); // Majority are exact/batched matches
    expect(result.resolvedCount).toBeGreaterThan(20); // Refunds/chargebacks/fees
    expect(result.duplicateCount).toBeGreaterThan(0); // Duplicates identified
    expect(result.missingCount).toBeGreaterThan(0); // Missing bank credits caught
    expect(result.throughputPerSecond).toBeGreaterThan(100); // Fast deterministic execution
    expect(result.reconciledValueMinorUnits).toBeGreaterThan(0n);
  });

  it("correctly aggregates many-to-one batched bank settlements", () => {
    const generator = new SyntheticDataGenerator({ seed: 2026, recordCount: 500 });
    const dataset = generator.generate();

    const result = DeterministicReconciliationEngine.reconcileBatch(
      dataset.datasetId,
      dataset.gatewayRecords,
      dataset.bankRecords,
      dataset.ledgerRecords,
      dataset.supportingEvents
    );

    const batchedDecisions = result.decisions.filter(
      (d) => d.method === "DETERMINISTIC_BATCH_SETTLEMENT"
    );
    expect(batchedDecisions.length).toBeGreaterThan(0);

    for (const d of batchedDecisions) {
      expect(d.state).toBe("MATCHED");
      expect(d.varianceMinorUnits).toBe(0n);
      expect(d.evidenceItems[0].evidenceType).toBe("BATCH_PAYOUT_MATCH");
    }
  });

  it("detects and flags duplicate payments without false matching", () => {
    const generator = new SyntheticDataGenerator({ seed: 2026, recordCount: 500 });
    const dataset = generator.generate();

    const result = DeterministicReconciliationEngine.reconcileBatch(
      dataset.datasetId,
      dataset.gatewayRecords,
      dataset.bankRecords,
      dataset.ledgerRecords,
      dataset.supportingEvents
    );

    const duplicates = result.decisions.filter((d) => d.state === "DUPLICATE");
    expect(duplicates.length).toBeGreaterThan(0);

    for (const dup of duplicates) {
      expect(dup.exceptions[0].exceptionType).toBe("DUPLICATE_PAYMENT");
      expect(dup.exceptions[0].severity).toBe("HIGH");
      expect(dup.varianceMinorUnits).toBeGreaterThan(0n);
    }
  });

  it("defends against adversarial false-match traps", () => {
    const generator = new SyntheticDataGenerator({ seed: 2026, recordCount: 500 });
    const dataset = generator.generate();

    const result = DeterministicReconciliationEngine.reconcileBatch(
      dataset.datasetId,
      dataset.gatewayRecords,
      dataset.bankRecords,
      dataset.ledgerRecords,
      dataset.supportingEvents
    );

    const traps = result.decisions.filter((d) => d.method === "ADVERSARIAL_TRAP_GUARD");
    expect(traps.length).toBeGreaterThan(0);

    for (const trap of traps) {
      // Must NOT be marked MATCHED!
      expect(trap.state).toBe("REVIEW");
      expect(trap.exceptions[0].exceptionType).toBe("AMBIGUOUS_MATCH");
    }
  });
});
