import { 
  InvestigationRequest, 
  AiInvestigationOutput, 
  AiInvestigationOutputSchema, 
  CitedEvidenceItem 
} from "./types";
import { DecisionState } from "@prisma/client";

export interface ValidationResult {
  passed: boolean;
  sanitizedRecommendation: DecisionState;
  sanitizedConfidence: number;
  citedEvidence: CitedEvidenceItem[];
  validationError?: string;
}

export class AntiHallucinationValidator {
  /**
   * Strictly validates LLM output against genuine application data.
   * If any hallucinated ID or unauthorized resolution is detected,
   * the decision is immediately downgraded to REVIEW with an audit record.
   */
  public static validate(
    rawOutput: any,
    request: InvestigationRequest
  ): ValidationResult {
    // 1. Validate structured schema
    const parsed = AiInvestigationOutputSchema.safeParse(rawOutput);
    if (!parsed.success) {
      return {
        passed: false,
        sanitizedRecommendation: DecisionState.REVIEW,
        sanitizedConfidence: 0.5,
        citedEvidence: [],
        validationError: `Output failed schema validation: ${parsed.error.message}`,
      };
    }

    const data: AiInvestigationOutput = parsed.data;

    // 2. Build map of genuine, verified IDs in this transaction context
    const validIds = new Set<string>();
    if (request.gatewayRecord) validIds.add(request.gatewayRecord.id);
    if (request.bankRecord) validIds.add(request.bankRecord.id);
    if (request.ledgerRecord) validIds.add(request.ledgerRecord.id);
    if (request.candidates) {
      for (const c of request.candidates) {
        validIds.add(c.bankRecord.id);
      }
    }
    if (request.supportingEvents) {
      for (const e of request.supportingEvents) {
        validIds.add(e.id);
      }
    }

    // 3. Verify that every cited evidence record ID is genuine (anti-hallucination check)
    const validCitedEvidence: CitedEvidenceItem[] = [];
    const hallucinatedIds: string[] = [];

    for (const item of data.citedEvidence) {
      if (!validIds.has(item.sourceRecordId)) {
        hallucinatedIds.push(item.sourceRecordId);
      } else {
        validCitedEvidence.push({
          evidenceType: item.evidenceType,
          sourceRecordId: item.sourceRecordId,
          sourceTable: item.sourceTable,
          description: item.description,
          monetaryImpactMinorUnits: BigInt(item.monetaryImpactPaise),
        });
      }
    }

    if (hallucinatedIds.length > 0) {
      return {
        passed: false,
        sanitizedRecommendation: DecisionState.REVIEW,
        sanitizedConfidence: 0.3,
        citedEvidence: validCitedEvidence,
        validationError: `Anti-Hallucination Guard Triggered: Model cited non-existent record IDs [${hallucinatedIds.join(", ")}]. Automatically downgraded to REVIEW.`,
      };
    }

    // 4. Financial Integrity Check: If AI recommends RESOLVED, verify supporting evidence
    if (data.recommendation === "RESOLVED") {
      const events = request.supportingEvents || [];
      const totalOffset = events.reduce((sum, e) => sum + e.amountMinorUnits, 0n);

      // If there is significant variance and no supporting events, it CANNOT be auto-resolved
      if (request.varianceMinorUnits > 0n && totalOffset === 0n && validCitedEvidence.length === 0) {
        return {
          passed: false,
          sanitizedRecommendation: DecisionState.REVIEW,
          sanitizedConfidence: 0.4,
          citedEvidence: validCitedEvidence,
          validationError: `Financial Integrity Guard: Model attempted to mark variance of ${request.varianceMinorUnits} paise as RESOLVED without valid supporting offset events. Downgraded to REVIEW.`,
        };
      }
    }

    // 5. Check recommendation mapping
    const recommendationMap: Record<string, DecisionState> = {
      MATCHED: DecisionState.MATCHED,
      RESOLVED: DecisionState.RESOLVED,
      REVIEW: DecisionState.REVIEW,
      UNRESOLVED: DecisionState.UNRESOLVED,
      DUPLICATE: DecisionState.DUPLICATE,
      MISSING: DecisionState.MISSING,
      CONFLICT: DecisionState.CONFLICT,
    };

    const finalRecommendation = recommendationMap[data.recommendation] || DecisionState.REVIEW;

    return {
      passed: true,
      sanitizedRecommendation: finalRecommendation,
      sanitizedConfidence: data.confidence,
      citedEvidence: validCitedEvidence,
    };
  }
}
