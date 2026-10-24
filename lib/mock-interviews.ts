export const interviewTypes = [
  "Technical",
  "HR",
  "Aptitude",
  "Communication",
  "Mixed",
] as const;

export type InterviewType = (typeof interviewTypes)[number];

export const interviewDifficulties = [
  "Beginner",
  "Intermediate",
  "Advanced",
] as const;

export type InterviewDifficulty = (typeof interviewDifficulties)[number];

export type InterviewQuestion = {
  id: string;
  category: InterviewType | "Problem Solving" | "Behavioral";
  topic: string;
  difficulty: InterviewDifficulty;
  question: string;
  expectedConcepts: string[];
  idealAnswer: string;
};

export type InterviewRubric = {
  relevance: number;
  correctness: number;
  completeness: number;
  reasoning: number;
  clarity: number;
};

export type InterviewAnswerEvaluation = {
  questionId: string;
  question: string;
  category: InterviewQuestion["category"];
  topic: string;
  difficulty: InterviewDifficulty;
  answer: string;
  score: number;
  answerIsCorrect?: boolean;
  performance: "Excellent" | "Good" | "Partial" | "Poor" | "Irrelevant";
  relevanceAssessment: string;
  feedback: string;
  rubric: InterviewRubric;
  strengths: string[];
  incorrectOrMissing: string[];
  idealAnswer: string;
  improvements: string[];
  recommendedTopics: string[];
  followUpQuestion: string;
};

export type MockInterviewAttempt = {
  id: string;
  studentId: string;
  role: string;
  interviewType: InterviewType;
  difficulty: InterviewDifficulty;
  questionCount: number;
  questions: InterviewQuestion[];
  answers: string[];
  answerEvaluations: InterviewAnswerEvaluation[];
  averageScore: number;
  completedAt: string;
  durationSeconds: number;
  status: "completed";
  generationMode: "openai" | "anthropic" | "fallback";
  evaluationMode: "openai" | "anthropic" | "mixed" | "blank";
  topicPerformance: { topic: string; score: number }[];
  strengths: string[];
  weakAreas: string[];
  recommendations: string[];
};

export type TopicPerformance = {
  topic: string;
  averageScore: number;
  attempts: number;
  trend: "improving" | "declining" | "steady";
};

export type MockInterviewHistorySummary = {
  priorQuestionIds: string[];
  weakAreas: string[];
  improvingAreas: string[];
  strongAreas: string[];
};

type QuestionTemplate = Omit<InterviewQuestion, "difficulty"> & {
  allowedTypes: InterviewType[];
  minimumDifficulty: InterviewDifficulty;
  roles: string[];
};

