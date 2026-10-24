"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Search,
  Users,
  X,
} from "lucide-react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { Pager, usePaged } from "@/components/pager";
import { subjectsOfSemester, type BranchCode } from "@student/data/catalog";
import { studentProfiles, type StudentProfile } from "@/lib/students";
import {
  readDeclaredResults,
  saveDeclaredResult,
  subscribeToDeclaredResults,
  type DeclaredResultSubject,
  type DeclaredStudentResult,
} from "@/lib/declared-results";

const semesters = Array.from({ length: 8 }, (_, index) => `Semester ${index + 1}`);
const departments = [
  "All departments",
  ...Array.from(new Set(studentProfiles.map((student) => student.department))),
];

/** Semesters 1-5 use the real subject catalog; later semesters have no catalog yet, so a generic list applies. */
function getSubjects(student: StudentProfile, semester: string) {
  const number = Number(semester.replace("Semester ", ""));
  if (number >= 1 && number <= 5) {
    return subjectsOfSemester(number, student.branchCode as BranchCode).map((subject) => subject.name);
  }
  const department = student.department;
  const subjects: Record<string, string[]> = {
    "Computer Science": [
      "Data Structures",
      "Database Systems",
      "Operating Systems",
      "Computer Networks",
      "Mathematics",
    ],
    "Information Technology": [
      "Web Technologies",
      "Database Systems",
      "Cloud Computing",
      "Computer Networks",
      "Mathematics",
    ],
    Electronics: [
      "Digital Electronics",
      "Circuit Theory",
      "Signals and Systems",
      "Communication Systems",
      "Mathematics",
    ],
    "Mechanical Engineering": [
      "Engineering Mechanics",
      "Thermodynamics",
      "Manufacturing",
      "Material Science",
      "Mathematics",
    ],
    "Civil Engineering": [
      "Structural Analysis",
      "Geotechnical Engineering",
      "Transportation Engineering",
      "Water Resources",
      "Mathematics",
    ],
  };
  return subjects[department] ?? subjects["Computer Science"];
}

function getGrade(score: number) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "F";
}

function getAverage(result: DeclaredStudentResult) {
  return (
    result.subjects.reduce((sum, subject) => sum + subject.score, 0) /
    result.subjects.length
  );
}

