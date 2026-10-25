import raw from "./questionBank.json";
import type { PublicQuestion, Rubric } from "./types";

export const QUESTION_BANK = raw as unknown as Rubric[];

export function getRubric(id: string): Rubric | undefined {
  return QUESTION_BANK.find((q) => q.id === id);
}

export function findRubricByText(question: string): Rubric | undefined {
  const norm = question.trim().toLowerCase();
  return QUESTION_BANK.find((q) => q.question.trim().toLowerCase() === norm);
}

export function toPublic(q: Rubric): PublicQuestion {
  return { id: q.id, category: q.category, question: q.question, maxMarks: q.maxMarks };
}

export const CATEGORY_ORDER = ["Introduction", "Technical Knowledge", "Problem Solving", "Communication", "Behavioral"] as const;

/** One question per category, rotating at random. Technical questions are filtered by role when any match. */
export function pickInterview(role?: string, random: () => number = Math.random): PublicQuestion[] {
  return CATEGORY_ORDER.map((category) => {
    let pool = QUESTION_BANK.filter((q) => q.category === category);
    if (category === "Technical Knowledge" && role) {
      const forRole = pool.filter((q) => q.roles?.includes(role));
      if (forRole.length) pool = forRole;
    }
    return toPublic(pool[Math.floor(random() * pool.length)]);
  });
}
