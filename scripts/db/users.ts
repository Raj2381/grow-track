/**
 * Demo logins: 1 admin, 1 mentor per department, and students STU-0001..0010. Created through the Auth Admin API with
 * the SERVICE ROLE key; roles go into app_metadata (users cannot edit it) and the database trigger turns that into a
 * profiles row. Passwords are random, written ONLY to .demo-credentials.local, and never printed.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { root } from "./migrations";
import { MENTORS } from "../../lib/dataset/config";

export type DemoUser = { role: "admin" | "faculty" | "student"; email: string; ref: string; displayName: string; appMetadata: Record<string, string> };

export const CREDENTIALS_FILE = path.join(root, ".demo-credentials.local");
const EMAIL_DOMAIN = "example.com";   // reserved for documentation: nothing real is ever mailed

export function demoUsers(studentNames: Record<string, string>): DemoUser[] {
  const users: DemoUser[] = [
    { role: "admin", email: `growtrack.admin@${EMAIL_DOMAIN}`, ref: "admin", displayName: "Demo Administrator", appMetadata: { role: "admin", display_name: "Demo Administrator" } },
  ];
  for (const [branch, list] of Object.entries(MENTORS)) {
    const m = list[0];
    users.push({ role: "faculty", email: `growtrack.faculty.${branch.toLowerCase()}@${EMAIL_DOMAIN}`, ref: m.id, displayName: m.name, appMetadata: { role: "faculty", faculty_id: m.id, display_name: m.name } });
  }
  for (let n = 1; n <= 10; n++) {
    const id = `STU-${String(n).padStart(4, "0")}`;
    users.push({ role: "student", email: `growtrack.stu${String(n).padStart(4, "0")}@${EMAIL_DOMAIN}`, ref: id, displayName: studentNames[id] ?? id, appMetadata: { role: "student", student_id: id, display_name: studentNames[id] ?? id } });
  }
  return users;
}

/** The slice of supabase.auth.admin the script needs, so it can be replaced by a fake in tests. */
export interface AuthAdminApi {
  listUsers(page: number, perPage: number): Promise<{ users: { id: string; email?: string }[] }>;
  createUser(attrs: { email: string; password: string; email_confirm: boolean; app_metadata: Record<string, string> }): Promise<{ id: string }>;
  updateUserById(id: string, attrs: { app_metadata: Record<string, string>; password?: string }): Promise<void>;
}

const newPassword = () => randomBytes(15).toString("base64url");

type Existing = Map<string, string>; // email -> password line already on disk
function readCredentials(file: string): Existing {
  const map: Existing = new Map();
  if (!existsSync(file)) return map;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const [role, email, password, ref] = line.split(",");
    if (role && email && password && ref && role !== "role") map.set(email, line);
  }
  return map;
}

export type UsersReport = { created: number; updated: number; passwordsReset: number; total: number };

export async function ensureDemoUsers(api: AuthAdminApi, users: DemoUser[], opts: { file?: string; resetPasswords?: boolean } = {}): Promise<UsersReport> {
  const file = opts.file ?? CREDENTIALS_FILE;
  const lines = readCredentials(file);
  const byEmail = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { users: batch } = await api.listUsers(page, 200);
    for (const u of batch) if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
    if (batch.length < 200) break;
  }
  const report: UsersReport = { created: 0, updated: 0, passwordsReset: 0, total: users.length };
  for (const user of users) {
    const existingId = byEmail.get(user.email.toLowerCase());
    if (!existingId) {
      const password = newPassword();
      await api.createUser({ email: user.email, password, email_confirm: true, app_metadata: user.appMetadata });
      lines.set(user.email, [user.role, user.email, password, user.ref].join(","));
      report.created++;
    } else {
      const reset = opts.resetPasswords || !lines.has(user.email);   // an existing login whose password we do not know is reset
      const password = reset ? newPassword() : undefined;
      await api.updateUserById(existingId, { app_metadata: user.appMetadata, ...(password ? { password } : {}) });
      if (password) {
        lines.set(user.email, [user.role, user.email, password, user.ref].join(","));
        report.passwordsReset++;
      }
      report.updated++;
    }
  }
  const body = ["role,email,password,id", ...users.map((u) => lines.get(u.email)).filter(Boolean)].join("\n") + "\n";
  writeFileSync(file, body, { mode: 0o600 });
  try { chmodSync(file, 0o600); } catch { /* best effort */ }
  return report;
}


/**
 * The same operations over a direct Postgres connection, for when only SUPABASE_DB_URL is available. It writes the rows
 * GoTrue itself would write (auth.users + an email identity, password hashed with bcrypt through pgcrypto, empty strings
 * in the token columns so sign-in does not trip over NULLs). Roles go into raw_app_meta_data exactly as with the Admin API.
 */
export type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

export function sqlAuthAdmin(db: Queryable): AuthAdminApi {
  return {
    async listUsers(page, perPage) {
      const r = await db.query("select id::text as id, email from auth.users order by email limit $1 offset $2", [perPage, (page - 1) * perPage]);
      return { users: r.rows.map((x) => ({ id: String(x.id), email: x.email ? String(x.email) : undefined })) };
    },
    async createUser(attrs) {
      const id = randomUUID();
      await db.query(
        `with u as (
           insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
             created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
             phone_change, phone_change_token, reauthentication_token)
           values ('00000000-0000-0000-0000-000000000000', $1::uuid, 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')),
             now(), $4::jsonb, '{}'::jsonb, now(), now(), '', '', '', '', '', '', '', '')
           returning id, email)
         insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
         select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now() from u`,
        [id, attrs.email, attrs.password, JSON.stringify(attrs.app_metadata)],
      );
      return { id };
    },
    async updateUserById(id, attrs) {
      await db.query(
        `update auth.users set raw_app_meta_data = $2::jsonb, updated_at = now(),
           encrypted_password = case when $3::text is null then encrypted_password else extensions.crypt($3::text, extensions.gen_salt('bf')) end
         where id = $1::uuid`,
        [id, JSON.stringify(attrs.app_metadata), attrs.password ?? null],
      );
    },
  };
}