const questionTemplates: QuestionTemplate[] = [
  {
    id: "js-closures",
    category: "Technical",
    topic: "JavaScript",
    question:
      "A click handler inside a loop logs the same final value for every button. Explain why this happens and how you would fix it.",
    expectedConcepts: ["closure", "scope", "let or block scope", "handler capture"],
    idealAnswer:
      "The callbacks close over a shared loop binding, so they observe its final value when invoked. Use a block-scoped binding such as let, create a per-iteration function scope, or capture the value explicitly.",
    allowedTypes: ["Technical", "Mixed"],
    minimumDifficulty: "Beginner",
    roles: ["Software Developer", "Frontend Developer", "Full Stack Developer"],
  },
  {
    id: "js-event-loop",
    category: "Technical",
    topic: "JavaScript",
    question:
      "In JavaScript, what is the event loop responsible for, and how do promise callbacks relate to timers?",
    expectedConcepts: ["call stack", "event loop", "microtask queue", "task queue"],
    idealAnswer:
      "The event loop coordinates queued work after the current stack completes. Promise reactions run as microtasks, which are typically drained before the next timer or other task callback.",
    allowedTypes: ["Technical", "Aptitude", "Mixed"],
    minimumDifficulty: "Intermediate",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Full Stack Developer"],
  },
  {
    id: "react-state",
    category: "Technical",
    topic: "React",
    question:
      "A component renders a large list and feels slow. Describe how you would investigate and improve it without changing its behavior.",
    expectedConcepts: ["profile first", "unnecessary renders", "memoization", "list virtualization"],
    idealAnswer:
      "Profile the component first, identify expensive renders, stabilize props where useful, memoize costly work or components only when measured, and consider list virtualization for large lists.",
    allowedTypes: ["Technical", "Mixed"],
    minimumDifficulty: "Intermediate",
    roles: ["Software Developer", "Frontend Developer", "Full Stack Developer"],
  },
  {
    id: "react-effects",
    category: "Technical",
    topic: "React",
    question:
      "A page fetches duplicate data after a component renders. How would you investigate the cause and make the request lifecycle reliable?",
    expectedConcepts: ["effect dependencies", "cleanup", "request cancellation", "loading and error states"],
    idealAnswer:
      "Inspect effect dependencies and development Strict Mode behavior, avoid triggering requests during render, cancel or ignore stale requests during cleanup, and represent loading and error states explicitly.",
    allowedTypes: ["Technical", "Mixed"],
    minimumDifficulty: "Intermediate",
    roles: ["Software Developer", "Frontend Developer", "Full Stack Developer"],
  },
  {
    id: "sql-joins",
    category: "Technical",
    topic: "SQL",
    question:
      "A report must include every customer, including customers with no orders. Which join would you use and how would you handle missing order values?",
    expectedConcepts: ["left join", "preserve left rows", "null values", "join condition"],
    idealAnswer:
      "Use a LEFT JOIN from customers to orders. It preserves every customer and returns NULL in the order columns when there is no matching order; use the join condition on the customer key.",
    allowedTypes: ["Technical", "Aptitude", "Mixed"],
    minimumDifficulty: "Beginner",
    roles: ["Software Developer", "Backend Developer", "Data Analyst", "Full Stack Developer"],
  },
  {
    id: "sql-aggregation",
    category: "Technical",
    topic: "SQL",
    question:
      "How would you find departments whose average salary is above a given threshold, and why is WHERE not enough for that condition?",
    expectedConcepts: ["group by", "aggregate", "having", "where filters rows"],
    idealAnswer:
      "Group rows by department, calculate AVG(salary), then filter the groups with HAVING. WHERE filters individual rows before grouping and cannot directly filter the aggregate result.",
    allowedTypes: ["Technical", "Aptitude", "Mixed"],
    minimumDifficulty: "Intermediate",
    roles: ["Software Developer", "Backend Developer", "Data Analyst"],
  },
  {
    id: "sql-index",
    category: "Technical",
    topic: "SQL",
    question:
      "A frequently used lookup query has become slow as a table grows. How can an index help, and what trade-offs would you check?",
    expectedConcepts: ["index lookup", "query plan", "write overhead", "storage"],
    idealAnswer:
      "An appropriate index can reduce rows scanned for selective lookups. Check the query plan and selectivity; indexes consume storage and add work to inserts, updates, and deletes.",
    allowedTypes: ["Technical", "Mixed"],
    minimumDifficulty: "Advanced",
    roles: ["Software Developer", "Backend Developer", "Data Analyst"],
  },
  {
    id: "api-idempotency",
    category: "Technical",
    topic: "APIs",
    question:
      "A client retries a payment request after a timeout. How would you prevent the retry from charging the customer twice?",
    expectedConcepts: ["idempotency key", "server-side record", "atomic operation", "retry"],
    idealAnswer:
      "Accept a client-generated idempotency key, persist the key with the operation result, and atomically ensure repeated requests with that key return the original result rather than creating another charge.",
    allowedTypes: ["Technical", "Mixed"],
    minimumDifficulty: "Advanced",
    roles: ["Software Developer", "Backend Developer", "Full Stack Developer"],
  },
  {
    id: "api-status",
    category: "Technical",
    topic: "APIs",
    question:
      "An API request fails because the caller sent invalid data. Which HTTP status would you return and what should the response communicate?",
    expectedConcepts: ["4xx client error", "400 or 422", "actionable validation", "no secrets"],
    idealAnswer:
      "Return a 4xx response such as 400 or 422 with a clear, actionable validation error that identifies the invalid field without exposing internal details or secrets.",
    allowedTypes: ["Technical", "Mixed"],
    minimumDifficulty: "Beginner",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Full Stack Developer"],
  },
  {
    id: "debugging-regression",
    category: "Problem Solving",
    topic: "Debugging",
    question:
      "A bug appears only after a recent release and cannot be reproduced locally. Walk through how you would investigate it safely.",
    expectedConcepts: ["scope impact", "logs and telemetry", "reproduction", "rollback or mitigation", "regression test"],
    idealAnswer:
      "Establish impact and scope, inspect deployment changes and telemetry, reproduce with production-like conditions without exposing sensitive data, mitigate or roll back if needed, then add a regression test.",
    allowedTypes: ["Technical", "Aptitude", "Mixed"],
    minimumDifficulty: "Intermediate",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Data Analyst", "QA Engineer"],
  },
  {
    id: "complexity",
    category: "Aptitude",
    topic: "Problem Solving",
    question:
      "You have a list of numbers and need to find whether any two sum to a target. Compare a straightforward approach with a more efficient one.",
    expectedConcepts: ["nested scan", "hash set", "time complexity", "space trade-off"],
    idealAnswer:
      "A nested scan takes O(n²) time and constant extra space. A hash set can find complements in one pass with O(n) expected time and O(n) extra space.",
    allowedTypes: ["Aptitude", "Technical", "Mixed"],
    minimumDifficulty: "Intermediate",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Data Analyst", "QA Engineer"],
  },
  {
    id: "data-analyst-missing",
    category: "Aptitude",
    topic: "Data Analysis",
    question:
      "A dataset has missing values in a field used for a report. What checks would you perform before choosing how to handle them?",
    expectedConcepts: ["missingness pattern", "impact", "domain context", "document choice"],
    idealAnswer:
      "Measure how many values are missing and whether the pattern correlates with groups or outcomes, consult domain meaning, assess impact on the report, and document any exclusion or imputation.",
    allowedTypes: ["Aptitude", "Technical", "Mixed"],
    minimumDifficulty: "Beginner",
    roles: ["Data Analyst", "Software Developer"],
  },
  {
    id: "data-analyst-correlation",
    category: "Aptitude",
    topic: "Statistics",
    question:
      "A chart shows that two variables move together. What can you conclude, and what additional evidence is needed before claiming causation?",
    expectedConcepts: ["correlation not causation", "confounders", "study design", "evidence"],
    idealAnswer:
      "The observed association does not establish that one variable causes the other. Consider confounders, temporal order, a credible causal design or experiment, and uncertainty before making causal claims.",
    allowedTypes: ["Aptitude", "Technical", "Mixed"],
    minimumDifficulty: "Intermediate",
    roles: ["Data Analyst", "Software Developer"],
  },
  {
    id: "security-input",
    category: "Technical",
    topic: "Web Security",
    question:
      "A search term is inserted into a database query. How would you prevent that input from changing the meaning of the query?",
    expectedConcepts: ["parameterized query", "input treated as data", "avoid concatenation"],
    idealAnswer:
      "Use parameterized queries or prepared statements so the search term is treated as data, not SQL syntax. Avoid concatenating untrusted input into the query string.",
    allowedTypes: ["Technical", "Mixed"],
    minimumDifficulty: "Intermediate",
    roles: ["Software Developer", "Backend Developer", "Full Stack Developer"],
  },
  {
    id: "testing-boundaries",
    category: "Technical",
    topic: "Testing",
    question:
      "A function works for typical inputs but fails for an empty list and duplicate values. What tests and design checks would you add?",
    expectedConcepts: ["boundary cases", "duplicates", "expected behavior", "regression tests"],
    idealAnswer:
      "Add tests for empty input, one item, duplicates, and normal cases, define expected behavior for each boundary, and retain the cases as regression tests.",
    allowedTypes: ["Technical", "Aptitude", "Mixed"],
    minimumDifficulty: "Beginner",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "QA Engineer"],
  },
  {
    id: "git-conflict",
    category: "Technical",
    topic: "Collaboration",
    question:
      "Two branches changed the same function and now conflict. How would you resolve the conflict while preserving both intended behaviors?",
    expectedConcepts: ["understand both changes", "resolve deliberately", "tests", "review"],
    idealAnswer:
      "Understand the intent of both changes, combine or choose behavior deliberately rather than accepting a side blindly, run focused tests, and request review if requirements conflict.",
    allowedTypes: ["Technical", "Communication", "Mixed"],
    minimumDifficulty: "Intermediate",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "QA Engineer"],
  },
  {
    id: "hr-feedback",
    category: "HR",
    topic: "Communication",
    question:
      "Describe a time you received difficult feedback. What did you do with it and what changed afterward?",
    expectedConcepts: ["specific situation", "listen", "action", "outcome", "reflection"],
    idealAnswer:
      "Use a specific example, explain how you listened and clarified the feedback, describe the concrete change you made, and reflect on the outcome or lesson.",
    allowedTypes: ["HR", "Communication", "Mixed"],
    minimumDifficulty: "Beginner",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Data Analyst", "QA Engineer", "General Graduate Role"],
  },
  {
    id: "hr-priority",
    category: "HR",
    topic: "Time Management",
    question:
      "Two important tasks have the same deadline and different stakeholders. How would you decide what to do first and communicate the plan?",
    expectedConcepts: ["impact and urgency", "clarify dependencies", "communicate trade-offs", "revisit plan"],
    idealAnswer:
      "Compare impact, urgency, dependencies, and effort, clarify expectations with stakeholders, communicate trade-offs and a realistic plan, then revisit it as information changes.",
    allowedTypes: ["HR", "Communication", "Mixed"],
    minimumDifficulty: "Intermediate",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Data Analyst", "QA Engineer", "General Graduate Role"],
  },
  {
    id: "hr-mistake",
    category: "Behavioral",
    topic: "Accountability",
    question:
      "Tell me about a mistake you made in a team project. How did you handle the impact and prevent a repeat?",
    expectedConcepts: ["own responsibility", "communicate impact", "corrective action", "prevention"],
    idealAnswer:
      "Describe a real mistake without blaming others, explain how you communicated and corrected its impact, and identify a specific prevention or learning step.",
    allowedTypes: ["HR", "Communication", "Mixed"],
    minimumDifficulty: "Beginner",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Data Analyst", "QA Engineer", "General Graduate Role"],
  },
  {
    id: "hr-motivation",
    category: "HR",
    topic: "Role Motivation",
    question:
      "What attracts you to this role, and which experience or skill best prepares you to contribute?",
    expectedConcepts: ["role-specific motivation", "relevant evidence", "contribution", "growth"],
    idealAnswer:
      "Connect a specific aspect of the role to your interests, give evidence from a relevant project or experience, and explain how you would contribute while continuing to learn.",
    allowedTypes: ["HR", "Communication", "Mixed"],
    minimumDifficulty: "Beginner",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Data Analyst", "QA Engineer", "General Graduate Role"],
  },
  {
    id: "communication-explain",
    category: "Communication",
    topic: "Communication",
    question:
      "Explain a technical decision you made to a non-technical stakeholder, including the trade-off and how you checked they understood.",
    expectedConcepts: ["plain language", "relevant context", "trade-off", "check understanding"],
    idealAnswer:
      "Give context in plain language, relate the decision to stakeholder goals, explain the trade-off without jargon, and invite questions or confirm understanding.",
    allowedTypes: ["Communication", "HR", "Mixed"],
    minimumDifficulty: "Intermediate",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Data Analyst", "QA Engineer", "General Graduate Role"],
  },
  {
    id: "communication-uncertainty",
    category: "Communication",
    topic: "Communication",
    question:
      "A stakeholder asks for a delivery date before the work is fully understood. How would you respond accurately and keep them informed?",
    expectedConcepts: ["state uncertainty", "clarify scope", "estimate range", "update cadence"],
    idealAnswer:
      "Be transparent about uncertainty, clarify scope and dependencies, provide a provisional range with assumptions, and agree on when you will update the estimate.",
    allowedTypes: ["Communication", "HR", "Mixed"],
    minimumDifficulty: "Advanced",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Data Analyst", "QA Engineer", "General Graduate Role"],
  },
  {
    id: "frontend-accessibility",
    category: "Technical",
    topic: "Accessibility",
    question:
      "A custom dropdown works with a mouse but not a keyboard. What interaction and accessibility behavior would you check?",
    expectedConcepts: ["keyboard navigation", "focus management", "accessible name", "semantic pattern"],
    idealAnswer:
      "Check a suitable semantic pattern, keyboard navigation and selection, visible focus, accessible naming and state, and screen-reader announcements; avoid inventing keyboard behavior inconsistent with the chosen pattern.",
    allowedTypes: ["Technical", "Mixed"],
    minimumDifficulty: "Intermediate",
    roles: ["Frontend Developer", "Software Developer", "Full Stack Developer"],
  },
  {
    id: "backend-transactions",
    category: "Technical",
    topic: "Databases",
    question:
      "An operation updates two related tables, but the second update can fail. How would you prevent the database from being left half-updated?",
    expectedConcepts: ["transaction", "atomicity", "rollback", "error handling"],
    idealAnswer:
      "Perform both updates in a database transaction so they commit atomically; if either fails, roll back and report the failure appropriately.",
    allowedTypes: ["Technical", "Mixed"],
    minimumDifficulty: "Intermediate",
    roles: ["Backend Developer", "Software Developer", "Full Stack Developer"],
  },
  {
    id: "qa-test-strategy",
    category: "Technical",
    topic: "Testing",
    question:
      "A release includes a critical checkout flow change. How would you choose a focused set of automated and manual tests?",
    expectedConcepts: ["risk-based testing", "happy path", "failure cases", "regression", "test layers"],
    idealAnswer:
      "Use risk-based coverage for the main success path and critical failure boundaries, select suitable unit/integration/end-to-end layers, verify regressions, and manually explore high-impact edge cases.",
    allowedTypes: ["Technical", "Aptitude", "Mixed"],
    minimumDifficulty: "Advanced",
    roles: ["QA Engineer", "Software Developer", "Backend Developer", "Frontend Developer"],
  },
  {
    id: "frontend-layout",
    category: "Technical",
    topic: "CSS",
    question:
      "A dashboard looks correct on desktop but overflows on a narrow phone. How would you locate and fix the responsive layout issue?",
    expectedConcepts: ["reproduce viewport", "overflow source", "responsive constraints", "test breakpoints"],
    idealAnswer:
      "Reproduce at narrow widths, inspect which element exceeds its container, fix intrinsic sizing or min-width constraints, use responsive layout rules, and retest nearby breakpoints.",
    allowedTypes: ["Technical", "Mixed"],
    minimumDifficulty: "Beginner",
    roles: ["Frontend Developer", "Software Developer", "Full Stack Developer"],
  },
  {
    id: "data-chart-misleading",
    category: "Aptitude",
    topic: "Data Analysis",
    question:
      "A chart uses a truncated axis and makes a small difference look dramatic. How would you present the comparison fairly?",
    expectedConcepts: ["axis context", "scale choice", "show absolute values", "avoid misleading framing"],
    idealAnswer:
      "Use an appropriate axis scale, disclose any truncation, show values and context, and consider a complementary view so the visual magnitude does not exaggerate the difference.",
    allowedTypes: ["Aptitude", "Communication", "Mixed"],
    minimumDifficulty: "Intermediate",
    roles: ["Data Analyst", "General Graduate Role"],
  },
  {
    id: "problem-decomposition",
    category: "Aptitude",
    topic: "Problem Solving",
    question:
      "You receive a vague request to improve an application. How would you turn it into a problem that can be investigated and measured?",
    expectedConcepts: ["clarify user", "identify pain point", "baseline", "measurable outcome", "validate"],
    idealAnswer:
      "Clarify who is affected and the observed pain point, establish a baseline, define a measurable outcome, identify constraints, and validate the proposed problem with stakeholders or users.",
    allowedTypes: ["Aptitude", "HR", "Mixed"],
    minimumDifficulty: "Beginner",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Data Analyst", "QA Engineer", "General Graduate Role"],
  },
  {
    id: "tradeoffs",
    category: "Problem Solving",
    topic: "Problem Solving",
    question:
      "A quick fix would reduce today's incident but increase maintenance risk. How would you decide on a response and explain the trade-off?",
    expectedConcepts: ["impact", "short-term mitigation", "long-term fix", "risk", "communication"],
    idealAnswer:
      "Compare immediate user impact and operational risk, choose a safe reversible mitigation if needed, plan the durable fix, and communicate assumptions, risks, and follow-up ownership.",
    allowedTypes: ["Technical", "HR", "Mixed"],
    minimumDifficulty: "Advanced",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Data Analyst", "QA Engineer", "General Graduate Role"],
  },
  {
    id: "role-security",
    category: "Technical",
    topic: "Security",
    question:
      "A feature needs an API credential in the browser. Where should the credential live and how should the browser access the feature?",
    expectedConcepts: ["server-side secret", "backend endpoint", "authorization", "least privilege"],
    idealAnswer:
      "Keep the credential in a server-side secret store, expose a constrained backend endpoint, authenticate and authorize access there, and grant only the permissions required.",
    allowedTypes: ["Technical", "Mixed"],
    minimumDifficulty: "Advanced",
    roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Full Stack Developer"],
  },
];

