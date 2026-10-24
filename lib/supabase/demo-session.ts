"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { decide } from "@/lib/access";
import { isAppRole, type AppRole } from "./config";

/**
 * There is no login page: the app signs the browser in to a built-in demo account by itself.
 * An existing session is kept as long as it may open the current page (so a mentor who moves from the faculty workspace to a
 * shared page stays a mentor); otherwise the account that belongs to the area of the URL is used. Row Level Security still
 * applies to whichever account is active, so the database stays closed to visitors who have no session.
 * For real use, replace this file with real sign-in (see README).
 */
const ACCOUNTS: Record<AppRole, string | undefined> = {
  admin: process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL,
  faculty: process.env.NEXT_PUBLIC_DEMO_FACULTY_EMAIL,
  hod: process.env.NEXT_PUBLIC_DEMO_HOD_EMAIL,
  tpo: process.env.NEXT_PUBLIC_DEMO_TPO_EMAIL,
  student: process.env.NEXT_PUBLIC_DEMO_STUDENT_EMAIL,
};

export function areaOf(path: string): AppRole {
  if (/^\/student(\/|$)/.test(path)) return "student";
  if (/^\/hod(\/|$)/.test(path)) return "hod";
  if (/^\/tpo(\/|$)/.test(path)) return "tpo";
  if (/^\/faculty(\/|$)/.test(path)) return "faculty";
  return "admin";
}

let pending: Promise<void> | null = null;
let pendingKey = "";

export function ensureDemoSession(db: SupabaseClient): Promise<void> {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const password = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";
  if (!password) return Promise.resolve();
  const key = path.split("/").slice(0, 2).join("/");
  if (pending && pendingKey === key) return pending;
  pendingKey = key;
  pending = (async () => {
    const { data } = await db.auth.getSession();
    const meta = data.session?.user.app_metadata as { role?: unknown; student_id?: unknown } | undefined;
    if (isAppRole(meta?.role)) {
      const studentId = typeof meta?.student_id === "string" ? meta.student_id : null;
      const staffViewingStudent = /^\/student\/dashboard\/student\//.test(path) && meta.role !== "student";
      // each workspace opens as its own role (an administrator who opens /hod sees the HOD view), except staff viewing one student
      const area = areaOf(path);
      const wrongRole = area !== "admin" && meta.role !== area && !staffViewingStudent;
      if (!wrongRole && decide(path, { role: meta.role, studentId }).action === "next") return;
    }
    const email = ACCOUNTS[areaOf(path)];
    if (!email) return;
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw new Error("The demo session could not be started.");
  })().catch((e) => {
    pending = null;
    throw e;
  });
  return pending;
}
