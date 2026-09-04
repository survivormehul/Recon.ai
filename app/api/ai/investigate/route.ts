import { NextRequest, NextResponse } from "next/server";
import { AiInvestigator } from "@/lib/ai/investigator";
import { InvestigationRequest } from "@/lib/ai/types";
import { SyntheticDataGenerator } from "@/lib/generator/synthetic-generator";
import { DeterministicReconciliationEngine } from "@/lib/reconciliation/deterministic-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, provider, seed = 2026 } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required" },
        { status: 400 }
      );
    }

    // Look up transaction from generator (or DB)
    const generator = new SyntheticDataGenerator({ seed: Number(seed) || 2026, recordCount: 500 });
    const dataset = generator.generate();

    const batchResult = DeterministicReconciliationEngine.reconcileBatch(
      dataset.datasetId,
      dataset.gatewayRecords,
      dataset.bankRecords,
      dataset.ledgerRecords,
      dataset.supportingEvents
    );

    const decision = batchResult.decisions.find((d) => d.orderId === orderId);

    if (!decision) {
      return NextResponse.json(
        { success: false, error: `Order ${orderId} not found in dataset` },
        { status: 404 }
      );
    }

    const request: InvestigationRequest = {
      orderId: decision.orderId,
      initialState: decision.state,
      varianceMinorUnits: decision.varianceMinorUnits,
      gatewayRecord: decision.gatewayRecord,
      bankRecord: decision.bankRecord,
      ledgerRecord: decision.ledgerRecord,
      candidates: decision.candidates,
      supportingEvents: dataset.supportingEvents.filter((e) => e.referenceId === orderId),
      provider,
    };

    const result = await AiInvestigator.investigateTransaction(request);

    return NextResponse.json({
      success: true,
      investigation: {
        ...result,
        citedEvidence: result.citedEvidence.map((e) => ({
          ...e,
          monetaryImpactMinorUnits: e.monetaryImpactMinorUnits.toString(),
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Investigation failed" },
      { status: 500 }
    );
  }
}
