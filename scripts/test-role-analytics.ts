/** HOD / TPO analytics tests.  npm run test:roles */
import { ATTENDANCE_LIMIT, byMentor, bySection, histogram, placementRow, skillAverages, statusCounts, summarize, tpoStatus } from "../lib/role-analytics";
import type { ScopeStudent } from "../lib/data/scope";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); if (!ok) failures++; };

const base: ScopeStudent = {
  id: "STU-1", name: "A", department: "Computer Science", branchCode: "CSE", section: "A", mentorId: "FAC-1", overall: "Low", reason: "", predSgpa: 7, backlogLevel: "Low",
  placementLevel: "Low", engagementLevel: "Low", readyP: 0.9, backlogP: 0.1, cgpa: 7.5, sgpaLast: 7, attendance: 85, attChange: 0, backlogs: 0, submitPct: 90, points: 40, faculty: 4,
  aptitude: 82, aptitudeAttempts: 3, coding: 78, codingAttempts: 2, interview: 85, interviewAttempts: 1, tech: 80, comm: 76, successScore: 80,
};
const mk = (o: Partial<ScopeStudent>): ScopeStudent => ({ ...base, ...o });

const list = [mk({}), mk({ id: "S2", attendance: 60, overall: "High", backlogs: 2, section: "B", mentorId: "FAC-2", cgpa: 5 }), mk({ id: "S3", attendance: 74.9, overall: "Medium", section: "B", mentorId: "FAC-2", cgpa: 6 })];
const t = summarize(list);
check("summary counts students, risk, backlogs", t.students === 3 && t.highRisk === 1 && t.mediumRisk === 1 && t.withBacklog === 1);
check("attendance below the limit uses < 75 exactly", ATTENDANCE_LIMIT === 75 && t.belowAttendance === 2);
check("averages are rounded, not invented", t.avgAttendance === 73.3 && t.avgCgpa === 6.17, `${t.avgAttendance} ${t.avgCgpa}`);
const empty = summarize([]);
check("an empty department gives nulls and zeros, not NaN", empty.students === 0 && empty.avgAttendance === null && empty.avgCgpa === null && empty.highRisk === 0);
check("by section groups and sorts", JSON.stringify(bySection(list).map((r) => [r.section, r.students])) === JSON.stringify([["A", 1], ["B", 2]]));
const m = byMentor(list, [{ id: "FAC-1", name: "One" }, { id: "FAC-2", name: "Two" }, { id: "FAC-3", name: "Idle" }]);
check("by mentor counts mentees and keeps mentors with none", m[0].mentees === 1 && m[1].mentees === 2 && m[1].highRisk === 1 && m[2].mentees === 0 && m[2].avgAttendance === null);
check("histogram buckets add up and the last bucket is closed", histogram([0, 49.9, 50, 99, 100], [0, 50, 100]).map((b) => b.count).join() === "2,3");

check("tpo status thresholds", tpoStatus(80) === "Ready" && tpoStatus(79.9) === "In preparation" && tpoStatus(50) === "In preparation" && tpoStatus(49.9) === "Not ready" && tpoStatus(null) === "Not assessed");
const ready = placementRow(base);
check("a fully assessed strong student is Ready with strengths and no weaknesses", ready.status === "Ready" && ready.weaknesses.length === 0 && ready.strengths.length === 5 && ready.recommendations[0] === "Continue placement preparation", String(ready.readiness));
const none = placementRow(mk({ aptitudeAttempts: 0, codingAttempts: 0, interviewAttempts: 0, tech: 0, comm: 0 }));
check("a student with no assessment is Not assessed, never scored zero", none.status === "Not assessed" && none.readiness === null && none.notAssessed.length === 5 && none.recommendations.some((r) => r.startsWith("First assessment")));
const weak = placementRow(mk({ coding: 30, interview: 40, aptitudeAttempts: 0 }));
check("weak areas produce matching recommendations, unassessed areas are not called weak", weak.weaknesses.join() === "Coding,Mock interviews" && !weak.weaknesses.includes("Aptitude") && weak.recommendations.some((r) => r.includes("Coding")) && weak.recommendations.some((r) => r.includes("Mock interviews")));
const rows = [ready, none, weak];
const counts = statusCounts(rows);
check("status counts add up to the number of students", Object.values(counts).reduce((a, b) => a + b, 0) === 3 && counts["Not assessed"] === 1);
const avgs = skillAverages(rows);
check("skill averages only use assessed students", avgs.find((a) => a.label === "Aptitude")!.assessed === 1 && avgs.find((a) => a.label === "Coding")!.assessed === 2);
console.log(failures ? `\n${failures} FAILED` : "\nALL ROLE ANALYTICS TESTS PASSED");
process.exit(failures ? 1 : 0);
