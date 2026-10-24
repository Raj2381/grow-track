/**
 * Academic calendar shared by the dataset generator and the apps.
 * The batch joined in Aug 2024. Semesters 1-5 are complete; semester 6 is the upcoming one that the
 * Round 2 models predict. "Today" is just after the semester-5 results.
 */
export const TODAY = "2027-01-08";
export const CURRENT_SEM = 5;
export const BATCH_YEAR = 2024;

export const SEM_DATES: Record<number, [string, string]> = {
  1: ["2024-08-05", "2024-12-20"],
  2: ["2025-01-06", "2025-05-30"],
  3: ["2025-08-04", "2025-12-19"],
  4: ["2026-01-05", "2026-05-29"],
  5: ["2026-08-03", "2026-12-18"],
};

export const SEM_MONTHS: Record<number, string[]> = {
  1: ["2024-08", "2024-09", "2024-10", "2024-11", "2024-12"],
  2: ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05"],
  3: ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12"],
  4: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"],
  5: ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"],
};

export const HOLIDAYS = new Set([
  "2024-10-02", "2024-11-01", "2025-03-14", "2025-04-18", "2025-10-02", "2025-10-21",
  "2026-03-04", "2026-04-03", "2026-09-15", "2026-10-02", "2026-11-09",
]);

export const SEMESTERS = [1, 2, 3, 4, 5] as const;

export const iso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}
