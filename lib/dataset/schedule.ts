import { HOLIDAYS, SEM_DATES, iso } from "./calendar";

/**
 * Lecture dates of the subject at position `subjectIndex` (0-5) in a semester timetable.
 * Each subject meets 3 days out of every 5 working days, staggered by subject position.
 * The generator stores only a presence string per subject; this function rebuilds the dates.
 */
export function lectureDates(semester: number, subjectIndex: number): string[] {
  const [from, to] = SEM_DATES[semester];
  const dates: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); iso(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const weekday = d.getUTCDay();
    const date = iso(d);
    if (weekday === 0 || weekday === 6 || HOLIDAYS.has(date)) continue;
    if ((weekday + subjectIndex) % 5 < 3) dates.push(date);
  }
  return dates;
}
