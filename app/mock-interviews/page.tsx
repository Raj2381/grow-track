
"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Play,
  Square,
  CheckCircle2,
  Clock,
  Search,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Award,
  MessageSquare,
  Sparkles,
  AlertCircle,
  Camera,
  Brain,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  buildTopicPerformance,
  buildCompletedAttempt,
  enforceCorrectAnswerScore,
  interviewDifficulties,
  interviewTypes,
  isInterviewAnswerEvaluation,
  isInterviewQuestion,
  summarizeInterviewHistory,
  type InterviewAnswerEvaluation,
  type InterviewDifficulty,
  type InterviewQuestion,
  type InterviewType,
  type MockInterviewAttempt,
} from "@/lib/mock-interviews";
import { studentProfiles } from "@/lib/students";
import {
  getDefaultDemoStudentId,
  readMockInterviewResults,
  readSelectedDemoStudentId,
  saveSelectedDemoStudentId,
  saveMockInterviewResult,
  subscribeToMockInterviewResults,
  subscribeToSelectedDemoStudentId,
} from "@/lib/student-portal";
type Question = InterviewQuestion;
type AnswerResult = InterviewAnswerEvaluation;

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function subscribeToBrowserCapabilities() {
  return () => {};
}

function getSpeechRecognitionSupport() {
  if (typeof window === "undefined") return false;
  const browser = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition);
}

