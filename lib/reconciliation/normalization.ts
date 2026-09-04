/**
 * Data Normalization Engine for Recon.ai
 *
 * Normalizes references, bank descriptions, amounts, and dates
 * while strictly preserving original raw values for audit and evidence.
 */

export interface NormalizedReference {
  raw: string;
  clean: string;
  prefix?: string;
  strippedPrefixes: string[];
}

export class NormalizationEngine {
  private static readonly BANK_PREFIX_REGEX = /^(CMS[\/\-_]|NEFT[\/\-_]|RTGS[\/\-_]|IMPS[\/\-_]|UPI[\/\-_]|SETTLE[\/\-_]|CR[\/\-_]|DR[\/\-_]|REFUND[\/\-_]|CHARGEBACK[\/\-_])+/gi;

  /**
   * Normalizes transaction/bank references (UTRs, order refs, payment IDs):
   * 1. Strips common banking prefixes (CMS/, NEFT-, RTGS/, etc.)
   * 2. Trims leading/trailing whitespace
   * 3. Normalizes internal whitespace and punctuation
   * 4. Converts to uppercase for canonical comparison
   */
  static normalizeReference(raw?: string | null): NormalizedReference {
    if (!raw) {
      return { raw: "", clean: "", strippedPrefixes: [] };
    }

    const trimmed = raw.trim();
    const strippedPrefixes: string[] = [];

    // Extract prefixes
    let clean = trimmed.replace(this.BANK_PREFIX_REGEX, (match) => {
      strippedPrefixes.push(match);
      return "";
    });

    // Remove internal redundant spaces, hyphens, and slashes
    clean = clean
      .replace(/[\/\-_]+/g, "") // remove slashes and hyphens
      .replace(/\s+/g, "")     // remove whitespace
      .toUpperCase();

    return {
      raw,
      clean,
      strippedPrefixes,
    };
  }

  /**
   * Check if two references match under normalization.
   */
  static areReferencesEquivalent(refA?: string | null, refB?: string | null): boolean {
    if (!refA || !refB) return false;
    const cleanA = this.normalizeReference(refA).clean;
    const cleanB = this.normalizeReference(refB).clean;
    return cleanA.length > 0 && cleanA === cleanB;
  }

  /**
   * Calculates Jaro-Winkler string similarity (0.0 to 1.0)
   * for fuzzy candidate matching.
   */
  static stringSimilarity(s1: string, s2: string): number {
    const a = s1.trim().toUpperCase();
    const b = s2.trim().toUpperCase();

    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;

    const matchWindow = Math.floor(Math.max(a.length, b.length) / 2) - 1;
    const aMatches = new Array(a.length).fill(false);
    const bMatches = new Array(b.length).fill(false);

    let matches = 0;
    for (let i = 0; i < a.length; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, b.length);

      for (let j = start; j < end; j++) {
        if (bMatches[j]) continue;
        if (a[i] !== b[j]) continue;
        aMatches[i] = true;
        bMatches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0.0;

    let transpositions = 0;
    let bIdx = 0;
    for (let i = 0; i < a.length; i++) {
      if (!aMatches[i]) continue;
      while (!bMatches[bIdx]) bIdx++;
      if (a[i] !== b[bIdx]) transpositions++;
      bIdx++;
    }

    const m = matches;
    const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;

    // Winkler prefix bonus
    let prefix = 0;
    for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
      if (a[i] === b[i]) prefix++;
      else break;
    }

    return jaro + prefix * 0.1 * (1 - jaro);
  }

  /**
   * Calculates difference in business days between two dates.
   */
  static dateDifferenceInDays(d1: Date | string, d2: Date | string): number {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Determines if a bank settlement date is within a valid settlement window
   * for a gateway transaction (e.g. T+0 to T+4 business days).
   */
  static isWithinSettlementWindow(
    txnDate: Date | string,
    settlementDate: Date | string,
    maxDaysOffset: number = 4
  ): boolean {
    const tDate = new Date(txnDate);
    const sDate = new Date(settlementDate);

    // Settlement cannot occur before transaction initiation
    if (sDate.getTime() < tDate.getTime() - (12 * 3600 * 1000)) {
      return false;
    }

    const days = this.dateDifferenceInDays(tDate, sDate);
    return days <= maxDaysOffset;
  }
}
