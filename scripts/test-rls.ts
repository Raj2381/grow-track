/**
 * Row Level Security tests.   npm run test:rls
 *
 *   default            applies the real migrations to an in-process Postgres (PGlite) with a Supabase-style auth shim,
 *                      loads a fixture and proves what every role can and cannot do.
 *   SUPABASE_DB_URL    ALSO runs the read-only structural checks against the real database (RLS on every public table,
 *                      anon has no table privileges). It never inserts anything there.
 *
 * The suite FAILS if any public table has RLS switched off, and it proves that detector works by switching RLS off on
 * one table and checking the detector notices.
 */
import { Client } from "pg";
import { asRole, createTestDb, type TestDb } from "./db/pglite";
import { loadEnv, normalizeDbUrl } from "./db/env";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` ${detail}` : ""}`);
  if (!ok) failures++;
};

const ID = {
  admin: "a0000000-0000-0000-0000-000000000001",
  facCse: "a0000000-0000-0000-0000-000000000002",
  facIt: "a0000000-0000-0000-0000-000000000003",
  hodCse: "a0000000-0000-0000-0000-000000000004",
  tpo: "a0000000-0000-0000-0000-000000000005",
  nobody: "a0000000-0000-0000-0000-000000000007",
  escalator: "a0000000-0000-0000-0000-000000000008",
  stu: (n: number) => `b0000000-0000-0000-0000-00000000000${n}`,
};
const as = {
  admin: { sub: ID.admin },
  facCse: { sub: ID.facCse },
  facIt: { sub: ID.facIt },
  hodCse: { sub: ID.hodCse },
  tpo: { sub: ID.tpo },
  nobody: { sub: ID.nobody },
  escalator: { sub: ID.escalator },
  stu: (n: number) => ({ sub: ID.stu(n) }),
};

type Row = Record<string, unknown>;
const rows = async (db: TestDb, sql: string, params: unknown[] = []) => (await db.query<Row>(sql, params)).rows;
const count = async (db: TestDb, sql: string, params: unknown[] = []) => Number((await rows(db, sql, params))[0].c);
async function fails(db: TestDb, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

/* ------------------------------------------------------------------------------------------------ fixture */
async function loadFixture(db: TestDb) {
  await db.exec(`
    insert into departments values ('CSE','Computer Science','B.Tech CSE'),('IT','Information Technology','B.Tech IT');
    insert into faculty values ('FAC-CSE-1','Dr. Meera Pillai','CSE'),('FAC-CSE-2','Prof. Rohit Verma','CSE'),('FAC-IT-1','Dr. Farah Khan','IT');
    insert into subjects values ('CS401','Database Management Systems','DBMS',4,5,'Dr. Meera Pillai'),('CS402','Operating Systems','OS',4,5,'Prof. Rohit Verma'),('IT401','Information Security','InfoSec',3,5,'Dr. Farah Khan');
    insert into branch_subjects values ('CSE',5,0,'CS401'),('CSE',5,1,'CS402'),('IT',5,0,'IT401');
    insert into semesters values (5,'2026-08-03','2026-12-18');
  `);
  const students: [string, string, string][] = [["STU-0001", "CSE", "FAC-CSE-1"], ["STU-0002", "CSE", "FAC-CSE-1"], ["STU-0003", "IT", "FAC-IT-1"]];
  for (let n = 4; n <= 8; n++) students.push([`STU-000${n}`, "CSE", "FAC-CSE-1"]);
  for (const [id, branch, mentor] of students) {
    await db.query(
      `insert into students values ($1,$2,'R'||$1,$1||'@campus.edu',$3,'A',$4,'Female','Hostel',false,'Top 50%','Middle',2024,5)`,
      [id, `Student ${id}`, branch, mentor],
    );
  }
  // logins: the trigger builds profiles from raw_app_meta_data
  const users: [string, Record<string, string>, Record<string, string>?][] = [
    [ID.admin, { role: "admin", display_name: "Admin" }],
    [ID.facCse, { role: "faculty", faculty_id: "FAC-CSE-1" }],
    [ID.facIt, { role: "faculty", faculty_id: "FAC-IT-1" }],
    [ID.hodCse, { role: "hod", faculty_id: "FAC-CSE-2" }],
    [ID.tpo, { role: "tpo" }],
    [ID.nobody, {}],
    [ID.escalator, {}, { role: "admin" }], // tries to make itself admin through user_metadata
  ];
  for (let n = 1; n <= 8; n++) users.push([ID.stu(n), { role: "student", student_id: `STU-000${n}` }]);
  for (const [id, app, user] of users) {
    await db.query("insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values ($1,$2,$3,$4)", [id, `${id}@demo.test`, JSON.stringify(app), JSON.stringify(user ?? {})]);
  }

  for (const sid of ["STU-0001", "STU-0003"]) {
    const code = sid === "STU-0003" ? "IT401" : "CS401";
    const q = (sql: string) => db.query(sql, sql.includes("$2") ? [sid, code] : [sid]);
    await q(`insert into semester_results values ($1,$2,5,20,30,50,'B',6,true,4,50,true)`);
    await q(`insert into backlogs values ($1,$2,5,1,'2026-12-12',35,'Fail')`);
    await q(`insert into attendance_monthly values ($1,5,$2,'2026-09',10,8)`);
    await q(`insert into lecture_presence values ($1,5,$2,'1101')`);
    await q(`insert into lms_monthly values ($1,5,'2026-09',10,5.0,4,3,1,60,2)`);
    await q(`insert into assignments values ('A-'||$1,$1,5,$2,'2026-09-01','2026-09-10',true,'2026-09-09',false,70)`);
    await q(`insert into faculty_remarks values ($1,5,$2,'T','2026-09-20',4,4,4,'')`);
    await q(`insert into aptitude_attempts values ('AP-'||$1,$1,5,'2026-10-01','General Practice',5,5,5,50,1200,'historical')`);
    await q(`insert into coding_attempts values ('CO-'||$1,$1,5,'2026-10-01','Python','Easy',60,5,3,2,0,900,'{}','historical')`);
    await q(`insert into interview_attempts values ('IN-'||$1,$1,5,'2026-10-01','HR','Easy',60,60,60,60,'','historical')`);
    await q(`insert into activities (id,student_id,semester,activity_date,type,title,organizer,category,role,status,source) values ('AC-'||$1,$1,5,'2026-10-01','club','Club','Org','Tech','Member','Approved','historical')`);
    await q(`insert into skill_assessments values ('SK-'||$1,$1,5,'technical','DSA',60,'2026-11-01','historical')`);
    await q(`insert into interventions (id,student_id,semester,reason,action_plan,priority,status,follow_up_date,source) values ('INT-'||$1,$1,5,'r','a','High','Planned','2027-01-20','historical')`);
    await q(`insert into academic_updates values ($1,60,55,'',now(),null)`);
    await q(`insert into declared_results values ($1,5,now(),null)`);
    await q(`insert into declared_result_subjects values ($1,5,'DBMS',70)`);
    await q(`insert into mock_interview_results values ('MI-'||$1,$1,'SWE',60,now())`);
    await q(`insert into lms_logins values ($1,now())`);
    await q(`insert into lms_completed_assignments values ($1,'programming-basics',now())`);
    await q(`insert into lms_solved_challenges values ($1,'two-sum',now())`);
    await q(`insert into feedback_entries (id,student_id,reference_code,category,feedback_type,title,description,experience_date,rating) values ('FB-'||$1,$1,'REF-'||$1,'Academic','Suggestion','t','d','2026-10-01',4)`);
    await q(`insert into surveys values ($1,'2026-10-01','{}','{}')`);
    await q(`insert into portal_intro values ($1,'2026-10-01',60,'')`);
  }
  await db.exec(`
    insert into model_runs (id, data_sha256, is_current) values ('00000000-0000-0000-0000-0000000000f1','abc',true);
    insert into segments values ('s1','00000000-0000-0000-0000-0000000000f1','Seg','def',2,0.25,'{}','{}','{}',7,80,0.2);
    insert into segment_members values ('s1','STU-0001'),('s1','STU-0003');
    insert into risk_trends values ('00000000-0000-0000-0000-0000000000f1','{}');
    insert into model_metrics values ('00000000-0000-0000-0000-0000000000f1','{}');
    insert into whatif_model values ('00000000-0000-0000-0000-0000000000f1','{}');
    insert into cohort_stats values ('00000000-0000-0000-0000-0000000000f1','{}');
  `);
  for (const sid of ["STU-0001", "STU-0002", "STU-0003"]) {
    await db.query(
      `insert into predictions values ($1,'00000000-0000-0000-0000-0000000000f1','High','r','m',0.5,'High',6,5,7,'Average',0.5,'High',0.5,0.5,'High',0.5,'High','{}','{}')`,
      [sid],
    );
    await db.query(`insert into whatif_inputs values ($1,'00000000-0000-0000-0000-0000000000f1','{}')`, [sid]);
    await db.query(
      `insert into recommendations (id,run_id,target_type,target_id,target_label,action,reason,owner,priority,priority_score,expected_impact,due_in_days,rule_id)
       values ('REC-'||$1,'00000000-0000-0000-0000-0000000000f1','student',$1,'l','do it','because','Faculty mentor','High',0.7,'impact',14,'rule')`,
      [sid],
    );
  }
  await db.exec(`insert into recommendations (id,run_id,target_type,target_id,target_label,action,reason,owner,priority,priority_score,expected_impact,due_in_days,rule_id)
    values ('REC-SEG','00000000-0000-0000-0000-0000000000f1','segment','s1','l','do it','because','Dean / Administrator','High',0.7,'impact',14,'rule')`);
}

async function tablesWithoutRls(query: (sql: string) => Promise<Row[]>): Promise<string[]> {
  const r = await query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                         where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity order by 1`);
  return r.map((x) => String(x.relname));
}

