/**
 * Saved demo data (attendance sessions, interventions, declared results, student overlays...) is keyed by student id.
 * When the dataset changes, old ids no longer exist and several readers would reject the saved data. This clears
 * it once per dataset version. It only touches keys this app wrote, and never theme or layout preferences.
 */
export const DATASET_VERSION = "unified-800-v1";
const VERSION_KEY = "growthtrack-dataset-version";

const EXACT_KEYS = [
  "campusiq-attendance-sessions",
  "campusiq-interventions",
  "campusiq-academic-updates",
  "campusiq-mock-interview-results",
  "campusiq-demo-student-id",
  "growthtrack-declared-results",
  "scap.overlay.v1",
];
const PREFIXES = ["campusiq-lms-activity", "campusiq-lms-session", "growtrack.feedback.v1."];

export function migrateDemoData() {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    if (storage.getItem(VERSION_KEY) === DATASET_VERSION) return;
    EXACT_KEYS.forEach((key) => storage.removeItem(key));
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key && PREFIXES.some((prefix) => key.startsWith(prefix))) storage.removeItem(key);
    }
    storage.setItem(VERSION_KEY, DATASET_VERSION);
  } catch {
    // storage unavailable (private mode): nothing was saved either
  }
}
