"use client";

import { GraduationCap, ShieldCheck, UserRound } from "lucide-react";
import { useCurrentUser } from "@/lib/data/hooks";

/** Who is signed in and in what role: the views, and what the database lets them see, follow from this. */
export function RoleBadge() {
  const { data: user } = useCurrentUser();
  if (!user?.role) return null;
  const label = {
    admin: "Dean / Administrator", faculty: `Faculty mentor · ${user.facultyId}`, hod: `Head of Department · ${user.facultyId}`,
    tpo: "Training and Placement Officer", student: `Student · ${user.studentId}`,
  }[user.role];
  const Icon = user.role === "admin" ? ShieldCheck : user.role === "student" ? GraduationCap : UserRound;
  return (
    <span title={`Signed in as ${user.displayName}`} className="hidden items-center gap-2 rounded border border-[#dfe5dc] bg-white px-2.5 py-2 text-[10px] font-semibold text-[#344037] sm:inline-flex sm:text-[11px]">
      <Icon size={13} className="text-[#28684e]" aria-hidden="true" />
      {label}
    </span>
  );
}
