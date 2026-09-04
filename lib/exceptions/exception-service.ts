import { prisma } from "../prisma";
import { ExceptionType, Severity } from "@prisma/client";
import { Money } from "../money";

export interface ExceptionFilterOptions {
  runId?: string;
  severity?: Severity;
  exceptionType?: ExceptionType;
  resolved?: boolean;
}

export interface ExceptionResolutionPayload {
  exceptionId: string;
  actionTaken: "REQUEST_REFUND" | "LEDGER_ADJUSTMENT" | "CONTACT_GATEWAY" | "WRITE_OFF" | "HOLD_PAYOUT";
  notes?: string;
  actor?: string;
}

export interface ExceptionSummaryStats {
  totalCount: number;
  openCount: number;
  resolvedCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalMonetaryImpactMinorUnits: bigint;
  totalMonetaryImpactFormatted: string;
}

export class ExceptionService {
  /**
   * Fetch exceptions with optional filters.
   */
  static async listExceptions(filters: ExceptionFilterOptions = {}) {
    const where: any = {};
    if (filters.runId) where.runId = filters.runId;
    if (filters.severity) where.severity = filters.severity;
    if (filters.exceptionType) where.exceptionType = filters.exceptionType;
    if (filters.resolved !== undefined) where.resolved = filters.resolved;

    try {
      const items = await prisma.exceptionRecord.findMany({
        where,
        orderBy: [
          { severity: "asc" },
          { monetaryImpactMinorUnits: "desc" },
        ],
        include: {
          decision: true,
        },
      });

      return items.map((item) => ({
        ...item,
        monetaryImpactFormatted: Money.formatPaise(item.monetaryImpactMinorUnits),
      }));
    } catch (error) {
      console.warn("Database unavailable for listExceptions, returning empty list:", error);
      return [];
    }
  }

  /**
   * Get summary statistics across exceptions for a run or globally.
   */
  static async getSummaryStats(runId?: string): Promise<ExceptionSummaryStats> {
    try {
      const where: any = runId ? { runId } : {};
      const exceptions = await prisma.exceptionRecord.findMany({ where });

      let openCount = 0;
      let resolvedCount = 0;
      let criticalCount = 0;
      let highCount = 0;
      let mediumCount = 0;
      let lowCount = 0;
      let totalImpact = 0n;

      for (const exc of exceptions) {
        if (exc.resolved) resolvedCount++;
        else openCount++;

        if (exc.severity === Severity.CRITICAL) criticalCount++;
        else if (exc.severity === Severity.HIGH) highCount++;
        else if (exc.severity === Severity.MEDIUM) mediumCount++;
        else if (exc.severity === Severity.LOW) lowCount++;

        totalImpact += exc.monetaryImpactMinorUnits;
      }

      return {
        totalCount: exceptions.length,
        openCount,
        resolvedCount,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        totalMonetaryImpactMinorUnits: totalImpact,
        totalMonetaryImpactFormatted: Money.formatPaise(totalImpact),
      };
    } catch (error) {
      return {
        totalCount: 0,
        openCount: 0,
        resolvedCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        totalMonetaryImpactMinorUnits: 0n,
        totalMonetaryImpactFormatted: "₹0.00",
      };
    }
  }

  /**
   * Resolve an exception and emit an audit event.
   */
  static async resolveException(payload: ExceptionResolutionPayload) {
    const { exceptionId, actionTaken, notes, actor = "HUMAN_CONTROLLER" } = payload;

    try {
      const updated = await prisma.exceptionRecord.update({
        where: { id: exceptionId },
        data: {
          resolved: true,
          resolvedAt: new Date(),
        },
      });

      // Emit audit event
      await prisma.auditEvent.create({
        data: {
          runId: updated.runId,
          entityType: "ExceptionRecord",
          entityId: updated.id,
          action: "RESOLVED",
          actor,
          previousState: "OPEN",
          newState: "RESOLVED",
          details: {
            actionTaken,
            notes,
            monetaryImpactPaise: updated.monetaryImpactMinorUnits.toString(),
            orderId: updated.orderId,
          },
        },
      });

      return {
        success: true,
        exception: {
          ...updated,
          monetaryImpactFormatted: Money.formatPaise(updated.monetaryImpactMinorUnits),
        },
      };
    } catch (error: any) {
      console.error("Failed to resolve exception:", error);
      throw new Error(`Failed to resolve exception: ${error.message}`);
    }
  }
}
