/**
 * Database command line.   npm run db:migrate | db:seed | db:load-ml | db:users | db:verify | db:reset
 *
 * Backend, chosen from what is in .env.local (server-only secrets, never NEXT_PUBLIC_):
 *   SUPABASE_DB_URL            direct Postgres connection (fastest; also lets db:migrate apply the SQL for you)
 *   SUPABASE_SERVICE_ROLE_KEY  REST + Auth Admin API (needed for demo users; bypasses RLS, so only used here)
 * With neither, the commands that need one print what to add and exit with code 2.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { readEnv, type Secrets } from "./env";
import { migrationFiles, root } from "./migrations";
import { PgSink, RestSink, type Sink } from "./sink";
import { buildSeed, CLEAR_ORDER, MIXED_SOURCE_TABLES } from "./seed-data";
import { runSeed } from "./seed";
import { loadMlOutputs } from "./ml-load";
import { demoUsers, ensureDemoUsers, sqlAuthAdmin, CREDENTIALS_FILE, type AuthAdminApi } from "./users";

const args = process.argv.slice(3);
const flag = (name: string) => args.includes(name);
const log = (line: string) => console.log(line);

function needSecret(what: string): never {
  console.error(`\nThis command needs ${what} in .env.local (server-only: never prefix it with NEXT_PUBLIC_, never commit it, never paste it in chat).`);
  console.error("  SUPABASE_SERVICE_ROLE_KEY  Supabase dashboard -> Project Settings -> API Keys -> the secret / service_role key");
  console.error("  SUPABASE_DB_URL            Supabase dashboard -> Connect -> Connection string (use the session pooler string, with your database password)");
  process.exit(2);
}

async function backend(env: Secrets): Promise<{ sink: Sink; close: () => Promise<void> }> {
  if (env.dbUrl) {
    const client = new Client({ connectionString: env.dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    return { sink: new PgSink(client as never), close: () => client.end() };
  }
  if (env.serviceRoleKey) {
    const client = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    return { sink: new RestSink(client), close: async () => {} };
  }
  return needSecret("SUPABASE_DB_URL or SUPABASE_SERVICE_ROLE_KEY");
}

async function authApi(env: Secrets): Promise<{ api: AuthAdminApi; close: () => Promise<void> }> {
  if (env.serviceRoleKey) {
    const admin = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;
    return {
      close: async () => {},
      api: {
        async listUsers(page, perPage) {
          const { data, error } = await admin.listUsers({ page, perPage });
          if (error) throw new Error(`listUsers: ${error.message}`);
          return { users: data.users.map((u) => ({ id: u.id, email: u.email })) };
        },
        async createUser(attrs) {
          const { data, error } = await admin.createUser(attrs);
          if (error || !data.user) throw new Error(`createUser ${attrs.email}: ${error?.message}`);
          return { id: data.user.id };
        },
        async updateUserById(id, attrs) {
          const { error } = await admin.updateUserById(id, attrs);
          if (error) throw new Error(`updateUserById: ${error.message}`);
        },
      },
    };
  }
  if (env.dbUrl) {
    const client = new Client({ connectionString: env.dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    return { api: sqlAuthAdmin(client as never), close: () => client.end() };
  }
  return needSecret("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_DB_URL (logins are created through one of them)");
}

async function migrate(env: Secrets) {
  const files = migrationFiles();
  const combined = ["-- All GrowTrack migrations in order. Paste into the Supabase SQL editor and run once. Safe to run again.", ...files.map((f) => `\n-- ===== ${f.name} =====\n${f.sql}`)].join("\n");
  writeFileSync(path.join(root, "supabase", "all_migrations.sql"), combined);
  if (!env.dbUrl) {
    console.log("No SUPABASE_DB_URL, so the SQL cannot be applied from here. Two ways to apply it:");
    console.log("  1. Supabase dashboard -> SQL Editor -> New query -> paste the contents of supabase/all_migrations.sql -> Run.");
    console.log("  2. Add SUPABASE_DB_URL to .env.local and run `npm run db:migrate` again.");
    return;
  }
  const client = new Client({ connectionString: env.dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    for (const f of files) {
      await client.query(f.sql);
      log(`ok   applied ${f.name}`);
    }
    const rls = await client.query("select count(*)::int c from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity");
    log(Number(rls.rows[0].c) === 0 ? "ok   every public table has RLS enabled" : `FAIL ${rls.rows[0].c} public tables without RLS`);
  } finally {
    await client.end();
  }
}

async function seed(env: Secrets) {
  const { sink, close } = await backend(env);
  try {
    const report = await runSeed(sink, log);
    if (!report.every((r) => r.ok)) { console.error("seed counts do not match the source"); process.exit(1); }
  } finally { await close(); }
  await users(env, true);
}

async function users(env: Secrets, quiet = false) {
  const spec = buildSeed().find((t) => t.table === "students")!.rows as { id: string; name: string }[];
  const { api, close } = await authApi(env);
  const report = await ensureDemoUsers(api, demoUsers(Object.fromEntries(spec.map((s) => [s.id, s.name]))), { resetPasswords: flag("--reset-passwords") }).finally(close);
  log(`ok   demo logins: ${report.created} created, ${report.updated} updated, ${report.passwordsReset} passwords (re)set`);
  if (!quiet || report.created || report.passwordsReset) log(`     credentials are in ${path.basename(CREDENTIALS_FILE)} (git-ignored, mode 600)`);
}

async function verify(env: Secrets) {
  const { sink, close } = await backend(env);
  let bad = 0;
  try {
    for (const t of buildSeed()) {
      const loaded = await sink.count(t.table, MIXED_SOURCE_TABLES.includes(t.table) ? { column: "source", value: "historical" } : undefined);
      const ok = loaded === t.rows.length;
      if (!ok) bad++;
      log(`${ok ? "ok  " : "FAIL"} ${t.table.padEnd(20)} ${String(loaded).padStart(7)} / ${t.rows.length}`);
    }
    for (const [table, expected] of [["predictions", 800], ["whatif_inputs", 800], ["segments", 6]] as [string, number][]) {
      const n = await sink.count(table);
      if (n !== expected) bad++;
      log(`${n === expected ? "ok  " : "FAIL"} ${table.padEnd(20)} ${String(n).padStart(7)} / ${expected}`);
    }
    const current = await sink.count("model_runs", { column: "is_current", value: "true" }).catch(() => -1);
    log(`${current === 1 ? "ok  " : "FAIL"} model_runs current       ${current}`);
    if (current !== 1) bad++;
  } finally { await close(); }
  if (bad) { console.error(`\n${bad} checks failed`); process.exit(1); }
  console.log("\ndatabase matches the source data");
}

async function reset(env: Secrets) {
  if (!flag("--yes")) {
    console.error("db:reset deletes ALL rows in the GrowTrack data tables (students, history, app state, ML outputs), then reloads the sample data.");
    console.error("Login accounts in Supabase Auth are NOT deleted. Re-run with --yes to proceed:  npm run db:reset -- --yes");
    process.exit(2);
  }
  const { sink, close } = await backend(env);
  try {
    for (const table of CLEAR_ORDER) { await sink.deleteAll(table); log(`cleared ${table}`); }
    await runSeed(sink, log);
    await loadMlOutputs(sink, log);
  } finally { await close(); }
  await users(env, true);
}

async function main() {
  const command = process.argv[2];
  const env = readEnv();
  const commands: Record<string, () => Promise<void>> = {
    migrate: () => migrate(env), seed: () => seed(env), users: () => users(env), verify: () => verify(env), reset: () => reset(env),
    "load-ml": async () => { const { sink, close } = await backend(env); try { await loadMlOutputs(sink, log); } finally { await close(); } },
  };
  if (!commands[command]) { console.error(`usage: db <${Object.keys(commands).join("|")}>`); process.exit(2); }
  await commands[command]();
}
main().catch((error) => { console.error(`\n${error instanceof Error ? error.message : error}`); process.exit(1); });
