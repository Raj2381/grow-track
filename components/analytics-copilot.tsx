"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navRoleFor } from "@/lib/admin-nav";

const FOLLOW_UP = {
  admin: { review: "/interventions", directory: "/students" },
  faculty: { review: "/interventions", directory: "/students" },
  hod: { review: "/hod/results", directory: "/hod/students" },
  tpo: { review: "/tpo/students-needing-support", directory: "/tpo/placement-readiness" },
} as const;
import {
  ArrowRight,
  Bot,
  Check,
  CornerDownLeft,
  MessageCircle,
  Minimize2,
  Sparkles,
} from "lucide-react";
import {
  getAdminAnalyticsAnswer,
  type AdminAnalyticsAnswer,
} from "@/lib/admin-analytics";
import { useData } from "@/lib/data/hooks";
import { fetchScopeStudents } from "@/lib/data/scope";
import { toAnalyticsStudent } from "@/lib/role-analytics";

const suggestedQuestions = [
  "Which students are most at risk this semester?",
  "What factors are driving poor placement readiness?",
  "Show me students who have good CGPA but low employability scores.",
  "What intervention should we prioritize for the CSE department?",
];

const adminWorkspacePaths = [
  "/admin",
  "/faculty",
  "/hod",
  "/tpo",
  "/students",
  "/attendance",
  "/academic-performance",
  "/results",
  "/placement-readiness",
  "/interventions",
  "/settings",
  "/help",
  "/skill-gap",
  "/mock-interviews",
];

const COPILOT_DISCOVERY_KEY = "growthtrack-copilot-discovery-seen";

