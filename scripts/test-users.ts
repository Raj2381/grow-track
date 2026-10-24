/** The demo-user logic against a fake Auth Admin API.  npm run test:users */
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { demoUsers, ensureDemoUsers, type AuthAdminApi } from "./db/users";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` ${detail}` : ""}`); if (!ok) failures++; };

async function main() {
  const store = new Map<string, { id: string; email: string; password: string; app: Record<string, string>; confirmed: boolean }>();
  const calls = { create: 0, update: 0 };
  const api: AuthAdminApi = {
    async listUsers(page, perPage) { const all = [...store.values()]; return { users: all.slice((page - 1) * perPage, page * perPage).map(({ id, email }) => ({ id, email })) }; },
    async createUser(a) { calls.create++; const id = `u${store.size + 1}`; store.set(id, { id, email: a.email, password: a.password, app: a.app_metadata, confirmed: a.email_confirm }); return { id }; },
    async updateUserById(id, a) { calls.update++; const u = store.get(id)!; u.app = a.app_metadata; if (a.password) u.password = a.password; },
  };
  const file = path.join(mkdtempSync(path.join(tmpdir(), "gt-users-")), ".demo-credentials.local");
  const users = demoUsers({ "STU-0001": "Aarav Mehta" });

  check("1 admin + 5 mentors + 10 students", users.length === 16 && users.filter((u) => u.role === "admin").length === 1 && users.filter((u) => u.role === "faculty").length === 5 && users.filter((u) => u.role === "student").length === 10);
  check("faculty logins are linked to FAC-<DEPT>-1", users.filter((u) => u.role === "faculty").every((u) => /^FAC-[A-Z]+-1$/.test(u.appMetadata.faculty_id)));
  check("roles go into app_metadata, never user_metadata", users.every((u) => u.appMetadata.role === u.role));

  const first = await ensureDemoUsers(api, users, { file });
  check("first run creates all 16 users, already confirmed", first.created === 16 && [...store.values()].every((u) => u.confirmed));
  const creds1 = readFileSync(file, "utf8");
  check("credentials file has one line per user and is private", creds1.trim().split("\n").length === 17 && (statSync(file).mode & 0o077) === 0, `mode ${(statSync(file).mode & 0o777).toString(8)}`);
  check("passwords are 20 characters and unique", [...store.values()].every((u) => u.password.length >= 20) && new Set([...store.values()].map((u) => u.password)).size === 16);
  check("the stored password is the one in the file", creds1.split("\n").slice(1).filter(Boolean).every((l) => { const [, email, password] = l.split(","); return [...store.values()].find((u) => u.email === email)?.password === password; }));

  const second = await ensureDemoUsers(api, users, { file });
  check("second run creates nothing and keeps every password", second.created === 0 && second.passwordsReset === 0 && readFileSync(file, "utf8") === creds1 && calls.create === 16);
  const third = await ensureDemoUsers(api, users, { file, resetPasswords: true });
  check("--reset-passwords rotates them all", third.passwordsReset === 16 && readFileSync(file, "utf8") !== creds1);
  check("nothing in the report contains a password", !JSON.stringify([first, second, third]).match(/[A-Za-z0-9_-]{20,}/));

  console.log(failures ? `\n${failures} FAILED` : "\nALL USER TESTS PASSED");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
