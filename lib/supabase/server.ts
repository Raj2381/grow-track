import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseConfig } from "./config";

/**
 * Server client for route handlers and server actions: acts as the signed-in user (RLS applies).
 * With cacheComponents on, reading cookies must happen at request time, so never call this inside a cached scope.
 */
export async function createClient() {
  const { url, key } = supabaseConfig();
  const store = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component, where cookies are read-only: the proxy refreshes the session instead
        }
      },
    },
  });
}
