import { 
  InvestigationRequest, 
  InvestigationResult, 
  AiProviderType 
} from "./types";
import { IAiProvider } from "./providers/base-provider";
import { GeminiInvestigationProvider } from "./providers/gemini-provider";
import { OpenAiInvestigationProvider } from "./providers/openai-provider";
import { OfflineInvestigationProvider } from "./providers/offline-provider";
import { prisma } from "../prisma";

export class AiInvestigator {
  private static getProvider(preference?: AiProviderType): IAiProvider {
    if (preference === "gemini") {
      const p = new GeminiInvestigationProvider();
      if (p.isAvailable()) return p;
    }
    if (preference === "openai") {
      const p = new OpenAiInvestigationProvider();
      if (p.isAvailable()) return p;
    }
    if (preference === "offline_fallback") {
      return new OfflineInvestigationProvider();
    }

    // Default auto-detection
    const gemini = new GeminiInvestigationProvider();
    if (gemini.isAvailable()) return gemini;

    const openai = new OpenAiInvestigationProvider();
    if (openai.isAvailable()) return openai;

    return new OfflineInvestigationProvider();
  }

  /**
   * Investigate a single ambiguous or disputed transaction.
   */
  public static async investigateTransaction(
    request: InvestigationRequest,
    options?: { decisionId?: string; runId?: string }
  ): Promise<InvestigationResult> {
    const provider = this.getProvider(request.provider);
    const result = await provider.investigate(request);

    // If database persistence is requested and IDs provided, record investigation
    if (options?.decisionId && options?.runId) {
      try {
        await prisma.aiInvestigation.create({
          data: {
            runId: options.runId,
            decisionId: options.decisionId,
            orderId: result.orderId,
            provider: result.provider,
            model: result.model,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            latencyMs: result.latencyMs,
            hypothesesConsidered: result.hypothesesConsidered,
            toolCallsExecuted: result.toolCallsExecuted as any,
            rawAiOutput: JSON.stringify({
              ...result,
              citedEvidence: result.citedEvidence.map((e) => ({
                ...e,
                monetaryImpactPaise: e.monetaryImpactMinorUnits.toString(),
              })),
            }),
            validatedOutput: {
              recommendation: result.recommendation,
              confidence: result.confidence,
              citedEvidence: result.citedEvidence.map((e) => ({
                ...e,
                monetaryImpactPaise: e.monetaryImpactMinorUnits.toString(),
              })),
              reasoningSummary: result.reasoningSummary,
              recommendedAction: result.recommendedAction,
            } as any,
            validationPassed: result.validationPassed,
            validationError: result.validationError,
            recommendation: result.recommendation,
            reasoningSummary: result.reasoningSummary,
          },
        });

        // Emit audit event
        await prisma.auditEvent.create({
          data: {
            runId: options.runId,
            entityType: "AiInvestigation",
            entityId: options.decisionId,
            action: "INVESTIGATED",
            actor: `AI_${result.provider.toUpperCase()}`,
            previousState: request.initialState,
            newState: result.recommendation,
            details: {
              model: result.model,
              confidence: result.confidence,
              validationPassed: result.validationPassed,
              validationError: result.validationError,
              latencyMs: result.latencyMs,
            },
          },
        });
      } catch (dbErr) {
        console.warn("Could not persist AI investigation to database (running in offline/in-memory mode):", dbErr);
      }
    }

    return result;
  }

  /**
   * Batch investigate multiple residual items requiring AI investigation.
   */
  public static async investigateBatch(
    requests: InvestigationRequest[],
    options?: { runId?: string }
  ): Promise<InvestigationResult[]> {
    const results: InvestigationResult[] = [];
    for (const req of requests) {
      const res = await this.investigateTransaction(req, { runId: options?.runId });
      results.push(res);
    }
    return results;
  }
}
