import { runHistoryStore, OrchestratedRunResult } from "../reconciliation/orchestrator";
import { GeminiInvestigationProvider } from "./providers/gemini-provider";

export interface ControllerQueryRequest {
  question: string;
  runId?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  provider?: "gemini" | "offline_fallback";
}

export interface ControllerQueryResponse {
  answer: string;
  citedRecords: Array<{
    type: "order" | "utr" | "metric" | "exception";
    identifier: string;
    details: string;
  }>;
  groundedFacts: {
    runId: string;
    recordCount: number;
    matchRatePercent: number;
    totalUnexplainedVariance: string;
    totalLeakageDetected: string;
    totalLeakagePrevented: string;
  };
  providerUsed: "gemini" | "grounded_rule_engine";
  latencyMs: number;
}

export class ControllerAssistant {
  /**
   * Answer natural language questions grounded strictly in live reconciliation data.
   */
  public static async answerQuestion(request: ControllerQueryRequest): Promise<ControllerQueryResponse> {
    const startTime = Date.now();
    const run = request.runId ? runHistoryStore.getRun(request.runId) : runHistoryStore.getLatestRun();

    if (!run) {
      return {
        answer: "No reconciliation run data is currently available. Please execute a reconciliation run from the 'Run Reconciliation' page first.",
        citedRecords: [],
        groundedFacts: {
          runId: "none",
          recordCount: 0,
          matchRatePercent: 0,
          totalUnexplainedVariance: "₹0.00",
          totalLeakageDetected: "₹0.00",
          totalLeakagePrevented: "₹0.00",
        },
        providerUsed: "grounded_rule_engine",
        latencyMs: Date.now() - startTime,
      };
    }

    const q = request.question.trim().toLowerCase();

    // Check if question asks about a specific Order ID
    const orderIdMatch = request.question.match(/ORD-[A-Za-z0-9-]+/i);
    const specificOrder = orderIdMatch 
      ? run.decisions.find((d) => d.orderId.toLowerCase() === orderIdMatch[0].toLowerCase())
      : null;

    const chosenProvider = request.provider || (process.env.NODE_ENV === "test" ? "offline_fallback" : "gemini");

    // Check if Gemini API should be queried
    if (chosenProvider !== "offline_fallback") {
      const geminiProvider = new GeminiInvestigationProvider();
      if (geminiProvider.isAvailable()) {
        try {
          const aiAnswer = await this.askGemini(request.question, run, specificOrder);
        if (aiAnswer) {
          return {
            ...aiAnswer,
            groundedFacts: {
              runId: run.runId,
              recordCount: run.recordCount,
              matchRatePercent: run.metrics.matchRatePercent,
              totalUnexplainedVariance: run.financials.formattedUnresolved,
              totalLeakageDetected: run.financials.formattedLeakage,
              totalLeakagePrevented: run.financials.formattedPrevented,
            },
            providerUsed: "gemini",
            latencyMs: Date.now() - startTime,
          };
        }
      } catch (err) {
        console.warn("[ControllerAssistant] Gemini query failed, falling back to grounded rule engine:", err);
      }
    }
  }

    // Deterministic Grounded Rule Engine Fallback (guaranteed zero hallucination)
    const deterministicResponse = this.answerDeterministically(request.question, run, specificOrder);
    return {
      ...deterministicResponse,
      groundedFacts: {
        runId: run.runId,
        recordCount: run.recordCount,
        matchRatePercent: run.metrics.matchRatePercent,
        totalUnexplainedVariance: run.financials.formattedUnresolved,
        totalLeakageDetected: run.financials.formattedLeakage,
        totalLeakagePrevented: run.financials.formattedPrevented,
      },
      providerUsed: "grounded_rule_engine",
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Invoke Gemini with factual run context and strict anti-hallucination prompt.
   */
  private static async askGemini(
    question: string,
    run: OrchestratedRunResult,
    specificOrder: any | null
  ): Promise<{ answer: string; citedRecords: any[] } | null> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return null;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    // Prepare rich factual context
    const factualContext = {
      runId: run.runId,
      seed: run.seed,
      recordCount: run.recordCount,
      metrics: run.metrics,
      financials: {
        totalBatchValue: run.financials.formattedTotal,
        reconciledValue: run.financials.formattedReconciled,
        unexplainedVariance: run.financials.formattedUnresolved,
        financialLeakageDetected: run.financials.formattedLeakage,
        financialLeakagePrevented: run.financials.formattedPrevented,
        recoverableFunds: run.financials.formattedRecoverable,
      },
      evaluation: {
        precision: `${(run.evaluation.precision * 100).toFixed(1)}%`,
        recall: `${(run.evaluation.recall * 100).toFixed(1)}%`,
        f1Score: `${(run.evaluation.f1Score * 100).toFixed(1)}%`,
        matchRate: `${(run.evaluation.matchRate * 100).toFixed(1)}%`,
        resolutionRate: `${(run.evaluation.resolutionRate * 100).toFixed(1)}%`,
        falseAutoResolutionRate: `${(run.evaluation.falseAutoResolutionRate * 100).toFixed(1)}%`,
        exceptionAccuracy: `${(run.evaluation.exceptionAccuracy * 100).toFixed(1)}%`,
      },
      topExceptions: run.decisions
        .flatMap((d) => d.exceptions)
        .slice(0, 8)
        .map((e) => ({
          orderId: e.orderId,
          type: e.exceptionType,
          severity: e.severity,
          impact: `₹${(Number(e.monetaryImpactMinorUnits) / 100).toFixed(2)}`,
          action: e.recommendedAction,
        })),
      specificOrderDetails: specificOrder ? {
        orderId: specificOrder.orderId,
        state: specificOrder.state,
        method: specificOrder.method,
        confidence: `${Math.round(specificOrder.confidence * 100)}%`,
        variance: `₹${(Number(specificOrder.varianceMinorUnits) / 100).toFixed(2)}`,
        explanation: specificOrder.explanation,
        gateway: specificOrder.gatewayRecord ? {
          gross: `₹${(Number(specificOrder.gatewayRecord.grossAmountMinorUnits) / 100).toFixed(2)}`,
          net: `₹${(Number(specificOrder.gatewayRecord.netAmountMinorUnits) / 100).toFixed(2)}`,
          ref: specificOrder.gatewayRecord.rawReference,
        } : null,
        bank: specificOrder.bankRecord ? {
          credit: `₹${(Number(specificOrder.bankRecord.creditAmountMinorUnits) / 100).toFixed(2)}`,
          utr: specificOrder.bankRecord.utrReference,
        } : null,
      } : null,
    };

    const systemPrompt = `You are the Recon.ai Autonomous Finance Controller Assistant for Razorpay Track 04.
Your responsibility is to provide accurate, concise, authoritative answers to financial controller queries about payment reconciliation batches.

NON-NEGOTIABLE GROUNDING RULES:
1. Ground truth only: Answer ONLY using the facts, numbers, Order IDs, and metrics provided in the FACTUAL_CONTEXT.
2. Zero hallucination: NEVER invent numbers, UTRs, or transaction IDs. If a question asks about an order or metric not in the data, explicitly state that it does not exist in the current reconciliation batch.
3. Currency precision: Format all monetary amounts with the Rupee symbol (₹) exactly as provided.
4. Citations: Explicitly mention Order IDs, UTR references, or exception categories where relevant.
5. Provide structured, professional markdown answers suitable for an executive financial audit.`;

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `FACTUAL_CONTEXT:\n${JSON.stringify(factualContext, null, 2)}\n\nCONTROLLER QUESTION: ${question}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 800,
        },
      }),
    }).finally(() => clearTimeout(timeoutHandle));

    if (!response.ok) return null;

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts;
    const text = parts?.find((p: any) => typeof p.text === "string")?.text;
    if (!text) return null;

    // Extract citations
    const citedRecords: any[] = [];
    if (specificOrder) {
      citedRecords.push({
        type: "order",
        identifier: specificOrder.orderId,
        details: `State: ${specificOrder.state} | Variance: ₹${(Number(specificOrder.varianceMinorUnits) / 100).toFixed(2)}`,
      });
      if (specificOrder.bankRecord?.utrReference) {
        citedRecords.push({
          type: "utr",
          identifier: specificOrder.bankRecord.utrReference,
          details: `Bank Credit: ₹${(Number(specificOrder.bankRecord.creditAmountMinorUnits) / 100).toFixed(2)}`,
        });
      }
    }

    return { answer: text, citedRecords };
  }

  /**
   * Deterministic answer generator for air-gapped / offline operation.
   */
  private static answerDeterministically(
    question: string,
    run: OrchestratedRunResult,
    specificOrder: any | null
  ): { answer: string; citedRecords: any[] } {
    const q = question.toLowerCase();
    const citedRecords: any[] = [];

    // Query 1: Specific Order Details
    if (specificOrder) {
      citedRecords.push({
        type: "order",
        identifier: specificOrder.orderId,
        details: `State: ${specificOrder.state}, Variance: ₹${(Number(specificOrder.varianceMinorUnits) / 100).toFixed(2)}`,
      });

      const bankPart = specificOrder.bankRecord 
        ? `bank credit of ₹${(Number(specificOrder.bankRecord.creditAmountMinorUnits) / 100).toFixed(2)} (UTR: ${specificOrder.bankRecord.utrReference})`
        : "no recorded bank credit";
      const gatewayPart = specificOrder.gatewayRecord
        ? `gateway settlement of ₹${(Number(specificOrder.gatewayRecord.netAmountMinorUnits) / 100).toFixed(2)}`
        : "no recorded gateway record";

      return {
        answer: `### Transaction Audit: **${specificOrder.orderId}**\n\n` +
          `* **Status:** \`${specificOrder.state}\` (Confidence: ${Math.round(specificOrder.confidence * 100)}%)\n` +
          `* **Reconciliation Method:** \`${specificOrder.method}\`\n` +
          `* **Unexplained Variance:** ₹${(Number(specificOrder.varianceMinorUnits) / 100).toFixed(2)}\n` +
          `* **Multi-Source Evidence:** Matched ${gatewayPart} against ${bankPart}.\n\n` +
          `**Controller Explanation:**\n${specificOrder.explanation}\n\n` +
          (specificOrder.exceptions.length > 0 
            ? `**Active Exceptions:** ${specificOrder.exceptions.map((e: any) => `*${e.title}* (${e.recommendedAction})`).join("; ")}`
            : `*Zero open exceptions on this transaction.*`),
        citedRecords,
      };
    }

