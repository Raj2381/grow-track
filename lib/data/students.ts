import { DataError, friendlyMessage, unwrap, type Db } from "./db";

export type DirectoryStudent = {
  id: string; name: string; rollNo: string; email: string; branchCode: string; department: string; section: string;
  mentorId: string; mentorName: string; semester: number;
};

type Row = { id: string; name: string; roll_no: string; email: string; branch_code: string; section: string; mentor_id: string; current_semester: number };

/** Every student the signed-in person may see, straight from the database (so students added later appear too). */
export async function fetchDirectoryStudents(db: Db): Promise<DirectoryStudent[]> {
  const [students, departments, faculty] = await Promise.all([
    db.from("students").select("id, name, roll_no, email, branch_code, section, mentor_id, current_semester").order("id").limit(5000),
    db.from("departments").select("code, name"),
    db.from("faculty").select("id, name"),
  ]);
  const dept = new Map(unwrap(departments).map((d) => [d.code, d.name]));
  const fac = new Map(unwrap(faculty).map((f) => [f.id, f.name]));
  return (unwrap(students) as Row[]).map((s) => ({
    id: s.id, name: s.name, rollNo: s.roll_no, email: s.email, branchCode: s.branch_code, department: dept.get(s.branch_code) ?? s.branch_code,
    section: s.section, mentorId: s.mentor_id, mentorName: fac.get(s.mentor_id) ?? s.mentor_id, semester: s.current_semester,
  }));
}

export async function fetchDepartmentOptions(db: Db) {
  const { data, error } = await db.from("departments").select("code, name").order("name");
  if (error) throw new DataError(friendlyMessage(error), error.code);
  return data ?? [];
}

export type NewStudent = { name: string; branch: string; section: string; semester: number; email?: string; gender?: string; residence?: string };

/** Adds a student through the database function (administrators only; it picks the id, roll number and mentor). */
export async function addStudent(db: Db, s: NewStudent) {
  const { data, error } = await db.rpc("add_student", {
    p_name: s.name, p_branch: s.branch, p_section: s.section, p_semester: s.semester,
    p_email: s.email || undefined, p_gender: s.gender || "Other", p_residence: s.residence || "Day scholar",
  });
  if (error) throw new DataError(error.code === "42501" ? "Only an administrator can add students." : error.message || friendlyMessage(error), error.code);
  return data as unknown as { id: string; name: string; roll_no: string; mentor_id: string };
}
