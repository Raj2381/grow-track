import { DataError, friendlyMessage, type Db } from "./db";

export type FeedbackWindow = { branchCode: string; isOpen: boolean; message: string; closesAt: string | null; updatedAt: string };

/** Open means switched on and not past its closing time. The database never trusts the client's clock for who may write, only this display rule uses it. */
export function isWindowOpen(w: FeedbackWindow | null, now?: number): boolean {
  if (!w || !w.isOpen) return false;
  if (w.closesAt === null) return true;
  // the clock is read only when there is a closing time to compare with, never while the page is being prerendered
  return new Date(w.closesAt).getTime() > (now ?? Date.now());
}

type Row = { branch_code: string; is_open: boolean; message: string; closes_at: string | null; updated_at: string };
const toWindow = (r: Row): FeedbackWindow => ({ branchCode: r.branch_code, isOpen: r.is_open, message: r.message, closesAt: r.closes_at, updatedAt: r.updated_at });

/** The window for a department, or null when the HOD has never opened one. Row Level Security shows a student only their own department's row. */
export async function fetchFeedbackWindow(db: Db, branchCode: string): Promise<FeedbackWindow | null> {
  const { data, error } = await db.from("feedback_windows").select("*").eq("branch_code", branchCode).maybeSingle();
  if (error) throw new DataError(friendlyMessage(error), error.code);
  return data ? toWindow(data as Row) : null;
}

/** The department of the signed-in HOD (from their faculty record). */
export async function fetchMyDepartment(db: Db): Promise<{ code: string; name: string } | null> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await db.from("profiles").select("faculty_id").eq("id", auth.user.id).maybeSingle();
  if (!profile?.faculty_id) return null;
  const { data: f } = await db.from("faculty").select("branch_code, departments(name)").eq("id", profile.faculty_id).maybeSingle();
  if (!f) return null;
  const d = f.departments as { name?: string } | { name?: string }[] | null;
  return { code: f.branch_code, name: (Array.isArray(d) ? d[0]?.name : d?.name) ?? f.branch_code };
}

/** Opens or closes feedback for a department. Only that department's HOD (or an administrator) is allowed; anyone else gets a plain refusal. */
export async function setFeedbackWindow(db: Db, branchCode: string, change: { isOpen: boolean; message: string; closesAt: string | null }): Promise<FeedbackWindow> {
  const { data, error } = await db.from("feedback_windows")
    .upsert({ branch_code: branchCode, is_open: change.isOpen, message: change.message.trim().slice(0, 300), closes_at: change.closesAt }, { onConflict: "branch_code" })
    .select("*").single();
  if (error) throw new DataError(error.code === "42501" ? "Only the Head of Department can open or close feedback." : friendlyMessage(error), error.code);
  return toWindow(data as Row);
}