export default function ResultsPage() {
  const [semester, setSemester] = useState("Semester 1");
  const [department, setDepartment] = useState("All departments");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<DeclaredStudentResult[]>([]);
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(
    null,
  );
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const refresh = () => {
      try {
        setResults(readDeclaredResults());
      } catch (error) {
        setNotice(
          error instanceof Error
            ? `Could not load declared results: ${error.message}`
            : "Could not load declared results.",
        );
      }
    };
    refresh();
    return subscribeToDeclaredResults(refresh);
  }, []);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return studentProfiles.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(query) ||
        student.id.toLowerCase().includes(query);
      const matchesDepartment =
        department === "All departments" ||
        student.department === department;
      return matchesSearch && matchesDepartment;
    });
  }, [department, search]);
  const paged = usePaged(filteredStudents, `${department}|${search}|${semester}`);

  const semesterResults = results.filter(
    (result) => result.semester === semester,
  );

  function openDeclaration(student: StudentProfile) {
    const existing = semesterResults.find(
      (result) => result.studentId === student.id,
    );
    const subjects = existing?.subjects ?? getSubjects(student, semester).map(
      (name) => ({ name, score: undefined }),
    );
    setMarks(
      Object.fromEntries(
        subjects.map((subject) => [
          subject.name,
          subject.score === undefined ? "" : String(subject.score),
        ]),
      ),
    );
    setEditingStudent(student);
    setNotice("");
  }

  function declareResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStudent) return;

    const subjects: DeclaredResultSubject[] = Object.entries(marks).map(
      ([name, score]) => ({ name, score: Number(score) }),
    );
    if (
      subjects.length === 0 ||
      subjects.some(
        ({ score }) =>
          !Number.isFinite(score) || score < 0 || score > 100,
      )
    ) {
      setNotice("Enter a mark from 0 to 100 for every subject.");
      return;
    }

    try {
      saveDeclaredResult(editingStudent.id, semester, subjects);
      setResults(readDeclaredResults());
      setNotice(`Result declared for ${editingStudent.name}.`);
      setEditingStudent(null);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Could not declare result: ${error.message}`
          : "Could not declare result.",
      );
    }
  }

  return (
    <AdminPageShell title="Results">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13.5px] font-bold tracking-[2px] text-[#367552]">
              EXAMINATION OFFICE
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#213c2d]">
              Result declaration
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#4b564e]">
              Enter subject marks and declare semester results for students in
              the GrowthTrack directory.
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-[#dfe6de] bg-white px-3 py-2 text-[15px] text-[#405345]">
            <span className="whitespace-nowrap">Examination semester</span>
            <select
              aria-label="Examination semester"
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              className="rounded-md bg-transparent py-1 outline-none"
            >
              {semesters.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </header>

        {notice && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-lg border border-[#dce8df] bg-[#f5faf6] px-4 py-3 text-[15px] text-[#28654d]"
          >
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            title="Students in directory"
            value={String(studentProfiles.length)}
            subtitle="All students"
            icon={Users}
          />
          <SummaryCard
            title="Results declared"
            value={String(semesterResults.length)}
            subtitle={`${semester} declarations`}
            icon={CheckCircle2}
          />
          <SummaryCard
            title="Awaiting declaration"
            value={String(studentProfiles.length - semesterResults.length)}
            subtitle="Students without a result for this semester"
            icon={ClipboardList}
          />
        </section>

        <section className="overflow-hidden rounded-xl border border-[#e2e8e2] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8ede7] p-5">
            <div>
              <h2 className="font-semibold text-[#2c4031]">
                Student result register
              </h2>
              <p className="mt-1 text-[13.5px] text-[#556057]">
                Results are saved in this browser only and can be updated by
                declaring the same student and semester again.
              </p>
            </div>
            <span className="rounded-full bg-[#edf5ef] px-3 py-1.5 text-[13.5px] font-medium text-[#28684e]">
              {filteredStudents.length} students
            </span>
          </div>

          <div className="grid gap-3 border-b border-[#e8ede7] bg-[#fafbf9] p-4 md:grid-cols-[1fr_260px]">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-[#dfe6de] bg-white px-3">
              <Search size={16} className="text-[#879287]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or student ID"
                aria-label="Search students"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              />
            </label>
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              aria-label="Filter by department"
              className="h-10 rounded-lg border border-[#dfe6de] bg-white px-3 text-[15px] outline-none focus:border-[#367552]"
            >
              {departments.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-[#fafbf9] text-[14px] uppercase tracking-wide text-[#849084]">
                <tr>
                  <th className="px-5 py-4 font-semibold">Student</th>
                  <th className="px-4 py-4 font-semibold">Department</th>
                  <th className="px-4 py-4 font-semibold">Semester</th>
                  <th className="px-4 py-4 font-semibold">Final average</th>
                  <th className="px-4 py-4 font-semibold">Grade</th>
                  <th className="px-4 py-4 font-semibold">Result</th>
                  <th className="px-5 py-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.pageItems.map((student) => {
                  const result = semesterResults.find(
                    (item) => item.studentId === student.id,
                  );
                  const average = result ? getAverage(result) : null;
                  const passed =
                    result &&
                    result.subjects.every((subject) => subject.score >= 40);
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
                          {student.id}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-[15px] text-[#59675b]">
                        {student.department}
                      </td>
                      <td className="px-4 py-4 text-[15px] text-[#59675b]">
                        {semester}
                      </td>
                      <td className="px-4 py-4 text-[15px] font-semibold text-[#344638]">
                        {average === null ? "—" : `${average.toFixed(1)}%`}
                      </td>
                      <td className="px-4 py-4 text-[15px] text-[#59675b]">
                        {average === null ? "—" : getGrade(average)}
                      </td>
                      <td className="px-4 py-4">
                        {result ? (
                          <span
                            className={`rounded-full px-2.5 py-1 text-[13.5px] font-semibold ${
                              passed
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {passed ? "Pass" : "Fail"}
                          </span>
                        ) : (
                          <span className="text-[13.5px] text-[#556057]">
                            Not declared
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openDeclaration(student)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#cddbcf] bg-white px-3 py-2 text-[15px] font-medium text-[#28684e] transition hover:bg-[#edf5ef]"
                        >
                          <BookOpenCheck size={15} />
                          {result ? "Update" : "Declare"}
                        </button>
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
                      No matching students found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#edf0eb] px-4">
            <Pager paged={paged} noun="students" />
          </div>
          <p className="border-t border-[#edf0eb] px-5 py-3 text-[13.5px] leading-5 text-[#556057]">
            Grading policy: each subject requires at least 40/100 to
            pass; grades use a simple percentage band. Confirm your
            institution&apos;s official rules before relying on these results.
          </p>
        </section>
      </div>

      {editingStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditingStudent(null);
          }}
        >
          <form
            onSubmit={declareResult}
            aria-labelledby="declare-result-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-[#e2e8e2] bg-white p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="declare-result-title"
                  className="text-lg font-semibold text-[#2c4031]"
                >
                  Declare {semester} result
                </h2>
                <p className="mt-1 text-[15px] text-[#748075]">
                  {editingStudent.name} · {editingStudent.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                aria-label="Close result form"
                className="rounded p-1 text-[#4b564e] hover:bg-[#f3f6f2]"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-[#e6ebe4]">
              <div className="grid grid-cols-[1fr_120px] bg-[#f7f9f6] px-4 py-3 text-[13.5px] font-semibold uppercase tracking-wide text-[#4b564e]">
                <span>Subject</span>
                <span>Marks / 100</span>
              </div>
              {Object.entries(marks).map(([subject, score]) => (
                <label
                  key={subject}
                  className="grid grid-cols-[1fr_120px] items-center gap-3 border-t border-[#edf0eb] px-4 py-3 text-[15px] text-[#46564a]"
                >
                  <span>{subject}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    required
                    value={score}
                    onChange={(event) =>
                      setMarks((current) => ({
                        ...current,
                        [subject]: event.target.value,
                      }))
                    }
                    aria-label={`${subject} marks`}
                    className="w-full rounded-md border border-[#dfe5dc] px-3 py-2 outline-none focus:border-[#57906f]"
                  />
                </label>
              ))}
            </div>
            <p className="mt-3 text-[13.5px] leading-5 text-[#556057]">
              Declaring publishes this marksheet in the local Results register.
              You can update it later by declaring this semester again.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="rounded-md border border-[#dfe5dc] px-4 py-2.5 text-[15px] font-medium text-[#46564a] hover:bg-[#f5f7f4]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-[#28684e] px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-[#1e573f]"
              >
                Declare result
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminPageShell>
  );
}

function SummaryCard({
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
  return (
    <section className="rounded-xl border border-[#e2e8e2] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] text-[#4b564e]">{title}</p>
        <span className="rounded-lg bg-[#edf5ef] p-2.5 text-[#28684e]">
          <Icon size={19} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold text-[#25352a]">{value}</p>
      <p className="mt-1 text-[13.5px] text-[#556057]">{subtitle}</p>
    </section>
  );
}