const difficultyRank: Record<InterviewDifficulty, number> = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
};

export function buildTopicPerformance(
  attempts: MockInterviewAttempt[],
): TopicPerformance[] {
  const scoresByTopic = new Map<string, number[]>();
  for (const attempt of attempts) {
    for (const evaluation of attempt.answerEvaluations) {
      const scores = scoresByTopic.get(evaluation.topic) ?? [];
      scores.push(evaluation.score);
      scoresByTopic.set(evaluation.topic, scores);
    }
  }

  return [...scoresByTopic.entries()]
    .map(([topic, scores]) => {
      const latestScores = scores.slice(-3);
      const previousScores = scores.slice(-6, -3);
      const averageScore = (values: number[]) =>
        values.length
          ? Math.round(values.reduce((total, score) => total + score, 0) / values.length)
          : 0;
      const latest = averageScore(latestScores);
      const previous = averageScore(previousScores);

      return {
        topic,
        averageScore: latest,
        attempts: scores.length,
        trend:
          previousScores.length === 0 || Math.abs(latest - previous) < 5
            ? "steady"
            : latest > previous
              ? "improving"
              : "declining",
      } satisfies TopicPerformance;
    })
    .sort((left, right) => left.averageScore - right.averageScore);
}

export function summarizeInterviewHistory(
  attempts: MockInterviewAttempt[],
): MockInterviewHistorySummary {
  const ordered = attempts
    .slice()
    .sort(
      (left, right) =>
        Date.parse(right.completedAt) - Date.parse(left.completedAt),
    );
  const topics = buildTopicPerformance(ordered);

  return {
    priorQuestionIds: ordered
      .slice(0, 3)
      .flatMap((attempt) => attempt.questions.map((question) => question.id))
      .slice(0, 30),
    weakAreas: topics
      .filter((topic) => topic.averageScore < 65)
      .slice(0, 5)
      .map((topic) => topic.topic),
    improvingAreas: topics
      .filter((topic) => topic.trend === "improving")
      .slice(0, 5)
      .map((topic) => topic.topic),
    strongAreas: topics
      .filter((topic) => topic.averageScore >= 80)
      .slice(-5)
      .map((topic) => topic.topic),
  };
}

