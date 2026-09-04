import { NextRequest, NextResponse } from "next/server";
import { SyntheticDataGenerator } from "@/lib/generator/synthetic-generator";
import { Money } from "@/lib/money";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const seed = Number(body.seed) || 2026;
    const recordCount = Number(body.recordCount) || 500;

    const generator = new SyntheticDataGenerator({ seed, recordCount });
    const dataset = generator.generate();

    // Group scenarios by category for distribution summary
    const distribution: Record<string, number> = {};
    for (const gt of dataset.groundTruths) {
      distribution[gt.expectedCategory] = (distribution[gt.expectedCategory] || 0) + 1;
    }

    // Calculate total gross value in dataset
    const totalGrossPaise = dataset.gatewayRecords.reduce(
      (acc, r) => acc + r.grossAmountMinorUnits,
      0n
    );
    const totalNetPaise = dataset.gatewayRecords.reduce(
      (acc, r) => acc + r.netAmountMinorUnits,
      0n
    );

    return NextResponse.json({
      success: true,
      dataset: {
        id: dataset.datasetId,
        name: dataset.name,
        seed: dataset.seed,
        counts: {
          gateway: dataset.gatewayRecords.length,
          bank: dataset.bankRecords.length,
          ledger: dataset.ledgerRecords.length,
          supportingEvents: dataset.supportingEvents.length,
          groundTruths: dataset.groundTruths.length,
        },
        financials: {
          totalGross: Money.format(totalGrossPaise),
          totalNet: Money.format(totalNetPaise),
          totalGrossMinorUnits: totalGrossPaise.toString(),
          totalNetMinorUnits: totalNetPaise.toString(),
        },
        scenarioDistribution: distribution,
        preview: {
          gateway: dataset.gatewayRecords.slice(0, 5).map((r) => ({
            ...r,
            grossAmountMinorUnits: r.grossAmountMinorUnits.toString(),
            feeMinorUnits: r.feeMinorUnits.toString(),
            taxMinorUnits: r.taxMinorUnits.toString(),
            netAmountMinorUnits: r.netAmountMinorUnits.toString(),
            formattedGross: Money.format(r.grossAmountMinorUnits),
            formattedNet: Money.format(r.netAmountMinorUnits),
          })),
          bank: dataset.bankRecords.slice(0, 5).map((r) => ({
            ...r,
            creditAmountMinorUnits: r.creditAmountMinorUnits.toString(),
            formattedCredit: Money.format(r.creditAmountMinorUnits),
          })),
          supportingEvents: dataset.supportingEvents.slice(0, 5).map((r) => ({
            ...r,
            amountMinorUnits: r.amountMinorUnits.toString(),
            feeImpactMinorUnits: r.feeImpactMinorUnits.toString(),
            formattedAmount: Money.format(r.amountMinorUnits),
          })),
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate dataset" },
      { status: 500 }
    );
  }
}
