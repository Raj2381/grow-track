import { NextResponse } from "next/server";
import {
  buildExecutableProgram,
  parseCodingResults,
  wandboxCompilers,
} from "@/lib/code-execution";
import {
  findCodingChallenge,
  type CodingLanguage,
} from "@/lib/coding-challenges";

const allowedLanguages = new Set<CodingLanguage>([
  "javascript",
  "python",
  "java",
  "c",
  "cpp",
]);
const maxSourceLength = 30_000;
const maxOutputLength = 20_000;

function boundedString(value: unknown) {
  return typeof value === "string"
    ? value.slice(0, maxOutputLength)
    : "";
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > maxSourceLength + 2_000) {
      return NextResponse.json(
        { error: "Request is too large. Keep your source code under 30 KB." },
        { status: 413 },
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Request must contain valid JSON." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid code execution request." }, { status: 400 });
    }

    const { language, challengeId, source } = body as {
      language?: unknown;
      challengeId?: unknown;
      source?: unknown;
    };
    if (
      typeof language !== "string" ||
      !allowedLanguages.has(language as CodingLanguage)
    ) {
      return NextResponse.json({ error: "Choose a supported language." }, { status: 400 });
    }
    if (typeof challengeId !== "string") {
      return NextResponse.json({ error: "Choose a coding challenge." }, { status: 400 });
    }
    const challenge = findCodingChallenge(challengeId);
    if (!challenge) {
      return NextResponse.json({ error: "Unknown coding challenge." }, { status: 400 });
    }
    if (typeof source !== "string" || !source.trim()) {
      return NextResponse.json({ error: "Enter a solution before running tests." }, { status: 400 });
    }
    if (source.length > maxSourceLength) {
      return NextResponse.json(
        { error: "Source code is too large. Keep it under 30 KB." },
        { status: 413 },
      );
    }

    const typedLanguage = language as CodingLanguage;
    const program = buildExecutableProgram(challenge, typedLanguage, source);
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 20_000);

    let providerResponse: Response;
    try {
      providerResponse = await fetch("https://wandbox.org/api/compile.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          compiler: wandboxCompilers[typedLanguage],
          code: typedLanguage === "java" ? `${program}` : program,
          stdin: "",
          save: false,
          "compiler-option-raw": "",
          "runtime-option-raw": "",
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    const providerBody: unknown = await providerResponse.json().catch(() => null);
    if (!providerResponse.ok) {
      const message =
        providerBody && typeof providerBody === "object" &&
        typeof (providerBody as { message?: unknown }).message === "string"
          ? (providerBody as { message: string }).message
          : `Code runner returned HTTP ${providerResponse.status}.`;
      return NextResponse.json(
        { error: message.slice(0, 500) },
        { status: providerResponse.status === 429 ? 429 : 502 },
      );
    }
    if (!providerBody || typeof providerBody !== "object") {
      return NextResponse.json(
        { error: "Code runner returned an invalid response." },
        { status: 502 },
      );
    }

    const execution = providerBody as {
      status?: unknown;
      signal?: unknown;
      compiler_output?: unknown;
      compiler_error?: unknown;
      compiler_message?: unknown;
      program_output?: unknown;
      program_error?: unknown;
      program_message?: unknown;
    };
    if (
      typeof execution.status !== "string" &&
      typeof execution.status !== "number"
    ) {
      return NextResponse.json(
        { error: "Code runner response did not include execution results." },
        { status: 502 },
      );
    }

    const compilerError = boundedString(execution.compiler_error);
    const compilerOutput =
      boundedString(execution.compiler_output) +
      compilerError +
      boundedString(execution.compiler_message);
    const programError =
      boundedString(execution.program_error) +
      boundedString(execution.program_message);
    const runCode = Number(execution.status);
    const stdout = boundedString(execution.program_output);
    const stderr = programError;
    const taggedOutput = stdout.includes("__CAMPUSIQ_CASE__:")
      ? stdout
      : stderr.includes("__CAMPUSIQ_CASE__:")
        ? stderr
        : "";
    const results =
      runCode === 0 && taggedOutput
        ? parseCodingResults(taggedOutput, challenge)
        : [];
    return NextResponse.json({
      stdout,
      stderr,
      runCode: Number.isFinite(runCode) ? runCode : null,
      signal: typeof execution.signal === "string" ? execution.signal : null,
      compileOutput: compilerOutput,
      compileCode: compilerError ? 1 : 0,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "The code runner took too long to respond. Please try again."
        : error instanceof Error
          ? `Code execution failed: ${error.message}`
          : "Code execution failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
