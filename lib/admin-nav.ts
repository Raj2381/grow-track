import {
  Activity, BookOpen, BriefcaseBusiness, ChartLine, CircleHelp, ClipboardCheck, ClipboardList, FlaskConical, Layers, LayoutDashboard, ListChecks,
  MessageSquare, Presentation, Radar, Settings, ShieldAlert, Users, UsersRound, type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/data/current-user";

export type NavLink = { label: string; href: string; icon: LucideIcon };

/** The forecast screens, shown as their own group in every admin sidebar. */
export const FORECAST_LINKS: NavLink[] = [
  { label: "Forecast", href: "/admin/predictions", icon: Radar },
  { label: "Recommendations", href: "/admin/recommendations", icon: ListChecks },
  { label: "Risk trends", href: "/admin/risk-trends", icon: ChartLine },
  { label: "Segments", href: "/admin/segments", icon: Layers },
  { label: "Model performance", href: "/admin/model", icon: FlaskConical },
  { label: "Executive brief", href: "/admin/executive-brief", icon: Presentation },
];

export type NavSet = { home: string; label: string; workspace: NavLink[]; forecast: NavLink[]; account: NavLink[] };

const SHARED_HELP = (prefix: string): NavLink[] => [
  { label: "Settings", href: `${prefix}/settings`, icon: Settings },
  { label: "Help and documentation", href: `${prefix}/help`, icon: CircleHelp },
];

const ADMIN_WORKSPACE: NavLink[] = [
  { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Students", href: "/students", icon: Users },
  { label: "Academic performance", href: "/academic-performance", icon: BookOpen },
  { label: "Results", href: "/results", icon: ClipboardList },
  { label: "Attendance management", href: "/admin/attendance", icon: ClipboardCheck },
  { label: "Placement readiness", href: "/placement-readiness", icon: BriefcaseBusiness },
  { label: "Interventions", href: "/interventions", icon: Activity },
];

/** The sidebar for each role. Each role sees only its own links; the database and the routing rules enforce the same limits. */
export const NAV_BY_ROLE: Record<Exclude<AppRole, "student">, NavSet> = {
  admin: { home: "/admin/dashboard", label: "Administrator", workspace: ADMIN_WORKSPACE, forecast: FORECAST_LINKS, account: [
    { label: "Settings", href: "/settings", icon: Settings }, { label: "Help and documentation", href: "/help", icon: CircleHelp },
  ] },
  faculty: { home: "/faculty/dashboard", label: "Faculty", workspace: [{ label: "Overview", href: "/faculty/dashboard", icon: LayoutDashboard }, ...ADMIN_WORKSPACE.slice(1)],
    forecast: FORECAST_LINKS.filter((l) => l.href !== "/admin/executive-brief"), account: SHARED_HELP("/faculty") },
  hod: { home: "/hod/dashboard", label: "Head of Department", workspace: [
    { label: "Overview", href: "/hod/dashboard", icon: LayoutDashboard },
    { label: "Faculty overview", href: "/hod/faculty", icon: UsersRound },
    { label: "Student performance", href: "/hod/students", icon: BookOpen },
    { label: "Attendance analytics", href: "/hod/attendance", icon: ClipboardCheck },
    { label: "Academic results", href: "/hod/results", icon: ClipboardList },
    { label: "Student feedback", href: "/hod/feedback", icon: MessageSquare },
  ], forecast: FORECAST_LINKS.filter((l) => l.href !== "/admin/executive-brief"), account: SHARED_HELP("/hod") },
  tpo: { home: "/tpo/dashboard", label: "Training and Placement", workspace: [
    { label: "Overview", href: "/tpo/dashboard", icon: LayoutDashboard },
    { label: "Placement readiness", href: "/tpo/placement-readiness", icon: BriefcaseBusiness },
    { label: "Strong and weak areas", href: "/tpo/strong-weak-areas", icon: BookOpen },
    { label: "Students needing support", href: "/tpo/students-needing-support", icon: ShieldAlert },
    { label: "Placement analytics", href: "/tpo/placement-analytics", icon: ClipboardList },
  ], forecast: FORECAST_LINKS.filter((l) => ["/admin/predictions", "/admin/recommendations", "/admin/segments"].includes(l.href)), account: SHARED_HELP("/tpo") },
};

/** Which sidebar to draw: the workspace in the URL decides at once (no flicker); shared pages follow the signed-in role. */
export function navRoleFor(pathname: string, sessionRole: AppRole | null | undefined): Exclude<AppRole, "student"> {
  const m = /^\/(hod|tpo|faculty)(\/|$)/.exec(pathname);
  if (m) return m[1] as "hod" | "tpo" | "faculty";
  return sessionRole && sessionRole !== "student" ? sessionRole : "admin";
}