/* ------------------------------------------------------------------------------------------------ tests */
async function structural(db: TestDb) {
  const missing = await tablesWithoutRls((sql) => rows(db, sql));
  check("every public table has Row Level Security enabled", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : `${await count(db, "select count(*)::int c from pg_tables where schemaname='public'")} tables`);

  // prove the detector works: switch RLS off on one table, it must be reported, then restore
  await db.exec("alter table public.students disable row level security");
  const caught = await tablesWithoutRls((sql) => rows(db, sql));
  await db.exec("alter table public.students enable row level security");
  check("the RLS detector notices a table with RLS switched off", caught.includes("students"));

  const anonGrants = await count(db, `select count(*)::int c from information_schema.role_table_grants where table_schema='public' and grantee='anon'`);
  check("anon has no privileges on any public table", anonGrants === 0, `${anonGrants} grants`);
  const exposed = await count(db, `select count(*)::int c from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and has_function_privilege('anon', p.oid, 'execute')`);
  check("anon cannot execute the private helper functions", exposed === 0);
  const policies = await rows(db, `select tablename from pg_policies where schemaname='public' and 'anon' = any(roles)`);
  check("no policy applies to anon", policies.length === 0);
}

async function profiles(db: TestDb) {
  check("a login with an app role gets a profile", (await count(db, "select count(*)::int c from profiles")) === 13, "admin 1, faculty 2, hod 1, tpo 1, students 8; none for nobody / escalator");
  const nobody = await count(db, "select count(*)::int c from profiles where id = $1", [ID.nobody]);
  check("self-signup (no app metadata) gets NO profile and therefore no role", nobody === 0);
  const esc = await count(db, "select count(*)::int c from profiles where id = $1", [ID.escalator]);
  check("role in user_metadata does not grant a role (users can edit it)", esc === 0);
}

