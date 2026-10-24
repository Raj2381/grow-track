import type { WhatIfInputs, WhatIfModel, StudentFeatureMap } from "@/lib/whatif";
import { DataError, friendlyMessage, unwrap, type Db } from "./db";

export type WhatIfStudent = StudentFeatureMap;
type Schema = { numeric: string[]; categorical: string[] };

export async function fetchWhatIfModel(db: Db): Promise<{ model: WhatIfModel; schema: Schema }> {
  const row = unwrap(await db.from("whatif_model").select("data").limit(1).single());
  const data = row.data as unknown as WhatIfModel & { input_schema: Schema };
  return { model: data, schema: data.input_schema };
}

/** One student's what-if features, shaped for lib/whatif.ts. */
export async function fetchWhatIfInputs(db: Db, studentId: string): Promise<StudentFeatureMap> {
  const [inputs, modelRow] = await Promise.all([
    db.from("whatif_inputs").select("data").eq("student_id", studentId).single(),
    db.from("whatif_model").select("data").limit(1).single(),
  ]);
  if (inputs.error) throw new DataError(friendlyMessage(inputs.error), inputs.error.code);
  const schema = (unwrap(modelRow).data as unknown as { input_schema: Schema }).input_schema;
  const row = inputs.data!.data as unknown as { n: number[]; c: string[]; aux: Record<string, number> };
  const values: Record<string, number | string> = {};
  schema.numeric.forEach((name, i) => (values[name] = row.n[i]));
  schema.categorical.forEach((name, i) => (values[name] = row.c[i]));
  return { values, aux: row.aux };
}

export type { WhatIfInputs, WhatIfModel };
