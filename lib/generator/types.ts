import { DecisionState, Severity, ExceptionType, SupportingEventType } from "@prisma/client";

export type ScenarioType =
  | "EXACT_MATCH"
  | "REFERENCE_FORMAT_VARIATION"
  | "DATE_OFFSET"
  | "FEE_DISCREPANCY"
  | "TAX_DISCREPANCY"
  | "PARTIAL_SETTLEMENT"
  | "SPLIT_SETTLEMENT"
  | "BATCHED_BANK_CREDIT" // Many-to-one
  | "REFUND_OFFSET"
  | "CHARGEBACK_OFFSET"
  | "GATEWAY_ADJUSTMENT"
  | "DUPLICATE_PAYMENT"
  | "DUPLICATE_BANK_CREDIT"
  | "MISSING_BANK_CREDIT"
  | "MISSING_GATEWAY_RECORD"
  | "AMBIGUOUS_CANDIDATES"
  | "FALSE_MATCH_TRAP"
  | "GENUINE_UNEXPLAINED_VARIANCE";

export interface RawGatewayRecord {
  id: string;
  orderId: string;
  transactionId: string;
  arnReference?: string;
  rawReference?: string;
  normalizedReference?: string;
  grossAmountMinorUnits: bigint;
  feeMinorUnits: bigint;
  taxMinorUnits: bigint;
  netAmountMinorUnits: bigint;
  currency: string;
  paymentStatus: string;
  paymentMethod: string;
  transactionTime: Date;
  settlementDueDate?: Date;
  metadata?: Record<string, any>;
}

export interface RawBankRecord {
  id: string;
  utrReference: string;
  accountNumberMasked: string;
  rawDescription: string;
  normalizedDescription?: string;
  creditAmountMinorUnits: bigint;
  currency: string;
  valueDate: Date;
  bookingDate: Date;
  isBatched: boolean;
  batchCount: number;
  metadata?: Record<string, any>;
}

export interface RawLedgerRecord {
  id: string;
  journalEntryId: string;
  internalReference: string;
  orderId: string;
  expectedAmountMinorUnits: bigint;
  expectedFeeMinorUnits: bigint;
  expectedTaxMinorUnits: bigint;
  expectedNetMinorUnits: bigint;
  currency: string;
  accountCode: string;
  merchantId: string;
  ledgerDate: Date;
  metadata?: Record<string, any>;
}

export interface RawSupportingEvent {
  id: string;
  eventType: SupportingEventType;
  referenceId: string; // e.g. orderId or refundId
  relatedTransactionId?: string;
  amountMinorUnits: bigint;
  feeImpactMinorUnits: bigint;
  currency: string;
  eventDate: Date;
  reasonCode?: string;
  notes?: string;
}

export interface RawGroundTruth {
  id: string;
  orderId: string;
  expectedStatus: DecisionState;
  expectedCategory: ScenarioType;
  matchedGatewayId?: string;
  matchedBankUtr?: string;
  matchedLedgerId?: string;
  supportingEventIds: string[];
  unexplainedVarianceMinorUnits: bigint;
  expectedExplanation: string;
}

export interface GeneratedDataset {
  datasetId: string;
  name: string;
  seed: number;
  recordCount: number;
  gatewayRecords: RawGatewayRecord[];
  bankRecords: RawBankRecord[];
  ledgerRecords: RawLedgerRecord[];
  supportingEvents: RawSupportingEvent[];
  groundTruths: RawGroundTruth[]; // Strictly isolated from reconciliation engine
}