async function anonAndNobody(db: TestDb) {
  const tables = (await rows(db, "select tablename from pg_tables where schemaname='public' order by 1")).map((r) => String(r.tablename));
  let leaked: string[] = [];
  await asRole(db, null, async () => {
    for (const t of tables) {
      try {
        if ((await count(db, `select count(*)::int c from public.${t}`)) > 0) leaked.push(t);
      } catch {
        /* permission denied is also a pass */
      }
    }
  });
  check("anon reads nothing from any table", leaked.length === 0, leaked.join(","));
  leaked = [];
  await asRole(db, as.nobody, async () => {
    for (const t of tables) {
      try {
        const n = await count(db, `select count(*)::int c from public.${t}`);
        // reference data is readable by any signed-in user; everything else must be empty for a user with no role
        if (n > 0 && !["departments", "faculty", "subjects", "branch_subjects", "semesters"].includes(t)) leaked.push(t);
      } catch {
        /* denied */
      }
    }
  });
  check("a signed-in user with no role reads nothing but reference data", leaked.length === 0, leaked.join(","));
  const rpc = await asRole(db, null, () => fails(db, "select * from public.faculty_evaluation_summary()"));
  check("anon cannot call the RPCs", rpc !== null);
}

const STUDENT_TABLES = ["students", "semester_results", "backlogs", "attendance_monthly", "lecture_presence", "lms_monthly", "assignments", "faculty_remarks", "aptitude_attempts", "coding_attempts", "interview_attempts", "activities", "skill_assessments", "interventions", "academic_updates", "declared_results", "declared_result_subjects", "mock_interview_results", "lms_logins", "lms_completed_assignments", "lms_solved_challenges", "feedback_entries", "surveys", "portal_intro", "predictions", "whatif_inputs", "faculty_evaluation_receipts"];

