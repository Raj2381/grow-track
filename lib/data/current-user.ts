import type { Db } from "./db";

export type AppRole = "admin" | "faculty" | "student" | "hod" | "tpo";
export type CurrentUser = {
  id: string;
  email: string | null;
  role: AppRole | null;
  studentId: string | null;
  facultyId: string | null;
  displayName: string;
  /** a student's mentor, to name them in advice */
  mentor: { id: string; name: string } | null;
};

/** The signed-in person and their role (from the profiles table, the source of truth that RLS also uses). */
export async function fetchCurrentUser(db: Db): Promise<CurrentUser | null> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await db.from("profiles").select("role, student_id, faculty_id, display_name").eq("id", auth.user.id).maybeSingle();
  let mentor: CurrentUser["mentor"] = null;
  if (profile?.student_id) {
    const { data: student } = await db.from("students").select("mentor_id").eq("id", profile.student_id).maybeSingle();
    if (student?.mentor_id) {
      const { data: faculty } = await db.from("faculty").select("id, name").eq("id", student.mentor_id).maybeSingle();
      if (faculty) mentor = { id: faculty.id, name: faculty.name };
    }
  }
  return {
    id: auth.user.id,
    email: auth.user.email ?? null,
    role: (profile?.role as AppRole | undefined) ?? null,
    studentId: profile?.student_id ?? null,
    facultyId: profile?.faculty_id ?? null,
    displayName: profile?.display_name || auth.user.email || "Signed-in user",
    mentor,
  };
}
