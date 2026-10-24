"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { DashboardStrip } from "@/components/forecast/dashboard-strip";
import { PageHeader } from "@/components/forecast/ui";
import { NAV_BY_ROLE } from "@/lib/admin-nav";

/** The faculty home: the forecast for the mentor's own mentees (the strip is role-aware) and a door to each working page. */
export function FacultyDashboard() {
  const links = NAV_BY_ROLE.faculty.workspace.filter((l) => l.href !== "/faculty/dashboard");
  return (
    <AdminPageShell title="Faculty overview">
      <PageHeader eyebrow="FACULTY WORKSPACE" title="Faculty overview" subtitle="Your mentees at a glance, the actions waiting for you, and the tools for attendance, results and support." />
      <DashboardStrip />
      <section aria-label="Your tools" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {links.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href} className="group flex items-center justify-between gap-3 rounded-md border border-[#e2e7df] bg-white p-5 transition hover:border-[#9fc3b1]">
            <span className="flex items-center gap-3 text-[16px] font-semibold text-[#1f2c24]"><Icon size={20} className="text-[#28684e]" aria-hidden="true" />{label}</span>
            <ArrowRight size={16} className="text-[#556057] transition group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        ))}
      </section>
    </AdminPageShell>
  );
}
