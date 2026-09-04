import { 
  ReconciliationResultItem, 
  GeneratedException 
} from "../reconciliation/deterministic-engine";
import { 
  RawGroundTruth, 
  ScenarioType 
} from "../generator/types";
import { Money } from "../money";
import { DecisionState, ExceptionType, Severity } from "@prisma/client";

export type LeakageCategory = 
  | "MDR_OVERCHARGE"
  | "GST_MISCALCULATION"
  | "DUPLICATE_PAYMENT"
  | "MISSING_SETTLEMENT"
  | "UNMATCHED_CHARGEBACK"
  | "UNREFUNDED_CANCELLATION"
  | "TIMING_FLOAT_LOSS"
  | "UNEXPLAINED_VARIANCE";

export interface ScenarioBreakdownItem {
  scenario: ScenarioType;
  totalCases: number;
  matchedCount: number;
  resolvedCount: number;
  reviewCount: number;
  unresolvedCount: number;
  duplicateCount: number;
  missingCount: number;
  conflictCount: number;
  correctCount: number;
  accuracy: number;
  isTrapScenario: boolean;
}

export interface ConfusionMatrix {
  matrix: Record<string, Record<string, number>>;
  actualLabels: string[];
  predictedLabels: string[];
}

export interface LeakageItem {
  category: LeakageCategory;
  count: number;
  monetaryMinorUnits: bigint;
  monetaryFormatted: string;
  description: string;
  preventedMinorUnits: bigint;
  preventedFormatted: string;
  recoverableMinorUnits: bigint;
  recoverableFormatted: string;
}

export interface ComprehensiveEvaluationResult {
  runId?: string;
  
  // Independent Ground Truth Metrics (0.0 to 1.0)
  matchRate: number;
  precision: number;
  recall: number;
  f1Score: number;
  resolutionRate: number;
  falseAutoResolutionRate: number;
  exceptionAccuracy: number;
  reviewRate: number;
  unresolvedRate: number;
  adversarialRobustnessRate: number;

  // Ground Truth Verification Counts
  totalGroundTruthCases: number;
  correctDecisions: number;
  falsePositives: number;
  falseNegatives: number;
  truePositives: number;
  trueNegatives: number;

  // Financial Coverage (Paise)
  totalValueReconciledMinorUnits: bigint;
  totalUnexplainedVarianceMinorUnits: bigint;
  detectedLeakageMinorUnits: bigint;
  preventedLeakageMinorUnits: bigint;
  recoverableMinorUnits: bigint;

  // Formatted Currency
  totalValueReconciledFormatted: string;
  totalUnexplainedVarianceFormatted: string;
  detectedLeakageFormatted: string;
  preventedLeakageFormatted: string;
  recoverableFormatted: string;

  // Rich Breakdown Data
  scenarioBreakdown: Record<string, ScenarioBreakdownItem>;
  leakageBreakdown: Record<string, LeakageItem>;
  confusionMatrix: ConfusionMatrix;

  // Processing Performance
  throughputPerSecond: number;
  totalProcessingTimeMs: number;
  deterministicDurationMs: number;
  aiDurationMs: number;
}

export interface EvaluationOptions {
  runId?: string;
  decisions: ReconciliationResultItem[];
  groundTruths: RawGroundTruth[];
  totalProcessingTimeMs?: number;
  deterministicDurationMs?: number;
  aiDurationMs?: number;
  throughputPerSecond?: number;
}

