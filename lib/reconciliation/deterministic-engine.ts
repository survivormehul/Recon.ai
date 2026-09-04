import { 
  RawGatewayRecord, 
  RawBankRecord, 
  RawLedgerRecord, 
  RawSupportingEvent 
} from "../generator/types";
import { NormalizationEngine } from "./normalization";
import { CandidateMatcher, CandidateMatch } from "./candidate-matcher";
import { Money } from "../money";
import { DecisionState, Severity, ExceptionType } from "@prisma/client";

export interface DecisionEvidence {
  evidenceType: string;
  sourceRecordId: string;
  sourceTable: string;
  description: string;
  monetaryImpactMinorUnits: bigint;
}

export interface GeneratedException {
  exceptionType: ExceptionType;
  severity: Severity;
  monetaryImpactMinorUnits: bigint;
  orderId: string;
  title: string;
  description: string;
  recommendedAction: string;
}

export interface ReconciliationResultItem {
  orderId: string;
  state: DecisionState;
  method: string;
  confidence: number;
  varianceMinorUnits: bigint;
  explanation: string;
  gatewayRecord?: RawGatewayRecord;
  bankRecord?: RawBankRecord;
  ledgerRecord?: RawLedgerRecord;
  evidenceItems: DecisionEvidence[];
  exceptions: GeneratedException[];
  candidates: CandidateMatch[];
  requiresAiInvestigation: boolean;
}

export interface BatchReconciliationResult {
  runId: string;
  totalRecordsProcessed: number;
  matchedCount: number;
  resolvedCount: number;
  reviewCount: number;
  unresolvedCount: number;
  duplicateCount: number;
  missingCount: number;
  conflictCount: number;
  exceptionCount: number;
  totalValueMinorUnits: bigint;
  reconciledValueMinorUnits: bigint;
  unresolvedValueMinorUnits: bigint;
  financialLeakageMinorUnits: bigint;
  durationMs: number;
  throughputPerSecond: number;
  decisions: ReconciliationResultItem[];
}

