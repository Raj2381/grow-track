"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  BriefcaseBusiness,
  CalendarCheck,
  ClipboardList,
  Code2,
  GraduationCap,
  House,
  LibraryBig,
  Menu,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { studentProfiles, type StudentProfile } from "@/lib/students";
import { StudentSelect } from "@/components/student-select";
import {
  readSelectedDemoStudentId,
  saveSelectedDemoStudentId,
  STUDENT_DEMO_ID_UPDATED_EVENT,
} from "@/lib/student-portal";

const studentLinks = [
  { label: "Overview", href: "/student", icon: House },
  {
    label: "Academic Performance",
    href: "/student/academic-performance",
    icon: BookOpen,
  },
  {
    label: "My Attendance",
    href: "/student/attendance",
    icon: CalendarCheck,
  },
  { label: "LMS Activity", href: "/student/lms", icon: LibraryBig },
  { label: "Coding Practice", href: "/student/coding-practice", icon: Code2 },
  {
    label: "My Interventions",
    href: "/student/interventions",
    icon: ClipboardList,
  },
  {
    label: "Placement Readiness",
    href: "/student/placement-readiness",
    icon: BriefcaseBusiness,
  },
  { label: "Profile", href: "/student/profile", icon: UserRound },
];

type StudentContextValue = {
  student: StudentProfile;
  students: StudentProfile[];
};

const StudentContext = createContext<StudentContextValue | null>(null);

export function useDemoStudent() {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error("useDemoStudent must be used within StudentPageShell.");
  }
  return context;
}

export function StudentPageShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [studentId, setStudentId] = useState(studentProfiles[0]?.id ?? "");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    const refresh = () => {
      try {
        setStudentId(readSelectedDemoStudentId());
        setStorageError("");
      } catch {
        setStorageError(
          "This browser could not read localStorage. Student selection may not persist.",
        );
      } finally {
        setReady(true);
      }
    };

    refresh();
    window.addEventListener(STUDENT_DEMO_ID_UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(STUDENT_DEMO_ID_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const student =
    studentProfiles.find((item) => item.id === studentId) ??
    studentProfiles[0];
  const contextValue = useMemo(
    () => ({ student, students: studentProfiles }),
    [student],
  );

  function selectStudent(nextId: string) {
    try {
      saveSelectedDemoStudentId(nextId);
      setStudentId(nextId);
      setStorageError("");
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "Could not save the selected student.",
      );
    }
  }

  function isActive(href: string) {
    return href === "/student"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
  }

  if (!student) {
    return (
      <main className="min-h-screen bg-[#f5f7f3] p-8 text-[#252f28]">
        No student records are available.
      </main>
    );
  }

  return (
    <StudentContext.Provider value={contextValue}>
      <div className="min-h-screen bg-[#f5f7f3] text-[#252f28]">
        <div className="flex min-h-screen">
          <aside
            id="student-sidebar"
            className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-[#193f31] text-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
              mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex h-[96px] items-center justify-between px-6">
              <Link
                href="/student"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/25">
                  <GraduationCap size={24} strokeWidth={1.7} />
                </span>
                <span>
                  <span className="block text-[20px] font-semibold tracking-[-0.6px]">
                    GrowthTrack
                  </span>
                  <span className="mt-1 block text-[9px] font-semibold tracking-[1.5px] text-[#a7beb0]">
                    STUDENT PORTAL
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded p-1 text-white/70 hover:bg-white/10 lg:hidden"
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 px-[18px] pt-7">
              <p className="mb-3 px-3 text-[10px] font-semibold tracking-[1.5px] text-[#9cb5a6]">
                STUDENT DASHBOARD
              </p>
              <div className="space-y-1">
                {studentLinks.map(({ label, href, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex min-h-[43px] items-center gap-3 rounded-md px-3 text-[12px] transition-colors ${
                        active
                          ? "bg-[#315c47] font-semibold text-white"
                          : "text-[#c2d2c7] hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {active && (
                        <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[#b5d7bd]" />
                      )}
                      <Icon size={18} strokeWidth={1.7} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="border-t border-white/10 p-5">
              <p className="text-[11px] font-semibold">{student.name}</p>
              <p className="mt-1 text-[10px] text-[#a8bfb0]">{student.id}</p>
            </div>
          </aside>

          {mobileMenuOpen && (
            <button
              type="button"
              aria-label="Close navigation backdrop"
              className="fixed inset-0 z-30 bg-black/40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}

          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-20 flex min-h-[66px] flex-wrap items-center justify-between gap-3 border-b border-[#e2e7df] bg-white px-4 py-3 sm:px-7 lg:px-9">
              <div className="flex items-center gap-3 text-[12px]">
                <button
                  type="button"
                  className="rounded-md border border-[#e2e7df] p-2 text-[#47564b] lg:hidden"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open navigation"
                  aria-controls="student-sidebar"
                  aria-expanded={mobileMenuOpen}
                >
                  <Menu size={19} />
                </button>
                <span className="text-[#556057]">Student portal</span>
                <span className="text-[#c3c9c1]">/</span>
                <span className="font-semibold text-[#2b382e]">{title}</span>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-[#59675b]">
                Student
                <StudentSelect
                  students={studentProfiles}
                  value={student.id}
                  onChange={(id) => id && selectStudent(id)}
                  placeholder="Search students"
                  className="w-[230px] rounded-md border border-[#dfe5dc] bg-white px-2.5 py-2 text-xs outline-none focus:border-[#57906f]"
                />
              </label>
            </header>

            <main className="mx-auto max-w-[1580px] px-4 pb-10 pt-6 sm:px-7 lg:px-9">
              {storageError && (
                <p role="alert" className="mb-4 text-sm text-red-700">
                  {storageError}
                </p>
              )}
              {!ready ? (
                <p role="status" className="text-sm text-[#748075]">
                  Loading student profile…
                </p>
              ) : (
                children
              )}
            </main>
          </div>
        </div>
      </div>
    </StudentContext.Provider>
  );
}

export function StudentSummary({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof UsersRound;
}) {
  return (
    <section className="rounded-md border border-[#e2e7df] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] text-[#737e74]">{title}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#edf4ef] text-[#28684e]">
          <Icon size={18} strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-3 text-[29px] font-semibold tracking-[-1px] text-[#252f28]">
        {value}
      </p>
      <p className="mt-2 text-[11px] text-[#556057]">{detail}</p>
    </section>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="mb-7">
      <p className="mb-2 text-[10px] font-bold tracking-[1.7px] text-[#28684e]">
        {eyebrow}
      </p>
      <h1 className="text-[27px] font-semibold leading-tight tracking-[-1px] sm:text-[30px]">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-[12px] leading-5 text-[#7a847b]">
        {description}
      </p>
    </section>
  );
}