function overlapsWeakArea(question: QuestionTemplate, areas: string[]) {
  return areas.some((area) => area.toLowerCase() === question.topic.toLowerCase());
}

function relatedToWeakArea(question: QuestionTemplate, areas: string[]) {
  const relatedTopics: Record<string, string[]> = {
    SQL: ["Data Analysis", "Databases", "Statistics"],
    React: ["JavaScript", "Accessibility", "CSS"],
    JavaScript: ["React", "APIs", "Testing"],
    "Problem Solving": ["Debugging", "Data Analysis", "Testing"],
    Communication: ["Time Management", "Accountability", "Role Motivation"],
    Debugging: ["Testing", "Problem Solving", "Collaboration"],
    "Data Analysis": ["Statistics", "SQL", "Communication"],
    Statistics: ["Data Analysis", "SQL", "Problem Solving"],
  };
  return areas.some(
    (area) =>
      relatedTopics[area]?.some(
        (topic) => topic.toLowerCase() === question.topic.toLowerCase(),
      ) ?? false,
  );
}

export function createFallbackQuestions(options: {
  role: string;
  interviewType: InterviewType;
  difficulty: InterviewDifficulty;
  questionCount: number;
  history: MockInterviewHistorySummary;
  attemptSeed: string;
}): InterviewQuestion[] {
  const roleQuestions = questionTemplates.filter((question) =>
    question.roles.includes(options.role),
  );
  const eligibleRoleQuestions = roleQuestions.filter(
    (question) =>
      difficultyRank[question.minimumDifficulty] <=
      Math.min(2, difficultyRank[options.difficulty] + 1),
  );
  const pool = eligibleRoleQuestions.length
    ? eligibleRoleQuestions
    : roleQuestions;
  const priorIds = new Set(options.history.priorQuestionIds);
  const freshPool = pool.filter((question) => !priorIds.has(question.id));
  const selectionPool = freshPool.length >= options.questionCount ? freshPool : pool;
  const selected: QuestionTemplate[] = [];
  const remaining = selectionPool.slice();
  const weakCount = options.history.weakAreas.length
    ? Math.round(options.questionCount * 0.6)
    : Math.ceil(options.questionCount * 0.35);
  const relatedCount = options.history.weakAreas.length
    ? Math.round(options.questionCount * 0.25)
    : Math.ceil(options.questionCount * 0.3);
  const targetDifficulties = options.history.weakAreas.length
    ? difficultyRank[options.difficulty]
    : Math.max(0, difficultyRank[options.difficulty] - 1);

  const pick = (predicate: (question: QuestionTemplate) => boolean) => {
    const candidates = remaining.filter(predicate);
    if (!candidates.length) return false;
    const focusedCandidates =
      options.interviewType === "Mixed"
        ? candidates
        : candidates.filter((question) =>
            question.allowedTypes.includes(options.interviewType),
          );
    const selectableCandidates = focusedCandidates.length
      ? focusedCandidates
      : candidates;
    const seedOffset = [...options.attemptSeed].reduce(
      (total, character) => total + character.charCodeAt(0),
      0,
    );
    const choiceIndex = seedOffset % selectableCandidates.length;
    const choice = selectableCandidates[choiceIndex];
    selected.push(choice);
    remaining.splice(remaining.indexOf(choice), 1);
    return true;
  };

  for (let index = 0; index < weakCount; index++) {
    pick(
      (question) =>
        overlapsWeakArea(question, options.history.weakAreas) &&
        difficultyRank[question.minimumDifficulty] <= targetDifficulties,
    );
  }
  for (let index = 0; index < relatedCount; index++) {
    pick((question) =>
      relatedToWeakArea(question, options.history.weakAreas),
    );
  }
  while (selected.length < options.questionCount && remaining.length > 0) {
    pick(() => true);
  }

  const ranked = selected.slice(0, options.questionCount).map((template) => {
    const adaptiveScore = options.history.weakAreas.includes(template.topic)
      ? options.history.weakAreas.reduce(
          (score, area, index) =>
            area === template.topic ? 100 - index * 5 : score,
          0,
        )
      : 0;
    const adaptiveChallenge =
      options.history.improvingAreas.includes(template.topic) &&
      adaptiveScore === 0;
    const requestedRank = Math.min(
      2,
      difficultyRank[options.difficulty] + (adaptiveChallenge ? 1 : 0),
    );
    const questionRank = Math.max(
      requestedRank,
      difficultyRank[template.minimumDifficulty],
    );
    const difficulty = interviewDifficulties[questionRank];

    return {
      id: template.id,
      category: template.category,
      topic: template.topic,
      difficulty,
      question: template.question,
      expectedConcepts: template.expectedConcepts,
      idealAnswer: template.idealAnswer,
    };
  });

  return ranked;
}

