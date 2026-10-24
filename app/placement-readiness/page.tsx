"use client";

import { AdminPageShell } from "@/components/admin-page-shell";
import { studentProfiles, studentDepartments } from "@/lib/students";
import { Pager, usePaged } from "@/components/pager";
import { useMemo, useState } from "react";
import {
Users,
BriefcaseBusiness,
TrendingUp,
Search,
CheckCircle2,
AlertTriangle,
Target,
Code2,
MessageCircle,
Brain,
} from "lucide-react";
import {
BarChart,
Bar,
XAxis,
YAxis,
CartesianGrid,
Tooltip,
ResponsiveContainer,
} from "recharts";

type Student = {
  id: string;
  name: string;
  department: string;
  semester: string;
  technical: number;
  aptitude: number;
  communication: number;
  interview: number;
};

/** One row per student, taken from the unified dataset. */
const students: Student[] = studentProfiles.map((profile) => ({
  id: profile.id,
  name: profile.name,
  department: profile.department,
  semester: `Semester ${profile.semester}`,
  ...profile.placement,
}));

const departments = ["All departments", ...studentDepartments];

function getReadiness(student: Student) {
return Math.round(
(student.technical +
student.aptitude +
student.communication +
student.interview) /
4,
);
}

function getStatus(score: number) {
if (score >= 80) return "Placement ready";
if (score >= 65) return "Almost ready";
return "Needs training";
}

function MetricCard({
title,
value,
description,
icon: Icon,
}: {
title: string;
value: string;
description: string;
icon: typeof Users;
}) {
return ( <div className="rounded-xl border border-[#e2e8e2] bg-white p-5"> <div className="flex items-center justify-between gap-3"> <p className="text-[15px] text-[#4b564e]">{title}</p> <div className="rounded-lg bg-[#edf5ef] p-2.5 text-[#28684e]"> <Icon size={20} /> </div> </div> <p className="mt-4 text-3xl font-semibold tracking-tight text-[#203d2e]">
{value} </p> <p className="mt-2 text-[13.5px] text-[#556057]">{description}</p> </div>
);
}

