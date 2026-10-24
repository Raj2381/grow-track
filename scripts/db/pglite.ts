/** An in-process Postgres 18 (PGlite) with a Supabase-style auth shim, for testing migrations, RLS and seeding offline. */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { migrationFiles, shimSql } from "./migrations";

export type TestDb = PGlite;

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(shimSql());
  for (const m of migrationFiles()) {
    try {
      await db.exec(m.sql);
    } catch (error) {
      throw new Error(`migration ${m.name} failed: ${(error as Error).message}`);
    }
  }
  return db;
}

/** Runs `fn` as the given user (a JWT subject) or as anon (null), then restores the superuser. */
export async function asRole<T>(db: TestDb, who: { sub: string } | null, fn: () => Promise<T>): Promise<T> {
  await db.exec("reset role");
  if (who) {
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: who.sub, role: "authenticated" })]);
    await db.exec("set role authenticated");
  } else {
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "anon" })]);
    await db.exec("set role anon");
  }
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
