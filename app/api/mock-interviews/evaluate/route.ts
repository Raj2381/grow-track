import { NextResponse } from "next/server";
import { isInterviewQuestion } from "@/lib/mock-interviews";
import {
  evaluateInterviewAnswers,
  InterviewAiError,
  isInterviewType,
  isInterviewDifficulty,
} from "@/lib/mock-interview-ai";
import { isStudentId } from "@/lib/student-portal";

const maxRequestLength = 56_000;
const maxAnswerLength = 4_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > maxRequestLength) {
    return NextResponse.json(
      { error: "Interview answers are too large. Shorten your responses and retry." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json(
      { error: "Interview answers must contain valid JSON." },
      { status: 400 },
    );
  }

  if (
    !isRecord(body) ||
    typeof body.studentId !== "string" ||
    !isStudentId(body.studentId) ||
    !isInterviewType(body.interviewType) ||
    !isInterviewDifficulty(body.difficulty) ||
    !Array.isArray(body.questions) ||
    body.questions.length < 3 ||
    body.questions.length > 10 ||
    !body.questions.every(isInterviewQuestion) ||
    !Array.isArray(body.answers) ||
    body.answers.length !== body.questions.length ||
    !body.answers.every(
      (answer) =>
        typeof answer === "string" && answer.length <= maxAnswerLength,
    ) ||
    new Set(body.questions.map((question) => question.id)).size !==
      body.questions.length
  ) {
    return NextResponse.json(
      { error: "Interview answers or question details are invalid." },
      { status: 400 },
    );
  }

  try {
    const evaluations = await evaluateInterviewAnswers(
      body.questions,
      body.answers,
    );
    const answeredCount = body.answers.filter(
      (answer) => answer.trim().length > 0,
    ).length;
    return NextResponse.json({
      evaluations,
      evaluationMode:
        answeredCount === 0
          ? "blank"
          : answeredCount === body.answers.length
            ? "openai"
            : "mixed",
    });
  } catch (error) {
    const status =
      error instanceof InterviewAiError ? error.status : 502;
    const message =
      error instanceof InterviewAiError
        ? error.message
        : "AI evaluation failed. No results were saved. Retry the evaluation.";
    return NextResponse.json({ error: message }, { status });
  }
}
