"use client";

import { AdminPageShell } from "@/components/admin-page-shell";
import { studentProfiles, studentDepartments } from "@/lib/students";
import { Pager, usePaged } from "@/components/pager";

import { useMemo, useState } from "react";
import {
CalendarCheck,
Users,
UserCheck,
UserX,
Search,
} from "lucide-react";
import {
CartesianGrid,
Line,
LineChart,
ResponsiveContainer,
Tooltip,
XAxis,
YAxis,
} from "recharts";

type AttendanceRecord = {
id: string;
name: string;
department: string;
semester: string;
present: number;
total: number;
};

const records: AttendanceRecord[] = studentProfiles.map((profile) => ({
  id: profile.id,
  name: profile.name,
  department: profile.department,
  semester: `Semester ${profile.semester}`,
  present: profile.lectures.attended,
  total: profile.lectures.total,
}));

/** Average attendance of all students in each completed semester. */
const semesterTrend = Array.from({ length: 5 }, (_, index) => ({
  day: `Sem ${index + 1}`,
  attendance: Math.round(
    studentProfiles.reduce((sum, student) => sum + student.semesterAttendance[index], 0) /
      studentProfiles.length,
  ),
}));

const departments = ["All departments", ...studentDepartments];

const semesters = ["All semesters", ...Array.from(new Set(records.map((record) => record.semester)))];

function MetricCard({
title,
value,
subtitle,
icon: Icon,
}: {
title: string;
value: string;
subtitle: string;
icon: typeof Users;
}) {
return ( <div className="rounded-xl border border-[#e2e8e2] bg-white p-5"> <div className="flex items-center justify-between gap-3"> <p className="text-[15px] text-[#4b564e]">{title}</p> <div className="rounded-lg bg-[#edf5ef] p-2.5 text-[#28684e]"> <Icon size={20} /> </div> </div> <p className="mt-4 text-3xl font-semibold text-[#203d2e]">{value}</p> <p className="mt-2 text-[13.5px] text-[#556057]">{subtitle}</p> </div>
);
}

function AttendanceBadge({ percentage }: { percentage: number }) {
const status =
percentage < 75
? "Low attendance"
: percentage < 85
? "Needs monitoring"
: "Good attendance";

const color =
percentage < 75
? "bg-red-50 text-red-700"
: percentage < 85
? "bg-amber-50 text-amber-700"
: "bg-green-50 text-green-700";

return (
<span className={`whitespace-nowrap rounded-full px-3 py-1 text-[13.5px] font-medium ${color}`}>
{status} </span>
);
}

