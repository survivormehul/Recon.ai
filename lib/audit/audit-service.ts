import { prisma } from "../prisma";

export interface AuditEventInput {
  runId?: string;
  entityType: "Run" | "Transaction" | "Exception" | "Dataset" | "AiInvestigation";
  entityId: string;
  action: 
    | "DATASET_INGESTED"
    | "DETERMINISTIC_MATCHED"
    | "DISCREPANCY_DETECTED"
    | "AI_INVESTIGATION_DISPATCHED"
    | "TOOL_CALLED"
    | "VALIDATION_PASSED"
    | "VALIDATION_FAILED"
    | "DECISION_COMMITTED"
    | "EXCEPTION_LOGGED"
    | "EXCEPTION_RESOLVED"
    | "RUN_COMPLETED";
  actor: "DETERMINISTIC_ENGINE" | "AI_INVESTIGATOR" | "ANTI_HALLUCINATION_VALIDATOR" | "FINANCE_CONTROLLER" | "RECON_ORCHESTRATOR";
  previousState?: string;
  newState?: string;
  details?: Record<string, any>;
  timestamp?: Date;
}

export interface AuditFilterOptions {
  runId?: string;
  entityId?: string;
  entityType?: string;
  action?: string;
  actor?: string;
  limit?: number;
  offset?: number;
}

// Global In-Memory Audit Cache for instant UI queries
class AuditMemoryStore {
  private events: AuditEventInput[] = [];

  public addEvent(event: AuditEventInput) {
    this.events.unshift({
      ...event,
      timestamp: event.timestamp || new Date(),
    });
    // Keep last 10,000 events in memory
    if (this.events.length > 10000) {
      this.events = this.events.slice(0, 10000);
    }
  }

  public addBatch(events: AuditEventInput[]) {
    const timestamped = events.map((e) => ({
      ...e,
      timestamp: e.timestamp || new Date(),
    }));
    this.events = [...timestamped, ...this.events];
    if (this.events.length > 10000) {
      this.events = this.events.slice(0, 10000);
    }
  }

  public query(filters: AuditFilterOptions = {}): { events: AuditEventInput[]; total: number } {
    let filtered = this.events;

    if (filters.runId) {
      filtered = filtered.filter((e) => e.runId === filters.runId);
    }
    if (filters.entityId) {
      const q = filters.entityId.toLowerCase();
      filtered = filtered.filter((e) => e.entityId.toLowerCase().includes(q));
    }
    if (filters.entityType) {
      filtered = filtered.filter((e) => e.entityType === filters.entityType);
    }
    if (filters.action) {
      filtered = filtered.filter((e) => e.action === filters.action);
    }
    if (filters.actor) {
      filtered = filtered.filter((e) => e.actor === filters.actor);
    }

    const total = filtered.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;

    return {
      events: filtered.slice(offset, offset + limit),
      total,
    };
  }

  public getAll(runId?: string): AuditEventInput[] {
    if (runId) {
      return this.events.filter((e) => e.runId === runId);
    }
    return this.events;
  }
}

const globalForAudit = global as unknown as { auditStore?: AuditMemoryStore };
export const auditMemoryStore = globalForAudit.auditStore || new AuditMemoryStore();
if (process.env.NODE_ENV !== "production") globalForAudit.auditStore = auditMemoryStore;

export class AuditService {
  /**
   * Log an individual audit event.
   */
  public static async log(event: AuditEventInput): Promise<void> {
    const timestamp = event.timestamp || new Date();
    const eventWithTime = { ...event, timestamp };

    // Record in memory store
    auditMemoryStore.addEvent(eventWithTime);

    // Persist standalone events to database if available (run-scoped events are batch persisted in Stage 4 of orchestration)
    if (process.env.NODE_ENV !== "test" && !event.runId) {
      try {
        await prisma.auditEvent.create({
          data: {
            entityType: event.entityType,
            entityId: event.entityId,
            action: event.action,
            actor: event.actor,
            previousState: event.previousState,
            newState: event.newState,
            details: event.details as any,
            timestamp,
          },
        });
      } catch (err) {
        // In-memory store handles fallback
      }
    }
  }

  /**
   * Log a batch of audit events.
   */
  public static async logBatch(events: AuditEventInput[]): Promise<void> {
    if (!events.length) return;

    const timestamp = new Date();
    const prepared = events.map((e) => ({
      ...e,
      timestamp: e.timestamp || timestamp,
    }));

    // Record in memory
    auditMemoryStore.addBatch(prepared);

    // Persist standalone events to database
    if (process.env.NODE_ENV !== "test") {
      const nonRunEvents = prepared.filter((e) => !e.runId);
      if (nonRunEvents.length > 0) {
        try {
          await prisma.auditEvent.createMany({
            data: nonRunEvents.map((e) => ({
              entityType: e.entityType,
              entityId: e.entityId,
              action: e.action,
              actor: e.actor,
              previousState: e.previousState,
              newState: e.newState,
              details: e.details as any,
              timestamp: e.timestamp,
            })),
          });
        } catch (err) {
          // Graceful fallback to memory store
        }
      }
    }
  }

  /**
   * Query audit trail events with filtering and pagination.
   */
  public static async list(filters: AuditFilterOptions = {}): Promise<{
    events: Array<{
      id: string;
      runId?: string;
      entityType: string;
      entityId: string;
      action: string;
      actor: string;
      previousState?: string;
      newState?: string;
      details?: any;
      timestamp: string;
    }>;
    total: number;
    source: "database" | "memory";
  }> {
    // 1. Try database first
    try {
      const where: any = {};
      if (filters.runId) where.runId = filters.runId;
      if (filters.entityId) where.entityId = { contains: filters.entityId, mode: "insensitive" };
      if (filters.entityType) where.entityType = filters.entityType;
      if (filters.action) where.action = filters.action;
      if (filters.actor) where.actor = filters.actor;

      const [count, rows] = await Promise.all([
        prisma.auditEvent.count({ where }),
        prisma.auditEvent.findMany({
          where,
          orderBy: { timestamp: "desc" },
          take: filters.limit || 50,
          skip: filters.offset || 0,
        }),
      ]);

      if (rows.length > 0 || count > 0) {
        return {
          events: rows.map((r) => ({
            id: r.id,
            runId: r.runId || undefined,
            entityType: r.entityType,
            entityId: r.entityId,
            action: r.action,
            actor: r.actor,
            previousState: r.previousState || undefined,
            newState: r.newState || undefined,
            details: r.details,
            timestamp: r.timestamp.toISOString(),
          })),
          total: count,
          source: "database",
        };
      }
    } catch (err) {
      // Fall through to memory store
    }

    // 2. Query in-memory store
    const memResult = auditMemoryStore.query(filters);
    return {
      events: memResult.events.map((e, idx) => ({
        id: `mem_audit_${Date.now()}_${idx}`,
        runId: e.runId,
        entityType: e.entityType,
        entityId: e.entityId,
        action: e.action,
        actor: e.actor,
        previousState: e.previousState,
        newState: e.newState,
        details: e.details,
        timestamp: (e.timestamp || new Date()).toISOString(),
      })),
      total: memResult.total,
      source: "memory",
    };
  }
}
