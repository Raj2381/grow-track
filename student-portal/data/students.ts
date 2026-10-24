/**
 * The student portal no longer ships a student list. Records come from the unified dataset
 * (data/DATASET.md) and are fetched one student at a time by services/api.ts.
 */
export { TODAY, CURRENT_SEM } from '@/lib/dataset/calendar'

/** The "logged-in" demo student. */
export const DEFAULT_STUDENT_ID = 'STU-0001'