export class ObjectiveEvaluator {
  /**
   * Objectively evaluate reconciliation decisions against the isolated ground truth dataset.
   */
  public static evaluate(options: EvaluationOptions): ComprehensiveEvaluationResult {
    const { 
      runId, 
      decisions, 
      groundTruths, 
      totalProcessingTimeMs = 0, 
      deterministicDurationMs = 0, 
      aiDurationMs = 0, 
      throughputPerSecond = 0 
    } = options;

    const gtMap = new Map<string, RawGroundTruth>();
    for (const gt of groundTruths) {
      gtMap.set(gt.orderId, gt);
    }

    const decisionMap = new Map<string, ReconciliationResultItem>();
    for (const dec of decisions) {
      decisionMap.set(dec.orderId, dec);
    }

    // Tracking Counters
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;
    let correctDecisions = 0;

    let matchedCount = 0;
    let resolvedCount = 0;
    let reviewCount = 0;
    let unresolvedCount = 0;
    let duplicateCount = 0;
    let missingCount = 0;
    let conflictCount = 0;

    let totalTraps = 0;
    let trapsBlocked = 0;

    let totalGroundTruthExceptions = 0;
    let correctlyDetectedExceptions = 0;

    let totalValueReconciledMinorUnits = 0n;
    let totalUnexplainedVarianceMinorUnits = 0n;

    // Confusion Matrix tracking
    const standardLabels = [
      DecisionState.MATCHED,
      DecisionState.RESOLVED,
      DecisionState.REVIEW,
      DecisionState.DUPLICATE,
      DecisionState.MISSING,
      DecisionState.CONFLICT,
      DecisionState.UNRESOLVED,
    ];

    const matrix: Record<string, Record<string, number>> = {};
    for (const actual of standardLabels) {
      matrix[actual] = {};
      for (const pred of standardLabels) {
        matrix[actual][pred] = 0;
      }
    }

    // Scenario Breakdown tracking
    const scenarioBreakdown: Record<string, ScenarioBreakdownItem> = {};

    // Evaluate each ground truth record
    for (const gt of groundTruths) {
      const dec = decisionMap.get(gt.orderId);
      const predictedState = dec ? dec.state : DecisionState.UNRESOLVED;
      const actualState = gt.expectedStatus;

      // Update confusion matrix
      if (matrix[actualState] && matrix[actualState][predictedState] !== undefined) {
        matrix[actualState][predictedState]++;
      }

      // Initialize scenario breakdown if needed
      if (!scenarioBreakdown[gt.expectedCategory]) {
        scenarioBreakdown[gt.expectedCategory] = {
          scenario: gt.expectedCategory,
          totalCases: 0,
          matchedCount: 0,
          resolvedCount: 0,
          reviewCount: 0,
          unresolvedCount: 0,
          duplicateCount: 0,
          missingCount: 0,
          conflictCount: 0,
          correctCount: 0,
          accuracy: 0,
          isTrapScenario: gt.expectedCategory === "FALSE_MATCH_TRAP",
        };
      }

      const sItem = scenarioBreakdown[gt.expectedCategory];
      sItem.totalCases++;

      if (predictedState === DecisionState.MATCHED) sItem.matchedCount++;
      else if (predictedState === DecisionState.RESOLVED) sItem.resolvedCount++;
      else if (predictedState === DecisionState.REVIEW) sItem.reviewCount++;
      else if (predictedState === DecisionState.UNRESOLVED) sItem.unresolvedCount++;
      else if (predictedState === DecisionState.DUPLICATE) sItem.duplicateCount++;
      else if (predictedState === DecisionState.MISSING) sItem.missingCount++;
      else if (predictedState === DecisionState.CONFLICT) sItem.conflictCount++;

      // Evaluate Traps
      if (gt.expectedCategory === "FALSE_MATCH_TRAP") {
        totalTraps++;
        // A trap is successfully blocked if it was NOT auto-matched or resolved
        if (predictedState === DecisionState.CONFLICT || predictedState === DecisionState.REVIEW) {
          trapsBlocked++;
        }
      }

      // Check if this case was an exception in ground truth
      const isActualException = gt.expectedCategory !== "EXACT_MATCH";
      if (isActualException) {
        totalGroundTruthExceptions++;
      }

      // Decision Correctness logic
      let isCorrect = false;
      const isAutoResolvedState = (predictedState === DecisionState.MATCHED || predictedState === DecisionState.RESOLVED);

      if (actualState === DecisionState.MATCHED) {
        // Expected Clean Match
        if (predictedState === DecisionState.MATCHED) {
          // Verify reference match if ground truth specifies bank UTR
          if (gt.matchedBankUtr && dec?.bankRecord?.utrReference) {
            if (dec.bankRecord.utrReference === gt.matchedBankUtr) {
              isCorrect = true;
              truePositives++;
            } else {
              // False Positive: matched the wrong bank transaction!
              falsePositives++;
            }
          } else {
            isCorrect = true;
            truePositives++;
          }
        } else {
          // Expected clean match was not matched
          falseNegatives++;
        }
      } else if (actualState === DecisionState.RESOLVED) {
        // Expected Resolved via supporting evidence
        if (predictedState === DecisionState.RESOLVED) {
          isCorrect = true;
          truePositives++;
          if (isActualException) correctlyDetectedExceptions++;
        } else if (predictedState === DecisionState.REVIEW) {
          // Flagged for AI/human review - safe conservative handling, not a false positive
          isCorrect = true; 
          trueNegatives++;
          if (isActualException) correctlyDetectedExceptions++;
        } else if (predictedState === DecisionState.MATCHED) {
          // Falsely matched as 1-to-1 without properly resolving variances
          falsePositives++;
        } else {
          falseNegatives++;
        }
      } else if (actualState === DecisionState.CONFLICT) {
        // Expected Conflict / Trap
        if (predictedState === DecisionState.CONFLICT || predictedState === DecisionState.REVIEW) {
          isCorrect = true;
          trueNegatives++;
          if (isActualException) correctlyDetectedExceptions++;
        } else if (isAutoResolvedState) {
          // Catastrophic error: Auto-resolved a trap!
          falsePositives++;
        } else {
          trueNegatives++;
        }
      } else if (actualState === DecisionState.DUPLICATE) {
        if (predictedState === DecisionState.DUPLICATE) {
          isCorrect = true;
          trueNegatives++;
          if (isActualException) correctlyDetectedExceptions++;
        } else if (isAutoResolvedState) {
          // Erroneously matched duplicate payment as valid settlement
          falsePositives++;
        } else {
          trueNegatives++;
        }
      } else if (actualState === DecisionState.MISSING) {
        if (predictedState === DecisionState.MISSING) {
          isCorrect = true;
          trueNegatives++;
          if (isActualException) correctlyDetectedExceptions++;
        } else if (isAutoResolvedState) {
          // Erroneously claimed missing record was found
          falsePositives++;
        } else {
          trueNegatives++;
        }
      } else {
        // Expected REVIEW or UNRESOLVED
        if (predictedState === DecisionState.REVIEW || predictedState === DecisionState.UNRESOLVED) {
          isCorrect = true;
          trueNegatives++;
          if (isActualException) correctlyDetectedExceptions++;
        } else if (isAutoResolvedState) {
          falsePositives++;
        } else {
          trueNegatives++;
        }
      }

      if (isCorrect) {
        correctDecisions++;
        sItem.correctCount++;
      }
    }

    // Finalize scenario accuracies
    for (const key of Object.keys(scenarioBreakdown)) {
      const item = scenarioBreakdown[key];
      item.accuracy = item.totalCases > 0 ? Number((item.correctCount / item.totalCases).toFixed(4)) : 0;
    }

    // Tally decision state counts and financial values from actual decisions
    for (const dec of decisions) {
      if (dec.state === DecisionState.MATCHED) {
        matchedCount++;
        if (dec.gatewayRecord) {
          totalValueReconciledMinorUnits += dec.gatewayRecord.grossAmountMinorUnits;
        } else if (dec.bankRecord) {
          totalValueReconciledMinorUnits += dec.bankRecord.creditAmountMinorUnits;
        }
      } else if (dec.state === DecisionState.RESOLVED) {
        resolvedCount++;
        if (dec.gatewayRecord) {
          totalValueReconciledMinorUnits += dec.gatewayRecord.grossAmountMinorUnits;
        }
      } else if (dec.state === DecisionState.REVIEW) {
        reviewCount++;
      } else if (dec.state === DecisionState.UNRESOLVED) {
        unresolvedCount++;
      } else if (dec.state === DecisionState.DUPLICATE) {
        duplicateCount++;
      } else if (dec.state === DecisionState.MISSING) {
        missingCount++;
      } else if (dec.state === DecisionState.CONFLICT) {
        conflictCount++;
      }

      if (dec.varianceMinorUnits > 0n) {
        totalUnexplainedVarianceMinorUnits += dec.varianceMinorUnits;
      }
    }

    const totalGroundTruthCases = groundTruths.length;
    const totalRecordsProcessed = decisions.length;

    // Precision, Recall, F1 Score
    const precision = (truePositives + falsePositives) > 0 
      ? Number((truePositives / (truePositives + falsePositives)).toFixed(4)) 
      : 1.0;

    const recall = (truePositives + falseNegatives) > 0 
      ? Number((truePositives / (truePositives + falseNegatives)).toFixed(4)) 
      : 1.0;

    const f1Score = (precision + recall) > 0 
      ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4)) 
      : 0;

    const totalAutoResolved = matchedCount + resolvedCount;
    const resolutionRate = totalRecordsProcessed > 0 
      ? Number((totalAutoResolved / totalRecordsProcessed).toFixed(4)) 
      : 0;

    // False Auto Resolution Rate: Proportion of auto-resolved items that were false positives
    const falseAutoResolutionRate = totalAutoResolved > 0 
      ? Number((falsePositives / totalAutoResolved).toFixed(4)) 
      : 0;

    const exceptionAccuracy = totalGroundTruthExceptions > 0 
      ? Number((correctlyDetectedExceptions / totalGroundTruthExceptions).toFixed(4)) 
      : 1.0;

    const reviewRate = totalRecordsProcessed > 0 
      ? Number((reviewCount / totalRecordsProcessed).toFixed(4)) 
      : 0;

    const unresolvedRate = totalRecordsProcessed > 0 
      ? Number((unresolvedCount / totalRecordsProcessed).toFixed(4)) 
      : 0;

    const adversarialRobustnessRate = totalTraps > 0 
      ? Number((trapsBlocked / totalTraps).toFixed(4)) 
      : 1.0;

    const matchRate = totalRecordsProcessed > 0 
      ? Number((matchedCount / totalRecordsProcessed).toFixed(4)) 
      : 0;

    // Calculate Financial Leakage Metrics
    const { 
      detectedLeakageMinorUnits, 
      preventedLeakageMinorUnits, 
      recoverableMinorUnits, 
      leakageBreakdown 
    } = this.calculateLeakage(decisions, groundTruths);

    return {
      runId,
      matchRate,
      precision,
      recall,
      f1Score,
      resolutionRate,
      falseAutoResolutionRate,
      exceptionAccuracy,
      reviewRate,
      unresolvedRate,
      adversarialRobustnessRate,

      totalGroundTruthCases,
      correctDecisions,
      falsePositives,
      falseNegatives,
      truePositives,
      trueNegatives,

      totalValueReconciledMinorUnits,
      totalUnexplainedVarianceMinorUnits,
      detectedLeakageMinorUnits,
      preventedLeakageMinorUnits,
      recoverableMinorUnits,

      totalValueReconciledFormatted: Money.formatPaise(totalValueReconciledMinorUnits),
      totalUnexplainedVarianceFormatted: Money.formatPaise(totalUnexplainedVarianceMinorUnits),
      detectedLeakageFormatted: Money.formatPaise(detectedLeakageMinorUnits),
      preventedLeakageFormatted: Money.formatPaise(preventedLeakageMinorUnits),
      recoverableFormatted: Money.formatPaise(recoverableMinorUnits),

      scenarioBreakdown,
      leakageBreakdown,
      confusionMatrix: {
        matrix,
        actualLabels: standardLabels,
        predictedLabels: standardLabels,
      },

      throughputPerSecond,
      totalProcessingTimeMs,
      deterministicDurationMs,
      aiDurationMs,
    };
  }

  /**
   * Calculates comprehensive financial leakage, prevented leakage, and recoverable claims.
   */
  private static calculateLeakage(
    decisions: ReconciliationResultItem[],
    groundTruths: RawGroundTruth[]
  ): {
    detectedLeakageMinorUnits: bigint;
    preventedLeakageMinorUnits: bigint;
    recoverableMinorUnits: bigint;
    leakageBreakdown: Record<string, LeakageItem>;
  } {
    const leakageMap: Record<LeakageCategory, LeakageItem> = {
      MDR_OVERCHARGE: {
        category: "MDR_OVERCHARGE",
        count: 0,
        monetaryMinorUnits: 0n,
        monetaryFormatted: "₹0.00",
        description: "Payment gateway MDR fee charged above the contracted merchant rate.",
        preventedMinorUnits: 0n,
        preventedFormatted: "₹0.00",
        recoverableMinorUnits: 0n,
        recoverableFormatted: "₹0.00",
      },
      GST_MISCALCULATION: {
        category: "GST_MISCALCULATION",
        count: 0,
        monetaryMinorUnits: 0n,
        monetaryFormatted: "₹0.00",
        description: "Goods and Services Tax on MDR miscalculated or deviating from 18%.",
        preventedMinorUnits: 0n,
        preventedFormatted: "₹0.00",
        recoverableMinorUnits: 0n,
        recoverableFormatted: "₹0.00",
      },
      DUPLICATE_PAYMENT: {
        category: "DUPLICATE_PAYMENT",
        count: 0,
        monetaryMinorUnits: 0n,
        monetaryFormatted: "₹0.00",
        description: "Multiple customer charges or duplicate bank credits for a single order.",
        preventedMinorUnits: 0n,
        preventedFormatted: "₹0.00",
        recoverableMinorUnits: 0n,
        recoverableFormatted: "₹0.00",
      },
      MISSING_SETTLEMENT: {
        category: "MISSING_SETTLEMENT",
        count: 0,
        monetaryMinorUnits: 0n,
        monetaryFormatted: "₹0.00",
        description: "Gateway captured transactions with no corresponding bank credit within SLA.",
        preventedMinorUnits: 0n,
        preventedFormatted: "₹0.00",
        recoverableMinorUnits: 0n,
        recoverableFormatted: "₹0.00",
      },
      UNMATCHED_CHARGEBACK: {
        category: "UNMATCHED_CHARGEBACK",
        count: 0,
        monetaryMinorUnits: 0n,
        monetaryFormatted: "₹0.00",
        description: "Chargeback debited by banking partner without internal ledger authorization.",
        preventedMinorUnits: 0n,
        preventedFormatted: "₹0.00",
        recoverableMinorUnits: 0n,
        recoverableFormatted: "₹0.00",
      },
      UNREFUNDED_CANCELLATION: {
        category: "UNREFUNDED_CANCELLATION",
        count: 0,
        monetaryMinorUnits: 0n,
        monetaryFormatted: "₹0.00",
        description: "Cancelled or returned orders where customer refund or MDR reversal failed.",
        preventedMinorUnits: 0n,
        preventedFormatted: "₹0.00",
        recoverableMinorUnits: 0n,
        recoverableFormatted: "₹0.00",
      },
      TIMING_FLOAT_LOSS: {
        category: "TIMING_FLOAT_LOSS",
        count: 0,
        monetaryMinorUnits: 0n,
        monetaryFormatted: "₹0.00",
        description: "Opportunity cost and float interest loss from settlement delays past T+2 SLA.",
        preventedMinorUnits: 0n,
        preventedFormatted: "₹0.00",
        recoverableMinorUnits: 0n,
        recoverableFormatted: "₹0.00",
      },
      UNEXPLAINED_VARIANCE: {
        category: "UNEXPLAINED_VARIANCE",
        count: 0,
        monetaryMinorUnits: 0n,
        monetaryFormatted: "₹0.00",
        description: "Residual discrepancy remaining after all automated and rule deductions.",
        preventedMinorUnits: 0n,
        preventedFormatted: "₹0.00",
        recoverableMinorUnits: 0n,
        recoverableFormatted: "₹0.00",
      },
    };

    let totalDetected = 0n;
    let totalPrevented = 0n;
    let totalRecoverable = 0n;

    for (const dec of decisions) {
      // Analyze exceptions attached to decisions
      for (const exc of dec.exceptions) {
        let category: LeakageCategory = "UNEXPLAINED_VARIANCE";

        if (exc.exceptionType === ExceptionType.FEE_DISCREPANCY) {
          category = "MDR_OVERCHARGE";
        } else if (exc.exceptionType === ExceptionType.TAX_DISCREPANCY) {
          category = "GST_MISCALCULATION";
        } else if (exc.exceptionType === ExceptionType.DUPLICATE_PAYMENT || exc.exceptionType === ExceptionType.DUPLICATE_BANK_CREDIT) {
          category = "DUPLICATE_PAYMENT";
        } else if (exc.exceptionType === ExceptionType.MISSING_BANK_CREDIT) {
          category = "MISSING_SETTLEMENT";
        } else if (exc.exceptionType === ExceptionType.TIMING_LAG) {
          category = "TIMING_FLOAT_LOSS";
        } else if (exc.exceptionType === ExceptionType.UNEXPLAINED_VARIANCE || exc.exceptionType === ExceptionType.AMOUNT_MISMATCH) {
          category = "UNEXPLAINED_VARIANCE";
        }

        const impact = exc.monetaryImpactMinorUnits > 0n ? exc.monetaryImpactMinorUnits : (dec.varianceMinorUnits > 0n ? dec.varianceMinorUnits : 0n);
        const item = leakageMap[category];
        item.count++;
        item.monetaryMinorUnits += impact;
        totalDetected += impact;

        // In finance, MDR overcharges and missing settlements can be directly clawed back from gateway
        if (category === "MDR_OVERCHARGE" || category === "GST_MISCALCULATION" || category === "MISSING_SETTLEMENT") {
          item.recoverableMinorUnits += impact;
          totalRecoverable += impact;
        }

        // When a duplicate payment is caught, double-fulfillment is prevented
        if (category === "DUPLICATE_PAYMENT") {
          item.preventedMinorUnits += impact;
          item.recoverableMinorUnits += impact;
          totalPrevented += impact;
          totalRecoverable += impact;
        }
      }

      // Prevented leakage from adversarial traps
      if (dec.state === DecisionState.CONFLICT && dec.method === "DETERMINISTIC_TRAP_QUARANTINE") {
        const trapGross = dec.gatewayRecord?.grossAmountMinorUnits ?? 0n;
        if (trapGross > 0n) {
          leakageMap.UNEXPLAINED_VARIANCE.preventedMinorUnits += trapGross;
          totalPrevented += trapGross;
        }
      }
    }

    // Format strings for all items
    for (const key of Object.keys(leakageMap) as LeakageCategory[]) {
      const item = leakageMap[key];
      item.monetaryFormatted = Money.formatPaise(item.monetaryMinorUnits);
      item.preventedFormatted = Money.formatPaise(item.preventedMinorUnits);
      item.recoverableFormatted = Money.formatPaise(item.recoverableMinorUnits);
    }

    return {
      detectedLeakageMinorUnits: totalDetected,
      preventedLeakageMinorUnits: totalPrevented,
      recoverableMinorUnits: totalRecoverable,
      leakageBreakdown: leakageMap,
    };
  }
}
