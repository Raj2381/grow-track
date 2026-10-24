import type { CodingAttempt, CodingLanguage } from '@student/types'

export const MIN_QUESTIONS_FOR_SKILL = 5
export const CODING_LANGUAGES: CodingLanguage[] = ['Java', 'Python', 'C', 'SQL']

/** Best score per language (only attempts with enough questions count toward the skill score). */
export function bestByLanguage(attempts: CodingAttempt[], countAll = false): Partial<Record<CodingLanguage, number>> {
  const out: Partial<Record<CodingLanguage, number>> = {}
  for (const a of attempts) if (countAll || a.questionCount >= MIN_QUESTIONS_FOR_SKILL) out[a.language] = Math.max(out[a.language] ?? 0, a.score)
  return out
}

/** < 40% Beginner · 40–74% Intermediate · >= 75% Advanced */
export const codingLevel = (pct: number) => (pct >= 75 ? 'Advanced' : pct >= 40 ? 'Intermediate' : 'Beginner')
