"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseConfig } from "./config";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser client (publishable key). Row Level Security decides what it can read and write. */
export function createClient() {
  if (!client) {
    const { url, key } = supabaseConfig();
    client = createBrowserClient<Database>(url, key);
  }
  return client;
}