async function students(db: TestDb) {
  await asRole(db, as.stu(1), async () => {
    const bad: string[] = [];
    for (const t of STUDENT_TABLES) {
      const col = t === "students" ? "id" : "student_id";
      const other = await count(db, `select count(*)::int c from public.${t} where ${col} <> 'STU-0001'`);
      if (other > 0) bad.push(t);
    }
    check("a student sees only their own rows in every student table", bad.length === 0, bad.join(","));
    check("a student sees their own marks", (await count(db, "select count(*)::int c from semester_results where student_id='STU-0001'")) === 1);
    check("a student cannot read another student's profile row", (await count(db, "select count(*)::int c from students where id='STU-0003'")) === 0);
    check("a student sees their own prediction and recommendation", (await count(db, "select count(*)::int c from predictions")) === 1 && (await count(db, "select count(*)::int c from recommendations")) === 1);
    check("a student does not see segment recommendations", (await count(db, "select count(*)::int c from recommendations where target_type='segment'")) === 0);
    for (const t of ["risk_trends", "segments", "segment_members", "model_runs", "cohort_stats"]) {
      check(`a student cannot read ${t}`, (await count(db, `select count(*)::int c from ${t}`)) === 0);
    }
    check("a student can read the what-if model and the model report (no personal data)", (await count(db, "select count(*)::int c from whatif_model")) === 1 && (await count(db, "select count(*)::int c from model_metrics")) === 1);
    check("a student can read their own what-if inputs and nobody else's", (await count(db, "select count(*)::int c from whatif_inputs where student_id = 'STU-0001'")) === 1 && (await count(db, "select count(*)::int c from whatif_inputs where student_id <> 'STU-0001'")) === 0);
    check("the forecast directory view shows a student only themselves", (await count(db, "select count(*)::int c from predictions_directory")) === 1 && (await rows(db, "select prediction_summary() as s"))[0].s !== null
      && Number(((await rows(db, "select public.prediction_summary() ->> 'total' as t"))[0] as { t: string }).t) === 1);
    check("a student cannot see another student's profile row via profiles", (await count(db, "select count(*)::int c from profiles")) === 1);
  });

  // writes
  await asRole(db, as.stu(1), async () => {
    await db.query("update semester_results set total = 99 where student_id = 'STU-0001'");
    await db.query("update predictions set overall = 'Low'");
    await db.query("update interventions set status = 'Completed'");
    await db.query("update attendance_monthly set lectures_attended = 10");
  });
  check("a student cannot edit marks, predictions, interventions or attendance (update touches 0 rows)",
    (await count(db, "select count(*)::int c from semester_results where total = 99")) === 0
    && (await count(db, "select count(*)::int c from predictions where overall = 'Low'")) === 0
    && (await count(db, "select count(*)::int c from interventions where status = 'Completed'")) === 0
    && (await count(db, "select count(*)::int c from attendance_monthly where lectures_attended = 10")) === 0);

  await asRole(db, as.stu(1), async () => {
    const own = await fails(db, `insert into activities (id,student_id,semester,activity_date,type,title,organizer,category,role,status,source) values ('AC-N1','STU-0001',5,'2026-11-01','event','E','O','C','R','Pending','portal')`);
    check("a student can add their own activity as Pending", own === null, own ?? "");
    check("a student cannot file an Approved activity", (await fails(db, `insert into activities (id,student_id,semester,activity_date,type,title,organizer,category,role,status,source) values ('AC-N2','STU-0001',5,'2026-11-01','event','E','O','C','R','Approved','portal')`)) !== null);
    check("a student cannot file an activity for someone else", (await fails(db, `insert into activities (id,student_id,semester,activity_date,type,title,organizer,category,role,status,source) values ('AC-N3','STU-0002',5,'2026-11-01','event','E','O','C','R','Pending','portal')`)) !== null);
    check("a student cannot forge a historical record", (await fails(db, `insert into aptitude_attempts values ('AP-X','STU-0001',5,'2026-11-01','x',5,5,5,50,1,'historical')`)) !== null);
    check("a student can record their own portal test attempt", (await fails(db, `insert into aptitude_attempts values ('AP-OK','STU-0001',5,'2026-11-01','x',5,5,5,50,1,'portal')`)) === null);
    check("a student cannot create interventions", (await fails(db, `insert into interventions (id,student_id,reason,action_plan,priority,status,follow_up_date,source,created_by) values ('INT-S','STU-0001','r','a','High','Planned','2027-01-01','app','${ID.stu(1)}')`)) !== null);
    check("a student cannot insert predictions", (await fails(db, `insert into predictions select 'STU-0002', run_id, overall, reason, mentor_id, sgpa_p, sgpa_level, pred_sgpa, sgpa_lo, sgpa_hi, sgpa_band, backlog_p, backlog_level, notready_p, ready_p, placement_level, engagement_p, engagement_level, drivers, facts from predictions limit 1 on conflict do nothing`)) !== null);
    check("a student can record their own LMS login", (await fails(db, `insert into lms_logins values ('STU-0001', now() + interval '1 second')`)) === null);
    check("a student cannot record an LMS login for someone else", (await fails(db, `insert into lms_logins values ('STU-0002', now())`)) !== null);
    check("a student can submit general feedback", (await fails(db, `insert into feedback_entries (id,student_id,reference_code,category,feedback_type,title,description,experience_date,rating) values ('FB-N','STU-0001','REF-N','A','S','t','d','2026-11-01',5)`)) === null);
    check("a student cannot mark their own feedback Resolved", (await fails(db, `insert into feedback_entries (id,student_id,reference_code,category,feedback_type,title,description,experience_date,rating,status) values ('FB-N2','STU-0001','REF-N2','A','S','t','d','2026-11-01',5,'Resolved')`)) !== null);
  });
}