export function AnalyticsCopilot() {
  const pathname = usePathname();
  // false while the server renders and during hydration, so the button never causes a hydration mismatch
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [isOpen, setIsOpen] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AdminAnalyticsAnswer | null>(null);

  const links = FOLLOW_UP[navRoleFor(pathname, null)];
  const isAdminWorkspace = adminWorkspacePaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  // The students come from the database for the signed-in person's own scope (a mentor's mentees, a HOD's department, everyone for admin/TPO).
  // They are fetched only once the panel is opened, so pages without the assistant open never pay for it.
  const students = useData(isAdminWorkspace && isOpen ? ["copilot-students"] : null, async (db) => (await fetchScopeStudents(db)).map(toAnalyticsStudent), { revalidateOnFocus: false });
  const profiles = students.data ?? [];

  useEffect(() => {
    if (!isAdminWorkspace || isOpen) return;

    try {
      if (window.localStorage.getItem(COPILOT_DISCOVERY_KEY)) return;
    } catch (error) {
      console.error("Could not read Copilot discovery preference.", error);
    }

    const showTimeoutId = window.setTimeout(() => setShowDiscovery(true), 0);
    const dismissTimeoutId = window.setTimeout(() => {
      setShowDiscovery(false);
      try {
        window.localStorage.setItem(COPILOT_DISCOVERY_KEY, "true");
      } catch (error) {
        console.error("Could not save Copilot discovery preference.", error);
      }
    }, 6000);

    return () => {
      window.clearTimeout(showTimeoutId);
      window.clearTimeout(dismissTimeoutId);
    };
  }, [isAdminWorkspace, isOpen]);

  function openCopilot() {
    setShowDiscovery(false);
    setIsOpen(true);
    try {
      window.localStorage.setItem(COPILOT_DISCOVERY_KEY, "true");
    } catch (error) {
      console.error("Could not save Copilot discovery preference.", error);
    }
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || !students.data) return;
    setResult(getAdminAnalyticsAnswer(trimmedQuestion, profiles));
  }

  if (!mounted || !isAdminWorkspace) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {isOpen ? (
        <section
          id="analytics-copilot-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="analytics-copilot-heading"
          aria-describedby="analytics-copilot-description"
          className="flex max-h-[min(82vh,760px)] w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-[#dce8df] bg-white shadow-[0_16px_60px_rgba(25,63,49,0.22)] sm:w-[460px]"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#e9eee8] bg-gradient-to-r from-[#f3f8f4] to-white px-4 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#28684e] text-white">
                <Bot size={20} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="analytics-copilot-heading"
                    className="text-[16px] font-semibold text-[#26382c]"
                  >
                    Analytics Copilot
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[15px] font-medium text-[#55715e] ring-1 ring-[#dce8df]">
                    <Sparkles size={10} />
                    Evidence-backed
                  </span>
                </div>
                <p
                  id="analytics-copilot-description"
                  className="mt-1 text-[13px] leading-4 text-[#4b5a50]"
                >
                  Ask about student performance and get grounded insights.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close analytics copilot"
              className="shrink-0 rounded-md p-1.5 text-[#4b5a50] transition hover:bg-[#edf3ee] hover:text-[#26382c]"
            >
              <Minimize2 size={17} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <p className="mb-3 text-[13px] text-[#556057]">
              {students.data ? `Using ${profiles.length.toLocaleString()} student records from your workspace` : students.error ?? "Loading student records…"}
            </p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {suggestedQuestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setQuestion(suggestion);
                    if (students.data) setResult(getAdminAnalyticsAnswer(suggestion, profiles));
                  }}
                  className="rounded-md border border-[#e2e7df] bg-white px-2 py-1.5 text-left text-[13px] leading-4 text-[#536056] transition hover:border-[#b6cebd] hover:bg-[#f7faf7]"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {result && (
              <div
                aria-live="polite"
                className="rounded-md border border-[#e2e9e2] bg-[#fbfcfa]"
              >
                <div className="flex justify-end p-3 pb-0">
                  <p className="max-w-[90%] rounded-lg rounded-br-sm bg-[#28684e] px-3 py-2 text-[13px] leading-4 text-white">
                    {question}
                  </p>
                </div>
                <div className="border-b border-[#e9eee8] px-3 py-3">
                  <p className="flex items-center gap-2 text-[15px] font-semibold text-[#344037]">
                    <Check size={15} className="shrink-0 text-[#28684e]" />
                    {result.title}
                  </p>
                  <p className="mt-2 text-[13px] leading-5 text-[#3f4a42]">
                    {result.summary}
                  </p>
                </div>

                <div className="space-y-4 p-3">
                  <div>
                    <h3 className="text-[13px] font-bold uppercase tracking-[0.7px] text-[#55715e]">
                      Evidence
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {result.evidence.map((item) => (
                        <li
                          key={item}
                          className="flex gap-2 text-[13px] leading-4 text-[#3f4a42]"
                        >
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7da188]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 rounded-md border border-[#dce9df] bg-[#f5faf6] p-2.5">
                      <p className="text-[15px] font-bold uppercase tracking-[0.6px] text-[#28654d]">
                        Suggested next step
                      </p>
                      <p className="mt-1.5 text-[13px] leading-4 text-[#536056]">
                        {result.recommendation}
                      </p>
                      <Link
                        href={links.review}
                        className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#28684e] hover:underline"
                      >
                        Review the follow-up page <ArrowRight size={11} />
                      </Link>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[13px] font-bold uppercase tracking-[0.7px] text-[#55715e]">
                        Matching students
                      </h3>
                      {result.students.length > 0 && (
                        <Link
                          href={links.directory}
                          className="text-[13px] font-semibold text-[#28684e] hover:underline"
                        >
                          Open the student list
                        </Link>
                      )}
                    </div>
                    {result.students.length > 0 ? (
                      <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto">
                        {result.students.map((student) => (
                          <li
                            key={student.id}
                            className="rounded-md border border-[#e5e9e3] bg-white p-2.5"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-[13px] font-semibold text-[#344037]">
                                  {student.name}
                                </p>
                                <p className="mt-1 text-[15px] text-[#556057]">
                                  {student.id} · {student.department}
                                </p>
                              </div>
                              <span className="rounded bg-[#f0f2ee] px-1.5 py-0.5 text-[15px] text-[#637066]">
                                {student.risk} risk
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[15px] text-[#3f4a42]">
                              <span>Academic {student.academicScore}</span>
                              <span>Placement {student.placementScore}</span>
                              <span>Attendance {student.attendance}%</span>
                              {result.includeGpaDetails && (
                                <>
                                  <span>
                                    CGPA{" "}
                                    {student.cgpa !== undefined
                                      ? student.cgpa.toFixed(2)
                                      : "Not recorded"}
                                  </span>
                                  <span>
                                    SGPA{" "}
                                    {student.sgpa !== undefined
                                      ? student.sgpa.toFixed(2)
                                      : "Not recorded"}
                                  </span>
                                </>
                              )}
                            </div>
                            {student.riskReasons.length > 0 && (
                              <p className="mt-2 text-[15px] leading-4 text-[#4b564e]">
                                {student.riskReasons.join(" ")}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 rounded-md border border-dashed border-[#dfe5dc] bg-white p-3 text-[13px] leading-4 text-[#4b564e]">
                        No matching student records to list for this answer.
                      </p>
                    )}
                  </div>
                </div>

                <p className="border-t border-[#e9eee8] px-3 py-2 text-[15px] leading-4 text-[#556057]">
                  Source: your workspace&apos;s student records and forecasts. Rule-based
                  analysis, not an external AI service. Validate records before acting.
                </p>
              </div>
            )}
          </div>

          <form
            onSubmit={submitQuestion}
            className="flex shrink-0 items-center gap-2 border-t border-[#e9eee8] bg-white p-3"
          >
            <label htmlFor="analytics-copilot-question" className="sr-only">
              Ask the student success data
            </label>
            <input
              id="analytics-copilot-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about student performance..."
              className="h-10 min-w-0 flex-1 rounded-md border border-[#dfe5dc] bg-white px-3 text-[14px] text-[#303b32] placeholder:text-[#6b756c]"
              maxLength={300}
            />
            <button
              type="submit"
              disabled={!question.trim() || !students.data}
              aria-label="Analyze question"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#28684e] text-white transition hover:bg-[#1f583f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CornerDownLeft size={16} />
            </button>
          </form>
        </section>
      ) : (
        <div className="copilot-launcher-wrap group relative">
          <div
            id="analytics-copilot-tooltip"
            role="tooltip"
            className={`copilot-launcher-tooltip ${
              showDiscovery ? "copilot-launcher-tooltip-discover" : ""
            }`}
          >
            <span className="copilot-tooltip-accent" />
            <span>
              <strong>AI Copilot</strong>
              <small>Your personal campus assistant</small>
            </span>
          </div>
          <button
            type="button"
            onClick={openCopilot}
            aria-label="Open AI Copilot"
            aria-describedby="analytics-copilot-tooltip"
            aria-expanded={isOpen}
            aria-controls="analytics-copilot-panel"
            className="copilot-launcher-button flex h-14 w-14 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d9d7d] focus-visible:ring-offset-4"
          >
            <MessageCircle size={24} strokeWidth={2.1} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
