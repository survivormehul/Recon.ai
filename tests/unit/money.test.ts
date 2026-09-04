import { describe, it, expect } from "vitest";
import { Money } from "../../lib/money";

describe("Money Utilities", () => {
  it("converts decimal strings and numbers to minor units correctly", () => {
    expect(Money.fromDecimal(1499.5)).toBe(149950n);
    expect(Money.fromDecimal("250.00")).toBe(25000n);
    expect(Money.fromDecimal(0)).toBe(0n);
    expect(Money.fromDecimal("0.05")).toBe(5n);
    expect(Money.fromDecimal("1000000.75")).toBe(100000075n);
  });

  it("handles negative decimals correctly", () => {
    expect(Money.fromDecimal("-50.25")).toBe(-5025n);
  });

  it("calculates exact addition and subtraction without floating point issues", () => {
    // In standard floats: 0.1 + 0.2 = 0.30000000000000004
    const a = Money.fromDecimal("0.10"); // 10n
    const b = Money.fromDecimal("0.20"); // 20n
    const sum = Money.add(a, b);
    expect(sum).toBe(30n);
    expect(Money.subtract(sum, a)).toBe(b);
  });

  it("calculates fee and tax with deterministic rounding", () => {
    // Gross: ₹10,000.00 (1,000,000 paise)
    // Fee: 2% = ₹200.00 (20,000 paise)
    // Tax: 18% of 200 = ₹36.00 (3,600 paise)
    // Net: ₹9,764.00 (976,400 paise)
    const gross = 1000000n;
    const { feeMinorUnits, taxMinorUnits, netAmountMinorUnits } = Money.calculateStandardFees(gross);
    expect(feeMinorUnits).toBe(20000n);
    expect(taxMinorUnits).toBe(3600n);
    expect(netAmountMinorUnits).toBe(976400n);
    expect(gross - feeMinorUnits - taxMinorUnits).toBe(netAmountMinorUnits);
  });

  it("evaluates tolerance checks correctly", () => {
    const expected = 50000n;
    const actualWithSmallVariance = 50005n; // 5 paise difference
    expect(Money.isWithinTolerance(expected, actualWithSmallVariance, 10n)).toBe(true);
    expect(Money.isWithinTolerance(expected, actualWithSmallVariance, 2n)).toBe(false);
  });
});
