import { homeFor, type AppRole } from "./supabase/config";

/** Pages only staff may open. Students are sent back to their own dashboard. */
export const STAFF_PREFIXES = [
  "/admin", "/students", "/academic-performance", "/results", "/attendance", "/placement-readiness",
  "/skill-gap", "/mock-interviews", "/interventions", "/settings",
];
/** Each role's own workspace; HOD and TPO see nothing outside it, faculty keep the shared staff pages as well. */
export const WORKSPACE_PREFIX: Partial<Record<AppRole, string>> = { hod: "/hod", tpo: "/tpo", faculty: "/faculty" };
const ALL_WORKSPACES = Object.values(WORKSPACE_PREFIX) as string[];
/** The forecast pages every staff role may open; the database narrows what each one sees (a HOD's department, a mentor's mentees). */
export const FORECAST_PAGES = ["/admin/predictions", "/admin/recommendations", "/admin/risk-trends", "/admin/segments", "/admin/model"];
export const PUBLIC_PATHS = ["/", "/login", "/help"];

const startsWithAny = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export type Decision =
  | { action: "next" }
  | { action: "redirect"; to: string };

/**
 * The routing rules, as a pure function so they can be tested without a server.
 * This is a convenience layer (UX and a first wall): Row Level Security is what actually protects the data.
 */
export function decide(path: string, user: { role: AppRole | null; studentId: string | null } | null): Decision {
  if (path.startsWith("/auth/")) return { action: "next" };
  if (!user) {
    if (PUBLIC_PATHS.includes(path)) return { action: "next" };
    return { action: "redirect", to: `/login?next=${encodeURIComponent(path)}` };
  }
  if (!user.role) {
    // signed in but with no profile (for example a self-signup): no access to anything but the login page
    return path === "/login" || path === "/" ? { action: "next" } : { action: "redirect", to: "/login?error=no-access" };
  }
  if (path === "/login") return { action: "redirect", to: homeFor(user.role) };
  if (user.role === "hod" || user.role === "tpo") {
    // outside their own workspace (and the public pages) they are sent home
    if (!startsWithAny(path, [WORKSPACE_PREFIX[user.role]!, ...FORECAST_PAGES]) && !PUBLIC_PATHS.includes(path)) return { action: "redirect", to: homeFor(user.role) };
    return { action: "next" };
  }
  if (user.role !== "admin" && startsWithAny(path, ALL_WORKSPACES) && !startsWithAny(path, [WORKSPACE_PREFIX[user.role] ?? "/none"])) {
    return { action: "redirect", to: homeFor(user.role) };
  }
  if (user.role === "student") {
    if (startsWithAny(path, STAFF_PREFIXES)) return { action: "redirect", to: "/student/dashboard" };
    const viewing = /^\/student\/dashboard\/student\/([^/]+)/.exec(path);
    if (viewing && viewing[1] !== user.studentId) return { action: "redirect", to: "/student/dashboard" };
  }
  return { action: "next" };
}