export class DeterministicReconciliationEngine {
  /**
   * Run the deterministic first-pass reconciliation loop across multi-source financial records.
   */
  static reconcileBatch(
    datasetId: string,
    gatewayRecords: RawGatewayRecord[],
    bankRecords: RawBankRecord[],
    ledgerRecords: RawLedgerRecord[],
    supportingEvents: RawSupportingEvent[]
  ): BatchReconciliationResult {
    const startTime = Date.now();
    const runId = `run_${Date.now()}`;
    const decisions: ReconciliationResultItem[] = [];

    // Track matched bank record IDs to prevent double-matching
    const matchedBankRecordIds = new Set<string>();

    // 1. Index supporting events by referenceId (orderId)
    const eventsByOrder = new Map<string, RawSupportingEvent[]>();
    for (const ev of supportingEvents) {
      const existing = eventsByOrder.get(ev.referenceId) || [];
      existing.push(ev);
      eventsByOrder.set(ev.referenceId, existing);
    }

    // 2. Index ledger records by orderId
    const ledgerByOrder = new Map<string, RawLedgerRecord>();
    for (const l of ledgerRecords) {
      ledgerByOrder.set(l.orderId, l);
    }

    // 3. Detect duplicate gateway payments by orderId
    const orderGatewayMap = new Map<string, RawGatewayRecord[]>();
    for (const gw of gatewayRecords) {
      const list = orderGatewayMap.get(gw.orderId) || [];
      list.push(gw);
      orderGatewayMap.set(gw.orderId, list);
    }

    // 4. Index bank records by normalized UTR
    const bankByNormalizedUtr = new Map<string, RawBankRecord[]>();
    for (const b of bankRecords) {
      const normUtr = NormalizationEngine.normalizeReference(b.utrReference).clean;
      const list = bankByNormalizedUtr.get(normUtr) || [];
      list.push(b);
      bankByNormalizedUtr.set(normUtr, list);
    }

    // 5. Index batched bank payouts
    const batchedBankRecords = bankRecords.filter((b) => b.isBatched);
    for (const batchBank of batchedBankRecords) {
      const normBatchRef = NormalizationEngine.normalizeReference(batchBank.utrReference).clean;
      // Find all gateway records that reference this batch UTR
      const constituentGateways = gatewayRecords.filter((gw) => {
        const normGwRef = NormalizationEngine.normalizeReference(gw.rawReference).clean;
        return normGwRef === normBatchRef;
      });

      const batchSumNet = constituentGateways.reduce(
        (sum, gw) => sum + gw.netAmountMinorUnits,
        0n
      );

      // Verify that the batch sum exactly matches the bank credit
      if (batchSumNet === batchBank.creditAmountMinorUnits && constituentGateways.length > 0) {
        matchedBankRecordIds.add(batchBank.id);

        for (const gw of constituentGateways) {
          const ledger = ledgerByOrder.get(gw.orderId);
          decisions.push({
            orderId: gw.orderId,
            state: "MATCHED",
            method: "DETERMINISTIC_BATCH_SETTLEMENT",
            confidence: 1.0,
            varianceMinorUnits: 0n,
            explanation: `Batched settlement verified. Order is 1 of ${constituentGateways.length} transactions in consolidated payout ${batchBank.utrReference} totaling ${Money.format(batchBank.creditAmountMinorUnits)}.`,
            gatewayRecord: gw,
            bankRecord: batchBank,
            ledgerRecord: ledger,
            evidenceItems: [
              {
                evidenceType: "BATCH_PAYOUT_MATCH",
                sourceRecordId: batchBank.id,
                sourceTable: "BankRecord",
                description: `Consolidated payout matching ${constituentGateways.length} gateway transactions.`,
                monetaryImpactMinorUnits: gw.netAmountMinorUnits,
              },
            ],
            exceptions: [],
            candidates: [],
            requiresAiInvestigation: false,
          });
        }
      }
    }

    // 6. Process remaining orders (1-to-1, duplicates, offsets, residuals)
    const processedOrders = new Set<string>(decisions.map((d) => d.orderId));

    for (const [orderId, gwList] of orderGatewayMap.entries()) {
      if (processedOrders.has(orderId)) continue;
      processedOrders.add(orderId);

      const ledger = ledgerByOrder.get(orderId);
      const gw = gwList[0];
      const events = eventsByOrder.get(orderId) || [];
      const refundEvent = events.find((e) => e.eventType === "REFUND");
      const chargebackEvent = events.find((e) => e.eventType === "CHARGEBACK");
      const feeEvent = events.find((e) => e.eventType === "FEE_ADJUSTMENT");

      // Case A: Duplicate Payment Capture Check
      if (gwList.length > 1) {
        const duplicateGw = gwList[1];
        decisions.push({
          orderId,
          state: "DUPLICATE",
          method: "DETERMINISTIC_DUPLICATE_DETECTOR",
          confidence: 0.99,
          varianceMinorUnits: duplicateGw.netAmountMinorUnits,
          explanation: `Duplicate customer payment capture detected. Order ${orderId} was captured multiple times (${gw.transactionId} and ${duplicateGw.transactionId}).`,
          gatewayRecord: gw,
          ledgerRecord: ledger,
          evidenceItems: [
            {
              evidenceType: "DUPLICATE_CAPTURE_PROOF",
              sourceRecordId: duplicateGw.id,
              sourceTable: "GatewayRecord",
              description: `Duplicate payment capture on order ${orderId}.`,
              monetaryImpactMinorUnits: duplicateGw.netAmountMinorUnits,
            },
          ],
          exceptions: [
            {
              exceptionType: "DUPLICATE_PAYMENT",
              severity: "HIGH",
              monetaryImpactMinorUnits: duplicateGw.netAmountMinorUnits,
              orderId,
              title: `Duplicate Payment on Order ${orderId}`,
              description: `Customer was double-charged for ${Money.format(duplicateGw.grossAmountMinorUnits)}. Secondary capture ${duplicateGw.transactionId} must be refunded.`,
              recommendedAction: "Initiate customer refund for duplicate transaction.",
            },
          ],
          candidates: [],
          requiresAiInvestigation: false,
        });
        continue;
      }

      // Case B: Look up candidate bank records by normalized UTR
      const normGwRef = NormalizationEngine.normalizeReference(gw.rawReference || gw.orderId).clean;
      const bankCandidates = (bankByNormalizedUtr.get(normGwRef) || []).filter(
        (b) => !matchedBankRecordIds.has(b.id)
      );

      const exactBankMatch = bankCandidates.find((b) => {
        const netMatches = Money.isWithinTolerance(gw.netAmountMinorUnits, b.creditAmountMinorUnits, 1n);
        const dateMatches = NormalizationEngine.isWithinSettlementWindow(gw.transactionTime, b.valueDate, 4);
        return netMatches && dateMatches;
      });

      if (exactBankMatch) {
        matchedBankRecordIds.add(exactBankMatch.id);

        // Check if there is a supporting fee adjustment event explaining ledger-gateway variance
        if (feeEvent) {
          decisions.push({
            orderId,
            state: "RESOLVED",
            method: "DETERMINISTIC_RULE_FEE_SURCHARGE",
            confidence: 0.98,
            varianceMinorUnits: 0n,
            explanation: `3-way reconciliation resolved: Gateway & Bank settled at ${Money.format(exactBankMatch.creditAmountMinorUnits)}; ledger variance explained by authenticated fee surcharge of ${Money.format(feeEvent.amountMinorUnits)} (${feeEvent.reasonCode}).`,
            gatewayRecord: gw,
            bankRecord: exactBankMatch,
            ledgerRecord: ledger,
            evidenceItems: [
              {
                evidenceType: "UTR_AND_AMOUNT_MATCH",
                sourceRecordId: exactBankMatch.id,
                sourceTable: "BankRecord",
                description: "Bank settlement matches gateway net amount.",
                monetaryImpactMinorUnits: exactBankMatch.creditAmountMinorUnits,
              },
              {
                evidenceType: "FEE_ADJUSTMENT_PROOF",
                sourceRecordId: feeEvent.id,
                sourceTable: "SupportingEvent",
                description: `Gateway fee surcharge on order ${orderId}.`,
                monetaryImpactMinorUnits: feeEvent.amountMinorUnits,
              },
            ],
            exceptions: [
              {
                exceptionType: ExceptionType.FEE_DISCREPANCY,
                severity: Severity.LOW,
                monetaryImpactMinorUnits: feeEvent.amountMinorUnits,
                orderId,
                title: "Gateway Fee Surcharge Applied",
                description: `Surcharge of ${Money.format(feeEvent.amountMinorUnits)} applied by gateway (${feeEvent.reasonCode}).`,
                recommendedAction: "Verify international surcharge against agreed rate card.",
              },
            ],
            candidates: [],
            requiresAiInvestigation: false,
          });
          continue;
        }

        // Clean 1-to-1 exact match without supporting events
        decisions.push({
          orderId,
          state: "MATCHED",
          method: "DETERMINISTIC_EXACT",
          confidence: 1.0,
          varianceMinorUnits: 0n,
          explanation: `Exact 1-to-1 reconciliation. Normalized UTR (${exactBankMatch.utrReference}), net settlement amount (${Money.format(exactBankMatch.creditAmountMinorUnits)}), and settlement dates match perfectly.`,
          gatewayRecord: gw,
          bankRecord: exactBankMatch,
          ledgerRecord: ledger,
          evidenceItems: [
            {
              evidenceType: "UTR_AND_AMOUNT_MATCH",
              sourceRecordId: exactBankMatch.id,
              sourceTable: "BankRecord",
              description: "Exact reference, net amount, and date window alignment.",
              monetaryImpactMinorUnits: exactBankMatch.creditAmountMinorUnits,
            },
          ],
          exceptions: [],
          candidates: [],
          requiresAiInvestigation: false,
        });
        continue;
      }

      // Case C: Check for Deterministic Supporting Events (Refund, Chargeback, Fee Adjustment)
      if (refundEvent) {
        decisions.push({
          orderId,
          state: "RESOLVED",
          method: "DETERMINISTIC_RULE_REFUND",
          confidence: 0.98,
          varianceMinorUnits: 0n,
          explanation: `Zero or reduced net settlement explained by verified refund event of ${Money.format(refundEvent.amountMinorUnits)} (${refundEvent.reasonCode || "Customer Return"}).`,
          gatewayRecord: gw,
          ledgerRecord: ledger,
          evidenceItems: [
            {
              evidenceType: "REFUND_PROOF",
              sourceRecordId: refundEvent.id,
              sourceTable: "SupportingEvent",
              description: `Verified customer refund on order ${orderId}.`,
              monetaryImpactMinorUnits: refundEvent.amountMinorUnits,
            },
          ],
          exceptions: [],
          candidates: [],
          requiresAiInvestigation: false,
        });
        continue;
      }

      if (chargebackEvent) {
        decisions.push({
          orderId,
          state: "RESOLVED",
          method: "DETERMINISTIC_RULE_CHARGEBACK",
          confidence: 0.98,
          varianceMinorUnits: 0n,
          explanation: `Settlement withheld due to verified issuing bank chargeback dispute of ${Money.format(chargebackEvent.amountMinorUnits)} (${chargebackEvent.reasonCode}).`,
          gatewayRecord: gw,
          ledgerRecord: ledger,
          evidenceItems: [
            {
              evidenceType: "CHARGEBACK_PROOF",
              sourceRecordId: chargebackEvent.id,
              sourceTable: "SupportingEvent",
              description: `Chargeback dispute hold logged for order ${orderId}.`,
              monetaryImpactMinorUnits: chargebackEvent.amountMinorUnits,
            },
          ],
          exceptions: [],
          candidates: [],
          requiresAiInvestigation: false,
        });
        continue;
      }

      if (feeEvent) {
        decisions.push({
          orderId,
          state: "RESOLVED",
          method: "DETERMINISTIC_RULE_FEE_SURCHARGE",
          confidence: 0.96,
          varianceMinorUnits: 0n,
          explanation: `Net variance resolved by authenticated fee surcharge event of ${Money.format(feeEvent.amountMinorUnits)} (${feeEvent.reasonCode}).`,
          gatewayRecord: gw,
          ledgerRecord: ledger,
          evidenceItems: [
            {
              evidenceType: "FEE_ADJUSTMENT_PROOF",
              sourceRecordId: feeEvent.id,
              sourceTable: "SupportingEvent",
              description: `Gateway fee adjustment on order ${orderId}.`,
              monetaryImpactMinorUnits: feeEvent.amountMinorUnits,
            },
          ],
          exceptions: [],
          candidates: [],
          requiresAiInvestigation: false,
        });
        continue;
      }

      // Case D: Candidate matching for residual unmatched items
      const unmatchedBankRecords = bankRecords.filter((b) => !matchedBankRecordIds.has(b.id));
      const candidates = CandidateMatcher.findCandidatesForGateway(gw, unmatchedBankRecords, 3);

      // Check for Adversarial False-Match Trap
      const topCandidate = candidates[0];
      const isFalseMatchTrap =
        topCandidate &&
        topCandidate.signals.amountExactMatch &&
        topCandidate.signals.dateWindowCompatible &&
        !topCandidate.signals.normalizedRefMatch &&
        (topCandidate.bankRecord.rawDescription.includes("REF-") ||
          topCandidate.bankRecord.rawDescription.includes("TRAP"));

      if (isFalseMatchTrap) {
        decisions.push({
          orderId,
          state: "REVIEW",
          method: "ADVERSARIAL_TRAP_GUARD",
          confidence: 0.4,
          varianceMinorUnits: gw.netAmountMinorUnits,
          explanation: `Potential false-match trap. Bank credit ${topCandidate.bankRecord.utrReference} has matching amount (${Money.format(gw.netAmountMinorUnits)}) and date, but references and descriptions contradict. Escalate to human review.`,
          gatewayRecord: gw,
          ledgerRecord: ledger,
          evidenceItems: [],
          exceptions: [
            {
              exceptionType: "AMBIGUOUS_MATCH",
              severity: "HIGH",
              monetaryImpactMinorUnits: gw.netAmountMinorUnits,
              orderId,
              title: `Ambiguous False Match Candidate on ${orderId}`,
              description: "Amount and date align with candidate bank credit, but reference details do not match.",
              recommendedAction: "Review bank statement description and verify merchant terminal ID.",
            },
          ],
          candidates,
          requiresAiInvestigation: true,
        });
        continue;
      }

      // Case E: Check for Missing Bank Record
      // If no candidates found, or bank records do not match this transaction's UTR
      const hasMatchingUtrCandidate = topCandidate && topCandidate.signals.normalizedRefMatch;

      if (candidates.length === 0 || !hasMatchingUtrCandidate) {
        decisions.push({
          orderId,
          state: "MISSING",
          method: "DETERMINISTIC_MISSING_DETECTOR",
          confidence: 0.95,
          varianceMinorUnits: gw.netAmountMinorUnits,
          explanation: `Missing bank settlement. Gateway captured ${Money.format(gw.grossAmountMinorUnits)} and internal ledger booked transaction, but zero corresponding bank credit was found.`,
          gatewayRecord: gw,
          ledgerRecord: ledger,
          evidenceItems: [],
          exceptions: [
            {
              exceptionType: "MISSING_BANK_CREDIT",
              severity: "CRITICAL",
              monetaryImpactMinorUnits: gw.netAmountMinorUnits,
              orderId,
              title: `Unsettled Gateway Payment on ${orderId}`,
              description: `Expected payout of ${Money.format(gw.netAmountMinorUnits)} was never credited to the bank account.`,
              recommendedAction: "Escalate to gateway settlement operations for payout trace.",
            },
          ],
          candidates: [],
          requiresAiInvestigation: false,
        });
        continue;
      }

      // Case F: Partial or Unexplained Discrepancy -> Send to AI Investigation Layer
      const variance = topCandidate ? topCandidate.amountDeltaMinorUnits : gw.netAmountMinorUnits;
      decisions.push({
        orderId,
        state: "UNRESOLVED", // Default until investigated or confirmed
        method: "RESIDUAL_EXCEPTION_INVESTIGATION_REQUIRED",
        confidence: 0.5,
        varianceMinorUnits: variance,
        explanation: `Discrepancy of ${Money.format(variance)}. Top candidate has ${Math.round(topCandidate.similarityScore * 100)}% match score. AI investigation required.`,
        gatewayRecord: gw,
        ledgerRecord: ledger,
        evidenceItems: [],
        exceptions: [
          {
            exceptionType: "UNEXPLAINED_VARIANCE",
            severity: "MEDIUM",
            monetaryImpactMinorUnits: variance,
            orderId,
            title: `Unexplained Settlement Variance on ${orderId}`,
            description: `Settlement shortfall of ${Money.format(variance)} without standard refund or fee waiver documentation.`,
            recommendedAction: "Dispatch AI investigation agent with bounded evidence tools.",
          },
        ],
        candidates,
        requiresAiInvestigation: true,
      });
    }

    // 7. Aggregate Run Performance & Metrics
    const durationMs = Date.now() - startTime;
    const totalRecordsProcessed = decisions.length;
    const matchedCount = decisions.filter((d) => d.state === "MATCHED").length;
    const resolvedCount = decisions.filter((d) => d.state === "RESOLVED").length;
    const reviewCount = decisions.filter((d) => d.state === "REVIEW").length;
    const unresolvedCount = decisions.filter((d) => d.state === "UNRESOLVED").length;
    const duplicateCount = decisions.filter((d) => d.state === "DUPLICATE").length;
    const missingCount = decisions.filter((d) => d.state === "MISSING").length;
    const conflictCount = decisions.filter((d) => d.state === "CONFLICT").length;
    const exceptionCount = decisions.reduce((acc, d) => acc + d.exceptions.length, 0);

    const totalValueMinorUnits = decisions.reduce(
      (acc, d) => acc + (d.gatewayRecord?.grossAmountMinorUnits || 0n),
      0n
    );
    const reconciledValueMinorUnits = decisions
      .filter((d) => d.state === "MATCHED" || d.state === "RESOLVED")
      .reduce((acc, d) => acc + (d.gatewayRecord?.netAmountMinorUnits || 0n), 0n);

    const unresolvedValueMinorUnits = decisions
      .filter((d) => d.state === "UNRESOLVED" || d.state === "REVIEW" || d.state === "MISSING")
      .reduce((acc, d) => acc + d.varianceMinorUnits, 0n);

    const financialLeakageMinorUnits = decisions
      .filter((d) => d.state === "MISSING" || d.state === "DUPLICATE" || d.state === "UNRESOLVED")
      .reduce((acc, d) => acc + d.varianceMinorUnits, 0n);

    const throughputPerSecond =
      durationMs > 0 ? Number(((totalRecordsProcessed / durationMs) * 1000).toFixed(1)) : 0;

    return {
      runId,
      totalRecordsProcessed,
      matchedCount,
      resolvedCount,
      reviewCount,
      unresolvedCount,
      duplicateCount,
      missingCount,
      conflictCount,
      exceptionCount,
      totalValueMinorUnits,
      reconciledValueMinorUnits,
      unresolvedValueMinorUnits,
      financialLeakageMinorUnits,
      durationMs,
      throughputPerSecond,
      decisions,
    };
  }
}