export default function AttendancePage() {
const [search, setSearch] = useState("");
const [department, setDepartment] = useState("All departments");
const [semester, setSemester] = useState("All semesters");
const [threshold, setThreshold] = useState("all");

const getPercentage = (record: AttendanceRecord) =>
Math.round((record.present / record.total) * 100);

const filteredRecords = useMemo(() => {
const query = search.trim().toLowerCase();


return records.filter((record) => {
  const percentage = getPercentage(record);

  const matchesSearch =
    record.name.toLowerCase().includes(query) ||
    record.id.toLowerCase().includes(query) ||
    record.department.toLowerCase().includes(query);

  const matchesDepartment =
    department === "All departments" ||
    record.department === department;

  const matchesSemester =
    semester === "All semesters" || record.semester === semester;

  const matchesThreshold =
    threshold === "all" ||
    (threshold === "low" && percentage < 75) ||
    (threshold === "good" && percentage >= 85);

  return (
    matchesSearch &&
    matchesDepartment &&
    matchesSemester &&
    matchesThreshold
  );
});


}, [search, department, semester, threshold]);
const paged = usePaged(filteredRecords, `${search}|${department}|${semester}|${threshold}`);

const monitoredCount = filteredRecords.length;

const averageAttendance =
  monitoredCount > 0
    ? Math.round(
        filteredRecords.reduce(
          (sum, record) => sum + getPercentage(record),
          0,
        ) / monitoredCount,
      )
    : 0;

const lowAttendance = filteredRecords.filter(
  (record) => getPercentage(record) < 75,
).length;

const goodAttendance = filteredRecords.filter(
  (record) => getPercentage(record) >= 85,
).length;

const departmentStats = departments
  .filter((item) => item !== "All departments")
  .map((name) => {
    const departmentRecords = filteredRecords.filter(
      (record) => record.department === name,
    );

    const average =
      departmentRecords.length > 0
        ? Math.round(
            departmentRecords.reduce(
              (sum, record) => sum + getPercentage(record),
              0,
            ) / departmentRecords.length,
          )
        : 0;

    return { name, average };
  });


return ( <AdminPageShell title="Attendance">

      <div>
        <section className="mb-8">
          <p className="text-[13.5px] font-bold tracking-[2px] text-[#367552]">
            STUDENT ENGAGEMENT
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#213c2d]">
            Attendance overview
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#4b564e]">
            Monitor attendance patterns, identify students with low
            attendance, and compare participation across departments.
          </p>
        </section>

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Average attendance"
            value={`${averageAttendance}%`}
            subtitle="Across all students"
            icon={CalendarCheck}
          />
          <MetricCard
            title="Students monitored"
            value={String(monitoredCount)}
            subtitle={
              monitoredCount === records.length
                ? "Student records"
                : "Filtered current view"
            }
            icon={Users}
          />
          <MetricCard
            title="Low attendance"
            value={String(lowAttendance)}
            subtitle="Below 75% attendance"
            icon={UserX}
          />
          <MetricCard
            title="Good attendance"
            value={String(goodAttendance)}
            subtitle="At least 85% attendance"
            icon={UserCheck}
          />
        </section>

        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="rounded-xl border border-[#e2e8e2] bg-white p-5 sm:p-6">
            <h2 className="font-semibold text-[#2c4031]">
              Attendance trend by semester
            </h2>
            <p className="mt-1 text-[13.5px] text-[#556057]">
              Average attendance of all students in each semester
            </p>

            <div className="mt-6 h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={semesterTrend} margin={{ top: 10, right: 10, bottom: 5, left: -15 }}>
                  <CartesianGrid stroke="#e9eee8" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#3f4a42", fontSize: 13 }} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fill: "#3f4a42", fontSize: 13 }} />
                  <Tooltip
                    formatter={(value) => [`${value}%`, "Attendance"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8e2", fontSize: 14 }}
                  />
                  <Line type="monotone" dataKey="attendance" stroke="#367552" strokeWidth={3} dot={{ r: 4, fill: "#367552" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-[#e2e8e2] bg-white p-5 sm:p-6">
            <h2 className="font-semibold text-[#2c4031]">
              Department comparison
            </h2>
            <p className="mt-1 text-[13.5px] text-[#556057]">
              Average attendance by department
            </p>

            <div className="mt-7 space-y-6">
              {departmentStats.map((item) => (
                <div key={item.name}>
                  <div className="mb-2 flex justify-between gap-3 text-[15px]">
                    <span className="text-[#4b5c4e]">{item.name}</span>
                    <span className="font-semibold text-[#2c4031]">{item.average}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#edf1ec]">
                    <div
                      className={`h-full rounded-full ${item.average < 75 ? "bg-amber-500" : "bg-[#679678]"}`}
                      style={{ width: `${item.average}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#e2e8e2] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8ede7] p-5">
            <div>
              <h2 className="font-semibold text-[#2c4031]">Student attendance records</h2>
              <p className="mt-1 text-[13.5px] text-[#556057]">Search, filter, and review attendance indicators.</p>
            </div>
            <span className="rounded-full bg-[#edf5ef] px-3 py-1.5 text-[13.5px] font-medium text-[#28684e]">
              {filteredRecords.length} records
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 border-b border-[#e8ede7] bg-[#fafbf9] p-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-[#dfe6de] bg-white px-3 xl:col-span-1">
              <Search size={16} className="text-[#879287]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or student ID"
                aria-label="Search attendance records"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              />
            </label>

            <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter by department" className="h-10 rounded-lg border border-[#dfe6de] bg-white px-3 text-[15px] outline-none">
              {departments.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={semester} onChange={(event) => setSemester(event.target.value)} aria-label="Filter by semester" className="h-10 rounded-lg border border-[#dfe6de] bg-white px-3 text-[15px] outline-none">
              {semesters.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={threshold} onChange={(event) => setThreshold(event.target.value)} aria-label="Filter by attendance status" className="h-10 rounded-lg border border-[#dfe6de] bg-white px-3 text-[15px] outline-none">
              <option value="all">All attendance levels</option>
              <option value="low">Low attendance (&lt;75%)</option>
              <option value="good">Good attendance (85%+)</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-[#fafbf9] text-[14px] uppercase tracking-wide text-[#849084]">
                <tr>
                  <th className="px-5 py-4 font-semibold">Student</th>
                  <th className="px-4 py-4 font-semibold">Department</th>
                  <th className="px-4 py-4 font-semibold">Semester</th>
                  <th className="px-4 py-4 font-semibold">Present</th>
                  <th className="px-4 py-4 font-semibold">Attendance</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {paged.pageItems.map((record) => {
                  const percentage = getPercentage(record);

                  return (
                    <tr key={record.id} className="border-t border-[#edf0eb] hover:bg-[#fafcf9]">
                      <td className="px-5 py-4">
                        <p className="text-[15px] font-medium text-[#2c4031]">{record.name}</p>
                        <p className="mt-1 text-[13.5px] text-[#556057]">{record.id}</p>
                      </td>
                      <td className="px-4 py-4 text-[15px] text-[#59675b]">{record.department}</td>
                      <td className="px-4 py-4 text-[15px] text-[#59675b]">{record.semester}</td>
                      <td className="px-4 py-4 text-[15px] text-[#59675b]">{record.present} / {record.total}</td>
                      <td className="px-4 py-4">
                        <span className={`text-[15px] font-semibold ${percentage < 75 ? "text-red-700" : "text-[#2c4031]"}`}>
                          {percentage}%
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <AttendanceBadge percentage={percentage} />
                      </td>
                    </tr>
                  );
                })}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-[15px] text-[#556057]">
                      No matching attendance records found.
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
          <span>Attendance</span>
        </footer>
      </div>
</AdminPageShell>


);
}
