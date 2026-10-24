/** Locating, reading and combining the SQL migrations. */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const root = path.resolve(__dirname, "..", "..");
export const migrationsDir = path.join(root, "supabase", "migrations");

export function migrationFiles(): { name: string; sql: string }[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(migrationsDir, name), "utf8") }));
}

export const shimSql = () => readFileSync(path.join(root, "supabase", "tests", "shim.sql"), "utf8");