    // Query 2: Financial Leakage & Unexplained Variance
    if (q.includes("leakage") || q.includes("prevent") || q.includes("loss") || q.includes("variance")) {
      citedRecords.push({
        type: "metric",
        identifier: "Detected Leakage",
        details: run.financials.formattedLeakage,
      });
      citedRecords.push({
        type: "metric",
        identifier: "Prevented Leakage",
        details: run.financials.formattedPrevented,
      });

      return {
        answer: `### Financial Leakage & Variance Summary\n\n` +
          `Across the **${run.recordCount} record batch** (Run \`${run.runId}\`):\n\n` +
          `* **Total Batch Value Processed:** ${run.financials.formattedTotal}\n` +
          `* **Successfully Reconciled Funds:** ${run.financials.formattedReconciled}\n` +
          `* **Detected Financial Leakage:** ${run.financials.formattedLeakage} (Unsettled gateway capture & uncollected refunds)\n` +
          `* **Prevented Financial Leakage:** ${run.financials.formattedPrevented} (Caught via duplicate blockades & MDR fee audits)\n` +
          `* **Total Unexplained Variance:** ${run.financials.formattedUnresolved}\n` +
          `* **Actionable Recoverable Funds:** ${run.financials.formattedRecoverable}\n\n` +
          `The reconciliation loop prevented payouts on duplicate and mismatched claims while logging genuine uncollected breaks in the Exception Center.`,
        citedRecords,
      };
    }

