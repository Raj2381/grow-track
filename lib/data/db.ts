import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type Db = SupabaseClient<Database>;

/** An error with a message that is safe to show to a person: no SQL, no keys, no stack. */
export class DataError extends Error {
  constructor(public readonly friendly: string, public readonly code?: string) {
    super(friendly);
    this.name = "DataError";
  }
}

type PgError = { message: string; code?: string; status?: number } | null;

export function friendlyMessage(error: PgError | unknown): string {
  const e = (error ?? {}) as { message?: string; code?: string; status?: number };
  if (e.code === "42501" || e.code === "PGRST301" || e.status === 401 || e.status === 403) return "You do not have access to this information. Sign in again, or ask an administrator.";
  if (e.code === "PGRST116") return "That item could not be found, or you are not allowed to see it.";
  if (/failed to fetch|network|load failed/i.test(e.message ?? "")) return "We could not reach the server. Check your connection and try again.";
  return "Something went wrong while loading this information. Please try again.";
}

/** Returns the data or throws a DataError (never a raw database error). */
export function unwrap<T>(result: { data: T; error: PgError }): NonNullable<T> {
  if (result.error) throw new DataError(friendlyMessage(result.error), result.error.code);
  if (result.data === null || result.data === undefined) throw new DataError("No data came back. Please try again.");
  return result.data as NonNullable<T>;
}

/** Keeps a user's search text from breaking a PostgREST filter expression. */
export const cleanSearch = (value: string) => value.replace(/[,()%*\\:]/g, " ").trim().slice(0, 60);
