import { NextRequest, NextResponse } from "next/server";
import { runProactiveScan } from "@/lib/proactiveScanner";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Optional override: ?date=2025-02-05
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? undefined;

    const alerts = runProactiveScan(date);
    return NextResponse.json({ alerts }, { status: 200 });
  } catch (err) {
    console.error("GET /api/proactive/scan error:", err);
    return NextResponse.json(
      { error: "Failed to run proactive scan" },
      { status: 500 }
    );
  }
}
