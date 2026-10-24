"use client";

import { Building2, IdCard, Mail, UserRound } from "lucide-react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { DataState, PageHeader, Panel } from "@/components/forecast/ui";
import { useCurrentUser, useData } from "@/lib/data/hooks";
import type { AppRole } from "@/lib/data/current-user";

const ROLE_LABEL: Record<AppRole, string> = { admin: "Administrator", faculty: "Faculty mentor", hod: "Head of Department", tpo: "Training and Placement Officer", student: "Student" };

/** The signed-in person's profile, straight from the database (read-only: roles are assigned by an administrator). */
export function ProfileSettings({ title }: { title: string }) {
  const me = useCurrentUser();
  const dept = useData(["profile-department", me.data?.facultyId ?? ""], async (db) => {
    if (!me.data?.facultyId) return null;
    const { data } = await db.from("faculty").select("name, branch_code, departments(name)").eq("id", me.data.facultyId).maybeSingle();
    const d = data?.departments as { name?: string } | { name?: string }[] | null | undefined;
    return { name: data?.name ?? null, department: (Array.isArray(d) ? d[0]?.name : d?.name) ?? data?.branch_code ?? null };
  }, { revalidateOnFocus: false });
  return (
    <AdminPageShell title="Settings">
      <PageHeader eyebrow="ACCOUNT" title={title} subtitle="Your profile as recorded in GrowthTrack. To change your role or details, ask an administrator." />
      <DataState state={me} skeletonRows={3}>
        {(u) => u ? (
          <Panel title="Profile" subtitle="Read-only">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { icon: UserRound, label: "Name", value: dept.data?.name ?? u.displayName },
                { icon: IdCard, label: "Role", value: ROLE_LABEL[u.role ?? "admin"] },
                { icon: Mail, label: "Sign-in", value: u.email ?? "Not recorded" },
                ...(dept.data?.department ? [{ icon: Building2, label: "Department", value: dept.data.department }] : []),
                ...(u.facultyId ? [{ icon: IdCard, label: "Faculty ID", value: u.facultyId }] : []),
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3 rounded-md border border-[#e2e7df] bg-[#fafbf9] p-4">
                  <Icon size={18} className="mt-0.5 text-[#28684e]" aria-hidden="true" />
                  <div><dt className="text-[13px] font-medium text-[#4b564e]">{label}</dt><dd className="mt-0.5 text-[16px] font-semibold text-[#1f2c24]">{value}</dd></div>
                </div>
              ))}
            </dl>
          </Panel>
        ) : <p className="text-[15px] text-[#4b564e]">No profile is available for this session.</p>}
      </DataState>
    </AdminPageShell>
  );
}
