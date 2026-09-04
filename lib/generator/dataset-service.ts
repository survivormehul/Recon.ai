import { prisma } from "../prisma";
import { GeneratedDataset } from "./types";
import { SyntheticDataGenerator } from "./synthetic-generator";

export class DatasetService {
  /**
   * Generates and persists a synthetic dataset into PostgreSQL via Prisma.
   */
  static async createAndPersist(seed: number = 2026, recordCount: number = 500): Promise<string> {
    const generator = new SyntheticDataGenerator({ seed, recordCount });
    const dataset = generator.generate();

    // 1. Create SourceDataset header
    const created = await prisma.sourceDataset.create({
      data: {
        id: dataset.datasetId,
        name: dataset.name,
        seed: dataset.seed,
        recordCount: dataset.recordCount,
        description: `Synthetic benchmark dataset (seed: ${dataset.seed}, ${dataset.recordCount} records).`,
      },
    });

    // 2. Persist Gateway Records
    if (dataset.gatewayRecords.length > 0) {
      await prisma.gatewayRecord.createMany({
        data: dataset.gatewayRecords.map((r) => ({
          id: r.id,
          datasetId: created.id,
          orderId: r.orderId,
          transactionId: r.transactionId,
          arnReference: r.arnReference,
          rawReference: r.rawReference,
          normalizedReference: r.normalizedReference,
          grossAmountMinorUnits: r.grossAmountMinorUnits,
          feeMinorUnits: r.feeMinorUnits,
          taxMinorUnits: r.taxMinorUnits,
          netAmountMinorUnits: r.netAmountMinorUnits,
          currency: r.currency,
          paymentStatus: r.paymentStatus,
          paymentMethod: r.paymentMethod,
          transactionTime: r.transactionTime,
          settlementDueDate: r.settlementDueDate,
        })),
      });
    }

    // 3. Persist Bank Records
    if (dataset.bankRecords.length > 0) {
      await prisma.bankRecord.createMany({
        data: dataset.bankRecords.map((r) => ({
          id: r.id,
          datasetId: created.id,
          utrReference: r.utrReference,
          accountNumberMasked: r.accountNumberMasked,
          rawDescription: r.rawDescription,
          normalizedDescription: r.normalizedDescription,
          creditAmountMinorUnits: r.creditAmountMinorUnits,
          currency: r.currency,
          valueDate: r.valueDate,
          bookingDate: r.bookingDate,
          isBatched: r.isBatched,
          batchCount: r.batchCount,
        })),
      });
    }

    // 4. Persist Ledger Records
    if (dataset.ledgerRecords.length > 0) {
      await prisma.ledgerRecord.createMany({
        data: dataset.ledgerRecords.map((r) => ({
          id: r.id,
          datasetId: created.id,
          journalEntryId: r.journalEntryId,
          internalReference: r.internalReference,
          orderId: r.orderId,
          expectedAmountMinorUnits: r.expectedAmountMinorUnits,
          expectedFeeMinorUnits: r.expectedFeeMinorUnits,
          expectedTaxMinorUnits: r.expectedTaxMinorUnits,
          expectedNetMinorUnits: r.expectedNetMinorUnits,
          currency: r.currency,
          accountCode: r.accountCode,
          merchantId: r.merchantId,
          ledgerDate: r.ledgerDate,
        })),
      });
    }

    // 5. Persist Supporting Events
    if (dataset.supportingEvents.length > 0) {
      await prisma.supportingEvent.createMany({
        data: dataset.supportingEvents.map((r) => ({
          id: r.id,
          datasetId: created.id,
          eventType: r.eventType,
          referenceId: r.referenceId,
          relatedTransactionId: r.relatedTransactionId,
          amountMinorUnits: r.amountMinorUnits,
          feeImpactMinorUnits: r.feeImpactMinorUnits,
          currency: r.currency,
          eventDate: r.eventDate,
          reasonCode: r.reasonCode,
          notes: r.notes,
        })),
      });
    }

    // 6. Persist Hidden Ground Truth (Segregated)
    if (dataset.groundTruths.length > 0) {
      await prisma.groundTruthRecord.createMany({
        data: dataset.groundTruths.map((r) => ({
          id: r.id,
          datasetId: created.id,
          orderId: r.orderId,
          expectedStatus: r.expectedStatus,
          expectedCategory: r.expectedCategory,
          matchedGatewayId: r.matchedGatewayId,
          matchedBankUtr: r.matchedBankUtr,
          matchedLedgerId: r.matchedLedgerId,
          supportingEventIds: r.supportingEventIds,
          unexplainedVarianceMinorUnits: r.unexplainedVarianceMinorUnits,
          expectedExplanation: r.expectedExplanation,
        })),
      });
    }

    return created.id;
  }

  /**
   * Load dataset records for reconciliation (Strictly excludes Ground Truth during inference)
   */
  static async loadForReconciliation(datasetId: string) {
    const dataset = await prisma.sourceDataset.findUnique({
      where: { id: datasetId },
      include: {
        gatewayRecords: true,
        bankRecords: true,
        ledgerRecords: true,
        supportingEvents: true,
        // NOTICE: groundTruths is NOT included here!
      },
    });

    if (!dataset) throw new Error(`Dataset not found: ${datasetId}`);
    return dataset;
  }

  /**
   * Load ground truth records ONLY for post-run evaluation
   */
  static async loadGroundTruthForEvaluation(datasetId: string) {
    return prisma.groundTruthRecord.findMany({
      where: { datasetId },
    });
  }
}
