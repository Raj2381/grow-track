"use client";

import { useEffect, useMemo } from "react";
import useSWR, { useSWRConfig, type SWRConfiguration } from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Db } from "./db";
import { DataError } from "./db";
import { ensureDemoSession } from "@/lib/supabase/demo-session";
import { fetchCurrentUser, type CurrentUser } from "./current-user";

/** The browser client acting as the signed-in user. */
export function useDb(): Db {
  return useMemo(() => createClient() as Db, []);
}

const DEFAULTS: SWRConfiguration = { revalidateOnFocus: true, keepPreviousData: true, shouldRetryOnError: false, dedupingInterval: 4000 };

/** SWR over a typed fetcher. `key` must include every input of the fetcher. Returns a friendly error message, never a raw error. */
export function useData<T>(key: unknown[] | null, fetcher: (db: Db) => Promise<T>, config: SWRConfiguration = {}) {
  const db = useDb();
  const result = useSWR<T, Error>(key ? ["gt", ...key] : null, async () => { await ensureDemoSession(db); return fetcher(db); }, { ...DEFAULTS, ...config });
  const error = result.error ? (result.error instanceof DataError ? result.error.friendly : "Something went wrong while loading this information. Please try again.") : null;
  return { data: result.data, error, loading: result.isLoading, refreshing: result.isValidating, retry: () => result.mutate(), mutate: result.mutate };
}

export function useCurrentUser() {
  return useData<CurrentUser | null>(["me"], fetchCurrentUser, { revalidateOnFocus: false, dedupingInterval: 30000 });
}

/**
 * Refreshes every cached query whose key starts with `prefix` when rows of `table` change in the database (Supabase
 * Realtime; Row Level Security still filters what each user receives). Focus-refetch in useData is the fallback.
 */
export function useRealtimeRefresh(table: string, prefix: string) {
  const db = useDb();
  const { mutate } = useSWRConfig();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = db
      .channel(`gt-${table}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => mutate((key) => Array.isArray(key) && key[0] === "gt" && key[1] === prefix), 400);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      void db.removeChannel(channel);
    };
  }, [db, table, prefix, mutate]);
}
