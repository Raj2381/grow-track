/** Routing rules and redirect safety.  npm run test:auth */
import { decide } from "../lib/supabase/proxy";
import { homeFor, safeNext } from "../lib/supabase/config";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` ${detail}` : ""}`); if (!ok) failures++; };
const to = (d: ReturnType<typeof decide>) => (d.action === "redirect" ? d.to : "next");

const anon = null;
const student = { role: "student" as const, studentId: "STU-0001" };
const faculty = { role: "faculty" as const, studentId: null };
const admin = { role: "admin" as const, studentId: null };
const hod = { role: "hod" as const, studentId: null };
const tpo = { role: "tpo" as const, studentId: null };
const roleless = { role: null, studentId: null };

check("anonymous: landing, login and help are public", ["/", "/login", "/help"].every((p) => to(decide(p, anon)) === "next"));
check("anonymous: every dashboard route redirects to /login with a next parameter", ["/admin/dashboard", "/students", "/student/dashboard", "/results", "/interventions", "/skill-gap"].every((p) => to(decide(p, anon)) === `/login?next=${encodeURIComponent(p)}`));
check("anonymous: the auth endpoints stay reachable", to(decide("/auth/signout", anon)) === "next");
check("student: own portal is open", to(decide("/student/dashboard", student)) === "next" && to(decide("/student/dashboard/results", student)) === "next");
check("student: staff pages redirect to the student dashboard", ["/admin/dashboard", "/students", "/academic-performance", "/results", "/attendance", "/placement-readiness", "/skill-gap", "/mock-interviews", "/interventions", "/settings", "/admin/attendance"].every((p) => to(decide(p, student)) === "/student/dashboard"));
check("student: another student's portal URL redirects to their own", to(decide("/student/dashboard/student/STU-0002", student)) === "/student/dashboard" && to(decide("/student/dashboard/student/STU-0002/results", student)) === "/student/dashboard");
check("student: their own id in the staff-view URL is allowed", to(decide("/student/dashboard/student/STU-0001/results", student)) === "next");
check("faculty and admin: can open staff pages and any student's portal view", [faculty, admin].every((u) => to(decide("/admin/dashboard", u)) === "next" && to(decide("/student/dashboard/student/STU-0042", u)) === "next"));
check("signed-in users do not see the login page again", to(decide("/login", student)) === "/student/dashboard" && to(decide("/login", admin)) === "/admin/dashboard" && to(decide("/login", faculty)) === "/faculty/dashboard" && to(decide("/login", hod)) === "/hod/dashboard" && to(decide("/login", tpo)) === "/tpo/dashboard");
check("a signed-in user without a role gets nothing but login and landing", to(decide("/admin/dashboard", roleless)) === "/login?error=no-access" && to(decide("/student/dashboard", roleless)) === "/login?error=no-access" && to(decide("/login", roleless)) === "next");
check("each role has a home", homeFor("student") === "/student/dashboard" && homeFor("admin") === "/admin/dashboard" && homeFor("faculty") === "/faculty/dashboard" && homeFor("hod") === "/hod/dashboard" && homeFor("tpo") === "/tpo/dashboard");
check("hod: own workspace is open, everything else (admin, TPO, student, shared staff pages) redirects to the HOD dashboard", to(decide("/hod/students", hod)) === "next" && ["/admin/dashboard", "/tpo/dashboard", "/student/dashboard", "/students", "/results", "/faculty/dashboard"].every((p) => to(decide(p, hod)) === "/hod/dashboard"));
check("tpo: own workspace is open, everything else redirects to the TPO dashboard", to(decide("/tpo/placement-analytics", tpo)) === "next" && ["/admin/dashboard", "/hod/dashboard", "/student/dashboard", "/placement-readiness", "/interventions"].every((p) => to(decide(p, tpo)) === "/tpo/dashboard"));
check("hod and tpo may open the forecast pages (the database limits what they see) but not the executive brief", ["/admin/predictions", "/admin/recommendations", "/admin/segments"].every((p) => to(decide(p, hod)) === "next" && to(decide(p, tpo)) === "next") && to(decide("/admin/executive-brief", hod)) === "/hod/dashboard");
check("hod and tpo can still read the public help and landing pages", ["/", "/help"].every((p) => to(decide(p, hod)) === "next" && to(decide(p, tpo)) === "next"));
check("faculty: other roles' workspaces redirect to the faculty dashboard, own workspace and staff pages open", to(decide("/hod/dashboard", faculty)) === "/faculty/dashboard" && to(decide("/tpo/dashboard", faculty)) === "/faculty/dashboard" && to(decide("/faculty/dashboard", faculty)) === "next" && to(decide("/students", faculty)) === "next");
check("admin can open every workspace", ["/hod/dashboard", "/tpo/dashboard", "/faculty/dashboard"].every((p) => to(decide(p, admin)) === "next"));
check("student: the HOD, TPO and faculty workspaces redirect to the student dashboard", ["/hod/dashboard", "/tpo/dashboard", "/faculty/dashboard"].every((p) => to(decide(p, student)) === "/student/dashboard"));
check("safeNext accepts same-site paths", safeNext("/students?x=1") === "/students?x=1" && safeNext("/student/dashboard") === "/student/dashboard");
check("safeNext rejects open-redirect attempts", ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null, undefined, "evil.com"].every((v) => safeNext(v as string | null) === null));

console.log(failures ? `\n${failures} FAILED` : "\nALL AUTH ROUTING TESTS PASSED");
process.exit(failures ? 1 : 0);
