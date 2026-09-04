import { z } from "zod";
import { DecisionState, Severity, ExceptionType, SupportingEventType } from "@prisma/client";
import { 
  RawGatewayRecord, 
  RawBankRecord, 
  RawLedgerRecord, 
  RawSupportingEvent 
} from "../generator/types";
import { CandidateMatch } from "../reconciliation/candidate-matcher";

export type AiProviderType = "gemini" | "openai" | "offline_fallback";

export interface InvestigationRequest {
  orderId: string;
  gatewayRecord?: RawGatewayRecord;
  bankRecord?: RawBankRecord;
  ledgerRecord?: RawLedgerRecord;
  candidates?: CandidateMatch[];
  supportingEvents?: RawSupportingEvent[];
  initialState: DecisionState;
  varianceMinorUnits: bigint;
  provider?: AiProviderType;
}

export interface CitedEvidenceItem {
  evidenceType: string;
  sourceRecordId: string;
  sourceTable: string;
  description: string;
  monetaryImpactMinorUnits: bigint;
}

export interface ToolCallExecutionRecord {
  toolName: string;
  args: Record<string, any>;
  result: Record<string, any>;
}

export interface InvestigationResult {
  orderId: string;
  provider: AiProviderType;
  model: string;
  recommendation: DecisionState;
  confidence: number;
  hypothesesConsidered: string[];
  toolCallsExecuted: ToolCallExecutionRecord[];
  citedEvidence: CitedEvidenceItem[];
  reasoningSummary: string;
  recommendedAction: string;
  validationPassed: boolean;
  validationError?: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

/**
 * Strict Zod Schema for Structured AI JSON Output.
 * Prevents schema deviation and validates controller reasoning fields.
 */
export const AiInvestigationOutputSchema = z.object({
  recommendation: z.enum([
    "RESOLVED",
    "REVIEW",
    "UNRESOLVED",
    "CONFLICT",
    "DUPLICATE",
    "MATCHED",
    "MISSING",
  ]),
  confidence: z.number().min(0.0).max(1.0),
  hypothesesConsidered: z.array(z.string()).min(1),
  reasoningSummary: z.string().min(10),
  recommendedAction: z.enum([
    "AUTO_RESOLVE",
    "CLAIM_REFUND",
    "ADJUST_LEDGER",
    "HOLD_PAYOUT",
    "WRITE_OFF",
    "CONTACT_GATEWAY",
    "HUMAN_REVIEW_REQUIRED",
  ]),
  citedEvidence: z.array(
    z.object({
      evidenceType: z.string(),
      sourceRecordId: z.string(),
      sourceTable: z.string(),
      description: z.string(),
      monetaryImpactPaise: z.number().int(),
    })
  ),
});

export type AiInvestigationOutput = z.infer<typeof AiInvestigationOutputSchema>;
