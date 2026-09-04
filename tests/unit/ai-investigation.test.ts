import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InvestigationToolRunner } from "../../lib/ai/tools";
import { AntiHallucinationValidator } from "../../lib/ai/validator";
import { OfflineInvestigationProvider } from "../../lib/ai/providers/offline-provider";
import { GeminiInvestigationProvider } from "../../lib/ai/providers/gemini-provider";
import { AiInvestigator } from "../../lib/ai/investigator";
import { InvestigationRequest, AiInvestigationOutput } from "../../lib/ai/types";
import { DecisionState } from "@prisma/client";

describe("AI Investigation Layer & Anti-Hallucination Guardrails", () => {
  const baseRequest: InvestigationRequest = {
    orderId: "ORD-TEST-001",
    initialState: DecisionState.REVIEW,
    varianceMinorUnits: 25000n, // ₹250.00
    gatewayRecord: {
      id: "gw_001",
      orderId: "ORD-TEST-001",
      transactionId: "pay_001",
      grossAmountMinorUnits: 100000n, // ₹1,000.00
      feeMinorUnits: 2000n,
      taxMinorUnits: 360n,
      netAmountMinorUnits: 97640n,
      currency: "INR",
      paymentStatus: "CAPTURED",
      paymentMethod: "UPI",
      transactionTime: new Date("2026-08-05T10:00:00Z"),
      rawReference: "UTRBK20260805001",
    },
    bankRecord: {
      id: "bank_001",
      utrReference: "UTRBK20260805001",
      accountNumberMasked: "XXXXXX9821",
      rawDescription: "CMS/PAYMENT/UTRBK20260805001",
      creditAmountMinorUnits: 97640n,
      currency: "INR",
      valueDate: new Date("2026-08-06T10:00:00Z"),
      bookingDate: new Date("2026-08-06T10:00:00Z"),
      isBatched: false,
      batchCount: 1,
    },
    ledgerRecord: {
      id: "ledger_001",
      journalEntryId: "JE-001",
      internalReference: "INT-001",
      orderId: "ORD-TEST-001",
      expectedAmountMinorUnits: 100000n,
      expectedFeeMinorUnits: 2000n,
      expectedTaxMinorUnits: 360n,
      expectedNetMinorUnits: 97640n,
      currency: "INR",
      accountCode: "1020",
      merchantId: "MERCH-001",
      ledgerDate: new Date("2026-08-05T10:00:00Z"),
    },
    supportingEvents: [
      {
        id: "ev_001",
        eventType: "FEE_ADJUSTMENT",
        referenceId: "ORD-TEST-001",
        amountMinorUnits: 25000n,
        feeImpactMinorUnits: 25000n,
        currency: "INR",
        eventDate: new Date("2026-08-05T10:00:00Z"),
        reasonCode: "INTERNATIONAL_SURCHARGE",
        notes: "International card fee adjustment.",
      },
    ],
  };

  // 1. Tool Execution Tests
  it("should execute bounded tools and retrieve accurate minor units data", () => {
    const toolRunner = new InvestigationToolRunner(baseRequest);

    // Transaction evidence
    const evidence = toolRunner.executeTool("get_transaction_evidence", { orderId: "ORD-TEST-001" });
    expect(evidence.result.gateway.id).toBe("gw_001");
    expect(evidence.result.gateway.netPaise).toBe("97640");

    // Supporting events
    const events = toolRunner.executeTool("inspect_supporting_events", { orderId: "ORD-TEST-001" });
    expect(events.result.totalEvents).toBe(1);
    expect(events.result.events[0].id).toBe("ev_001");
    expect(events.result.events[0].reasonCode).toBe("INTERNATIONAL_SURCHARGE");

    // Variance analysis
    const variance = toolRunner.executeTool("calculate_variance", { orderId: "ORD-TEST-001" });
    expect(variance.result.gatewayNetPaise).toBe("97640");
    expect(variance.result.totalSupportingEventOffsetPaise).toBe("25000");
  });

  // 2. Anti-Hallucination Tests
  it("should pass anti-hallucination validation when cited IDs and arithmetic are valid", () => {
    const validOutput: AiInvestigationOutput = {
      recommendation: "RESOLVED",
      confidence: 0.95,
      hypothesesConsidered: ["H1: Surcharge explained by authenticated fee adjustment"],
      reasoningSummary: "The variance is fully accounted for by fee adjustment ev_001.",
      recommendedAction: "AUTO_RESOLVE",
      citedEvidence: [
        {
          evidenceType: "FEE_ADJUSTMENT_PROOF",
          sourceRecordId: "ev_001", // Genuine ID
          sourceTable: "SupportingEvent",
          description: "Authenticated surcharge event",
          monetaryImpactPaise: 25000,
        },
      ],
    };

    const validation = AntiHallucinationValidator.validate(validOutput, baseRequest);
    expect(validation.passed).toBe(true);
    expect(validation.sanitizedRecommendation).toBe(DecisionState.RESOLVED);
    expect(validation.citedEvidence.length).toBe(1);
    expect(validation.validationError).toBeUndefined();
  });

  it("should catch hallucinated record IDs and immediately downgrade decision to REVIEW", () => {
    const hallucinatedOutput: AiInvestigationOutput = {
      recommendation: "RESOLVED",
      confidence: 0.95,
      hypothesesConsidered: ["H1: False claim"],
      reasoningSummary: "Resolved via non-existent credit.",
      recommendedAction: "AUTO_RESOLVE",
      citedEvidence: [
        {
          evidenceType: "PHANTOM_CREDIT",
          sourceRecordId: "bank_HALLUCINATED_9999", // Fabricated ID
          sourceTable: "BankRecord",
          description: "Made-up bank credit",
          monetaryImpactPaise: 25000,
        },
      ],
    };

    const validation = AntiHallucinationValidator.validate(hallucinatedOutput, baseRequest);
    expect(validation.passed).toBe(false);
    expect(validation.sanitizedRecommendation).toBe(DecisionState.REVIEW); // DOWNGRADED
    expect(validation.validationError).toContain("Anti-Hallucination Guard Triggered");
  });

  it("should prevent unauthorized RESOLVED recommendations when variance lacks supporting proof", () => {
    const requestWithUnexplainedVariance: InvestigationRequest = {
      ...baseRequest,
      varianceMinorUnits: 50000n, // ₹500.00
      supportingEvents: [], // No events
    };

    const unauthorizedResolveOutput: AiInvestigationOutput = {
      recommendation: "RESOLVED",
      confidence: 0.9,
      hypothesesConsidered: ["H1: Assume variance is fine"],
      reasoningSummary: "Variance overlooked.",
      recommendedAction: "AUTO_RESOLVE",
      citedEvidence: [],
    };

    const validation = AntiHallucinationValidator.validate(unauthorizedResolveOutput, requestWithUnexplainedVariance);
    expect(validation.passed).toBe(false);
    expect(validation.sanitizedRecommendation).toBe(DecisionState.REVIEW); // DOWNGRADED
    expect(validation.validationError).toContain("Financial Integrity Guard");
  });

  it("should safely handle malformed AI responses and fallback to REVIEW", () => {
    const malformedJson = { invalidField: 123 };
    const validation = AntiHallucinationValidator.validate(malformedJson, baseRequest);
    expect(validation.passed).toBe(false);
    expect(validation.sanitizedRecommendation).toBe(DecisionState.REVIEW);
    expect(validation.validationError).toContain("Output failed schema validation");
  });

  // 3. Gemini Provider Configuration & Model Verification
  it("should configure Gemini provider with the current supported gemini-2.5-flash model", () => {
    const provider = new GeminiInvestigationProvider();
    expect(provider.getModelIdentifier()).toBe("gemini-2.5-flash");
    expect(provider.name).toBe("gemini");
  });

  it("should support custom model overrides while defaulting to gemini-2.5-flash", () => {
    const customProvider = new GeminiInvestigationProvider({ model: "gemini-2.5-flash" });
    expect(customProvider.getModelIdentifier()).toBe("gemini-2.5-flash");
  });

  it("should report isAvailable=false when GEMINI_API_KEY is not set or empty", () => {
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = "";
      const provider = new GeminiInvestigationProvider();
      expect(provider.isAvailable()).toBe(false);
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it("should gracefully fallback to offline reasoner when Gemini API fails (e.g. HTTP 500)", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    const originalFetch = global.fetch;

    try {
      process.env.GEMINI_API_KEY = "dummy-test-key-recon-secret";
      // Mock fetch failure
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error with dummy-test-key-recon-secret"),
      } as any);

      const provider = new GeminiInvestigationProvider();
      expect(provider.isAvailable()).toBe(true);

      const result = await provider.investigate(baseRequest);

      // Should complete via offline fallback
      expect(result.provider).toBe("offline_fallback");
      expect(result.recommendation).toBe(DecisionState.RESOLVED);
      // Verify secret non-disclosure: secret key must never appear in reasoning summary
      expect(result.reasoningSummary).not.toContain("dummy-test-key-recon-secret");
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
      global.fetch = originalFetch;
    }
  });

  it("should gracefully fallback to offline reasoner when Gemini API times out", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    const originalFetch = global.fetch;

    try {
      process.env.GEMINI_API_KEY = "test-secret-key-12345";
      // Mock fetch timeout abort
      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("The operation was aborted due to timeout")), 20);
        });
      });

      const provider = new GeminiInvestigationProvider({ timeoutMs: 10 });
      const result = await provider.investigate(baseRequest);

      expect(result.provider).toBe("offline_fallback");
      expect(result.recommendation).toBe(DecisionState.RESOLVED);
      expect(result.reasoningSummary).not.toContain("test-secret-key-12345");
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
      global.fetch = originalFetch;
    }
  });

  // 4. Offline Provider Reasoning Tests
  it("should autonomously investigate and quarantine adversarial false-match traps", async () => {
    const trapRequest: InvestigationRequest = {
      orderId: "ORD-TRAP-999",
      initialState: DecisionState.CONFLICT,
      varianceMinorUnits: 0n,
      gatewayRecord: {
        id: "gw_trap",
        orderId: "ORD-TRAP-999",
        transactionId: "pay_trap",
        grossAmountMinorUnits: 150000n,
        feeMinorUnits: 3000n,
        taxMinorUnits: 540n,
        netAmountMinorUnits: 146460n,
        currency: "INR",
        paymentStatus: "CAPTURED",
        paymentMethod: "UPI",
        transactionTime: new Date("2026-08-01"),
      },
      candidates: [
        {
          bankRecord: {
            id: "bank_trap_adversary",
            utrReference: "UTRBK202608019999",
            accountNumberMasked: "XXXXXX1234",
            rawDescription: "CMS/TRAP-REF-MISMATCH/9999", // TRAP MARKER
            creditAmountMinorUnits: 146460n, // Exact amount match trap
            currency: "INR",
            valueDate: new Date("2026-08-02"),
            bookingDate: new Date("2026-08-02"),
            isBatched: false,
            batchCount: 1,
          },
          similarityScore: 0.82,
          amountDeltaMinorUnits: 0n,
          dateDeltaDays: 1,
          signals: {
            referenceExactMatch: false,
            normalizedRefMatch: false,
            amountExactMatch: true,
            dateWindowCompatible: true,
          },
        },
      ],
    };

    const provider = new OfflineInvestigationProvider();
    const result = await provider.investigate(trapRequest);

    expect(result.recommendation).toBe(DecisionState.CONFLICT);
    expect(result.recommendedAction).toBe("HOLD_PAYOUT");
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    expect(result.reasoningSummary).toContain("Adversarial trap isolated");
    expect(result.validationPassed).toBe(true);
  });

  it("should run batch investigations through AiInvestigator orchestrator", async () => {
    const requests: InvestigationRequest[] = [
      baseRequest,
      {
        orderId: "ORD-DUP-002",
        initialState: DecisionState.DUPLICATE,
        varianceMinorUnits: 100000n,
        gatewayRecord: {
          id: "gw_dup",
          orderId: "ORD-DUP-002",
          transactionId: "pay_dup_1",
          grossAmountMinorUnits: 100000n,
          feeMinorUnits: 2000n,
          taxMinorUnits: 360n,
          netAmountMinorUnits: 97640n,
          currency: "INR",
          paymentStatus: "CAPTURED",
          paymentMethod: "UPI",
          transactionTime: new Date("2026-08-01"),
        },
      },
    ];

    const results = await AiInvestigator.investigateBatch(requests);
    expect(results.length).toBe(2);
    expect(results[0].recommendation).toBe(DecisionState.RESOLVED);
    expect(results[1].recommendation).toBe(DecisionState.DUPLICATE);
    expect(results[0].toolCallsExecuted.length).toBe(4);
    expect(results[1].toolCallsExecuted.length).toBe(4);
  });
});