async function faculty(db: TestDb) {
  await asRole(db, as.facCse, async () => {
    const ids = (await rows(db, "select id from students order by 1")).map((r) => r.id);
    check("a faculty member sees exactly their mentees", ids.includes("STU-0001") && ids.includes("STU-0002") && !ids.includes("STU-0003"), `${ids.length} students`);
    const bad: string[] = [];
    for (const t of STUDENT_TABLES) {
      const col = t === "students" ? "id" : "student_id";
      const other = await count(db, `select count(*)::int c from public.${t} where ${col} = 'STU-0003'`);
      if (other > 0) bad.push(t);
    }
    check("a faculty member sees nothing of another department's student in any table", bad.length === 0, bad.join(","));
    check("a faculty member reads models and trends", (await count(db, "select count(*)::int c from model_metrics")) === 1 && (await count(db, "select count(*)::int c from risk_trends")) === 1);
    check("a faculty member sees segment recommendations and their mentees' recommendations", (await count(db, "select count(*)::int c from recommendations where target_type='segment'")) === 1 && (await count(db, "select count(*)::int c from recommendations where target_id='STU-0003'")) === 0);
    check("a faculty member sees only their mentees in segment_members", (await count(db, "select count(*)::int c from segment_members where student_id='STU-0003'")) === 0);
    check("a faculty member can create an intervention for a mentee", (await fails(db, `insert into interventions (id,student_id,reason,action_plan,priority,status,follow_up_date,source,created_by) values ('INT-F1','STU-0001','r','a','High','Planned','2027-01-01','app','${ID.facCse}')`)) === null);
    check("a faculty member cannot create an intervention for another department's student", (await fails(db, `insert into interventions (id,student_id,reason,action_plan,priority,status,follow_up_date,source,created_by) values ('INT-F2','STU-0003','r','a','High','Planned','2027-01-01','app','${ID.facCse}')`)) !== null);
    check("a faculty member cannot create an intervention in someone else's name", (await fails(db, `insert into interventions (id,student_id,reason,action_plan,priority,status,follow_up_date,source,created_by) values ('INT-F3','STU-0001','r','a','High','Planned','2027-01-01','app','${ID.admin}')`)) !== null);
    check("a faculty member can change a mentee recommendation's status", (await fails(db, "update recommendations set status = 'accepted' where id = 'REC-STU-0001'")) === null);
    check("a faculty member cannot rewrite a recommendation's content", (await fails(db, "update recommendations set action = 'hacked' where id = 'REC-STU-0001'")) !== null);
    check("a faculty member cannot change the priority of a recommendation", (await fails(db, "update recommendations set priority = 'Low' where id = 'REC-STU-0001'")) !== null);
    await db.query("update recommendations set status = 'done' where id = 'REC-STU-0003'");
    await db.query("update academic_updates set current_score = 1");
    await db.query("update students set mentor_id = 'FAC-CSE-1' where id = 'STU-0003'");
    check("a faculty member cannot write declared results or academic updates", (await fails(db, "insert into declared_results values ('STU-0002',5,now(),null)")) !== null);
  });
  check("a faculty member's updates to another department's recommendation, marks and students touch 0 rows",
    (await count(db, "select count(*)::int c from recommendations where id = 'REC-STU-0003' and status = 'done'")) === 0
    && (await count(db, "select count(*)::int c from academic_updates where current_score = 1")) === 0
    && (await count(db, "select count(*)::int c from students where id = 'STU-0003' and mentor_id = 'FAC-CSE-1'")) === 0);
  check("the accepted status was saved with who changed it", (await count(db, `select count(*)::int c from recommendations where id='REC-STU-0001' and status='accepted' and updated_by='${ID.facCse}'`)) === 1);

  // IT faculty is the mirror image
  await asRole(db, as.facIt, async () => {
    const ids = (await rows(db, "select id from students")).map((r) => r.id);
    check("the other department's faculty sees only STU-0003", ids.length === 1 && ids[0] === "STU-0003");
  });
}

async function hodAndTpo(db: TestDb) {
  await asRole(db, as.hodCse, async () => {
    const ids = (await rows(db, "select id from students")).map((r) => r.id as string);
    check("a HOD sees every student of their own department (even ones mentored by someone else)", ids.length === 7 && !ids.includes("STU-0003"), `${ids.length} students`);
    const bad: string[] = [];
    for (const t of STUDENT_TABLES) {
      if (t === "students") continue;
      const n = await count(db, `select count(*)::int c from ${t} where student_id = 'STU-0003'`).catch(() => 0);
      if (n > 0) bad.push(t);
    }
    check("a HOD sees nothing of another department's student in any table", bad.length === 0, bad.join(","));
    check("a HOD reads their department's predictions through the forecast directory, and only theirs", (await count(db, "select count(*)::int c from predictions_directory")) > 0 && (await count(db, "select count(*)::int c from predictions_directory where student_id = 'STU-0003'")) === 0);
    check("a HOD cannot add a student or rewrite one", (await fails(db, "update students set name = 'x' where id = 'STU-0001'")) === null && (await count(db, "select count(*)::int c from students where name = 'x'")) === 0, "update is filtered to zero rows");
    check("a HOD cannot use the administrator-only add_student function", (await fails(db, "select public.add_student('Eve','CSE','A')")) !== null);
    check("a HOD cannot read login profiles of other people", (await count(db, "select count(*)::int c from profiles")) === 1);
  });
  await asRole(db, as.tpo, async () => {
    check("a TPO sees every student in every department", (await count(db, "select count(*)::int c from students")) === 8);
    check("a TPO reads placement data of any student", (await count(db, "select count(*)::int c from aptitude_attempts")) >= 0 && (await fails(db, "select * from aptitude_attempts")) === null);
    check("a TPO cannot use the administrator-only add_student function", (await fails(db, "select public.add_student('Eve','CSE','A')")) !== null);
    check("a TPO cannot read the faculty evaluation summary (admin only)", (await fails(db, "select * from public.faculty_evaluation_summary()")) !== null);
    check("a TPO cannot see other people's login profiles", (await count(db, "select count(*)::int c from profiles")) === 1);
  });
}

