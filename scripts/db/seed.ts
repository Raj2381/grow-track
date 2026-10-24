/** Loads the history tables through a Sink, then checks the counts against the source. */
import { buildSeed, MIXED_SOURCE_TABLES, type TableSpec } from "./seed-data";
import type { Sink } from "./sink";

export type SeedReport = { table: string; expected: number; loaded: number; ok: boolean }[];

export async function runSeed(sink: Sink, log: (line: string) => void = () => {}, spec: TableSpec[] = buildSeed()): Promise<SeedReport> {
  const report: SeedReport = [];
  for (const t of spec) {
    const started = Date.now();
    await sink.upsert(t.table, t.rows, t.conflict, t.mode);
    const mixed = MIXED_SOURCE_TABLES.includes(t.table);
    const loaded = await sink.count(t.table, mixed ? { column: "source", value: "historical" } : undefined);
    const ok = loaded === t.rows.length;
    report.push({ table: t.table, expected: t.rows.length, loaded, ok });
    log(`${ok ? "ok  " : "FAIL"} ${t.table.padEnd(20)} ${String(loaded).padStart(7)} / ${String(t.rows.length).padEnd(7)} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  }
  return report;
}
