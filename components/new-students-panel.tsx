"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Plus, UserPlus, X } from "lucide-react";
import { useCurrentUser, useData, useDb } from "@/lib/data/hooks";
import { addStudent, fetchDepartmentOptions, fetchDirectoryStudents } from "@/lib/data/students";

const field = "w-full rounded-md border border-[#dfe5dc] bg-white px-3 py-2 text-[14.5px] text-[#252f28]";

/**
 * Students stored in the database that are not in the bundled sample list (for example ones you just added) appear here
 * straight away. Administrators can add a student with the form; the database picks the id, roll number and mentor.
 */
export function NewStudentsPanel({ knownIds }: { knownIds: Set<string> }) {
  const me = useCurrentUser();
  const db = useDb();
  const { mutate } = useSWRConfig();
  const all = useData(["directory-students"], fetchDirectoryStudents);
  const departments = useData(["department-options"], fetchDepartmentOptions, { revalidateOnFocus: false });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [form, setForm] = useState({ name: "", branch: "", section: "A", semester: 5, email: "", gender: "Other", residence: "Day scholar" });
  const isAdmin = me.data?.role === "admin";
  const added = (all.data ?? []).filter((s) => !knownIds.has(s.id));

  if (all.error && !all.data) return null;
  if (!isAdmin) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const s = await addStudent(db, { ...form, branch: form.branch || departments.data?.[0]?.code || "" });
      setDone(`${s.name} was added as ${s.id} and is now in the list below.`);
      setForm({ ...form, name: "", email: "" });
      setOpen(false);
      await mutate((key) => Array.isArray(key) && key[0] === "gt" && (key[1] === "directory-students" || key[1] === "options"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The student could not be added.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="directory-panel" aria-label="Newly added students" style={{ marginBottom: 18 }}>
      <div className="directory-panel-heading">
        <div>
          <h2>Add a student</h2>
          <p>Students added here or in Supabase appear in the list below straight away{added.length ? ` (${added.length} added so far)` : ""}. Marks and forecasts follow once records are loaded.</p>
        </div>
        {isAdmin && (
          <button type="button" onClick={() => { setOpen((o) => !o); setDone(""); }} className="inline-flex items-center gap-1.5 rounded-md bg-[#28684e] px-3 py-2 text-[14.5px] font-semibold text-white hover:bg-[#1f5340]">
            {open ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />} {open ? "Close" : "Add student"}
          </button>
        )}
      </div>
      {done && <p role="status" className="mx-5 mb-3 rounded bg-[#eef6f1] px-3 py-2 text-[14.5px] text-[#1f5a43]">{done}</p>}
      {open && (
        <form onSubmit={submit} className="mx-5 mb-4 grid grid-cols-1 gap-3 rounded-md border border-[#e2e7df] bg-[#fafbf9] p-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-[14px] font-semibold text-[#59665c]">Full name<input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${field} mt-1`} /></label>
          <label className="text-[14px] font-semibold text-[#59665c]">Department
            <select required value={form.branch || departments.data?.[0]?.code || ""} onChange={(e) => setForm({ ...form, branch: e.target.value })} className={`${field} mt-1`}>
              {departments.data?.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          </label>
          <label className="text-[14px] font-semibold text-[#59665c]">Section<input required maxLength={2} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className={`${field} mt-1`} /></label>
          <label className="text-[14px] font-semibold text-[#59665c]">Current semester
            <select value={form.semester} onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })} className={`${field} mt-1`}>{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>Semester {n}</option>)}</select>
          </label>
          <label className="text-[14px] font-semibold text-[#59665c]">Email (optional)<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${field} mt-1`} /></label>
          <label className="text-[14px] font-semibold text-[#59665c]">Gender
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={`${field} mt-1`}><option>Female</option><option>Male</option><option>Other</option></select>
          </label>
          <div className="flex items-end gap-3 sm:col-span-2 xl:col-span-3">
            <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-[#28684e] px-4 py-2 text-[14.5px] font-semibold text-white disabled:opacity-60"><UserPlus size={14} aria-hidden="true" />{busy ? "Adding…" : "Add student"}</button>
            {error && <p role="alert" className="text-[14.5px] text-[#8f2f29]">{error}</p>}
          </div>
        </form>
      )}
    </section>
  );
}