async function feedbackWindows(db: TestDb) {
  const open = "insert into feedback_windows (branch_code, is_open, message) values ('CSE', true, 'Please share your feedback') on conflict (branch_code) do update set is_open = excluded.is_open";
  await asRole(db, as.hodCse, async () => {
    check("a HOD can open feedback for their own department", (await fails(db, open)) === null);
    check("a HOD cannot open feedback for another department", (await fails(db, "insert into feedback_windows (branch_code, is_open) values ('IT', true)")) !== null);
    check("the database records who changed the window, not the client", (await rows(db, "select updated_by from feedback_windows where branch_code = 'CSE'"))[0].updated_by === ID.hodCse);
    check("a HOD can close it again", (await fails(db, "update feedback_windows set is_open = false where branch_code = 'CSE'")) === null);
    await db.query("update feedback_windows set is_open = true where branch_code = 'CSE'");
  });
  await asRole(db, as.stu(1), async () => {
    check("a CSE student sees the CSE feedback window", (await count(db, "select count(*)::int c from feedback_windows where branch_code = 'CSE' and is_open")) === 1);
    check("a student cannot change a feedback window", (await fails(db, "update feedback_windows set is_open = false where branch_code = 'CSE'")) === null && (await count(db, "select count(*)::int c from feedback_windows where is_open")) === 1, "update is filtered to zero rows");
    check("a student cannot open feedback for anyone", (await fails(db, "insert into feedback_windows (branch_code, is_open) values ('CSE', true) on conflict (branch_code) do update set is_open = true")) !== null);
  });
  await asRole(db, as.stu(3), async () => {
    check("an IT student does not see the CSE window", (await count(db, "select count(*)::int c from feedback_windows")) === 0);
  });
  await asRole(db, as.tpo, async () => {
    check("a TPO cannot see or change feedback windows", (await count(db, "select count(*)::int c from feedback_windows")) === 0 && (await fails(db, "insert into feedback_windows (branch_code, is_open) values ('CSE', true)")) !== null);
  });
  await asRole(db, null, async () => {
    check("anonymous visitors cannot read feedback windows", (await fails(db, "select * from feedback_windows")) !== null);
  });
}