function StatusBadge({ score }: { score: number }) {
const status = getStatus(score);

const style =
score >= 80
? "bg-green-50 text-green-700"
: score >= 65
? "bg-amber-50 text-amber-700"
: "bg-red-50 text-red-700";

return (
<span
className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-[13.5px] font-medium ${style}`}
>
{status} </span>
);
}

export default function PlacementReadinessPage() {
const [search, setSearch] = useState("");
const [department, setDepartment] = useState("All departments");
const [readinessFilter, setReadinessFilter] = useState("all");

const filteredStudents = useMemo(() => {
const query = search.trim().toLowerCase();


return students.filter((student) => {
  const score = getReadiness(student);

  const matchesSearch =
    student.name.toLowerCase().includes(query) ||
    student.id.toLowerCase().includes(query) ||
    student.department.toLowerCase().includes(query);

  const matchesDepartment =
    department === "All departments" ||
    student.department === department;

  const matchesReadiness =
    readinessFilter === "all" ||
    (readinessFilter === "ready" && score >= 80) ||
    (readinessFilter === "almost" && score >= 65 && score < 80) ||
    (readinessFilter === "training" && score < 65);

  return matchesSearch && matchesDepartment && matchesReadiness;
});


}, [search, department, readinessFilter]);
const paged = usePaged(filteredStudents, `${search}|${department}|${readinessFilter}`);

const averageReadiness = Math.round(
students.reduce((sum, student) => sum + getReadiness(student), 0) /
students.length,
);

const readyCount = students.filter(
(student) => getReadiness(student) >= 80,
).length;

const almostReadyCount = students.filter((student) => {
const score = getReadiness(student);
return score >= 65 && score < 80;
}).length;

const trainingCount = students.filter(
(student) => getReadiness(student) < 65,
).length;

const distribution = [
{ level: "Placement ready", count: readyCount },
{ level: "Almost ready", count: almostReadyCount },
{ level: "Needs training", count: trainingCount },
];

return ( <AdminPageShell title="Placement readiness">

      <div>
        <section className="mb-8">
          <p className="text-[13.5px] font-bold tracking-[2px] text-[#367552]">
            CAREER OUTCOMES
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#213c2d]">
            Placement readiness
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#4b564e]">
            Evaluate student employability skills, track placement
            preparation, and identify areas where targeted training
            could improve outcomes.
          </p>
        </section>

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Average readiness"
            value={`${averageReadiness}%`}
            description="Average of four skill indicators"
            icon={Target}
          />
          <MetricCard
            title="Placement ready"
            value={String(readyCount)}
            description="Readiness score of 80% or above"
            icon={CheckCircle2}
          />
          <MetricCard
            title="Almost ready"
            value={String(almostReadyCount)}
            description="Readiness score from 65% to 79%"
            icon={TrendingUp}
          />
          <MetricCard
            title="Needs training"
            value={String(trainingCount)}
            description="Readiness score below 65%"
            icon={AlertTriangle}
          />
        </section>

        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-[#e2e8e2] bg-white p-5 sm:p-6">
            <h2 className="font-semibold text-[#2c4031]">
              Skill performance
            </h2>
            <p className="mt-1 text-[13.5px] text-[#556057]">
              Average scores across all students
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                {
                  name: "Technical skills",
                  score: Math.round(
                    students.reduce((sum, s) => sum + s.technical, 0) /
                      students.length,
                  ),
                  icon: Code2,
                },
                {
                  name: "Aptitude",
                  score: Math.round(
                    students.reduce((sum, s) => sum + s.aptitude, 0) /
                      students.length,
                  ),
                  icon: Brain,
                },
                {
                  name: "Communication",
                  score: Math.round(
                    students.reduce(
                      (sum, s) => sum + s.communication,
                      0,
                    ) / students.length,
                  ),
                  icon: MessageCircle,
                },
                {
                  name: "Interview skills",
                  score: Math.round(
                    students.reduce((sum, s) => sum + s.interview, 0) /
                      students.length,
                  ),
                  icon: BriefcaseBusiness,
                },
              ].map((skill) => {
                const Icon = skill.icon;

                return (
                  <div
                    key={skill.name}
                    className="rounded-lg border border-[#edf0eb] bg-[#fafbf9] p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Icon size={18} className="text-[#367552]" />
                      <span className="text-lg font-semibold text-[#2c4031]">
                        {skill.score}%
                      </span>
                    </div>
                    <p className="mt-3 text-[13.5px] text-[#69766b]">
                      {skill.name}
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e8eee8]">
                      <div
                        className="h-full rounded-full bg-[#679678]"
                        style={{ width: `${skill.score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#e2e8e2] bg-white p-5 sm:p-6">
            <h2 className="font-semibold text-[#2c4031]">
              Readiness distribution
            </h2>
            <p className="mt-1 text-[13.5px] text-[#556057]">
              Number of students in each readiness category
            </p>

            <div className="mt-5 h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={distribution}
                  margin={{ top: 10, right: 8, left: -15, bottom: 5 }}
                >
                  <CartesianGrid
                    stroke="#e9eee8"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="level"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#3f4a42", fontSize: 10 }}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#3f4a42", fontSize: 13 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e2e8e2",
                      fontSize: 14,
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Students"
                    fill="#679678"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={65}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#edf0eb] pt-4 text-center">
              <div>
                <p className="text-xl font-semibold text-[#28684e]">
                  {readyCount}
                </p>
                <p className="mt-1 text-[13px] text-[#556057]">Ready</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-amber-600">
                  {almostReadyCount}
                </p>
                <p className="mt-1 text-[13px] text-[#556057]">Almost ready</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-red-600">
                  {trainingCount}
                </p>
                <p className="mt-1 text-[13px] text-[#556057]">Training</p>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#e2e8e2] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8ede7] p-5">
            <div>
              <h2 className="font-semibold text-[#2c4031]">
                Student readiness records
              </h2>
              <p className="mt-1 text-[13.5px] text-[#556057]">
                Review individual readiness scores and skill indicators.
              </p>
            </div>
            <span className="rounded-full bg-[#edf5ef] px-3 py-1.5 text-[13.5px] font-medium text-[#28684e]">
              {filteredStudents.length} records
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 border-b border-[#e8ede7] bg-[#fafbf9] p-4 md:grid-cols-3">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-[#dfe6de] bg-white px-3">
              <Search size={16} className="text-[#879287]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student or ID"
                aria-label="Search student records"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              />
            </label>

            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              aria-label="Filter by department"
              className="h-10 rounded-lg border border-[#dfe6de] bg-white px-3 text-[15px] outline-none"
            >
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={readinessFilter}
              onChange={(event) => setReadinessFilter(event.target.value)}
              aria-label="Filter by readiness"
              className="h-10 rounded-lg border border-[#dfe6de] bg-white px-3 text-[15px] outline-none"
            >
              <option value="all">All readiness levels</option>
              <option value="ready">Placement ready</option>
              <option value="almost">Almost ready</option>
              <option value="training">Needs training</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-[#fafbf9] text-[13px] uppercase tracking-wide text-[#849084]">
                <tr>
                  <th className="px-5 py-4 font-semibold">Student</th>
                  <th className="px-4 py-4 font-semibold">Department</th>
                  <th className="px-4 py-4 font-semibold">Technical</th>
                  <th className="px-4 py-4 font-semibold">Aptitude</th>
                  <th className="px-4 py-4 font-semibold">Communication</th>
                  <th className="px-4 py-4 font-semibold">Readiness</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {paged.pageItems.map((student) => {
                  const score = getReadiness(student);

                  return (
                    <tr
                      key={student.id}
                      className="border-t border-[#edf0eb] hover:bg-[#fafcf9]"
                    >
                      <td className="px-5 py-4">
                        <p className="text-[15px] font-medium text-[#2c4031]">
                          {student.name}
                        </p>
                        <p className="mt-1 text-[13.5px] text-[#556057]">
                          {student.id} · {student.semester}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-[15px] text-[#59675b]">
                        {student.department}
                      </td>
                      <td className="px-4 py-4 text-[15px] text-[#59675b]">
                        {student.technical}%
                      </td>
                      <td className="px-4 py-4 text-[15px] text-[#59675b]">
                        {student.aptitude}%
                      </td>
                      <td className="px-4 py-4 text-[15px] text-[#59675b]">
                        {student.communication}%
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-[#2c4031]">
                          {score}%
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge score={score} />
                      </td>
                    </tr>
                  );
                })}

                {filteredStudents.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-[15px] text-[#556057]"
                    >
                      No matching student records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#e8ede7] px-4">
            <Pager paged={paged} noun="students" />
          </div>
        </section>

        <footer className="mt-7 flex flex-wrap justify-between gap-2 border-t border-[#e2e8e2] pt-5 text-[13.5px] text-[#556057]">
          <span>GrowthTrack · Student Success Platform</span>
          <span>Placement readiness</span>
        </footer>
      </div>
</AdminPageShell>


);
}