    // Query 3: Evaluation Metrics / Precision & Recall / F1
    if (q.includes("precision") || q.includes("recall") || q.includes("f1") || q.includes("match rate") || q.includes("accuracy")) {
      citedRecords.push({
        type: "metric",
        identifier: "F1 Score",
        details: `${(run.evaluation.f1Score * 100).toFixed(1)}%`,
      });

      return {
        answer: `### Independent Ground-Truth Evaluation Metrics\n\n` +
          `Objective verification against isolated ground truth (**${run.recordCount} records**):\n\n` +
          `* **Match Rate:** ${(run.evaluation.matchRate * 100).toFixed(1)}% (${run.metrics.matchedCount} exact matches)\n` +
          `* **Precision:** ${(run.evaluation.precision * 100).toFixed(1)}%\n` +
          `* **Recall:** ${(run.evaluation.recall * 100).toFixed(1)}%\n` +
          `* **F1 Score:** ${(run.evaluation.f1Score * 100).toFixed(1)}%\n` +
          `* **Resolution Rate:** ${(run.evaluation.resolutionRate * 100).toFixed(1)}% (${run.metrics.resolvedCount} ambiguous cases resolved with proof)\n` +
          `* **False Auto-Resolution Rate:** ${(run.evaluation.falseAutoResolutionRate * 100).toFixed(1)}% (Guarded against false matches)\n` +
          `* **Exception Accuracy:** ${(run.evaluation.exceptionAccuracy * 100).toFixed(1)}%\n` +
          `* **Processing Throughput:** ${run.metrics.throughputPerSecond} records/sec (Duration: ${run.durationMs}ms)`,
        citedRecords,
      };
    }

