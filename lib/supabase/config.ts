/** Public Supabase settings (the URL and the publishable key are meant for the browser). */
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.");
  }
  return { url, key };
}

export const isSupabaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

/**
 * Login enforcement is a switch, off until the database has been migrated, seeded and has demo users: turning it on
 * earlier would lock everyone out of the app. Set NEXT_PUBLIC_REQUIRE_AUTH=true in .env.local to enforce it.
 */
export const isAuthRequired = () => process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

export type AppRole = "admin" | "faculty" | "student" | "hod" | "tpo";
export const isAppRole = (value: unknown): value is AppRole => value === "admin" || value === "faculty" || value === "student" || value === "hod" || value === "tpo";

/** Where each role lands after login. */
export const homeFor = (role: AppRole) =>
  role === "student" ? "/student/dashboard" : role === "hod" ? "/hod/dashboard" : role === "tpo" ? "/tpo/dashboard" : role === "faculty" ? "/faculty/dashboard" : "/admin/dashboard";

/** Only relative, same-site paths may be used as a post-login destination (prevents open redirects). */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}
