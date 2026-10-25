import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateAnswer, getRubric } from "@/evaluation";

const bodySchema = z.object({
  items: z.array(z.object({ questionId: z.string().min(1).max(64), answer: z.string().max(6000) })).min(1).max(10),
});

/** Scores every answer on the server (rules + optional LLM). The browser only displays what comes back. */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success || parsed.data.items.some((i) => !getRubric(i.questionId))) {
    return NextResponse.json({ error: "Invalid interview answers." }, { status: 400 });
  }
  const results = await Promise.all(parsed.data.items.map((i) => evaluateAnswer(i.questionId, i.answer)));
  const total = results.reduce((s, r) => s + r.score, 0);
  const max = results.reduce((s, r) => s + r.maxMarks, 0);
  return NextResponse.json(
    { results, total, max, percentage: Math.round((total / max) * 100) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
