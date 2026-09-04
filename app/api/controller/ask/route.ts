import { NextRequest, NextResponse } from "next/server";
import { ControllerAssistant, ControllerQueryRequest } from "@/lib/ai/controller-assistant";

export async function POST(req: NextRequest) {
  try {
    const body: ControllerQueryRequest = await req.json().catch(() => ({ question: "" }));
    if (!body.question || !body.question.trim()) {
      return NextResponse.json({ success: false, error: "Question parameter is required." }, { status: 400 });
    }

    const result = await ControllerAssistant.answerQuestion({
      question: body.question.trim(),
      runId: body.runId,
      history: body.history,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[Recon.ai API] Ask controller failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to answer controller query" },
      { status: 500 }
    );
  }
}
