/** Loads .env.local (then .env) into process.env for the scripts. Never prints a value. Existing variables win. */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { root } from "./migrations";

export function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(root, file);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match || line.trim().startsWith("#")) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
      if (process.env[match[1]] === undefined && value !== "") process.env[match[1]] = value;
    }
  }
}

/**
 * A database password may contain characters such as "@" or "." that break a connection URL. Everything between the
 * first ":" after the user name and the LAST "@" is the password, so it is URL-encoded here. Nothing is printed.
 */
export function normalizeDbUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  const m = /^(postgres(?:ql)?:\/\/)([^:/@]+):(.*)@([^@]+)$/.exec(raw.trim());
  if (!m) return raw.trim();
  let password = m[3];
  try { password = decodeURIComponent(password); } catch { /* not encoded */ }
  return `${m[1]}${m[2]}:${encodeURIComponent(password)}@${m[4]}`;
}

export type Secrets = { url: string; publishableKey: string; serviceRoleKey?: string; dbUrl?: string };

export function readEnv(): Secrets {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local");
  return { url, publishableKey, serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY, dbUrl: normalizeDbUrl(process.env.SUPABASE_DB_URL) };
}
