/**
 * Writes the executive brief as a PowerPoint file from the live database.   npm run build:brief
 * Output: data/brief/growtrack-executive-brief.pptx (git-ignored). Needs SUPABASE_DB_URL; reads only, never writes.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import PptxGenJS from "pptxgenjs";
import { loadEnv, normalizeDbUrl } from "./db/env";
import { buildBrief, totalSeconds, type BriefInputs } from "../lib/brief";
import { drawDeck } from "../lib/brief-pptx";
import { toStored } from "../lib/data/recommendations";
import type { ModelMetricsFile, PredictionSummary, RecommendationSummary, RiskTrendsFile, SegmentRecord } from "../lib/ml-types";

async function main() {
  loadEnv();
  const url = normalizeDbUrl(process.env.SUPABASE_DB_URL);
  if (!url) {
    console.error("SUPABASE_DB_URL is not set. Add it to .env.local (server-only) and run again.");
    process.exit(2);
  }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const one = async <T>(sql: string) => (await client.query(sql)).rows[0] as T;
    const summary = (await one<{ s: PredictionSummary }>("select public.prediction_summary(null, null, null) as s")).s;
    const recs = (await one<{ s: RecommendationSummary }>("select public.recommendation_summary(null) as s")).s;
    const trends = (await one<{ data: RiskTrendsFile }>("select data from public.risk_trends limit 1")).data;
    const metrics = (await one<{ data: ModelMetricsFile }>("select data from public.model_metrics limit 1")).data;
    const segRows = (await client.query("select * from public.segments order by member_count desc")).rows;
    const segments: Omit<SegmentRecord, "members">[] = segRows.map((s) => ({
      id: s.id, label: s.label, definition: s.definition, count: s.member_count, share_of_students: Number(s.share_of_students), by_department: s.by_department,
      department_lift: s.department_lift, mean_risk: s.mean_risk, mean_cgpa: s.mean_cgpa === null ? null : Number(s.mean_cgpa),
      mean_attendance: s.mean_attendance === null ? null : Number(s.mean_attendance), overall_high_share: s.overall_high_share === null ? null : Number(s.overall_high_share),
    }));
    const recRows = async (where: string) => (await client.query(`select * from public.recommendations where ${where} order by priority_score desc, id limit 6`)).rows.map(toStored as never) as ReturnType<typeof toStored>[];
    const inputs: BriefInputs = {
      summary, recs, trends, metrics, segments,
      topActions: (await recRows("status = 'open' and priority = 'Critical' and target_type = 'student'")).slice(0, 3),
      segmentActions: await recRows("target_type = 'segment'"),
    };
    const slides = buildBrief(inputs);
    const pptx = new PptxGenJS();
    drawDeck(pptx, slides);
    const dir = path.resolve(__dirname, "..", "data", "brief");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "growtrack-executive-brief.pptx");
    await pptx.writeFile({ fileName: file });
    console.log(`wrote ${path.relative(process.cwd(), file)}: ${slides.length} slides, about ${Math.round(totalSeconds(slides) / 6) / 10} minutes`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
