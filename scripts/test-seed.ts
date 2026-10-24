/**
 * Seeds an in-process Postgres (PGlite) with the real migrations and the full dataset, then proves
 *   - every history table has exactly the rows the generator produced, and re-seeding changes nothing (idempotent),
 *   - the row-level integrity rules in the data hold (30 results per student, 800 students, ...),
 *   - the ML outputs load and the current model run is unique.
 * npm run test:seed
 */
import { createTestDb } from "./db/pglite";
import { PgSink } from "./db/sink";
import { runSeed } from "./db/seed";
import { loadMlOutputs } from "./db/ml-load";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` ${detail}` : ""}`);
  if (!ok) failures++;
};

async function main() {
  const db = await createTestDb();
  const sink = new PgSink(db);
  const started = Date.now();
  const report = await runSeed(sink, (line) => console.log(line));
  console.log(`seeded in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  check("every history table has exactly the rows the generator produced", report.every((r) => r.ok), report.filter((r) => !r.ok).map((r) => `${r.table} ${r.loaded}/${r.expected}`).join(", "));

  const second = await runSeed(sink);
  check("re-seeding is idempotent (same counts)", second.every((r, i) => r.loaded === report[i].loaded));

  const one = async (sql: string) => Number(((await db.query<{ c: number }>(sql)).rows[0] as { c: number }).c);
  check("800 students, 5 departments, 30 results each", (await one("select count(*)::int c from students")) === 800 && (await one("select count(*)::int c from departments")) === 5
    && (await one("select count(*)::int c from (select student_id from semester_results group by 1 having count(*) <> 30) x")) === 0);
  check("each student has 6 subjects x 5 semesters of faculty remarks", (await one("select count(*)::int c from (select student_id from faculty_remarks group by 1 having count(*) <> 30) x")) === 0);
  check("lecture presence is stored for the 6 subjects of the current semester", (await one("select count(*)::int c from (select student_id from lecture_presence group by 1 having count(*) <> 6) x")) === 0);
  check("every student's mentor belongs to their department", (await one("select count(*)::int c from students s join faculty f on f.id = s.mentor_id where f.branch_code <> s.branch_code")) === 0);
  check("every result's subject belongs to the student's branch catalog", (await one(`select count(*)::int c from semester_results r join students s on s.id = r.student_id
      left join branch_subjects b on b.branch_code = s.branch_code and b.semester = r.semester and b.subject_code = r.subject_code where b.subject_code is null`)) === 0);
  check("first-attempt failures account for every backlog", (await one(`select count(*)::int c from semester_results where not first_attempt_passed`)) === (await one("select count(distinct (student_id, subject_code))::int c from backlogs")));
  check("the sem-5 presence strings match the monthly attendance totals", (await one(`select count(*)::int c from (
      select p.student_id, p.subject_code, length(replace(p.presence,'0','')) a, sum(m.lectures_attended) b from lecture_presence p
      join attendance_monthly m on m.student_id = p.student_id and m.semester = p.semester and m.subject_code = p.subject_code
      group by p.student_id, p.subject_code, p.presence having length(replace(p.presence,'0','')) <> sum(m.lectures_attended)) x`)) === 0);

  const ml = await loadMlOutputs(sink, (line) => console.log(line));
  check("800 predictions load", (await one("select count(*)::int c from predictions")) === 800 && ml.predictions === 800);
  check("exactly one model run is current", (await one("select count(*)::int c from model_runs where is_current")) === 1);
  check("recommendations load", (await one("select count(*)::int c from recommendations")) === ml.recommendations && ml.recommendations > 1000, `${ml.recommendations}`);
  check("every student recommendation targets a real student", (await one("select count(*)::int c from recommendations r where target_type='student' and not exists (select 1 from students s where s.id = r.target_id)")) === 0);
  check("segments and members load", (await one("select count(*)::int c from segments")) === 6 && (await one("select count(*)::int c from segment_members")) > 100);
  check("what-if inputs load for every student", (await one("select count(*)::int c from whatif_inputs")) === 800);

  // staff decisions survive a reload of the ML outputs
  await db.exec("update recommendations set status = 'accepted' where id = (select id from recommendations where target_type='student' order by id limit 1)");
  const keptId = ((await db.query<{ id: string }>("select id from recommendations where status='accepted'")).rows[0]).id;
  await loadMlOutputs(sink);
  check("a reload of the ML outputs keeps staff decisions on recommendations", (await one(`select count(*)::int c from recommendations where id='${keptId}' and status='accepted'`)) === 1);
  check("a reload creates a new current run without a second current one", (await one("select count(*)::int c from model_runs where is_current")) === 1 && (await one("select count(*)::int c from model_runs")) === 2);
  check("predictions point at the newest run", (await one("select count(distinct run_id)::int c from predictions")) === 1);

  console.log(failures ? `\n${failures} SEED CHECKS FAILED` : "\nALL SEED TESTS PASSED");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