    // Query 4: Exceptions & Human Review
    if (q.includes("exception") || q.includes("review") || q.includes("critical") || q.includes("escalat")) {
      const topExceptions = run.decisions.flatMap((d) => d.exceptions).slice(0, 5);
      topExceptions.forEach((e) => {
        citedRecords.push({
          type: "exception",
          identifier: e.orderId,
          details: `${e.severity}: ${e.title} (${e.recommendedAction})`,
        });
      });

      return {
        answer: `### Honest Exception & Human Review Queue\n\n` +
          `Currently tracking **${run.metrics.exceptionCount} open exceptions** graded by severity:\n\n` +
          `* **Review Required Decisions:** ${run.metrics.reviewCount} orders requiring manual sign-off\n` +
          `* **Unresolved Breaks:** ${run.metrics.unresolvedCount} orders with zero supporting evidence\n` +
          `* **Duplicate Signals Isolated:** ${run.metrics.duplicateCount} duplicate transactions blocked\n` +
          `* **Missing Credit Alerts:** ${run.metrics.missingCount} orders missing bank credits\n\n` +
          `**Top Priority Exceptions:**\n` +
          topExceptions.map((e, idx) => `${idx + 1}. **${e.orderId}** [${e.severity}]: *${e.title}* → \`${e.recommendedAction}\``).join("\n"),
        citedRecords,
      };
    }

    // Default Overview Answer
    return {
      answer: `### Recon.ai Financial Controller Overview\n\n` +
        `Summary of current batch (Run \`${run.runId}\`, **${run.recordCount} records**):\n\n` +
        `* **Deterministic High-Confidence Matches:** ${run.metrics.matchedCount} (${run.metrics.matchRatePercent}%)\n` +
        `* **AI Resolved Discrepancies:** ${run.metrics.resolvedCount} (Verified via supporting events)\n` +
        `* **Open Exceptions Graded:** ${run.metrics.exceptionCount} exceptions (Exposure: ${run.financials.formattedLeakage})\n` +
        `* **Throughput:** ${run.metrics.throughputPerSecond} records/sec in ${run.durationMs}ms.\n\n` +
        `You can ask me about specific transactions (e.g. *"Why was ORD-2026-0005 reviewed?"*), financial leakage (*"How much leakage was detected vs prevented?"*), or audit performance metrics.`,
      citedRecords,
    };
  }
}