async function attendance(db: TestDb) {
  await asRole(db, as.facCse, async () => {
    const e = await fails(db, `insert into attendance_sessions (id,title,subject,department,year,section,session_date,start_time,end_time,submitted,created_by) values ('ATT-1','L','DBMS','Computer Science','3rd year','A','2026-12-01','10:00','11:00',false,'${ID.facCse}')`);
    check("a faculty member can create an attendance session", e === null, e ?? "");
    await db.query(`insert into attendance_records values ('ATT-1','STU-0001','present'),('ATT-1','STU-0002','absent')`);
    check("a faculty member can mark records of their own session", (await count(db, "select count(*)::int c from attendance_records where session_id='ATT-1'")) === 2);
    check("a faculty member cannot create a session in someone else's name", (await fails(db, `insert into attendance_sessions (id,title,subject,department,year,session_date,start_time,end_time,created_by) values ('ATT-2','L','DBMS','x','y','2026-12-01','10:00','11:00','${ID.admin}')`)) !== null);
  });
  await asRole(db, as.stu(1), async () => {
    check("a student cannot see a draft (unsubmitted) session or its records", (await count(db, "select count(*)::int c from attendance_sessions")) === 0 && (await count(db, "select count(*)::int c from attendance_records")) === 0);
  });
  await asRole(db, as.facCse, async () => {
    const created = await fails(db, `select public.create_attendance_session('{"id":"ATT-RPC","title":"L","subject":"DBMS","department":"Computer Science","year":"3rd year","section":"A","session_date":"2026-12-02","start_time":"10:00","end_time":"11:00","created_by":"${ID.admin}"}'::jsonb, '[{"student_id":"STU-0001"},{"student_id":"STU-0002","status":"present"}]'::jsonb)`);
    check("a faculty member can create a session and its register atomically", created === null, created ?? "");
    check("the owner of an RPC-created session is the caller, not what the client sent", (await count(db, `select count(*)::int c from attendance_sessions where id='ATT-RPC' and created_by='${ID.facCse}'`)) === 1 && (await count(db, "select count(*)::int c from attendance_records where session_id='ATT-RPC'")) === 2);
    check("a failing register rolls back the whole session", (await fails(db, `select public.create_attendance_session('{"id":"ATT-BAD","title":"L","subject":"S","department":"d","year":"y","session_date":"2026-12-02","start_time":"10:00","end_time":"11:00"}'::jsonb, '[{"student_id":"STU-9999"}]'::jsonb)`)) !== null
      && (await count(db, "select count(*)::int c from attendance_sessions where id='ATT-BAD'")) === 0);
  });
  await asRole(db, as.stu(1), async () => {
    check("a student cannot create attendance sessions through the RPC", (await fails(db, `select public.create_attendance_session('{"id":"ATT-STU","title":"L","subject":"S","department":"d","year":"y","session_date":"2026-12-02","start_time":"10:00","end_time":"11:00"}'::jsonb, '[]'::jsonb)`)) !== null);
  });
  await asRole(db, null, async () => {
    check("anon cannot call create_attendance_session", (await fails(db, `select public.create_attendance_session('{}'::jsonb, '[]'::jsonb)`)) !== null);
  });
  await asRole(db, as.facCse, async () => { await db.query("update attendance_sessions set submitted = true where id = 'ATT-1'"); });
  await asRole(db, as.stu(1), async () => {
    check("once submitted a student sees the session and only their own record", (await count(db, "select count(*)::int c from attendance_sessions")) === 1 && (await count(db, "select count(*)::int c from attendance_records")) === 1);
    check("a student cannot change their attendance record", (await fails(db, "update attendance_records set status='present' where student_id='STU-0001'")) === null
      && (await count(db, "select count(*)::int c from attendance_records where status = 'present'")) === 1, "(still the original value)");
  });
  await asRole(db, as.facIt, async () => {
    check("another faculty member cannot see the session", (await count(db, "select count(*)::int c from attendance_sessions")) === 0);
  });
  await asRole(db, as.stu(2), async () => {
    check("a student sees their own absence, not their classmate's", (await rows(db, "select status from attendance_records")).map((r) => r.status).join() === "absent");
  });
}

async function views(db: TestDb) {
  await asRole(db, as.facCse, async () => {
    check("the forecast view shows a faculty member only their mentees", (await count(db, "select count(*)::int c from predictions_directory")) === 2 && (await count(db, "select count(*)::int c from predictions_directory where student_id = 'STU-0003'")) === 0);
    const total = Number(((await rows(db, "select public.prediction_summary() ->> 'total' as t"))[0] as { t: string }).t);
    check("the forecast summary counts only the faculty member's mentees", total === 2, `total ${total}`);
    const filtered = Number(((await rows(db, "select public.prediction_summary('IT') ->> 'total' as t"))[0] as { t: string }).t);
    check("filtering the summary by another department finds nothing for them", filtered === 0);
    const rec = (await rows(db, "select public.recommendation_summary() as s"))[0].s as { total: number; by_target_type: Record<string, number> };
    check("the recommendation summary covers their mentees' and the segment recommendations", rec.total === 3 && rec.by_target_type.segment === 1, JSON.stringify(rec));
  });
  await asRole(db, as.admin, async () => {
    check("the forecast view shows an admin everyone", (await count(db, "select count(*)::int c from predictions_directory")) === 3);
    const s = (await rows(db, "select public.prediction_summary() as s"))[0].s as { total: number; by_department: { branch_code: string }[] };
    check("the admin summary has a row per department", s.total === 3 && s.by_department.length === 2, JSON.stringify(s.by_department.map((d) => d.branch_code)));
  });
  await asRole(db, null, async () => {
    check("anon cannot read the forecast view or its summaries", (await fails(db, "select count(*) from predictions_directory")) !== null && (await fails(db, "select public.prediction_summary()")) !== null && (await fails(db, "select public.recommendation_summary()")) !== null);
  });
  await asRole(db, as.nobody, async () => {
    check("a signed-in user with no role sees an empty forecast view", (await count(db, "select count(*)::int c from predictions_directory")) === 0);
  });
}

