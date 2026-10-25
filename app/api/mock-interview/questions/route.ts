import { NextResponse } from "next/server";
import { pickInterview } from "@/evaluation";

/** Returns one randomly rotated question per category. Rubrics and ideal answers never leave the server. */
export async function GET(request: Request) {
  const role = new URL(request.url).searchParams.get("role") ?? undefined;
  return NextResponse.json({ questions: pickInterview(role) }, { headers: { "Cache-Control": "no-store" } });
}
