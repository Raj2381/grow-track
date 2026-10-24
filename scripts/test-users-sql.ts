/** Demo logins created with SQL (no service-role key): rows, roles, profiles and a real bcrypt check.  npm run test:users-sql */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createTestDb } from "./db/pglite";
import { PgSink } from "./db/sink";
import { buildSeed } from "./db/seed-data";
import { demoUsers, ensureDemoUsers, sqlAuthAdmin } from "./db/users";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` ${detail}` : ""}`); if (!ok) failures++; };

async function main() {
  const db = await createTestDb();
  const sink = new PgSink(db);
  const spec = buildSeed();
  for (const t of spec.filter((s) => ["departments", "faculty", "students"].includes(s.table))) await sink.upsert(t.table, t.rows, t.conflict, t.mode);
  const names = Object.fromEntries((spec.find((s) => s.table === "students")!.rows as { id: string; name: string }[]).map((s) => [s.id, s.name]));
  const file = path.join(mkdtempSync(path.join(tmpdir(), "gt-sql-")), ".demo-credentials.local");
  const one = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows[0] as Record<string, unknown>;

  const report = await ensureDemoUsers(sqlAuthAdmin(db), demoUsers(names), { file });
  check("16 logins created through SQL", report.created === 16 && Number((await one("select count(*)::int c from auth.users")).c) === 16);
  check("each login has an email identity", Number((await one("select count(*)::int c from auth.identities where provider = 'email'")).c) === 16);
  check("each login is confirmed, authenticated, with empty token columns (no NULLs for GoTrue to trip on)", Number((await one(`select count(*)::int c from auth.users where email_confirmed_at is not null and aud = 'authenticated' and role = 'authenticated'
     and confirmation_token = '' and recovery_token = '' and email_change = '' and reauthentication_token = ''`)).c) === 16);
  check("the trigger made a profile per login with the right role", Number((await one("select count(*)::int c from profiles")).c) === 16
    && Number((await one("select count(*)::int c from profiles where role='admin'")).c) === 1 && Number((await one("select count(*)::int c from profiles where role='faculty'")).c) === 5
    && Number((await one("select count(*)::int c from profiles where role='student' and student_id like 'STU-%'")).c) === 10);
  const lines = readFileSync(file, "utf8").trim().split("\n").slice(1).map((l) => l.split(","));
  let verified = 0;
  for (const [, email, password] of lines) {
    const r = await one("select (encrypted_password = extensions.crypt($1, encrypted_password)) ok from auth.users where email = $2", [password, email]);
    if (r.ok === true) verified++;
  }
  check("every password in the credentials file verifies against its bcrypt hash", verified === 16, `${verified}/16`);
  check("a wrong password does not verify", (await one("select (encrypted_password = extensions.crypt('wrong', encrypted_password)) ok from auth.users limit 1")).ok === false);
  const hashesBefore = (await db.query("select email, encrypted_password from auth.users order by email")).rows;
  const again = await ensureDemoUsers(sqlAuthAdmin(db), demoUsers(names), { file });
  const hashesAfter = (await db.query("select email, encrypted_password from auth.users order by email")).rows;
  check("a second run creates nothing and keeps every password hash", again.created === 0 && JSON.stringify(hashesBefore) === JSON.stringify(hashesAfter));
  await ensureDemoUsers(sqlAuthAdmin(db), demoUsers(names), { file, resetPasswords: true });
  const rotated = (await db.query<Record<string, unknown>>("select encrypted_password from auth.users order by email")).rows;
  check("--reset-passwords rotates them all", rotated.every((r, i) => r.encrypted_password !== (hashesAfter[i] as Record<string, unknown>).encrypted_password));
  console.log(failures ? `\n${failures} FAILED` : "\nALL SQL-LOGIN TESTS PASSED");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
