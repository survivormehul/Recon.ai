import { IAiProvider } from "./base-provider";
import { InvestigationRequest, InvestigationResult, ToolCallExecutionRecord } from "../types";
import { InvestigationToolRunner } from "../tools";
import { AntiHallucinationValidator } from "../validator";
import { OfflineInvestigationProvider } from "./offline-provider";

export class OpenAiInvestigationProvider implements IAiProvider {
  public name = "openai";
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async investigate(request: InvestigationRequest): Promise<InvestigationResult> {
    if (!this.isAvailable()) {
      const offline = new OfflineInvestigationProvider();
      return offline.investigate(request);
    }

    const startTime = Date.now();
    const toolRunner = new InvestigationToolRunner(request);
    const toolCallsExecuted: ToolCallExecutionRecord[] = [
      toolRunner.executeTool("get_transaction_evidence", { orderId: request.orderId }),
      toolRunner.executeTool("inspect_supporting_events", { orderId: request.orderId }),
      toolRunner.executeTool("calculate_variance", { orderId: request.orderId }),
      toolRunner.executeTool("search_candidate_matches", { orderId: request.orderId }),
    ];

    const systemPrompt = `You are Recon.ai Financial Controller Agent.
You reason strictly over provided tool outputs. Do not fabricate record IDs.
Output JSON schema:
{
  "recommendation": "RESOLVED" | "REVIEW" | "UNRESOLVED" | "CONFLICT" | "DUPLICATE" | "MATCHED" | "MISSING",
  "confidence": number (0.0 to 1.0),
  "hypothesesConsidered": string[],
  "reasoningSummary": string,
  "recommendedAction": "AUTO_RESOLVE" | "CLAIM_REFUND" | "ADJUST_LEDGER" | "HOLD_PAYOUT" | "WRITE_OFF" | "CONTACT_GATEWAY" | "HUMAN_REVIEW_REQUIRED",
  "citedEvidence": [
    {
      "evidenceType": string,
      "sourceRecordId": string,
      "sourceTable": string,
      "description": string,
      "monetaryImpactPaise": integer
    }
  ]
}`;

    const userPrompt = `Order ID: ${request.orderId}
Variance: ${request.varianceMinorUnits.toString()} paise
Evidence:
${JSON.stringify(toolCallsExecuted.map((t) => ({ tool: t.toolName, result: t.result })), null, 2)}`;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0.1,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API returned status ${response.status}`);
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      const parsedOutput = JSON.parse(content);

      const validation = AntiHallucinationValidator.validate(parsedOutput, request);
      const latencyMs = Date.now() - startTime;

      return {
        orderId: request.orderId,
        provider: "openai",
        model: "gpt-4o-mini",
        recommendation: validation.sanitizedRecommendation,
        confidence: validation.sanitizedConfidence,
        hypothesesConsidered: parsedOutput.hypothesesConsidered || [],
        toolCallsExecuted,
        citedEvidence: validation.citedEvidence,
        reasoningSummary: parsedOutput.reasoningSummary || "OpenAI investigation completed.",
        recommendedAction: parsedOutput.recommendedAction || "HUMAN_REVIEW_REQUIRED",
        validationPassed: validation.passed,
        validationError: validation.validationError,
        promptTokens: json.usage?.prompt_tokens || 450,
        completionTokens: json.usage?.completion_tokens || 190,
        latencyMs,
      };
    } catch (err: any) {
      console.warn("OpenAI API call failed, falling back to offline reasoner:", err.message);
      const offline = new OfflineInvestigationProvider();
      return offline.investigate(request);
    }
  }
}