export function calculateInterviewScore(
  rubric: InterviewRubric,
  category: InterviewQuestion["category"],
) {
  const weights =
    category === "HR" || category === "Behavioral" || category === "Communication"
      ? { relevance: 25, correctness: 10, completeness: 20, reasoning: 20, clarity: 25 }
      : { relevance: 30, correctness: 30, completeness: 20, reasoning: 15, clarity: 5 };

  return Math.round(
    (rubric.relevance * weights.relevance +
      rubric.correctness * weights.correctness +
      rubric.completeness * weights.completeness +
      rubric.reasoning * weights.reasoning +
      rubric.clarity * weights.clarity) /
      100,
  );
}

export function performanceLabel(
  score: number,
  relevance: number,
): InterviewAnswerEvaluation["performance"] {
  if (relevance < 10) return "Irrelevant";
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 45) return "Partial";
  return "Poor";
}

export function isInterviewQuestion(
  value: unknown,
): value is InterviewQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Partial<InterviewQuestion>;
  return (
    typeof question.id === "string" &&
    question.id.length > 0 &&
    question.id.length <= 100 &&
    typeof question.category === "string" &&
    (interviewTypes.includes(question.category as InterviewType) ||
      question.category === "Problem Solving" ||
      question.category === "Behavioral") &&
    typeof question.topic === "string" &&
    question.topic.length > 0 &&
    question.topic.length <= 100 &&
    typeof question.difficulty === "string" &&
    interviewDifficulties.includes(
      question.difficulty as InterviewDifficulty,
    ) &&
    typeof question.question === "string" &&
    question.question.trim().length > 0 &&
    question.question.length <= 1_000 &&
    Array.isArray(question.expectedConcepts) &&
    question.expectedConcepts.length > 0 &&
    question.expectedConcepts.length <= 12 &&
    question.expectedConcepts.every(
      (concept) => typeof concept === "string" && concept.length <= 160,
    ) &&
    typeof question.idealAnswer === "string" &&
    question.idealAnswer.length <= 2_000
  );
}