async function admin(db: TestDb) {
  await asRole(db, as.admin, async () => {
    check("admin sees every student", (await count(db, "select count(*)::int c from students")) === 8);
    check("admin sees every profile", (await count(db, "select count(*)::int c from profiles")) === 13);
    check("admin can declare a result", (await fails(db, "insert into declared_results values ('STU-0002',5,now(),null)")) === null);
    check("admin can write an academic update", (await fails(db, "insert into academic_updates values ('STU-0002',70,60,'',now(),null)")) === null);
    check("admin can approve an activity", (await fails(db, "update activities set status = 'Rejected' where id = 'AC-STU-0001'")) === null);
    check("admin can write their own settings and not someone else's", (await fails(db, `insert into admin_settings (user_id) values ('${ID.admin}')`)) === null && (await fails(db, `insert into admin_settings (user_id) values ('${ID.facCse}')`)) !== null);
    check("admin cannot rewrite a recommendation's content", (await fails(db, "update recommendations set reason = 'x' where id = 'REC-STU-0001'")) !== null);
    check("admin cannot insert predictions through the API", (await fails(db, `insert into model_runs (data_sha256) values ('x')`)) !== null);
  });
  await asRole(db, as.facCse, async () => {
    check("a faculty member can keep their own settings", (await fails(db, `insert into admin_settings (user_id) values ('${ID.facCse}')`)) === null);
  });
  await asRole(db, as.stu(1), async () => {
    check("a student cannot keep admin settings", (await fails(db, `insert into admin_settings (user_id) values ('${ID.stu(1)}')`)) !== null);
  });
}

async function evaluations(db: TestDb) {
  await asRole(db, as.stu(1), async () => {
    const ok = await fails(db, "select public.submit_faculty_evaluation('CS401',4,4,4,4,4,'Good','Clear lectures','2026-10-10','FE-1')");
    check("a student can submit an anonymous faculty evaluation for a subject of their semester", ok === null, ok ?? "");
    const again = await fails(db, "select public.submit_faculty_evaluation('CS401',5,5,5,5,5,'x','y','2026-10-10','FE-2')");
    check("a second evaluation of the same subject is refused", again !== null && /already/i.test(again), again ?? "");
    const wrong = await fails(db, "select public.submit_faculty_evaluation('IT401',5,5,5,5,5,'x','y','2026-10-10','FE-3')");
    check("a student cannot evaluate a subject outside their semester", wrong !== null);
    check("the student sees a receipt but not the evaluation", (await count(db, "select count(*)::int c from faculty_evaluation_receipts")) === 1 && (await count(db, "select count(*)::int c from faculty_evaluations")) === 0);
    check("a student cannot insert evaluations directly", (await fails(db, "insert into faculty_evaluations (subject_code,faculty_name,rating) values ('CS401','x',1)")) !== null);
    check("a student cannot call the staff summary", (await fails(db, "select * from public.faculty_evaluation_summary()")) !== null);
  });
  const columns = (await rows(db, "select column_name from information_schema.columns where table_name='faculty_evaluations'")).map((r) => String(r.column_name));
  check("the evaluation table has no student identifier", !columns.some((c) => /student|user|profile/.test(c)), columns.join(","));
  await asRole(db, as.admin, async () => {
    check("staff see no summary while fewer than 5 students have evaluated", (await rows(db, "select * from public.faculty_evaluation_summary()")).length === 0);
  });
  for (const n of [2, 4, 5, 6]) {
    await asRole(db, as.stu(n), async () => { await db.query("select public.submit_faculty_evaluation('CS401',3,3,3,3,3,'','',null,'FE-'||$1)", [`S${n}`]); });
  }
  await asRole(db, as.facCse, async () => {
    const summary = await rows(db, "select * from public.faculty_evaluation_summary()");
    check("staff see the aggregate once 5 students have evaluated", summary.length === 1 && Number(summary[0].responses) === 5, JSON.stringify(summary[0] ?? {}));
    check("staff cannot read individual evaluations", (await count(db, "select count(*)::int c from faculty_evaluations")) === 0);
  });
}

async function realDatabase(url: string) {
  console.log("\n--- structural checks against the real database (read-only) ---");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const q = async (sql: string) => (await client.query<Row>(sql)).rows;
    const exists = await q("select count(*)::int c from pg_tables where schemaname='public' and tablename='students'");
    if (Number(exists[0].c) === 0) {
      check("real database: schema is installed", false, "run `npm run db:migrate` first");
      return;
    }
    const missing = await tablesWithoutRls(q);
    check("real database: every public table has RLS enabled", missing.length === 0, missing.join(","));
    const grants = await q("select count(*)::int c from information_schema.role_table_grants where table_schema='public' and grantee='anon'");
    check("real database: anon has no privileges on public tables", Number(grants[0].c) === 0);
    const anonPolicies = await q("select count(*)::int c from pg_policies where schemaname='public' and 'anon' = any(roles)");
    check("real database: no policy applies to anon", Number(anonPolicies[0].c) === 0);
  } finally {
    await client.end();
  }
}

async function main() {
  loadEnv();
  const db = await createTestDb();
  await structural(db);
  await loadFixture(db);
  await profiles(db);
  await anonAndNobody(db);
  await students(db);
  await faculty(db);
  await hodAndTpo(db);
  await feedbackWindows(db);
  await attendance(db);
  await views(db);
  await admin(db);
  await evaluations(db);
  if (process.env.SUPABASE_DB_URL) await realDatabase(normalizeDbUrl(process.env.SUPABASE_DB_URL)!);
  console.log(failures ? `\n${failures} RLS CHECKS FAILED` : "\nALL RLS TESTS PASSED");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
