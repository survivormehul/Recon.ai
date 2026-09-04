import { IAiProvider } from "./base-provider";
import { InvestigationRequest, InvestigationResult, ToolCallExecutionRecord } from "../types";
import { InvestigationToolRunner, INVESTIGATION_TOOLS } from "../tools";
import { AntiHallucinationValidator } from "../validator";
import { OfflineInvestigationProvider } from "./offline-provider";

export class GeminiInvestigationProvider implements IAiProvider {
  public name = "gemini";
  private apiKey: string | undefined;
  private model: string;
  private timeoutMs: number;

  constructor(options?: { model?: string; timeoutMs?: number }) {
    this.apiKey = process.env.GEMINI_API_KEY?.trim();
    // Default to the current stable Gemini Flash model: gemini-3.6-flash
    this.model = options?.model || process.env.AI_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
    this.timeoutMs = options?.timeoutMs || 35000;
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  public getModelIdentifier(): string {
    return this.model;
  }

  public async investigate(request: InvestigationRequest): Promise<InvestigationResult> {
    // 1. If API key is not configured, fall back immediately to offline reasoner
    if (!this.isAvailable()) {
      const offline = new OfflineInvestigationProvider();
      return offline.investigate(request);
    }

    const startTime = Date.now();
    const toolRunner = new InvestigationToolRunner(request);

    // 2. Execute bounded application-owned tools
    const toolCallsExecuted: ToolCallExecutionRecord[] = [
      toolRunner.executeTool("get_transaction_evidence", { orderId: request.orderId }),
      toolRunner.executeTool("inspect_supporting_events", { orderId: request.orderId }),
      toolRunner.executeTool("calculate_variance", { orderId: request.orderId }),
      toolRunner.executeTool("search_candidate_matches", { orderId: request.orderId }),
    ];

    // 3. Format system instruction and bounded function declarations
    const systemInstruction = {
      role: "system",
      parts: [
        {
          text: `You are Recon.ai Financial Controller Agent.
You are performing autonomous 3-way payment reconciliation across Gateway, Bank, and Ledger records.
NON-NEGOTIABLE FINANCIAL CONTROLLER RULES:
1. You are an investigator and reasoner over verified evidence only. You are NEVER the primary source of financial truth.
2. Every cited record ID in 'citedEvidence' MUST exist in the provided tool outputs. NEVER invent, fabricate, or hallucinate IDs.
3. Every monetary figure must derive from verified integer paise arithmetic.
4. If an adversarial trap is detected (amount matches but reference is discordant or marked TRAP), recommend CONFLICT with HOLD_PAYOUT.
5. If there is unexplained positive variance without supporting events, you CANNOT recommend RESOLVED; you must recommend REVIEW.
6. Provide structured output adhering strictly to the response schema.`,
        },
      ],
    };

    // Prepare bounded tools schema for Gemini
    const geminiFunctionDeclarations = INVESTIGATION_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "OBJECT",
        properties: Object.fromEntries(
          Object.entries(tool.parameters.properties).map(([k, v]: [string, any]) => [
            k,
            { type: v.type.toUpperCase(), description: v.description },
          ])
        ),
        required: tool.parameters.required,
      },
    }));

    // Define response schema for Gemini Structured Output
    const responseSchema = {
      type: "OBJECT",
      properties: {
        recommendation: {
          type: "STRING",
          enum: ["RESOLVED", "REVIEW", "UNRESOLVED", "CONFLICT", "DUPLICATE", "MATCHED", "MISSING"],
        },
        confidence: { type: "NUMBER" },
        hypothesesConsidered: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
        reasoningSummary: { type: "STRING" },
        recommendedAction: {
          type: "STRING",
          enum: [
            "AUTO_RESOLVE",
            "CLAIM_REFUND",
            "ADJUST_LEDGER",
            "HOLD_PAYOUT",
            "WRITE_OFF",
            "CONTACT_GATEWAY",
            "HUMAN_REVIEW_REQUIRED",
          ],
        },
        citedEvidence: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              evidenceType: { type: "STRING" },
              sourceRecordId: { type: "STRING" },
              sourceTable: { type: "STRING" },
              description: { type: "STRING" },
              monetaryImpactPaise: { type: "INTEGER" },
            },
            required: ["evidenceType", "sourceRecordId", "sourceTable", "description", "monetaryImpactPaise"],
          },
        },
      },
      required: [
        "recommendation",
        "confidence",
        "hypothesesConsidered",
        "reasoningSummary",
        "recommendedAction",
        "citedEvidence",
      ],
    };

    const userPrompt = `Reconcile Transaction for Order ID: ${request.orderId}
Initial Deterministic State: ${request.initialState}
Variance (Paise): ${request.varianceMinorUnits.toString()}
Verified Tool Outputs:
${JSON.stringify(toolCallsExecuted.map((t) => ({ tool: t.toolName, result: t.result })), null, 2)}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

    try {
      // 4. Invoke Google Gemini API using fetch with AbortSignal timeout and secure header auth
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Pass API key strictly via header (never in URL parameter where it can be logged)
          "x-goog-api-key": this.apiKey!,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction,
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          tools: [
            {
              functionDeclarations: geminiFunctionDeclarations,
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.1,
          },
        }),
      }).finally(() => clearTimeout(timeoutHandle));

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        // Scrub error text so no key is ever reflected
        const sanitizedErr = this.sanitizeError(errText);
        throw new Error(`Gemini API HTTP ${response.status}: ${sanitizedErr}`);
      }

      const json = await response.json();
      const parts = json.candidates?.[0]?.content?.parts;
      const text = parts?.find((p: any) => typeof p.text === "string")?.text;

      if (!text) {
        throw new Error("Gemini returned empty candidate text");
      }

      const parsedOutput = JSON.parse(text);

      // 5. Run output through Anti-Hallucination Guardrails
      const validation = AntiHallucinationValidator.validate(parsedOutput, request);
      const latencyMs = Date.now() - startTime;

      const promptTokens = json.usageMetadata?.promptTokenCount || 480;
      const completionTokens = json.usageMetadata?.candidatesTokenCount || 190;

      return {
        orderId: request.orderId,
        provider: "gemini",
        model: this.model,
        recommendation: validation.sanitizedRecommendation,
        confidence: validation.sanitizedConfidence,
        hypothesesConsidered: parsedOutput.hypothesesConsidered || [],
        toolCallsExecuted,
        citedEvidence: validation.citedEvidence,
        reasoningSummary: parsedOutput.reasoningSummary || "Gemini investigation completed.",
        recommendedAction: parsedOutput.recommendedAction || "HUMAN_REVIEW_REQUIRED",
        validationPassed: validation.passed,
        validationError: validation.validationError,
        promptTokens,
        completionTokens,
        latencyMs,
      };
    } catch (err: any) {
      // Secure logging: never expose API key or raw credentials
      const safeErrorMessage = this.sanitizeError(err.message || String(err));
      console.warn(`[Recon.ai] Gemini provider failure (${safeErrorMessage}). Falling back gracefully to offline deterministic reasoner.`);

      const offline = new OfflineInvestigationProvider();
      const offlineResult = await offline.investigate(request);

      return {
        ...offlineResult,
        reasoningSummary: `[Fallback from Gemini (${safeErrorMessage})] ${offlineResult.reasoningSummary}`,
      };
    }
  }

  /**
   * Helper to ensure no secret API key is ever printed in logs or error traces.
   */
  private sanitizeError(str: string): string {
    if (!this.apiKey) return str;
    return str.replace(new RegExp(this.apiKey, "g"), "[REDACTED_API_KEY]");
  }
}
