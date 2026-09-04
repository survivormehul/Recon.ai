import { RawGatewayRecord, RawBankRecord, RawLedgerRecord } from "../generator/types";
import { NormalizationEngine } from "./normalization";
import { Money } from "../money";

export interface CandidateMatch {
  bankRecord: RawBankRecord;
  similarityScore: number;
  amountDeltaMinorUnits: bigint;
  dateDeltaDays: number;
  signals: {
    referenceSimilarity: number;
    amountExactMatch: boolean;
    amountWithinFeeTolerance: boolean;
    dateWindowCompatible: boolean;
    normalizedRefMatch: boolean;
  };
  explanation: string;
}

export class CandidateMatcher {
  /**
   * Evaluates and ranks bank statement candidates for an unmatched gateway record.
   *
   * Scoring weights:
   * - Normalized Reference Equivalence: 0.50
   * - Fuzzy Reference Similarity: 0.20
   * - Amount Exact / Tolerance Match: 0.20
   * - Date Window Compatibility: 0.10
   */
  static findCandidatesForGateway(
    gw: RawGatewayRecord,
    unmatchedBankRecords: RawBankRecord[],
    maxCandidates: number = 3
  ): CandidateMatch[] {
    const candidates: CandidateMatch[] = [];

    const normGwRef = NormalizationEngine.normalizeReference(gw.rawReference || gw.orderId);

    for (const bank of unmatchedBankRecords) {
      const normBankRef = NormalizationEngine.normalizeReference(bank.utrReference);

      // 1. Reference similarity
      const normalizedRefMatch = NormalizationEngine.areReferencesEquivalent(
        gw.rawReference,
        bank.utrReference
      );
      // Extract unique identifier suffixes (strip common bank/date prefixes like UTRBK202608)
      const extractSuffix = (str: string) => str.replace(/^(UTRBK\d{6}|CMS|NEFT|RTGS|UPI)/gi, "");
      const gwSuffix = extractSuffix(normGwRef.clean);
      const bankSuffix = extractSuffix(normBankRef.clean);

      const refSim = normalizedRefMatch
        ? 1.0
        : (gwSuffix.length >= 4 && bankSuffix.length >= 4
            ? NormalizationEngine.stringSimilarity(gwSuffix, bankSuffix)
            : NormalizationEngine.stringSimilarity(normGwRef.clean, normBankRef.clean));

      // 2. Amount compatibility
      const amountDelta = Money.absDiff(gw.netAmountMinorUnits, bank.creditAmountMinorUnits);
      const amountExactMatch = amountDelta === 0n;
      // Within 3% fee delta or standard tolerance
      const amountWithinFeeTolerance = amountDelta <= (gw.grossAmountMinorUnits * 300n) / 10000n;

      // 3. Date window compatibility
      const dateDelta = NormalizationEngine.dateDifferenceInDays(gw.transactionTime, bank.valueDate);
      const dateWindowCompatible = NormalizationEngine.isWithinSettlementWindow(
        gw.transactionTime,
        bank.valueDate,
        4 // max 4 days
      );

      // Plausibility filter:
      // Must have normalized match, strong suffix similarity (>= 0.70),
      // or exact amount match within date window with at least 0.40 similarity
      const isPlausible =
        normalizedRefMatch ||
        refSim >= 0.70 ||
        (amountExactMatch && dateWindowCompatible && refSim >= 0.35);

      if (!isPlausible) {
        continue;
      }

      // Calculate composite score
      let score = 0;
      if (normalizedRefMatch) score += 0.5;
      else score += refSim * 0.35;

      if (amountExactMatch) score += 0.35;
      else if (amountWithinFeeTolerance) score += 0.2;

      if (dateWindowCompatible) score += 0.15;

      // Filter out low confidence candidates (score < 0.40)
      if (score >= 0.40) {
        let explanation = "";
        if (normalizedRefMatch && amountExactMatch) {
          explanation = "Exact reference and net amount match.";
        } else if (normalizedRefMatch) {
          explanation = `Normalized reference matched with amount delta of ${Money.format(amountDelta)}.`;
        } else if (amountExactMatch && dateWindowCompatible) {
          explanation = `Exact net amount match within ${dateDelta} day window; references differ (${refSim.toFixed(2)} similarity).`;
        } else {
          explanation = `Candidate with ${Math.round(score * 100)}% composite signal score.`;
        }

        candidates.push({
          bankRecord: bank,
          similarityScore: Number(score.toFixed(4)),
          amountDeltaMinorUnits: amountDelta,
          dateDeltaDays: dateDelta,
          signals: {
            referenceSimilarity: Number(refSim.toFixed(4)),
            amountExactMatch,
            amountWithinFeeTolerance,
            dateWindowCompatible,
            normalizedRefMatch,
          },
          explanation,
        });
      }
    }

    // Sort descending by score, ascending by amount delta
    candidates.sort((a, b) => {
      if (b.similarityScore !== a.similarityScore) {
        return b.similarityScore - a.similarityScore;
      }
      return Number(a.amountDeltaMinorUnits - b.amountDeltaMinorUnits);
    });

    return candidates.slice(0, maxCandidates);
  }
}
