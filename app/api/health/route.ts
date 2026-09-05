import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Ping PostgreSQL through Prisma
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "healthy",
      service: "Recon.ai",
      database: "PostgreSQL 16",
      timestamp: new Date().toISOString(),
      architecture: {
        runtime: "Next.js 14 App Router",
        orm: "Prisma",
        currencyPrecision: "Integer minor units (Paise)",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        service: "Recon.ai",
        error: error.message || "Database unreachable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
