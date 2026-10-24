import { NextResponse } from "next/server";
import { createFallbackQuestions } from "@/lib/mock-interviews";
import {
  generateQuestionsWithOpenAI,
  isGenerateInterviewRequest,
  InterviewAiError,
} from "@/lib/mock-interview-ai";
import { isStudentId } from "@/lib/student-portal";

const maxRequestLength = 8_000;

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > maxRequestLength) {
    return NextResponse.json(
      { error: "Interview setup request is too large." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json(
      { error: "Interview setup must contain valid JSON." },
      { status: 400 },
    );
  }

  if (!isGenerateInterviewRequest(body) || !isStudentId(body.studentId)) {
    return NextResponse.json(
      { error: "Check the interview role, type, difficulty, and student profile." },
      { status: 400 },
    );
  }

  const student = body;
  try {
    const questions = await generateQuestionsWithOpenAI({
      ...student,
      history: student.history,
    });
    return NextResponse.json({
      questions,
      generationMode: "openai",
      notice: "",
    });
  } catch (error) {
    const questions = createFallbackQuestions({
      ...student,
      history: student.history,
      attemptSeed: crypto.randomUUID(),
    });
    if (questions.length !== student.questionCount) {
      return NextResponse.json(
        {
          error:
            "The available question set is too small for this interview selection. Choose another type or fewer questions.",
        },
        { status: 422 },
      );
    }
    const notice =
      error instanceof InterviewAiError
        ? `${error.message} A varied question-bank interview is available; AI scoring still requires OpenAI configuration. The bank prioritizes your focus and may include related role topics to meet the requested question count.`
        : "AI question generation failed. A varied question-bank interview is available; AI scoring still requires OpenAI configuration. The bank prioritizes your focus and may include related role topics to meet the requested question count.";
    return NextResponse.json({
      questions,
      generationMode: "fallback",
      notice,
    });
  }
}
