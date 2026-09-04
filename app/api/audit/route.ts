import { NextRequest, NextResponse } from "next/server";
import { AuditService } from "@/lib/audit/audit-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId") || undefined;
    const entityId = searchParams.get("entityId") || undefined;
    const action = searchParams.get("action") || undefined;
    const actor = searchParams.get("actor") || undefined;
    const entityType = searchParams.get("entityType") || undefined;
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 50));
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
    const isExport = searchParams.get("export") === "true";

    const result = await AuditService.list({
      runId,
      entityId,
      action,
      actor,
      entityType,
      limit: isExport ? 1000 : limit,
      offset: isExport ? 0 : offset,
    });

    if (isExport) {
      return new NextResponse(JSON.stringify(result.events, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="recon_audit_trail_${runId || "latest"}.json"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      total: result.total,
      source: result.source,
      limit,
      offset,
      events: result.events,
    });
  } catch (error: any) {
    console.error("[Recon.ai API] Audit query failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch audit events" },
      { status: 500 }
    );
  }
}
