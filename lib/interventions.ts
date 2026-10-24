export type InterventionPriority = "High" | "Medium" | "Low";
export type InterventionStatus = "Planned" | "In Progress" | "Completed";

export type Intervention = {
  id: string;
  studentId: string;
  reason: string;
  actionPlan: string;
  priority: InterventionPriority;
  followUpDate: string;
  status: InterventionStatus;
  createdAt: string;
};

export const INTERVENTIONS_STORAGE_KEY = "campusiq-interventions";
export const INTERVENTIONS_UPDATED_EVENT = "campusiq-interventions-updated";

export function isIntervention(value: unknown): value is Intervention {
  if (!value || typeof value !== "object") return false;

  const item = value as Partial<Intervention>;
  return (
    typeof item.id === "string" &&
    typeof item.studentId === "string" &&
    typeof item.reason === "string" &&
    typeof item.actionPlan === "string" &&
    (item.priority === "High" ||
      item.priority === "Medium" ||
      item.priority === "Low") &&
    typeof item.followUpDate === "string" &&
    (item.status === "Planned" ||
      item.status === "In Progress" ||
      item.status === "Completed") &&
    typeof item.createdAt === "string"
  );
}

export function readInterventions(): Intervention[] {
  if (typeof window === "undefined") return [];

  const stored = window.localStorage.getItem(INTERVENTIONS_STORAGE_KEY);
  if (!stored) return [];

  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isIntervention)) {
    throw new Error("Saved intervention data is invalid.");
  }
  return parsed;
}

export function saveInterventions(interventions: Intervention[]) {
  window.localStorage.setItem(
    INTERVENTIONS_STORAGE_KEY,
    JSON.stringify(interventions),
  );
  window.dispatchEvent(new Event(INTERVENTIONS_UPDATED_EVENT));
}

export function subscribeToInterventions(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(INTERVENTIONS_UPDATED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(INTERVENTIONS_UPDATED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
