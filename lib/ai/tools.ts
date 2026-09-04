import { InvestigationRequest, ToolCallExecutionRecord } from "./types";
import { Money } from "../money";
import { NormalizationEngine } from "../reconciliation/normalization";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export const INVESTIGATION_TOOLS: ToolDefinition[] = [
  {
    name: "get_transaction_evidence",
    description: "Fetch all available raw transaction details for the order across Gateway, Bank, and Ledger sources.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The internal Order ID to inspect." },
      },
      required: ["orderId"],
    },
  },
  {
    name: "inspect_supporting_events",
    description: "Inspect customer refunds, chargebacks, fee adjustments, and disputes associated with this order.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The internal Order ID to inspect events for." },
      },
      required: ["orderId"],
    },
  },
  {
    name: "calculate_variance",
    description: "Perform precise integer paise variance analysis: compares gross, net, MDR fee, and GST against ledger expectations.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "Order ID." },
      },
      required: ["orderId"],
    },
  },
  {
    name: "search_candidate_matches",
    description: "Search for candidate bank settlement records within the settlement window that could correspond to this gateway transaction.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "Order ID to correlate." },
      },
      required: ["orderId"],
    },
  },
];

export class InvestigationToolRunner {
  private request: InvestigationRequest;

  constructor(request: InvestigationRequest) {
    this.request = request;
  }

  public executeTool(toolName: string, args: Record<string, any>): ToolCallExecutionRecord {
    let result: Record<string, any> = {};

    switch (toolName) {
      case "get_transaction_evidence":
        result = this.getTransactionEvidence(args.orderId);
        break;
      case "inspect_supporting_events":
        result = this.inspectSupportingEvents(args.orderId);
        break;
      case "calculate_variance":
        result = this.calculateVariance(args.orderId);
        break;
      case "search_candidate_matches":
        result = this.searchCandidateMatches(args.orderId);
        break;
      default:
        result = { error: `Unknown tool: ${toolName}` };
    }

    return {
      toolName,
      args,
      result,
    };
  }

  private getTransactionEvidence(orderId: string): Record<string, any> {
    const gw = this.request.gatewayRecord;
    const bk = this.request.bankRecord;
    const ld = this.request.ledgerRecord;

    return {
      orderId,
      gateway: gw ? {
        id: gw.id,
        transactionId: gw.transactionId,
        paymentStatus: gw.paymentStatus,
        paymentMethod: gw.paymentMethod,
        grossPaise: gw.grossAmountMinorUnits.toString(),
        grossFormatted: Money.format(gw.grossAmountMinorUnits),
        feePaise: gw.feeMinorUnits.toString(),
        taxPaise: gw.taxMinorUnits.toString(),
        netPaise: gw.netAmountMinorUnits.toString(),
        netFormatted: Money.format(gw.netAmountMinorUnits),
        rawReference: gw.rawReference,
        transactionTime: gw.transactionTime.toISOString(),
      } : null,
      bank: bk ? {
        id: bk.id,
        utrReference: bk.utrReference,
        creditPaise: bk.creditAmountMinorUnits.toString(),
        creditFormatted: Money.format(bk.creditAmountMinorUnits),
        valueDate: bk.valueDate.toISOString(),
        rawDescription: bk.rawDescription,
        isBatched: bk.isBatched,
        batchCount: bk.batchCount,
      } : null,
      ledger: ld ? {
        id: ld.id,
        expectedAmountPaise: ld.expectedAmountMinorUnits.toString(),
        expectedFeePaise: ld.expectedFeeMinorUnits.toString(),
        expectedTaxPaise: ld.expectedTaxMinorUnits.toString(),
        expectedNetPaise: ld.expectedNetMinorUnits.toString(),
        expectedNetFormatted: Money.format(ld.expectedNetMinorUnits),
        accountCode: ld.accountCode,
      } : null,
    };
  }

  private inspectSupportingEvents(orderId: string): Record<string, any> {
    const events = this.request.supportingEvents || [];
    return {
      orderId,
      totalEvents: events.length,
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        amountPaise: e.amountMinorUnits.toString(),
        amountFormatted: Money.format(e.amountMinorUnits),
        feeImpactPaise: e.feeImpactMinorUnits.toString(),
        eventDate: e.eventDate.toISOString(),
        reasonCode: e.reasonCode || "N/A",
        notes: e.notes || "",
      })),
    };
  }

  private calculateVariance(orderId: string): Record<string, any> {
    const gw = this.request.gatewayRecord;
    const bk = this.request.bankRecord;
    const ld = this.request.ledgerRecord;

    const gwNet = gw?.netAmountMinorUnits ?? 0n;
    const bkCredit = bk?.creditAmountMinorUnits ?? 0n;
    const ldNet = ld?.expectedNetMinorUnits ?? 0n;

    const gwVsBankDelta = gwNet - bkCredit;
    const gwVsLedgerDelta = gwNet - ldNet;

    // Check fee delta
    const expectedFee = ld?.expectedFeeMinorUnits ?? 0n;
    const actualFee = gw?.feeMinorUnits ?? 0n;
    const feeVariance = actualFee - expectedFee;

    // Check supporting events total
    const events = this.request.supportingEvents || [];
    const totalEventOffset = events.reduce((sum, e) => sum + e.amountMinorUnits, 0n);

    const unexplainedResidual = (gwVsLedgerDelta > 0n ? gwVsLedgerDelta : -gwVsLedgerDelta) - totalEventOffset;

    return {
      orderId,
      gatewayNetPaise: gwNet.toString(),
      bankCreditPaise: bkCredit.toString(),
      ledgerExpectedNetPaise: ldNet.toString(),
      gwVsBankDeltaPaise: gwVsBankDelta.toString(),
      gwVsLedgerDeltaPaise: gwVsLedgerDelta.toString(),
      feeVariancePaise: feeVariance.toString(),
      totalSupportingEventOffsetPaise: totalEventOffset.toString(),
      unexplainedResidualPaise: (unexplainedResidual > 0n ? unexplainedResidual : 0n).toString(),
      isFullyReconciled: unexplainedResidual <= 0n && gwVsBankDelta === 0n,
    };
  }

  private searchCandidateMatches(orderId: string): Record<string, any> {
    const candidates = this.request.candidates || [];
    return {
      orderId,
      candidateCount: candidates.length,
      candidates: candidates.map((c) => ({
        bankRecordId: c.bankRecord.id,
        utrReference: c.bankRecord.utrReference,
        creditPaise: c.bankRecord.creditAmountMinorUnits.toString(),
        creditFormatted: Money.format(c.bankRecord.creditAmountMinorUnits),
        rawDescription: c.bankRecord.rawDescription,
        similarityScore: c.similarityScore,
        amountDeltaPaise: c.amountDeltaMinorUnits.toString(),
        dateDeltaDays: c.dateDeltaDays,
        signals: c.signals,
      })),
    };
  }
}