export function isInterviewAnswerEvaluation(
  value: unknown,
  requireCorrectnessFlag = false,
): value is InterviewAnswerEvaluation {
  if (!value || typeof value !== "object") return false;
  const evaluation = value as Partial<InterviewAnswerEvaluation>;
  const rubric = evaluation.rubric;
  return (
    typeof evaluation.questionId === "string" &&
    typeof evaluation.question === "string" &&
    typeof evaluation.category === "string" &&
    typeof evaluation.topic === "string" &&
    typeof evaluation.difficulty === "string" &&
    typeof evaluation.answer === "string" &&
    typeof evaluation.score === "number" &&
    Number.isFinite(evaluation.score) &&
    evaluation.score >= 0 &&
    evaluation.score <= 100 &&
    (typeof evaluation.answerIsCorrect === "boolean" ||
      (!requireCorrectnessFlag && evaluation.answerIsCorrect === undefined)) &&
    typeof evaluation.performance === "string" &&
    typeof evaluation.relevanceAssessment === "string" &&
    typeof evaluation.feedback === "string" &&
    !!rubric &&
    ["relevance", "correctness", "completeness", "reasoning", "clarity"].every(
      (key) =>
        typeof rubric[key as keyof typeof rubric] === "number" &&
        Number.isFinite(rubric[key as keyof typeof rubric]) &&
        rubric[key as keyof typeof rubric] >= 0 &&
        rubric[key as keyof typeof rubric] <= 100,
    ) &&
    Array.isArray(evaluation.strengths) &&
    evaluation.strengths.every((item) => typeof item === "string") &&
    Array.isArray(evaluation.incorrectOrMissing) &&
    evaluation.incorrectOrMissing.every((item) => typeof item === "string") &&
    typeof evaluation.idealAnswer === "string" &&
    Array.isArray(evaluation.improvements) &&
    evaluation.improvements.every((item) => typeof item === "string") &&
    Array.isArray(evaluation.recommendedTopics) &&
    evaluation.recommendedTopics.every((item) => typeof item === "string") &&
    typeof evaluation.followUpQuestion === "string"
  );
}

