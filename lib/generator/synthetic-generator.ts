import { 
  GeneratedDataset, 
  RawGatewayRecord, 
  RawBankRecord, 
  RawLedgerRecord, 
  RawSupportingEvent, 
  RawGroundTruth, 
  ScenarioType 
} from "./types";
import { SeedableRandom } from "./seedable-random";
import { Money } from "../money";
import { DecisionState, SupportingEventType } from "@prisma/client";

export interface GeneratorOptions {
  seed?: number;
  recordCount?: number; // default 500
  datasetName?: string;
}

export class SyntheticDataGenerator {
  private rng: SeedableRandom;
  private recordCount: number;
  private datasetName: string;
  private seed: number;

  constructor(options: GeneratorOptions = {}) {
    this.seed = options.seed ?? 2026;
    this.recordCount = Math.max(options.recordCount ?? 500, 50);
    this.datasetName = options.datasetName ?? `Synthetic_Recon_Batch_${this.seed}_${this.recordCount}`;
    this.rng = new SeedableRandom(this.seed);
  }

  public generate(): GeneratedDataset {
    const datasetId = `ds_${this.seed}_${Date.now()}`;
    const baseDate = new Date("2026-08-01T10:00:00Z");

    const gatewayRecords: RawGatewayRecord[] = [];
    const bankRecords: RawBankRecord[] = [];
    const ledgerRecords: RawLedgerRecord[] = [];
    const supportingEvents: RawSupportingEvent[] = [];
    const groundTruths: RawGroundTruth[] = [];

    // Helper to generate UTR: e.g. "UTRBK20260801000123"
    const generateUtr = (num: number) => `UTRBK202608${String(num).padStart(6, "0")}`;

    // Target scenario distribution counts for total records
    // Batched bank payouts group multiple gateway records (e.g. 5 orders in 1 bank credit)
    let orderIndex = 1000;
    let bankIndex = 5000;

    // We generate records in chunks until we reach the target record count for all sources
    while (gatewayRecords.length < this.recordCount || ledgerRecords.length < this.recordCount) {
      orderIndex++;
      const currentOrderId = `ORD-${orderIndex}`;
      const txnId = `pay_${this.seed}_${orderIndex}`;
      const baseUtr = generateUtr(orderIndex);

      // Deterministic date between 2026-08-01 and 2026-08-25
      const dayOffset = this.rng.nextInt(0, 20);
      const hourOffset = this.rng.nextInt(9, 21);
      const txnTime = new Date(baseDate.getTime() + (dayOffset * 86400000) + (hourOffset * 3600000));
      
      // Amount between ₹100.00 (10000 paise) and ₹50,000.00 (5000000 paise)
      const grossAmountMinorUnits = BigInt(this.rng.nextInt(100, 50000)) * 100n + BigInt(this.rng.pick([0, 25, 50, 75, 99]));
      const grossMinorUnits = grossAmountMinorUnits;
      const { feeMinorUnits, taxMinorUnits, netAmountMinorUnits } = Money.calculateStandardFees(grossAmountMinorUnits);

      // Determine Scenario based on random roll
      const roll = this.rng.next();

      if (roll < 0.52) {
        // -------------------------------------------------------------
        // 1. EXACT MATCH (~52%)
        // -------------------------------------------------------------
        const settlementDate = new Date(txnTime.getTime() + 86400000); // T+1
        
        gatewayRecords.push({
          id: `gw_${orderIndex}`,
          orderId: currentOrderId,
          transactionId: txnId,
          arnReference: `ARN-${orderIndex}`,
          rawReference: baseUtr,
          normalizedReference: baseUtr,
          grossAmountMinorUnits,
          feeMinorUnits,
          taxMinorUnits,
          netAmountMinorUnits,
          currency: "INR",
          paymentStatus: "CAPTURED",
          paymentMethod: this.rng.pick(["UPI", "CARD", "NETBANKING"]),
          transactionTime: txnTime,
          settlementDueDate: settlementDate,
        });

        bankRecords.push({
          id: `bank_${orderIndex}`,
          utrReference: baseUtr,
          accountNumberMasked: "XXXXXX9821",
          rawDescription: `CMS/PAYMENT-SETTLE/${baseUtr}/RAZORPAY`,
          normalizedDescription: baseUtr,
          creditAmountMinorUnits: netAmountMinorUnits,
          currency: "INR",
          valueDate: settlementDate,
          bookingDate: settlementDate,
          isBatched: false,
          batchCount: 1,
        });

        ledgerRecords.push({
          id: `ledger_${orderIndex}`,
          journalEntryId: `JE-${orderIndex}`,
          internalReference: `INT-${orderIndex}`,
          orderId: currentOrderId,
          expectedAmountMinorUnits: grossMinorUnits,
          expectedFeeMinorUnits: feeMinorUnits,
          expectedTaxMinorUnits: taxMinorUnits,
          expectedNetMinorUnits: netAmountMinorUnits,
          currency: "INR",
          accountCode: "1020-PAYMENT-CLEARING",
          merchantId: "MERCH-001",
          ledgerDate: txnTime,
        });

        groundTruths.push({
          id: `gt_${orderIndex}`,
          orderId: currentOrderId,
          expectedStatus: "MATCHED",
          expectedCategory: "EXACT_MATCH",
          matchedGatewayId: `gw_${orderIndex}`,
          matchedBankUtr: baseUtr,
          matchedLedgerId: `ledger_${orderIndex}`,
          supportingEventIds: [],
          unexplainedVarianceMinorUnits: 0n,
          expectedExplanation: "Exact deterministic 1-to-1 match with standard fee and tax.",
        });

      } else if (roll < 0.62) {
        // -------------------------------------------------------------
        // 2. REFERENCE FORMAT VARIATION (~10%)
        // -------------------------------------------------------------
        const settlementDate = new Date(txnTime.getTime() + 86400000);
        const noisyUtr = this.rng.pick([
          `  ${baseUtr}  `,                  // leading/trailing whitespace
          `CMS-${baseUtr.toLowerCase()}`,      // lowercase with prefix
          baseUtr.replace(/BK/, " BK "),       // internal spaces
          `NEFT/${baseUtr}///SETTLEMENT`,      // bank slash wrappers
        ]);

        gatewayRecords.push({
          id: `gw_${orderIndex}`,
          orderId: currentOrderId,
          transactionId: txnId,
          arnReference: `ARN-${orderIndex}`,
          rawReference: baseUtr,
          normalizedReference: baseUtr,
          grossAmountMinorUnits,
          feeMinorUnits,
          taxMinorUnits,
          netAmountMinorUnits,
          currency: "INR",
          paymentStatus: "CAPTURED",
          paymentMethod: "UPI",
          transactionTime: txnTime,
          settlementDueDate: settlementDate,
        });

        bankRecords.push({
          id: `bank_${orderIndex}`,
          utrReference: noisyUtr,
          accountNumberMasked: "XXXXXX9821",
          rawDescription: `NEFT-CR-${noisyUtr}`,
          creditAmountMinorUnits: netAmountMinorUnits,
          currency: "INR",
          valueDate: settlementDate,
          bookingDate: settlementDate,
          isBatched: false,
          batchCount: 1,
        });

        ledgerRecords.push({
          id: `ledger_${orderIndex}`,
          journalEntryId: `JE-${orderIndex}`,
          internalReference: `INT-${orderIndex}`,
          orderId: currentOrderId,
          expectedAmountMinorUnits: grossMinorUnits,
          expectedFeeMinorUnits: feeMinorUnits,
          expectedTaxMinorUnits: taxMinorUnits,
          expectedNetMinorUnits: netAmountMinorUnits,
          currency: "INR",
          accountCode: "1020-PAYMENT-CLEARING",
          merchantId: "MERCH-001",
          ledgerDate: txnTime,
        });

        groundTruths.push({
          id: `gt_${orderIndex}`,
          orderId: currentOrderId,
          expectedStatus: "MATCHED",
          expectedCategory: "REFERENCE_FORMAT_VARIATION",
          matchedGatewayId: `gw_${orderIndex}`,
          matchedBankUtr: noisyUtr,
          matchedLedgerId: `ledger_${orderIndex}`,
          supportingEventIds: [],
          unexplainedVarianceMinorUnits: 0n,
          expectedExplanation: "Match succeeds after normalizing noisy reference format.",
        });

      } else if (roll < 0.70) {
        // -------------------------------------------------------------
        // 3. DATE OFFSET (~8%)
        // -------------------------------------------------------------
        // Delayed payout by 3 business days (e.g. holiday or weekend)
        const settlementDate = new Date(txnTime.getTime() + (3 * 86400000));

        gatewayRecords.push({
          id: `gw_${orderIndex}`,
          orderId: currentOrderId,
          transactionId: txnId,
          rawReference: baseUtr,
          normalizedReference: baseUtr,
          grossAmountMinorUnits,
          feeMinorUnits,
          taxMinorUnits,
          netAmountMinorUnits,
          currency: "INR",
          paymentStatus: "CAPTURED",
          paymentMethod: "NETBANKING",
          transactionTime: txnTime,
          settlementDueDate: new Date(txnTime.getTime() + 86400000), // Expected T+1, arrived T+3
        });

        bankRecords.push({
          id: `bank_${orderIndex}`,
          utrReference: baseUtr,
          accountNumberMasked: "XXXXXX9821",
          rawDescription: `SETTLEMENT-DELAYED/${baseUtr}`,
          creditAmountMinorUnits: netAmountMinorUnits,
          currency: "INR",
          valueDate: settlementDate,
          bookingDate: settlementDate,
          isBatched: false,
          batchCount: 1,
        });

        ledgerRecords.push({
          id: `ledger_${orderIndex}`,
          journalEntryId: `JE-${orderIndex}`,
          internalReference: `INT-${orderIndex}`,
          orderId: currentOrderId,
          expectedAmountMinorUnits: grossMinorUnits,
          expectedFeeMinorUnits: feeMinorUnits,
          expectedTaxMinorUnits: taxMinorUnits,
          expectedNetMinorUnits: netAmountMinorUnits,
          currency: "INR",
          accountCode: "1020-PAYMENT-CLEARING",
          merchantId: "MERCH-001",
          ledgerDate: txnTime,
        });

        groundTruths.push({
          id: `gt_${orderIndex}`,
          orderId: currentOrderId,
          expectedStatus: "MATCHED",
          expectedCategory: "DATE_OFFSET",
          matchedGatewayId: `gw_${orderIndex}`,
          matchedBankUtr: baseUtr,
          matchedLedgerId: `ledger_${orderIndex}`,
          supportingEventIds: [],
          unexplainedVarianceMinorUnits: 0n,
          expectedExplanation: "Match confirmed via date window tolerance despite 3-day bank settlement delay.",
        });

      } else if (roll < 0.77) {
        // -------------------------------------------------------------
        // 4. BATCHED BANK SETTLEMENT (~7%) - Many-To-One
        // -------------------------------------------------------------
        // Group next 3 to 5 transactions into a single bank credit payout
        const batchSize = Math.min(this.rng.nextInt(3, 5), this.recordCount - gatewayRecords.length);
        bankIndex++;
        const batchUtr = `BATCH-UTR-${bankIndex}`;
        let batchTotalNet = 0n;
        const batchedOrderIds: string[] = [];

        for (let b = 0; b < batchSize; b++) {
          const bOrderIndex = orderIndex + b;
          const bOrderId = `ORD-${bOrderIndex}`;
          const bTxnId = `pay_${this.seed}_${bOrderIndex}`;
          const bGross = BigInt(this.rng.nextInt(150, 10000)) * 100n;
          const { feeMinorUnits: bFee, taxMinorUnits: bTax, netAmountMinorUnits: bNet } = Money.calculateStandardFees(bGross);
          
          batchTotalNet += bNet;
          batchedOrderIds.push(bOrderId);

          gatewayRecords.push({
            id: `gw_${bOrderIndex}`,
            orderId: bOrderId,
            transactionId: bTxnId,
            rawReference: batchUtr,
            normalizedReference: batchUtr,
            grossAmountMinorUnits: bGross,
            feeMinorUnits: bFee,
            taxMinorUnits: bTax,
            netAmountMinorUnits: bNet,
            currency: "INR",
            paymentStatus: "CAPTURED",
            paymentMethod: "UPI",
            transactionTime: txnTime,
          });

          ledgerRecords.push({
            id: `ledger_${bOrderIndex}`,
            journalEntryId: `JE-${bOrderIndex}`,
            internalReference: `INT-${bOrderIndex}`,
            orderId: bOrderId,
            expectedAmountMinorUnits: bGross,
            expectedFeeMinorUnits: bFee,
            expectedTaxMinorUnits: bTax,
            expectedNetMinorUnits: bNet,
            currency: "INR",
            accountCode: "1020-PAYMENT-CLEARING",
            merchantId: "MERCH-001",
            ledgerDate: txnTime,
          });

          groundTruths.push({
            id: `gt_${bOrderIndex}`,
            orderId: bOrderId,
            expectedStatus: "MATCHED",
            expectedCategory: "BATCHED_BANK_CREDIT",
            matchedGatewayId: `gw_${bOrderIndex}`,
            matchedBankUtr: batchUtr,
            matchedLedgerId: `ledger_${bOrderIndex}`,
            supportingEventIds: [],
            unexplainedVarianceMinorUnits: 0n,
            expectedExplanation: `Many-to-one batch payout. Order is 1 of ${batchSize} transactions in batch ${batchUtr}.`,
          });
        }

        // Single consolidated bank credit for the whole batch
        bankRecords.push({
          id: `bank_batch_${bankIndex}`,
          utrReference: batchUtr,
          accountNumberMasked: "XXXXXX9821",
          rawDescription: `CMS/BATCH-PAYOUT/${batchUtr}/COUNT-${batchSize}`,
          creditAmountMinorUnits: batchTotalNet,
          currency: "INR",
          valueDate: new Date(txnTime.getTime() + 86400000),
          bookingDate: new Date(txnTime.getTime() + 86400000),
          isBatched: true,
          batchCount: batchSize,
        });

        orderIndex += (batchSize - 1); // advance order index

      } else if (roll < 0.82) {
        // -------------------------------------------------------------
        // 5. REFUND OFFSET (~5%)
        // -------------------------------------------------------------
        // Customer requested refund; refund event exists in supporting records
        const refundAmount = (grossMinorUnits * 100n) / 100n; // full refund
        const eventId = `ev_ref_${orderIndex}`;

        gatewayRecords.push({
          id: `gw_${orderIndex}`,
          orderId: currentOrderId,
          transactionId: txnId,
          rawReference: baseUtr,
          normalizedReference: baseUtr,
          grossAmountMinorUnits,
          feeMinorUnits,
          taxMinorUnits,
          netAmountMinorUnits,
          currency: "INR",
          paymentStatus: "REFUNDED",
          paymentMethod: "UPI",
          transactionTime: txnTime,
        });

        // Bank payout was reduced or reversed by refund amount
        bankRecords.push({
          id: `bank_${orderIndex}`,
          utrReference: baseUtr,
          accountNumberMasked: "XXXXXX9821",
          rawDescription: `REFUND-REVERSAL/${baseUtr}`,
          creditAmountMinorUnits: 0n, // Net zero credit due to refund
          currency: "INR",
          valueDate: new Date(txnTime.getTime() + 86400000),
          bookingDate: new Date(txnTime.getTime() + 86400000),
          isBatched: false,
          batchCount: 1,
        });

        ledgerRecords.push({
          id: `ledger_${orderIndex}`,
          journalEntryId: `JE-${orderIndex}`,
          internalReference: `INT-${orderIndex}`,
          orderId: currentOrderId,
          expectedAmountMinorUnits: grossMinorUnits,
          expectedFeeMinorUnits: feeMinorUnits,
          expectedTaxMinorUnits: taxMinorUnits,
          expectedNetMinorUnits: netAmountMinorUnits,
          currency: "INR",
          accountCode: "1020-PAYMENT-CLEARING",
          merchantId: "MERCH-001",
          ledgerDate: txnTime,
        });

        supportingEvents.push({
          id: eventId,
          eventType: "REFUND",
          referenceId: currentOrderId,
          relatedTransactionId: txnId,
          amountMinorUnits: refundAmount,
          feeImpactMinorUnits: 0n,
          currency: "INR",
          eventDate: new Date(txnTime.getTime() + 43200000),
          reasonCode: "CUSTOMER_RETURN",
          notes: "Customer initiated full refund within 12 hours.",
        });

        groundTruths.push({
          id: `gt_${orderIndex}`,
          orderId: currentOrderId,
          expectedStatus: "RESOLVED",
          expectedCategory: "REFUND_OFFSET",
          matchedGatewayId: `gw_${orderIndex}`,
          matchedBankUtr: baseUtr,
          matchedLedgerId: `ledger_${orderIndex}`,
          supportingEventIds: [eventId],
          unexplainedVarianceMinorUnits: 0n,
          expectedExplanation: "Discrepancy fully explained by verified refund supporting event.",
        });

      } else if (roll < 0.86) {
        // -------------------------------------------------------------
        // 6. FEE / TAX DISCREPANCY (~4%)
        // -------------------------------------------------------------
        // Gateway applied custom high-risk card surcharge (e.g. 3.0% instead of 2.0%)
        const surchargeMinorUnits = (grossMinorUnits * 100n) / 10000n; // 1% extra fee
        const actualFee = feeMinorUnits + surchargeMinorUnits;
        const actualNet = grossMinorUnits - actualFee - taxMinorUnits;
        const eventId = `ev_fee_${orderIndex}`;

        gatewayRecords.push({
          id: `gw_${orderIndex}`,
          orderId: currentOrderId,
          transactionId: txnId,
          rawReference: baseUtr,
          normalizedReference: baseUtr,
          grossAmountMinorUnits,
          feeMinorUnits: actualFee,
          taxMinorUnits,
          netAmountMinorUnits: actualNet,
          currency: "INR",
          paymentStatus: "CAPTURED",
          paymentMethod: "CARD",
          transactionTime: txnTime,
        });

        bankRecords.push({
          id: `bank_${orderIndex}`,
          utrReference: baseUtr,
          accountNumberMasked: "XXXXXX9821",
          rawDescription: `SETTLE/${baseUtr}`,
          creditAmountMinorUnits: actualNet,
          currency: "INR",
          valueDate: new Date(txnTime.getTime() + 86400000),
          bookingDate: new Date(txnTime.getTime() + 86400000),
          isBatched: false,
          batchCount: 1,
        });

        ledgerRecords.push({
          id: `ledger_${orderIndex}`,
          journalEntryId: `JE-${orderIndex}`,
          internalReference: `INT-${orderIndex}`,
          orderId: currentOrderId,
          expectedAmountMinorUnits: grossMinorUnits,
          expectedFeeMinorUnits: feeMinorUnits, // Ledger expected standard 2.0%
          expectedTaxMinorUnits: taxMinorUnits,
          expectedNetMinorUnits: netAmountMinorUnits,
          currency: "INR",
          accountCode: "1020-PAYMENT-CLEARING",
          merchantId: "MERCH-001",
          ledgerDate: txnTime,
        });

        supportingEvents.push({
          id: eventId,
          eventType: "FEE_ADJUSTMENT",
          referenceId: currentOrderId,
          relatedTransactionId: txnId,
          amountMinorUnits: surchargeMinorUnits,
          feeImpactMinorUnits: surchargeMinorUnits,
          currency: "INR",
          eventDate: txnTime,
          reasonCode: "INTERNATIONAL_CARD_SURCHARGE",
          notes: "Commercial international card fee adjustment applied by gateway.",
        });

        groundTruths.push({
          id: `gt_${orderIndex}`,
          orderId: currentOrderId,
          expectedStatus: "RESOLVED",
          expectedCategory: "FEE_DISCREPANCY",
          matchedGatewayId: `gw_${orderIndex}`,
          matchedBankUtr: baseUtr,
          matchedLedgerId: `ledger_${orderIndex}`,
          supportingEventIds: [eventId],
          unexplainedVarianceMinorUnits: 0n,
          expectedExplanation: "Net settlement variance resolved via authenticated fee adjustment surcharge evidence.",
        });

      } else if (roll < 0.90) {
        // -------------------------------------------------------------
        // 7. CHARGEBACK OFFSET (~4%)
        // -------------------------------------------------------------
        const disputeAmount = grossMinorUnits;
        const eventId = `ev_cb_${orderIndex}`;

        gatewayRecords.push({
          id: `gw_${orderIndex}`,
          orderId: currentOrderId,
          transactionId: txnId,
          rawReference: baseUtr,
          normalizedReference: baseUtr,
          grossAmountMinorUnits,
          feeMinorUnits,
          taxMinorUnits,
          netAmountMinorUnits,
          currency: "INR",
          paymentStatus: "DISPUTED",
          paymentMethod: "CARD",
          transactionTime: txnTime,
        });

        bankRecords.push({
          id: `bank_${orderIndex}`,
          utrReference: baseUtr,
          accountNumberMasked: "XXXXXX9821",
          rawDescription: `CHARGEBACK-HOLD/${baseUtr}`,
          creditAmountMinorUnits: 0n, // Withheld due to chargeback
          currency: "INR",
          valueDate: new Date(txnTime.getTime() + 86400000),
          bookingDate: new Date(txnTime.getTime() + 86400000),
          isBatched: false,
          batchCount: 1,
        });

        ledgerRecords.push({
          id: `ledger_${orderIndex}`,
          journalEntryId: `JE-${orderIndex}`,
          internalReference: `INT-${orderIndex}`,
          orderId: currentOrderId,
          expectedAmountMinorUnits: grossMinorUnits,
          expectedFeeMinorUnits: feeMinorUnits,
          expectedTaxMinorUnits: taxMinorUnits,
          expectedNetMinorUnits: netAmountMinorUnits,
          currency: "INR",
          accountCode: "1020-PAYMENT-CLEARING",
          merchantId: "MERCH-001",
          ledgerDate: txnTime,
        });

        supportingEvents.push({
          id: eventId,
          eventType: "CHARGEBACK",
          referenceId: currentOrderId,
          relatedTransactionId: txnId,
          amountMinorUnits: disputeAmount,
          feeImpactMinorUnits: 0n,
          currency: "INR",
          eventDate: new Date(txnTime.getTime() + 86400000),
          reasonCode: "FRAUD_CLAIM_ISSUER",
          notes: "Issuing bank initiated chargeback dispute. Settlement held in escrow.",
        });

        groundTruths.push({
          id: `gt_${orderIndex}`,
          orderId: currentOrderId,
          expectedStatus: "RESOLVED",
          expectedCategory: "CHARGEBACK_OFFSET",
          matchedGatewayId: `gw_${orderIndex}`,
          matchedBankUtr: baseUtr,
          matchedLedgerId: `ledger_${orderIndex}`,
          supportingEventIds: [eventId],
          unexplainedVarianceMinorUnits: 0n,
          expectedExplanation: "Zero bank credit resolved through verified chargeback hold event.",
        });

      } else if (roll < 0.93) {
        // -------------------------------------------------------------
        // 8. DUPLICATE PAYMENT (~3%)
        // -------------------------------------------------------------
        // Customer paid twice for the same Order ID
        const dupTxnId = `pay_${this.seed}_${orderIndex}_dup`;
        const dupUtr = generateUtr(orderIndex + 90000);

        gatewayRecords.push({
          id: `gw_${orderIndex}`,
          orderId: currentOrderId,
          transactionId: txnId,
          rawReference: baseUtr,
          normalizedReference: baseUtr,
          grossAmountMinorUnits,
          feeMinorUnits,
          taxMinorUnits,
          netAmountMinorUnits,
          currency: "INR",
          paymentStatus: "CAPTURED",
          paymentMethod: "UPI",
          transactionTime: txnTime,
        });

        // Duplicate second payment capture
        gatewayRecords.push({
          id: `gw_${orderIndex}_dup`,
          orderId: currentOrderId,
          transactionId: dupTxnId,
          rawReference: dupUtr,
          normalizedReference: dupUtr,
          grossAmountMinorUnits,
          feeMinorUnits,
          taxMinorUnits,
          netAmountMinorUnits,
          currency: "INR",
          paymentStatus: "CAPTURED",
          paymentMethod: "UPI",
          transactionTime: new Date(txnTime.getTime() + 120000), // 2 mins later
        });

        bankRecords.push({
          id: `bank_${orderIndex}`,
          utrReference: baseUtr,
          accountNumberMasked: "XXXXXX9821",
          rawDescription: `SETTLE/${baseUtr}`,
          creditAmountMinorUnits: netAmountMinorUnits,
          currency: "INR",
          valueDate: new Date(txnTime.getTime() + 86400000),
          bookingDate: new Date(txnTime.getTime() + 86400000),
          isBatched: false,
          batchCount: 1,
        });

        bankRecords.push({
          id: `bank_${orderIndex}_dup`,
          utrReference: dupUtr,
          accountNumberMasked: "XXXXXX9821",
          rawDescription: `SETTLE/${dupUtr}`,
          creditAmountMinorUnits: netAmountMinorUnits,
          currency: "INR",
          valueDate: new Date(txnTime.getTime() + 86400000),
          bookingDate: new Date(txnTime.getTime() + 86400000),
          isBatched: false,
          batchCount: 1,
        });

        // Only ONE order was placed in ledger
        ledgerRecords.push({
          id: `ledger_${orderIndex}`,
          journalEntryId: `JE-${orderIndex}`,
          internalReference: `INT-${orderIndex}`,
          orderId: currentOrderId,
          expectedAmountMinorUnits: grossMinorUnits,
          expectedFeeMinorUnits: feeMinorUnits,
          expectedTaxMinorUnits: taxMinorUnits,
          expectedNetMinorUnits: netAmountMinorUnits,
          currency: "INR",
          accountCode: "1020-PAYMENT-CLEARING",
          merchantId: "MERCH-001",
          ledgerDate: txnTime,
        });

        groundTruths.push({
          id: `gt_${orderIndex}`,
          orderId: currentOrderId,
          expectedStatus: "DUPLICATE",
          expectedCategory: "DUPLICATE_PAYMENT",
          matchedGatewayId: `gw_${orderIndex}`,
          matchedBankUtr: baseUtr,
          matchedLedgerId: `ledger_${orderIndex}`,
          supportingEventIds: [],
          unexplainedVarianceMinorUnits: netAmountMinorUnits,
          expectedExplanation: `Duplicate customer payment detected for ${currentOrderId}. Second capture ${dupTxnId} requires refund.`,
        });

      } else if (roll < 0.96) {
        // -------------------------------------------------------------
        // 9. MISSING BANK CREDIT (~3%)
        // -------------------------------------------------------------
        // Gateway says payment was captured and internal ledger booked it,
        // but bank credit was NEVER received (unsettled / stuck funds).
        gatewayRecords.push({
          id: `gw_${orderIndex}`,
          orderId: currentOrderId,
          transactionId: txnId,
          rawReference: baseUtr,
          normalizedReference: baseUtr,
          grossAmountMinorUnits,
          feeMinorUnits,
          taxMinorUnits,
          netAmountMinorUnits,
          currency: "INR",
          paymentStatus: "CAPTURED",
          paymentMethod: "UPI",
          transactionTime: txnTime,
          settlementDueDate: new Date(txnTime.getTime() + 86400000),
        });

        ledgerRecords.push({
          id: `ledger_${orderIndex}`,
          journalEntryId: `JE-${orderIndex}`,
          internalReference: `INT-${orderIndex}`,
          orderId: currentOrderId,
          expectedAmountMinorUnits: grossMinorUnits,
          expectedFeeMinorUnits: feeMinorUnits,
          expectedTaxMinorUnits: taxMinorUnits,
          expectedNetMinorUnits: netAmountMinorUnits,
          currency: "INR",
          accountCode: "1020-PAYMENT-CLEARING",
          merchantId: "MERCH-001",
          ledgerDate: txnTime,
        });

        groundTruths.push({
          id: `gt_${orderIndex}`,
          orderId: currentOrderId,
          expectedStatus: "MISSING",
          expectedCategory: "MISSING_BANK_CREDIT",
          matchedGatewayId: `gw_${orderIndex}`,
          matchedBankUtr: undefined,
          matchedLedgerId: `ledger_${orderIndex}`,
          supportingEventIds: [],
          unexplainedVarianceMinorUnits: netAmountMinorUnits,
          expectedExplanation: "Unsettled funds. Gateway captured and ledger booked order, but bank statement has no record.",
        });

      } else if (roll < 0.98) {
        // -------------------------------------------------------------
        // 10. FALSE MATCH TRAP (~2%) - Adversarial Test
        // -------------------------------------------------------------
        // Two independent orders have identical amount and date,
        // but completely different merchants and order references.
        // The engine MUST NOT falsely pair them together.
        const trapUtr = generateUtr(orderIndex + 88888);
        const trapOrderId = `ORD-${orderIndex}-TRAP`;

        gatewayRecords.push({
          id: `gw_${orderIndex}`,
          orderId: currentOrderId,
          transactionId: txnId,
          rawReference: baseUtr,
          normalizedReference: baseUtr,
          grossAmountMinorUnits,
          feeMinorUnits,
          taxMinorUnits,
          netAmountMinorUnits,
          currency: "INR",
          paymentStatus: "CAPTURED",
          paymentMethod: "UPI",
          transactionTime: txnTime,
        });

        // Bank credit exists for a DIFFERENT order with same amount
        bankRecords.push({
          id: `bank_${orderIndex}`,
          utrReference: trapUtr,
          accountNumberMasked: "XXXXXX9821",
          rawDescription: `SETTLE/${trapUtr}/REF-${trapOrderId}`,
          creditAmountMinorUnits: netAmountMinorUnits,
          currency: "INR",
          valueDate: new Date(txnTime.getTime() + 86400000),
          bookingDate: new Date(txnTime.getTime() + 86400000),
          isBatched: false,
          batchCount: 1,
        });

        ledgerRecords.push({
          id: `ledger_${orderIndex}`,
          journalEntryId: `JE-${orderIndex}`,
          internalReference: `INT-${orderIndex}`,
          orderId: currentOrderId,
          expectedAmountMinorUnits: grossMinorUnits,
          expectedFeeMinorUnits: feeMinorUnits,
          expectedTaxMinorUnits: taxMinorUnits,
          expectedNetMinorUnits: netAmountMinorUnits,
          currency: "INR",
          accountCode: "1020-PAYMENT-CLEARING",
          merchantId: "MERCH-001",
          ledgerDate: txnTime,
        });

        groundTruths.push({
          id: `gt_${orderIndex}`,
          orderId: currentOrderId,
          expectedStatus: "REVIEW",
          expectedCategory: "FALSE_MATCH_TRAP",
          matchedGatewayId: `gw_${orderIndex}`,
          matchedBankUtr: undefined,
          matchedLedgerId: `ledger_${orderIndex}`,
          supportingEventIds: [],
          unexplainedVarianceMinorUnits: netAmountMinorUnits,
          expectedExplanation: "Adversarial false match trap. Identical amount and date but distinct transactions. Escalate to Review.",
        });

      } else {
        // -------------------------------------------------------------
        // 11. GENUINE UNEXPLAINED VARIANCE (~2%)
        // -------------------------------------------------------------
        // Bank credit has random discrepancy with ZERO supporting events.
        // The AI and engine MUST refuse to guess and mark UNRESOLVED.
        const unexplainedShortfall = BigInt(this.rng.nextInt(50, 500)) * 100n; // ₹50 to ₹500
        const flawedNet = netAmountMinorUnits - unexplainedShortfall;

        gatewayRecords.push({
          id: `gw_${orderIndex}`,
          orderId: currentOrderId,
          transactionId: txnId,
          rawReference: baseUtr,
          normalizedReference: baseUtr,
          grossAmountMinorUnits,
          feeMinorUnits,
          taxMinorUnits,
          netAmountMinorUnits,
          currency: "INR",
          paymentStatus: "CAPTURED",
          paymentMethod: "UPI",
          transactionTime: txnTime,
        });

        bankRecords.push({
          id: `bank_${orderIndex}`,
          utrReference: baseUtr,
          accountNumberMasked: "XXXXXX9821",
          rawDescription: `SETTLE/${baseUtr}`,
          creditAmountMinorUnits: flawedNet,
          currency: "INR",
          valueDate: new Date(txnTime.getTime() + 86400000),
          bookingDate: new Date(txnTime.getTime() + 86400000),
          isBatched: false,
          batchCount: 1,
        });

        ledgerRecords.push({
          id: `ledger_${orderIndex}`,
          journalEntryId: `JE-${orderIndex}`,
          internalReference: `INT-${orderIndex}`,
          orderId: currentOrderId,
          expectedAmountMinorUnits: grossMinorUnits,
          expectedFeeMinorUnits: feeMinorUnits,
          expectedTaxMinorUnits: taxMinorUnits,
          expectedNetMinorUnits: netAmountMinorUnits,
          currency: "INR",
          accountCode: "1020-PAYMENT-CLEARING",
          merchantId: "MERCH-001",
          ledgerDate: txnTime,
        });

        groundTruths.push({
          id: `gt_${orderIndex}`,
          orderId: currentOrderId,
          expectedStatus: "UNRESOLVED",
          expectedCategory: "GENUINE_UNEXPLAINED_VARIANCE",
          matchedGatewayId: `gw_${orderIndex}`,
          matchedBankUtr: baseUtr,
          matchedLedgerId: `ledger_${orderIndex}`,
          supportingEventIds: [],
          unexplainedVarianceMinorUnits: unexplainedShortfall,
          expectedExplanation: `Unexplained variance of ${Money.format(unexplainedShortfall)}. Zero supporting evidence. Agent must honestly declare UNRESOLVED.`,
        });
      }
    }

    return {
      datasetId,
      name: this.datasetName,
      seed: this.seed,
      recordCount: gatewayRecords.length,
      gatewayRecords,
      bankRecords,
      ledgerRecords,
      supportingEvents,
      groundTruths,
    };
  }
}