function getServerSpeechRecognitionSupport() {
  return false;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

export default function MockInterviewsPage() {
  const [phase, setPhase] = useState<"setup" | "interview" | "results">(
    "setup"
  );
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [interviewType, setInterviewType] = useState<InterviewType>("Mixed");
  const [difficulty, setDifficulty] =
    useState<InterviewDifficulty>("Intermediate");
  const [questionCount, setQuestionCount] = useState(5);
  const [generationMode, setGenerationMode] = useState<
    "openai" | "fallback"
  >("fallback");
  const [evaluationMode, setEvaluationMode] = useState<
    "openai" | "mixed" | "blank"
  >("openai");
  const [generationNotice, setGenerationNotice] = useState("");
  const [setupError, setSetupError] = useState("");
  const [evaluationError, setEvaluationError] = useState("");
  const [history, setHistory] = useState<MockInterviewAttempt[]>([]);
  const [historyStudentId, setHistoryStudentId] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [attemptId, setAttemptId] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyReady, setHistoryReady] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [micError, setMicError] = useState("");
  const speechSupported = useSyncExternalStore(
    subscribeToBrowserCapabilities,
    getSpeechRecognitionSupport,
    getServerSpeechRecognitionSupport,
  );
  const [elapsed, setElapsed] = useState(0);
  const studentId = useSyncExternalStore(
    subscribeToSelectedDemoStudentId,
    readSelectedDemoStudentId,
    getDefaultDemoStudentId,
  );
  const studentName =
    studentProfiles.find((student) => student.id === studentId)?.name ?? "";
  const [role, setRole] = useState("Software Developer");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [resultStorageError, setResultStorageError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recordingRef = useRef(false);
  const elapsedRef = useRef(0);
  const answersRef = useRef<string[]>([]);
  const scoredResults = results.map(enforceCorrectAnswerScore);
  const averageScore =
    scoredResults.length > 0
      ? Math.round(
          scoredResults.reduce((total, item) => total + item.score, 0) /
            scoredResults.length
        )
      : 0;

  const studentHistory = historyStudentId === studentId ? history : [];
  const historyInChronologicalOrder = studentHistory
    .slice()
    .sort(
      (left, right) =>
        Date.parse(left.completedAt) - Date.parse(right.completedAt),
    );
  const topicPerformance = buildTopicPerformance(historyInChronologicalOrder);
  const latestAttempt = studentHistory.at(0);
  const previousAttempt = studentHistory.at(1);
  const filteredHistory = studentHistory.filter((attempt) =>
    `${attempt.role} ${attempt.interviewType} ${attempt.difficulty} ${attempt.weakAreas.join(" ")}`
      .toLowerCase()
      .includes(historySearch.trim().toLowerCase()),
  );

  useEffect(() => {
    const refresh = () => {
      setHistoryReady(false);
      try {
        const attempts = readMockInterviewResults()
          .filter((item) => item.studentId === studentId && item.attempt)
          .map((item) => item.attempt)
          .filter(
            (attempt): attempt is MockInterviewAttempt => attempt !== undefined,
          )
          .sort(
            (left, right) =>
              Date.parse(right.completedAt) - Date.parse(left.completedAt),
          );
        setHistory(attempts);
        setHistoryError("");
      } catch (error) {
        setHistory([]);
        setHistoryError(
          error instanceof Error
            ? `Could not load interview history: ${error.message}`
            : "Could not load interview history.",
        );
      } finally {
        setHistoryStudentId(studentId);
        setHistoryReady(true);
      }
    };
    refresh();
    return subscribeToMockInterviewResults(refresh);
  }, [studentId]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (phase !== "interview") return;

    const timer = window.setInterval(() => {
      setElapsed((value) => {
        elapsedRef.current = value + 1;
        return value + 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [cameraOn, phase]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function toggleCamera() {
    if (cameraOn) {
      stopCamera();
      return;
    }

    setCameraError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      streamRef.current = stream;
      setCameraOn(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setCameraError(
        "Camera access was denied or is unavailable. Check your browser permissions and try again."
      );
    }
  }

  async function toggleMicrophone() {
    if (micOn) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      setMicOn(false);
      setRecording(false);
      recordingRef.current = false;
      return;
    }

    setMicError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      audioStreamRef.current = stream;
      setMicOn(true);
    } catch {
      setMicError(
        "Microphone access was denied or is unavailable. You can still type your answers."
      );
    }
  }

  function startVoiceAnswer() {
    if (!micOn) {
      setMicError("Enable microphone access before using voice answers.");
      return;
    }

    const w = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };

    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!Recognition) {
      setMicError(
        "Speech-to-text is not supported in this browser. You can type your answer instead."
      );
      return;
    }

    if (recordingRef.current) {
      recognitionRef.current?.stop();
      setRecording(false);
      recordingRef.current = false;
      return;
    }

    setMicError("");

    try {
      const recognition = new Recognition();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let transcript = "";

        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + " ";
        }

        const updated = [...answersRef.current];
        updated[currentQuestion] = transcript.trim();

        answersRef.current = updated;
        setAnswers(updated);
      };

      recognition.onerror = (event) => {
        if (event.error !== "no-speech") {
          setMicError(
            "Voice recognition stopped. You can continue by typing your answer."
          );
        }
        setRecording(false);
        recordingRef.current = false;
      };

      recognition.onend = () => {
        setRecording(false);
        recordingRef.current = false;
      };

      recognitionRef.current = recognition;
      recognition.start();
      recordingRef.current = true;
      setRecording(true);
    } catch {
      setMicError(
        "Could not start voice recognition. Please type your answer instead."
      );
    }
  }

  async function startInterview() {
    if (!studentId || !studentName.trim()) {
      window.alert("Please select a student profile before starting.");
      return;
    }

    setIsGenerating(true);
    setSetupError("");
    setGenerationNotice("");
    setResultStorageError("");

    try {
      const response = await fetch("/api/mock-interviews/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          role,
          interviewType,
          difficulty,
          questionCount,
          history: summarizeInterviewHistory(studentHistory),
        }),
      });
      const payload: unknown = await response.json();
      if (
        !response.ok ||
        !payload ||
        typeof payload !== "object" ||
        !("questions" in payload) ||
        !Array.isArray(payload.questions) ||
        payload.questions.length !== questionCount ||
        !payload.questions.every(isInterviewQuestion)
      ) {
        const errorMessage =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "The server returned invalid interview questions.";
        throw new Error(errorMessage);
      }

      const questionsForAttempt = payload.questions;
      const id = window.crypto.randomUUID();
      const nextAnswers = Array(questionsForAttempt.length).fill("");
      setQuestions(questionsForAttempt);
      setAnswers(nextAnswers);
      answersRef.current = nextAnswers;
      setResults([]);
      setCurrentQuestion(0);
      setAttemptId(id);
      setElapsed(0);
      elapsedRef.current = 0;
      setMicError("");
      setCameraError("");
      setEvaluationError("");
      setGenerationMode(
        "generationMode" in payload && payload.generationMode === "openai"
          ? "openai"
          : "fallback",
      );
      setGenerationNotice(
        "notice" in payload && typeof payload.notice === "string"
          ? payload.notice
          : "",
      );

      if (!cameraOn) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          streamRef.current = stream;
          setCameraOn(true);
        } catch {
          setCameraError(
            "Camera is unavailable. You may continue without a camera preview.",
          );
        }
      }

      setPhase("interview");
    } catch (error) {
      setSetupError(
        error instanceof Error
          ? `Could not start the interview: ${error.message}`
          : "Could not start the interview. Please retry.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function updateAnswer(value: string) {
    const updated = [...answersRef.current];
    updated[currentQuestion] = value;
    answersRef.current = updated;
    setAnswers(updated);
  }

  function goToQuestion(index: number) {
    recognitionRef.current?.stop();
    setRecording(false);
    recordingRef.current = false;
    setCurrentQuestion(index);
  }

  async function finishInterview() {
    recognitionRef.current?.stop();
    setRecording(false);
    recordingRef.current = false;
    setIsEvaluating(true);
    setEvaluationError("");

    try {
      const response = await fetch("/api/mock-interviews/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          interviewType,
          difficulty,
          questions,
          answers: answersRef.current,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "The AI evaluator could not score this interview.";
        throw new Error(message);
      }
      if (
        !payload ||
        typeof payload !== "object" ||
        !("evaluations" in payload) ||
        !Array.isArray(payload.evaluations) ||
        payload.evaluations.length !== questions.length ||
        !payload.evaluations.every((item) =>
          isInterviewAnswerEvaluation(item, true),
        )
      ) {
        throw new Error("The AI evaluator returned invalid feedback.");
      }
      if (
        !("evaluationMode" in payload) ||
        (payload.evaluationMode !== "openai" &&
          payload.evaluationMode !== "mixed" &&
          payload.evaluationMode !== "blank")
      ) {
        throw new Error("The evaluator did not identify how answers were scored.");
      }

      const evaluated = payload.evaluations.map(enforceCorrectAnswerScore);
      const completedAt = new Date().toISOString();
      const attempt = buildCompletedAttempt({
        id: attemptId,
        studentId,
        role,
        interviewType,
        difficulty,
        questions,
        answers: answersRef.current,
        answerEvaluations: evaluated,
        completedAt,
        durationSeconds: elapsedRef.current,
        generationMode,
        evaluationMode: payload.evaluationMode,
      });
      setEvaluationMode(payload.evaluationMode);
      setResults(evaluated);
      setEvaluationError("");
      try {
        saveMockInterviewResult({
          id: attempt.id,
          studentId,
          role,
          averageScore: attempt.averageScore,
          completedAt: attempt.completedAt,
          attempt,
        });
        setResultStorageError("");
      } catch (error) {
        setResultStorageError(
          error instanceof Error
            ? `The report is available now, but browser history could not be saved: ${error.message}`
            : "The report is available now, but browser history could not be saved.",
        );
      }
      stopCamera();
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      setMicOn(false);
      setPhase("results");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "AI evaluation failed. No interview score was saved.";
      setEvaluationError(
        `${message} Your answers are still here. Retry the evaluation; no score has been invented.`,
      );
    } finally {
      setIsEvaluating(false);
    }
  }

  function restartInterview() {
    recognitionRef.current?.abort();
    stopCamera();
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;

    setMicOn(false);
    setRecording(false);
    recordingRef.current = false;
    setAnswers([]);
    answersRef.current = [];
    setQuestions([]);
    setResults([]);
    setCurrentQuestion(0);
    setElapsed(0);
    elapsedRef.current = 0;
    setCameraError("");
    setMicError("");
    setEvaluationError("");
    setPhase("setup");
  }

  const question = questions[currentQuestion];
  const answeredCount = answers.filter((answer) => answer.trim()).length;

  return (
    <main className="min-h-screen bg-[#f6f7fb] p-4 text-slate-800 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-600">
              <Sparkles size={17} />
              GROWTHTRACK CAREER PREPARATION
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Mock Interviews
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Practice real interview questions, answer with your voice or
              keyboard, and review personalized practice feedback.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Brain size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Adaptive interview practice
              </p>
              <p className="text-xs text-slate-500">
                3–10 questions · Personalized report
              </p>
            </div>
          </div>
        </header>

        {phase === "setup" && (
          <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-7 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Set up your interview
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Tell us a little about yourself before you begin.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="studentId"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Student profile
                  </label>
                  <select
                    id="studentId"
                    value={studentId}
                    onChange={(event) => {
                      try {
                        saveSelectedDemoStudentId(event.target.value);
                        setResultStorageError("");
                      } catch (error) {
                        setResultStorageError(
                          error instanceof Error
                            ? error.message
                            : "The selected student could not be saved.",
                        );
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                  >
                    {studentProfiles.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} · {student.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    Result will be linked to the selected student ID and
                    saved in this browser only.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="role"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Target job role
                  </label>
                  <select
                    id="role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                  >
                    <option>Software Developer</option>
                    <option>Frontend Developer</option>
                    <option>Backend Developer</option>
                    <option>Data Analyst</option>
                    <option>Full Stack Developer</option>
                    <option>QA Engineer</option>
                    <option>General Graduate Role</option>
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="interviewType"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Interview focus
                    </label>
                    <select
                      id="interviewType"
                      value={interviewType}
                      onChange={(event) => {
                        const selected = interviewTypes.find(
                          (type) => type === event.target.value,
                        );
                        if (selected) setInterviewType(selected);
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                    >
                      {interviewTypes.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="difficulty"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Difficulty
                    </label>
                    <select
                      id="difficulty"
                      value={difficulty}
                      onChange={(event) => {
                        const selected = interviewDifficulties.find(
                          (level) => level === event.target.value,
                        );
                        if (selected) setDifficulty(selected);
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                    >
                      {interviewDifficulties.map((level) => (
                        <option key={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="questionCount"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Number of questions
                  </label>
                  <select
                    id="questionCount"
                    value={questionCount}
                    onChange={(event) =>
                      setQuestionCount(Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                  >
                    {[3, 5, 7, 10].map((count) => (
                      <option key={count} value={count}>
                        {count} questions
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    New sessions adapt to this student’s recent practice
                    history and weak topics.
                  </p>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <Camera className="mt-0.5 shrink-0 text-indigo-600" size={20} />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Camera and microphone
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Your browser may ask for camera access when the
                        interview begins. Enable your microphone separately to
                        use voice answers. Typing is always available.
                      </p>
                    </div>
                  </div>
                </div>

                {cameraError && (
                  <p className="flex items-start gap-2 text-sm text-amber-700">
                    <AlertCircle size={17} className="mt-0.5 shrink-0" />
                    {cameraError}
                  </p>
                )}

                {setupError && (
                  <p role="alert" className="text-sm text-rose-700">
                    {setupError}
                  </p>
                )}

                {generationNotice && (
                  <p
                    role="status"
                    className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-800"
                  >
                    {generationNotice}
                  </p>
                )}

                <button
                  onClick={() => void startInterview()}
                  disabled={!studentName.trim() || isGenerating || isEvaluating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGenerating ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Play size={18} />
                  )}
                  {isGenerating
                    ? "Preparing personalized questions…"
                    : studentHistory.length
                      ? "Start personalized interview"
                      : "Start mock interview"}
                  {!isGenerating && <ChevronRight size={18} />}
                </button>
              </div>
            </section>

            <div className="space-y-5">
              <section className="overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-sm sm:p-7">
                <div className="mb-5 flex items-center justify-between">
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                    INTERVIEW PREVIEW
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Ready to practice
                  </span>
                </div>

                <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-800/80 p-6 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
                    <Video size={30} />
                  </div>
                  <p className="font-semibold">Your interview room</p>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">
                    The live camera preview will appear here once you start the
                    interview and allow access.
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/5 p-3">
                    <Video size={18} className="mb-2 text-indigo-300" />
                    <p className="text-sm font-medium">Live camera</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Browser permission
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <Mic size={18} className="mb-2 text-indigo-300" />
                    <p className="text-sm font-medium">Voice answers</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Speech recognition support
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Practice history
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Local to {studentName || "this student"}
                    </p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    {studentHistory.length} attempt{studentHistory.length === 1 ? "" : "s"}
                  </span>
                </div>

                {historyError && (
                  <p role="alert" className="mt-4 text-sm text-rose-700">
                    {historyError}
                  </p>
                )}

                {!historyReady ? (
                  <p className="mt-4 text-sm text-slate-500">
                    Loading practice history…
                  </p>
                ) : studentHistory.length === 0 ? (
                  <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    Completed reports will show score trends, strengths, and
                    topics to revisit here.
                  </p>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Latest score</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {latestAttempt?.averageScore}%
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Change</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {latestAttempt && previousAttempt
                            ? `${latestAttempt.averageScore - previousAttempt.averageScore > 0 ? "+" : ""}${latestAttempt.averageScore - previousAttempt.averageScore}`
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {topicPerformance.length > 0 && (
                      <div className="mt-5">
                        <h4 className="text-sm font-semibold text-slate-800">
                          Topic trends
                        </h4>
                        <div className="mt-3 space-y-3">
                          {topicPerformance.slice(0, 4).map((topic) => (
                            <div key={topic.topic}>
                              <div className="mb-1 flex justify-between gap-3 text-xs">
                                <span className="font-medium text-slate-700">
                                  {topic.topic}
                                </span>
                                <span
                                  className={
                                    topic.trend === "improving"
                                      ? "text-emerald-700"
                                      : topic.trend === "declining"
                                        ? "text-rose-700"
                                        : "text-slate-500"
                                  }
                                >
                                  {topic.averageScore}% · {topic.trend}
                                </span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-indigo-500"
                                  style={{ width: `${topic.averageScore}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {latestAttempt?.weakAreas.length ? (
                      <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-900">
                          Focus next
                        </p>
                        <p className="mt-1 text-sm text-amber-800">
                          {latestAttempt.weakAreas.join(", ")}
                        </p>
                        {latestAttempt.recommendations.length > 0 && (
                          <p className="mt-2 text-xs leading-5 text-amber-800">
                            Suggested practice:{" "}
                            {latestAttempt.recommendations.slice(0, 2).join("; ")}
                          </p>
                        )}
                      </div>
                    ) : null}

                    <div className="mt-5">
                      <label
                        htmlFor="historySearch"
                        className="sr-only"
                      >
                        Search interview history
                      </label>
                      <input
                        id="historySearch"
                        value={historySearch}
                        onChange={(event) => setHistorySearch(event.target.value)}
                        placeholder="Search role or topic"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
                      />
                      <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                        {filteredHistory.slice(0, 5).map((attempt) => (
                          <div
                            key={attempt.id}
                            className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">
                                {attempt.role}
                              </p>
                              <p className="text-xs text-slate-500">
                                {attempt.interviewType} ·{" "}
                                {new Date(attempt.completedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm font-bold text-slate-800">
                              {attempt.averageScore}%
                            </span>
                          </div>
                        ))}
                        {filteredHistory.length === 0 && (
                          <p className="py-2 text-xs text-slate-500">
                            No attempts match this search.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>
        )}

        {phase === "interview" && (
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-7">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Interview in progress
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {studentName} · {role}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold tabular-nums text-slate-700">
                  <Clock size={16} />
                  {formatTime(elapsed)}
                </div>
              </div>

              <div className="p-5 sm:p-7">
                <div className="mb-5 flex items-center justify-between">
                  <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                    Question {currentQuestion + 1} of {questions.length}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {answeredCount} answered
                  </span>
                </div>

                <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all"
                    style={{
                      width: `${((currentQuestion + 1) / questions.length) * 100}%`,
                    }}
                  />
                </div>

                <div className="mb-6 rounded-2xl bg-slate-50 p-5 sm:p-6">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-indigo-600">
                    {question?.category}
                  </p>
                  <h2 className="text-xl font-bold leading-8 text-slate-900 sm:text-2xl">
                    {question?.question}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Take a moment to think. Explain your reasoning and use an
                    example where appropriate.
                  </p>
                </div>

                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <label
                    htmlFor="answer"
                    className="text-sm font-semibold text-slate-800"
                  >
                    Your answer
                  </label>
                  {speechSupported && (
                    <span className="text-xs text-emerald-700">
                      Voice transcription supported
                    </span>
                  )}
                </div>

                <textarea
                  id="answer"
                  value={answers[currentQuestion]}
                  onChange={(event) => updateAnswer(event.target.value)}
                  rows={7}
                  placeholder="Type your answer here, or use the voice-answer button below..."
                  className="w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                />

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void toggleMicrophone()}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                      micOn
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {micOn ? <Mic size={17} /> : <MicOff size={17} />}
                    {micOn ? "Microphone enabled" : "Enable microphone"}
                  </button>

                  <button
                    onClick={startVoiceAnswer}
                    disabled={!micOn}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      recording
                        ? "bg-rose-600 text-white hover:bg-rose-700"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                  >
                    {recording ? <Square size={15} /> : <Mic size={17} />}
                    {recording ? "Stop voice input" : "Answer by voice"}
                  </button>

                  <button
                    onClick={() => {
                      updateAnswer("");
                      setMicError("");
                    }}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <RotateCcw size={15} />
                    Clear
                  </button>
                </div>

                {recording && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-rose-600">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                    Listening… speak clearly. Click Stop voice input when done.
                  </p>
                )}

                {micError && (
                  <p className="mt-3 flex items-start gap-2 text-sm text-amber-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    {micError}
                  </p>
                )}

                {generationNotice && (
                  <p
                    role="status"
                    className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-800"
                  >
                    {generationNotice}
                  </p>
                )}

                {evaluationError && (
                  <p
                    role="alert"
                    className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-5 text-rose-800"
                  >
                    {evaluationError}
                  </p>
                )}

                <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                  <button
                    onClick={() =>
                      goToQuestion(Math.max(0, currentQuestion - 1))
                    }
                    disabled={currentQuestion === 0}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={17} />
                    Previous
                  </button>

                  {currentQuestion < questions.length - 1 ? (
                    <button
                      onClick={() => goToQuestion(currentQuestion + 1)}
                      className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      Next question
                      <ChevronRight size={17} />
                    </button>
                  ) : (
                    <button
                      onClick={finishInterview}
                      disabled={isEvaluating}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 size={17} />
                      {isEvaluating
                        ? "Evaluating your answers…"
                        : evaluationError
                          ? "Retry evaluation"
                          : "Finish and view report"}
                    </button>
                  )}
                </div>
              </div>
            </section>

            <aside className="space-y-5">
              <section className="overflow-hidden rounded-3xl bg-slate-900 p-4 text-white shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">Camera preview</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      cameraOn
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {cameraOn ? "Live" : "Off"}
                  </span>
                </div>

                <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-slate-800">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`h-full w-full object-cover ${
                      cameraOn ? "" : "hidden"
                    }`}
                  />
                  {!cameraOn && (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <VideoOff size={32} />
                      <span className="text-sm">Camera is off</span>
                    </div>
                  )}
                </div>

                {cameraError && (
                  <p className="mt-3 text-xs leading-5 text-amber-300">
                    {cameraError}
                  </p>
                )}

                <button
                  onClick={() => void toggleCamera()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/15"
                >
                  {cameraOn ? <VideoOff size={17} /> : <Video size={17} />}
                  {cameraOn ? "Turn camera off" : "Turn camera on"}
                </button>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 font-bold text-slate-900">
                  Interview progress
                </h3>
                <div className="space-y-3">
                  {questions.map((item, index) => {
                    const isCurrent = index === currentQuestion;
                    const isAnswered = Boolean(answers[index]?.trim());

                    return (
                      <button
                        key={item.id}
                        onClick={() => goToQuestion(index)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                          isCurrent
                            ? "border-indigo-200 bg-indigo-50"
                            : "border-transparent bg-slate-50 hover:border-slate-200"
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                            isAnswered
                              ? "bg-emerald-100 text-emerald-700"
                              : isCurrent
                                ? "bg-indigo-600 text-white"
                                : "bg-white text-slate-500"
                          }`}
                        >
                          {isAnswered ? <CheckCircle2 size={17} /> : index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800">
                            {item.category}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {isAnswered ? "Answer added" : "Not answered yet"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <AlertCircle size={17} />
                  Practice scoring notice
                </p>
                <p className="mt-2 text-xs leading-5 text-amber-800">
                  Answers are scored by the configured OpenAI evaluator.
                  Camera and voice are optional practice aids; facial
                  expressions and vocal tone are not assessed. Scores are
                  practice feedback, not a verified hiring or placement
                  readiness measure.
                </p>
              </div>
            </aside>
          </div>
        )}

        {phase === "results" && (
          <div className="space-y-6">
            <section className="overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-sm sm:p-9">
              <div className="flex flex-col justify-between gap-7 md:flex-row md:items-center">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                    <CheckCircle2 size={18} />
                    INTERVIEW COMPLETED
                  </div>
                  <h2 className="text-3xl font-bold sm:text-4xl">
                    Your practice report
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                    {studentName}, here is your practice feedback for the{" "}
                    {role} role. Review each answer to decide what to improve
                    next.
                  </p>
                  {resultStorageError ? (
                    <p
                      role="alert"
                      className="mt-3 text-sm font-medium text-amber-300"
                    >
                      {resultStorageError}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-300">
                      Result saved to this browser for student ID {studentId}.
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    Evaluation:{" "}
                    {evaluationMode === "openai"
                      ? "OpenAI"
                      : evaluationMode === "mixed"
                        ? "OpenAI with blank answers marked unscored"
                        : "No answers submitted"}
                    {" · "}
                    Questions:{" "}
                    {generationMode === "openai"
                      ? "AI-generated"
                      : "adaptive question bank"}
                  </p>
                </div>

                <div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-indigo-400/40">
                    <div className="text-center">
                      <p className="text-3xl font-bold">{averageScore}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-300">
                        out of 100
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-bold">
                      {averageScore >= 80
                        ? "Great practice!"
                        : averageScore >= 60
                          ? "Good progress"
                          : averageScore >= 35
                            ? "Keep improving"
                            : "More practice needed"}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      Average answer score
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      Time: {formatTime(elapsed)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <MessageSquare size={20} />
                </div>
                <p className="text-sm text-slate-500">Questions completed</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {results.length}/{questions.length}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Award size={20} />
                </div>
                <p className="text-sm text-slate-500">Average score</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {averageScore}%
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Clock size={20} />
                </div>
                <p className="text-sm text-slate-500">Duration</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {formatTime(elapsed)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Target size={20} />
                </div>
                  <p className="text-sm text-slate-500">Answers attempted</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {results.filter((result) => result.answer.trim()).length}/
                  {questions.length}
                </p>
              </div>
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900">
                  Question-by-question feedback
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  AI-generated feedback is practice guidance. Reference
                  answers are intentionally revealed only after submission.
                  Incorrect or off-topic answers receive 0/100; valid
                  alternative wording is accepted.
                </p>
              </div>

              <div className="space-y-5">
                {scoredResults.map((result, index) => (
                  <article
                    key={result.questionId}
                    className="rounded-2xl border border-slate-200 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                            {result.category}
                          </p>
                          <h4 className="mt-1 font-semibold leading-6 text-slate-900">
                            {result.question}
                          </h4>
                        </div>
                      </div>

                      <div className="min-w-24 rounded-xl bg-slate-50 px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-slate-900">
                          {result.score}
                        </p>
                        <p className="text-xs text-slate-500">/ 100</p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl bg-slate-50 p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Your answer
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {result.answer || "No answer submitted."}
                      </p>
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-semibold text-slate-800">
                        {result.performance} ·{" "}
                        {result.answerIsCorrect === true
                          ? "Answer accepted as correct"
                          : result.answer.trim()
                            ? "Incorrect or off-topic · 0/100"
                            : "No answer · 0/100"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {result.relevanceAssessment}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {result.feedback}
                      </p>
                    </div>

                    <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                      <p className="mb-3 text-sm font-semibold text-slate-800">
                        Scoring rubric
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        {(
                          [
                            ["Relevance", result.rubric.relevance],
                            ["Correctness", result.rubric.correctness],
                            ["Completeness", result.rubric.completeness],
                            ["Reasoning", result.rubric.reasoning],
                            ["Clarity", result.rubric.clarity],
                          ] as const
                        ).map(([label, score]) => (
                          <div key={label}>
                            <div className="mb-1 flex justify-between text-xs text-slate-600">
                              <span>{label}</span>
                              <span>{score}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-white">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-800">
                          <CheckCircle2 size={17} />
                          Strengths
                        </p>
                        {result.strengths.length ? (
                          <ul className="space-y-2">
                            {result.strengths.map((item) => (
                              <li
                                key={item}
                                className="flex gap-2 text-sm leading-5 text-emerald-900"
                              >
                                <span>•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-emerald-900">
                            No strengths were identified for this answer.
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
                        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
                          <TrendingUp size={17} />
                          Improve next time
                        </p>
                        {result.improvements.length ? (
                          <ul className="space-y-2">
                            {result.improvements.map((item) => (
                              <li
                                key={item}
                                className="flex gap-2 text-sm leading-5 text-amber-900"
                              >
                                <span>•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-amber-900">
                            No additional improvement suggestion was returned.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-4">
                        <p className="mb-2 text-sm font-semibold text-rose-800">
                          Missing or incorrect concepts
                        </p>
                        <ul className="space-y-1">
                          {result.incorrectOrMissing.map((item) => (
                            <li
                              key={item}
                              className="text-sm leading-5 text-rose-900"
                            >
                              • {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-4">
                        <p className="mb-2 text-sm font-semibold text-violet-800">
                          Recommended topics
                        </p>
                        <p className="text-sm leading-5 text-violet-900">
                          {result.recommendedTopics.length
                            ? result.recommendedTopics.join(", ")
                            : "Keep practicing this topic."}
                        </p>
                      </div>
                    </div>

                    <details className="mt-4 rounded-xl border border-slate-200 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                        View reference answer and follow-up practice
                      </summary>
                      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Reference answer
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        {result.idealAnswer}
                      </p>
                      {result.followUpQuestion && (
                        <>
                          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                            Follow-up question
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-700">
                            {result.followUpQuestion}
                          </p>
                        </>
                      )}
                    </details>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
                  <Sparkles size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900">
                    Your next steps
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {results.flatMap((result) => result.improvements).length
                      ? "Start with these specific recommendations from your answers:"
                      : "Practice using a clear structure: answer directly, explain your reasoning, and support it with a concrete example."}
                  </p>
                  {Array.from(
                    new Set(results.flatMap((result) => result.improvements)),
                  ).length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {Array.from(
                        new Set(
                          results.flatMap((result) => result.improvements),
                        ),
                      )
                        .slice(0, 6)
                        .map((item) => (
                          <li
                            key={item}
                            className="flex gap-2 text-sm leading-5 text-slate-700"
                          >
                            <span className="text-indigo-600">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={restartInterview}
                      className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      <RotateCcw size={17} />
                      Try another interview
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-5 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                    >
                      <Search size={17} />
                      Print / save report
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <p className="text-center text-xs leading-5 text-slate-500">
              Practice estimates are not verified placement-readiness or
              hiring assessments. History is stored per selected student
              in this browser only.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}