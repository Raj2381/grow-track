"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Pager, usePaged } from "@/components/pager";
import { useData } from "@/lib/data/hooks";
import { fetchFaculty, fetchScopeStudents, fetchStudentCounts, type ScopeStudent } from "@/lib/data/scope";

export const useScope = () => useData<ScopeStudent[]>(["scope"], fetchScopeStudents);
export const useStudentCounts = () => useData(["student-counts"], fetchStudentCounts);
export const useFaculty = () => useData(["faculty-list"], fetchFaculty, { revalidateOnFocus: false });

export type Column<T> = { key: string; header: string; render: (row: T) => ReactNode; align?: "right" };

/** A searchable, paged table: name or id search, optional extra filter, 25 rows a page. Text is sized to be read at a glance. */
export function DataTable<T extends { student?: ScopeStudent } | ScopeStudent>({ rows, columns, nameOf, idOf, empty, filter }: {
  rows: T[];
  columns: Column<T>[];
  nameOf: (row: T) => string;
  idOf: (row: T) => string;
  empty: string;
  filter?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => nameOf(r).toLowerCase().includes(t) || idOf(r).toLowerCase().includes(t)) : rows;
  }, [rows, q, nameOf, idOf]);
  const paged = usePaged(shown, q);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search by name or ID</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#556057]" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or ID" className="w-full rounded-md border border-[#cfd8cd] bg-white py-2.5 pl-9 pr-3 text-[14px] text-[#1f2c24] placeholder:text-[#6b756c]" />
        </label>
        {filter}
        <span className="text-[13px] text-[#4b564e]">{shown.length.toLocaleString()} {shown.length === 1 ? "student" : "students"}</span>
      </div>
      <div className="overflow-x-auto rounded-md border border-[#e2e7df]">
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead>
            <tr className="border-b border-[#e2e7df] bg-[#f6f8f5] text-[12px] uppercase tracking-[0.8px] text-[#3b463e]">
              {columns.map((c) => <th key={c.key} className={`px-4 py-3 font-semibold ${c.align === "right" ? "text-right" : ""}`}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {paged.pageItems.map((r) => (
              <tr key={idOf(r)} className="border-b border-[#eef1ec] last:border-0 hover:bg-[#fafbf9]">
                {columns.map((c) => <td key={c.key} className={`px-4 py-3 text-[#1f2c24] ${c.align === "right" ? "text-right tabular-nums" : ""}`}>{c.render(r)}</td>)}
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-[14px] text-[#4b564e]">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager paged={paged} noun="students" />
    </div>
  );
}

export const studentCell = (s: ScopeStudent) => (
  <div>
    <p className="font-semibold text-[#1f2c24]">{s.name}</p>
    <p className="text-[12.5px] text-[#4b564e]">{s.id} · {s.department} · Section {s.section}</p>
  </div>
);

export const pctText = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${n}%`);
export const toneText = (bad: boolean) => (bad ? "font-semibold text-[#b42323]" : "");
