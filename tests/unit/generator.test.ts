import { describe, it, expect } from "vitest";
import { SyntheticDataGenerator } from "../../lib/generator/synthetic-generator";

describe("Synthetic Data Generator", () => {
  it("generates at least 500 records by default", () => {
    const generator = new SyntheticDataGenerator({ seed: 2026, recordCount: 500 });
    const dataset = generator.generate();

    expect(dataset.recordCount).toBeGreaterThanOrEqual(500);
    expect(dataset.gatewayRecords.length).toBeGreaterThanOrEqual(500);
    expect(dataset.ledgerRecords.length).toBeGreaterThanOrEqual(500);
    expect(dataset.groundTruths.length).toBeGreaterThanOrEqual(500);
  });

  it("is 100% reproducible given the same seed", () => {
    const gen1 = new SyntheticDataGenerator({ seed: 2026, recordCount: 100 });
    const set1 = gen1.generate();

    const gen2 = new SyntheticDataGenerator({ seed: 2026, recordCount: 100 });
    const set2 = gen2.generate();

    expect(set1.recordCount).toBe(set2.recordCount);
    expect(set1.gatewayRecords[0].orderId).toBe(set2.gatewayRecords[0].orderId);
    expect(set1.gatewayRecords[0].grossAmountMinorUnits).toBe(set2.gatewayRecords[0].grossAmountMinorUnits);
    expect(set1.groundTruths[0].expectedCategory).toBe(set2.groundTruths[0].expectedCategory);
    expect(set1.bankRecords[0].utrReference).toBe(set2.bankRecords[0].utrReference);
  });

  it("generates a rich mix of controlled financial scenarios", () => {
    const generator = new SyntheticDataGenerator({ seed: 2026, recordCount: 500 });
    const dataset = generator.generate();

    const categories = new Set(dataset.groundTruths.map((g) => g.expectedCategory));

    // Verify presence of required distinct scenarios
    expect(categories.has("EXACT_MATCH")).toBe(true);
    expect(categories.has("REFERENCE_FORMAT_VARIATION")).toBe(true);
    expect(categories.has("DATE_OFFSET")).toBe(true);
    expect(categories.has("BATCHED_BANK_CREDIT")).toBe(true);
    expect(categories.has("REFUND_OFFSET")).toBe(true);
    expect(categories.has("FEE_DISCREPANCY")).toBe(true);
    expect(categories.has("CHARGEBACK_OFFSET")).toBe(true);
    expect(categories.has("DUPLICATE_PAYMENT")).toBe(true);
    expect(categories.has("MISSING_BANK_CREDIT")).toBe(true);
    expect(categories.has("FALSE_MATCH_TRAP")).toBe(true);
    expect(categories.has("GENUINE_UNEXPLAINED_VARIANCE")).toBe(true);
  });

  it("handles many-to-one batched bank credits accurately", () => {
    const generator = new SyntheticDataGenerator({ seed: 2026, recordCount: 500 });
    const dataset = generator.generate();

    const batchedBanks = dataset.bankRecords.filter((b) => b.isBatched);
    expect(batchedBanks.length).toBeGreaterThan(0);

    // Verify that the batched bank credit equals the sum of its constituent gateway net amounts
    for (const bankBatch of batchedBanks) {
      const constituentGateways = dataset.gatewayRecords.filter(
        (g) => g.rawReference === bankBatch.utrReference
      );
      expect(constituentGateways.length).toBe(bankBatch.batchCount);

      const sumNet = constituentGateways.reduce((acc, g) => acc + g.netAmountMinorUnits, 0n);
      expect(bankBatch.creditAmountMinorUnits).toBe(sumNet);
    }
  });

  it("strictly produces integer minor units for all monetary fields", () => {
    const generator = new SyntheticDataGenerator({ seed: 2026, recordCount: 100 });
    const dataset = generator.generate();

    for (const gw of dataset.gatewayRecords) {
      expect(typeof gw.grossAmountMinorUnits).toBe("bigint");
      expect(typeof gw.feeMinorUnits).toBe("bigint");
      expect(typeof gw.taxMinorUnits).toBe("bigint");
      expect(typeof gw.netAmountMinorUnits).toBe("bigint");
      expect(gw.grossAmountMinorUnits - gw.feeMinorUnits - gw.taxMinorUnits).toBe(gw.netAmountMinorUnits);
    }
  });

  it("maintains strict ground truth isolation metadata", () => {
    const generator = new SyntheticDataGenerator({ seed: 2026, recordCount: 100 });
    const dataset = generator.generate();

    for (const gt of dataset.groundTruths) {
      expect(gt.orderId).toBeTruthy();
      expect(["MATCHED", "RESOLVED", "REVIEW", "UNRESOLVED", "DUPLICATE", "MISSING", "CONFLICT"]).toContain(
        gt.expectedStatus
      );
      expect(gt.expectedExplanation).toBeTruthy();
    }
  });
});