export function enforceCorrectAnswerScore(
  evaluation: InterviewAnswerEvaluation,
): InterviewAnswerEvaluation {
  if (evaluation.answerIsCorrect === true) return evaluation;

  return {
    ...evaluation,
    score: 0,
    rubric: {
      relevance: 0,
      correctness: 0,
      completeness: 0,
      reasoning: 0,
      clarity: 0,
    },
  };
}

export function isMockInterviewAttempt(
  value: unknown,
): value is MockInterviewAttempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Partial<MockInterviewAttempt>;
  return (
    typeof attempt.id === "string" &&
    typeof attempt.studentId === "string" &&
    typeof attempt.role === "string" &&
    typeof attempt.interviewType === "string" &&
    interviewTypes.includes(attempt.interviewType as InterviewType) &&
    typeof attempt.difficulty === "string" &&
    interviewDifficulties.includes(attempt.difficulty as InterviewDifficulty) &&
    Number.isInteger(attempt.questionCount) &&
    typeof attempt.questionCount === "number" &&
    attempt.questionCount >= 3 &&
    attempt.questionCount <= 10 &&
    Array.isArray(attempt.questions) &&
    attempt.questions.length === attempt.questionCount &&
    attempt.questions.every(isInterviewQuestion) &&
    Array.isArray(attempt.answers) &&
    attempt.answers.length === attempt.questionCount &&
    attempt.answers.every((answer) => typeof answer === "string") &&
    Array.isArray(attempt.answerEvaluations) &&
    attempt.answerEvaluations.length === attempt.questionCount &&
    attempt.answerEvaluations.every((evaluation) =>
      isInterviewAnswerEvaluation(evaluation),
    ) &&
    typeof attempt.averageScore === "number" &&
    Number.isFinite(attempt.averageScore) &&
    attempt.averageScore >= 0 &&
    attempt.averageScore <= 100 &&
    typeof attempt.completedAt === "string" &&
    Number.isFinite(Date.parse(attempt.completedAt)) &&
    typeof attempt.durationSeconds === "number" &&
    attempt.durationSeconds >= 0 &&
    attempt.status === "completed" &&
    (attempt.generationMode === "openai" ||
      attempt.generationMode === "anthropic" ||
      attempt.generationMode === "fallback") &&
    (attempt.evaluationMode === "openai" ||
      attempt.evaluationMode === "anthropic" ||
      attempt.evaluationMode === "mixed" ||
      attempt.evaluationMode === "blank") &&
    Array.isArray(attempt.topicPerformance) &&
    Array.isArray(attempt.strengths) &&
    Array.isArray(attempt.weakAreas) &&
    Array.isArray(attempt.recommendations)
  );
}

