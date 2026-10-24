/** In-browser SQLite (sql.js) used to run and grade SQL-writing questions. */
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { SQL_SCHEMA } from '@student/data/codingQuestions'

let sqlPromise: Promise<SqlJsStatic> | null = null
const getSql = () => (sqlPromise ??= initSqlJs({ locateFile: () => '/sql-wasm.wasm' }))

export interface QueryResult { columns: string[]; rows: unknown[][] }

async function freshDb(): Promise<Database> {
  const SQL = await getSql()
  const db = new SQL.Database()
  db.run(SQL_SCHEMA)
  return db
}

/** Only a single read-only SELECT is allowed. */
function assertSelect(sql: string) {
  const s = sql.trim().replace(/;+\s*$/, '')
  if (!s) throw new Error('Write a query first.')
  if (s.includes(';')) throw new Error('Only one statement is allowed.')
  if (!/^(select|with)\b/i.test(s)) throw new Error('Only SELECT queries are allowed.')
  return s
}

export async function runQuery(sql: string): Promise<QueryResult> {
  const db = await freshDb()
  try {
    const res = db.exec(assertSelect(sql))
    return res.length ? { columns: res[0].columns, rows: res[0].values as unknown[][] } : { columns: [], rows: [] }
  } finally { db.close() }
}

const norm = (v: unknown) => (typeof v === 'number' ? Math.round(v * 10000) / 10000 : v)

/**
 * Grade by comparing result rows with the expected query's rows.
 * Column names/aliases are ignored. Row order only matters when the expected query has ORDER BY.
 */
export async function gradeSql(studentSql: string, expectedSql: string): Promise<{ correct: boolean; message: string }> {
  let mine: QueryResult
  try { mine = await runQuery(studentSql) } catch (e) { return { correct: false, message: `Query error: ${(e as Error).message}` } }
  const exp = await runQuery(expectedSql)
  const key = (r: unknown[]) => JSON.stringify(r.map(norm))
  if (mine.rows.length !== exp.rows.length) return { correct: false, message: `Your query returned ${mine.rows.length} row(s); ${exp.rows.length} expected.` }
  if (mine.columns.length !== exp.columns.length) return { correct: false, message: `Your query returned ${mine.columns.length} column(s); ${exp.columns.length} expected.` }
  const ordered = /\border\s+by\b/i.test(expectedSql)
  const a = mine.rows.map(key), b = exp.rows.map(key)
  const ok = ordered ? a.every((x, i) => x === b[i]) : [...a].sort().every((x, i) => x === [...b].sort()[i])
  return ok ? { correct: true, message: 'Result matches the expected output.' } : { correct: false, message: ordered && [...a].sort().join() === [...b].sort().join() ? 'Right rows, but in the wrong order.' : 'The rows returned do not match the expected result.' }
}
