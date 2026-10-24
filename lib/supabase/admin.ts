import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseConfig } from "./config";

/**
 * SERVICE ROLE client: bypasses Row Level Security. Server-only (the import above makes a client import a build
 * error). Use it only where code must act on behalf of the system, never with user input forwarded as a filter.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (server-only secret).");
  return createClient<Database>(supabaseConfig().url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
