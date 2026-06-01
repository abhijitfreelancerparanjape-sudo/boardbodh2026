import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { generateQuestions } from "@/lib/anthropic/generate";
import type { Board, DifficultyBand } from "@/types/db";

const BOARDS: Board[] = ["CBSE", "Maharashtra"];
const BANDS: DifficultyBand[] = ["foundational", "board_level", "advanced"];

// Studio: generate draft questions for a concept + band via Claude. Admin only.
export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const conceptId = body?.conceptId;
  const board = body?.board;
  const band = body?.band;
  const count = Number(body?.count ?? 5);
  if (!conceptId || !BOARDS.includes(board) || !BANDS.includes(band)) {
    return NextResponse.json({ error: "conceptId, board, and band are required" }, { status: 400 });
  }

  try {
    const result = await generateQuestions({ conceptId, board, band, count, userId: admin.id });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
