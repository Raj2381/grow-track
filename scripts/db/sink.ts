/**
 * Where seed data goes. One interface, two backends:
 *   PgSink    any object with query(sql, params) (a `pg` Client against SUPABASE_DB_URL, or PGlite in the tests).
 *             Fast: one statement per 5,000 rows via jsonb_populate_recordset.
 *   RestSink  supabase-js with the service-role key (bypasses RLS). Used when only the key is available.
 * Both run only in server-side scripts; never import this from app code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Row } from "./seed-data";

export type Mode = "update" | "keep";
export interface Sink {
  readonly kind: "postgres" | "rest";
  upsert(table: string, rows: Row[], conflict: string[], mode?: Mode): Promise<void>;
  count(table: string, equals?: { column: string; value: string }): Promise<number>;
  update(table: string, values: Row, where: Record<string, unknown>): Promise<void>;
  deleteAll(table: string): Promise<void>;
  deleteWhereNotIn(table: string, column: string, keep: string[], extra?: { column: string; value: string }): Promise<void>;
}

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;
export const BATCH = 5000;

export type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

export class PgSink implements Sink {
  readonly kind = "postgres" as const;
  constructor(private readonly db: Queryable) {}

  async upsert(table: string, rows: Row[], conflict: string[], mode: Mode = "update") {
    if (!rows.length) return;
    const columns = Object.keys(rows[0]);
    const cols = columns.map(q).join(", ");
    const updates = columns.filter((c) => !conflict.includes(c));
    const onConflict = mode === "keep" || updates.length === 0 ? "do nothing" : `do update set ${updates.map((c) => `${q(c)} = excluded.${q(c)}`).join(", ")}`;
    const sql = `insert into public.${q(table)} (${cols}) select ${cols} from jsonb_populate_recordset(null::public.${q(table)}, $1::jsonb) on conflict (${conflict.map(q).join(", ")}) ${onConflict}`;
    for (let i = 0; i < rows.length; i += BATCH) await this.db.query(sql, [JSON.stringify(rows.slice(i, i + BATCH))]);
  }
  async count(table: string, equals?: { column: string; value: string }) {
    const where = equals ? ` where ${q(equals.column)} = $1` : "";
    const r = await this.db.query(`select count(*)::int as c from public.${q(table)}${where}`, equals ? [equals.value] : []);
    return Number(r.rows[0].c);
  }
  async update(table: string, values: Row, where: Record<string, unknown>) {
    const set = Object.keys(values).map((c, i) => `${q(c)} = $${i + 1}`);
    const keys = Object.keys(where).map((c, i) => `${q(c)} = $${Object.keys(values).length + i + 1}`);
    await this.db.query(`update public.${q(table)} set ${set.join(", ")}${keys.length ? ` where ${keys.join(" and ")}` : ""}`, [...Object.values(values), ...Object.values(where)]);
  }
  async deleteAll(table: string) {
    await this.db.query(`delete from public.${q(table)}`);
  }
  async deleteWhereNotIn(table: string, column: string, keep: string[], extra?: { column: string; value: string }) {
    const e = extra ? ` and ${q(extra.column)} = $2` : "";
    await this.db.query(`delete from public.${q(table)} where ${q(column)}::text <> all($1::text[])${e}`, extra ? [keep, extra.value] : [keep]);
  }
}

/** The column used to address "every row" of a table over REST. */
const ANY_COLUMN: Record<string, string> = {
  departments: "code", semesters: "semester", subjects: "code", segment_members: "segment_id", risk_trends: "run_id", model_metrics: "run_id",
  whatif_model: "run_id", cohort_stats: "run_id", attendance_records: "session_id", admin_settings: "user_id", profiles: "id",
  faculty_evaluations: "id", declared_results: "student_id", declared_result_subjects: "student_id", academic_updates: "student_id",
  branch_subjects: "branch_code", lms_logins: "student_id", lms_completed_assignments: "student_id", lms_solved_challenges: "student_id",
  surveys: "student_id", portal_intro: "student_id", faculty_evaluation_receipts: "student_id", predictions: "student_id", whatif_inputs: "student_id",
  attendance_monthly: "student_id", lecture_presence: "student_id", lms_monthly: "student_id", semester_results: "student_id", backlogs: "student_id",
  faculty_remarks: "student_id",
};

export class RestSink implements Sink {
  readonly kind = "rest" as const;
  constructor(private readonly client: SupabaseClient) {}

  private fail(table: string, error: { message: string } | null) {
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  async upsert(table: string, rows: Row[], conflict: string[], mode: Mode = "update") {
    for (let i = 0; i < rows.length; i += 1000) {
      const { error } = await this.client.from(table).upsert(rows.slice(i, i + 1000), { onConflict: conflict.join(","), ignoreDuplicates: mode === "keep" });
      this.fail(table, error);
    }
  }
  async count(table: string, equals?: { column: string; value: string }) {
    let query = this.client.from(table).select("*", { count: "exact", head: true });
    if (equals) query = query.eq(equals.column, equals.value);
    const { count, error } = await query;
    this.fail(table, error);
    return count ?? 0;
  }
  async update(table: string, values: Row, where: Record<string, unknown>) {
    let query = this.client.from(table).update(values);
    for (const [k, v] of Object.entries(where)) query = query.eq(k, v as string);
    const { error } = await query;
    this.fail(table, error);
  }
  async deleteAll(table: string) {
    const column = ANY_COLUMN[table] ?? "id";
    const { error } = await this.client.from(table).delete().not(column, "is", null);
    this.fail(table, error);
  }
  async deleteWhereNotIn(table: string, column: string, keep: string[], extra?: { column: string; value: string }) {
    let existing = this.client.from(table).select(column);
    if (extra) existing = existing.eq(extra.column, extra.value);
    const { data, error } = await existing;
    this.fail(table, error);
    const keepSet = new Set(keep);
    const stale = ((data ?? []) as unknown as Record<string, string>[]).map((r) => r[column]).filter((v) => !keepSet.has(v));
    for (let i = 0; i < stale.length; i += 200) {
      const { error: e } = await this.client.from(table).delete().in(column, stale.slice(i, i + 200));
      this.fail(table, e);
    }
  }
}
