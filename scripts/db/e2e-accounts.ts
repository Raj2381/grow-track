/**
 * Temporary throwaway accounts for browser and E2E verification.   tsx scripts/db/e2e-accounts.ts create|delete
 * They use a fixed, publicly known test password, so they exist only while testing and MUST be deleted afterwards.
 * Emails are e2e.*@example.com; `delete` removes exactly those (profiles cascade).
 */
import { Client } from "pg";
import { readEnv } from "./env";
import { sqlAuthAdmin } from "./users";

export const E2E_PASSWORD = "GrowTrack-E2E-Throwaway-2026";
export const E2E_ACCOUNTS: { email: string; meta: Record<string, string> }[] = [
  { email: "e2e.admin@example.com", meta: { role: "admin", display_name: "E2E Dean" } },
  { email: "e2e.faculty@example.com", meta: { role: "faculty", faculty_id: "FAC-CSE-3", display_name: "E2E Mentor" } },
  { email: "e2e.hod@example.com", meta: { role: "hod", faculty_id: "FAC-CSE-2", display_name: "E2E HOD" } },
  { email: "e2e.tpo@example.com", meta: { role: "tpo", display_name: "E2E TPO" } },
  { email: "e2e.student0146@example.com", meta: { role: "student", student_id: "STU-0146", display_name: "E2E Student" } },
  { email: "e2e.student0230@example.com", meta: { role: "student", student_id: "STU-0230", display_name: "E2E Student B" } },
];

async function main() {
  const command = process.argv[2];
  const env = readEnv();
  if (!env.dbUrl) throw new Error("SUPABASE_DB_URL is required");
  const client = new Client({ connectionString: env.dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    if (command === "delete") {
      const r = await client.query("delete from auth.users where email like 'e2e.%@example.com'");
      console.log(`deleted ${r.rowCount} temporary accounts`);
      return;
    }
    if (command !== "create") throw new Error("usage: create | delete");
    const api = sqlAuthAdmin(client);
    const existing = await api.listUsers(1, 500);
    for (const a of E2E_ACCOUNTS) {
      const found = existing.users.find((u) => u.email === a.email);
      if (found) await api.updateUserById(found.id, { app_metadata: a.meta, password: E2E_PASSWORD });
      else await api.createUser({ email: a.email, password: E2E_PASSWORD, email_confirm: true, app_metadata: a.meta });
    }
    console.log(`ready: ${E2E_ACCOUNTS.length} temporary accounts (delete them with: npx tsx scripts/db/e2e-accounts.ts delete)`);
  } finally {
    await client.end();
  }
}
if (require.main === module) main().catch((e) => { console.error(String(e.message).replace(/:[^:@]*@/, ":***@")); process.exit(1); });
