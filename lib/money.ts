/**
 * Monetary Arithmetic Utilities for Recon.ai
 *
 * All monetary amounts are handled strictly as integer minor units (paise / cents)
 * to completely eliminate JavaScript IEEE-754 floating point imprecision.
 */

export type MinorUnits = bigint;

export class Money {
  /**
   * Convert decimal currency (e.g. 1499.50) to minor units (e.g. 149950n).
   * Robust against float parsing by using string representation.
   */
  static fromDecimal(amount: number | string): bigint {
    const str = typeof amount === "number" ? amount.toFixed(2) : amount.trim();
    const parts = str.split(".");
    const whole = BigInt(parts[0] || "0");
    let fracStr = parts[1] || "0";
    if (fracStr.length === 1) fracStr += "0";
    if (fracStr.length > 2) fracStr = fracStr.substring(0, 2);
    const frac = BigInt(fracStr);

    return whole >= 0n ? whole * 100n + frac : whole * 100n - frac;
  }

  /**
   * Format minor units (paise) to INR/USD display string (e.g. "₹1,499.50").
   */
  static format(minorUnits: bigint | number, currency: string = "INR"): string {
    const val = typeof minorUnits === "bigint" ? Number(minorUnits) / 100 : minorUnits / 100;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  }

  /**
   * Safe addition of minor units.
   */
  static add(a: bigint, b: bigint): bigint {
    return a + b;
  }

  /**
   * Safe subtraction: a - b.
   */
  static subtract(a: bigint, b: bigint): bigint {
    return a - b;
  }

  /**
   * Absolute difference: |a - b|.
   */
  static absDiff(a: bigint, b: bigint): bigint {
    const diff = a - b;
    return diff < 0n ? -diff : diff;
  }

  /**
   * Validate whether two amounts match within a tolerance in minor units.
   */
  static isWithinTolerance(a: bigint, b: bigint, toleranceMinorUnits: bigint = 0n): boolean {
    return this.absDiff(a, b) <= toleranceMinorUnits;
  }

  /**
   * Calculate standard payment gateway fee (e.g. 2.0% fee + 18% GST on fee).
   * fee = round(gross * feeRateBasisPoints / 10000)
   * tax = round(fee * taxRateBasisPoints / 10000)
   */
  static calculateStandardFees(
    grossMinorUnits: bigint,
    feeRateBasisPoints: number = 200, // 2.00%
    taxRateBasisPoints: number = 1800  // 18.00% GST on fee
  ): { feeMinorUnits: bigint; taxMinorUnits: bigint; netAmountMinorUnits: bigint } {
    const feeMinorUnits = (grossMinorUnits * BigInt(feeRateBasisPoints) + 5000n) / 10000n;
    const taxMinorUnits = (feeMinorUnits * BigInt(taxRateBasisPoints) + 5000n) / 10000n;
    const netAmountMinorUnits = grossMinorUnits - feeMinorUnits - taxMinorUnits;
    return { feeMinorUnits, taxMinorUnits, netAmountMinorUnits };
  }
}