export function buildCompletedAttempt(input: {
  id: string;
  studentId: string;
  role: string;
  interviewType: MockInterviewAttempt["interviewType"];
  difficulty: MockInterviewAttempt["difficulty"];
  questions: InterviewQuestion[];
  answers: string[];
  answerEvaluations: InterviewAnswerEvaluation[];
  completedAt: string;
  durationSeconds: number;
  generationMode: MockInterviewAttempt["generationMode"];
  evaluationMode: MockInterviewAttempt["evaluationMode"];
}): MockInterviewAttempt {
  if (
    input.questions.length === 0 ||
    input.questions.length !== input.answers.length ||
    input.questions.length !== input.answerEvaluations.length
  ) {
    throw new Error("Interview attempt data does not contain matching questions and answers.");
  }
  const answerEvaluations = input.answerEvaluations.map(
    enforceCorrectAnswerScore,
  );
  const averageScore = Math.round(
    answerEvaluations.reduce((total, item) => total + item.score, 0) /
      input.answerEvaluations.length,
  );
  const scoresByTopic = new Map<string, number[]>();
  for (const evaluation of answerEvaluations) {
    const scores = scoresByTopic.get(evaluation.topic) ?? [];
    scores.push(evaluation.score);
    scoresByTopic.set(evaluation.topic, scores);
  }
  const topicPerformance = [...scoresByTopic.entries()].map(
    ([topic, scores]) => ({
      topic,
      score: Math.round(
        scores.reduce((total, score) => total + score, 0) / scores.length,
      ),
    }),
  );
  const strengths = [
    ...new Set(answerEvaluations.flatMap((item) => item.strengths)),
  ].slice(0, 6);
  const weakAreas = topicPerformance
    .filter((topic) => topic.score < 65)
    .sort((left, right) => left.score - right.score)
    .slice(0, 5)
    .map((topic) => topic.topic);
  const recommendations = [
    ...new Set(
      answerEvaluations.flatMap((item) => [
        ...item.recommendedTopics,
        ...item.improvements,
      ]),
    ),
  ].slice(0, 8);

  return {
    ...input,
    answerEvaluations,
    averageScore,
    questionCount: input.questions.length,
    status: "completed",
    evaluationMode: input.evaluationMode,
    topicPerformance,
    strengths,
    weakAreas,
    recommendations,
  };
}
