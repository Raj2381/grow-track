"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSWRConfig } from "swr";
import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fetchPredictionDetail } from "@/lib/data/predictions";
import { fetchWhatIfModel } from "@/lib/data/whatif";
import { updateRecommendation } from "@/lib/data/recommendations";
import { useData, useDb } from "@/lib/data/hooks";
import type { RecStatus } from "@/lib/ml-types";
import { DriverList } from "./drivers";
import { OutcomeCard } from "./outcome-card";
import { RecommendationCard } from "./recommendation-card";
import { WhatIfPanel } from "./whatif-panel";
import { DataState, LevelBadge, OUTCOME_META, OUTCOME_ORDER, Panel, SyntheticNote } from "./ui";

/** The drill-down for one student: forecast, why, facts, what-if and the actions to take. */
export function StudentSheet({ studentId, onClose, canEdit }: { studentId: string | null; onClose: () => void; canEdit: boolean }) {
  return (
    <Sheet open={studentId !== null} onOpenChange={(open) => !open && onClose()}>
      {/* inline width: the shadcn base classes target data-side and would beat a plain utility class */}
      <SheetContent side="right" style={{ width: "min(100vw, 680px)", maxWidth: "none" }} className="gap-0 overflow-y-auto overflow-x-hidden bg-white p-0 text-[#252f28]">
        {studentId && <SheetBody studentId={studentId} canEdit={canEdit} />}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({ studentId, canEdit }: { studentId: string; canEdit: boolean }) {
  const db = useDb();
  const { mutate } = useSWRConfig();
  const detail = useData(["detail", studentId], (d) => fetchPredictionDetail(d, studentId));
  const whatIfModel = useData(["whatif-model"], fetchWhatIfModel, { revalidateOnFocus: false });
  const model = whatIfModel.data?.model;
  const facts = detail.data?.prediction.facts;
  const factList = useMemo(() => !facts ? [] : [
    ["CGPA", facts.cgpa.toFixed(2)], ["Last SGPA", facts.sgpa_last.toFixed(2)],
    ["Attendance", `${facts.att.toFixed(0)}% (${facts.att_change >= 0 ? "+" : ""}${facts.att_change.toFixed(0)} pts)`],
    ["Active backlogs", String(facts.backlogs)], ["Assignments submitted", `${facts.submit_pct.toFixed(0)}%`],
    ["LMS logins / month", facts.logins.toFixed(0)], ["Aptitude", facts.aptitude_attempts ? `${facts.aptitude.toFixed(0)}%` : "not taken"],
    ["Coding", facts.coding_attempts ? `${facts.coding.toFixed(0)}%` : "not taken"], ["Mock interview", facts.interview_attempts ? facts.interview.toFixed(0) : "not taken"],
    ["Success score (Round 1)", facts.success_score.toFixed(0)],
  ] as [string, string][], [facts]);

  async function change(id: string, patch: { status?: RecStatus; assignedTo?: string | null }) {
    await updateRecommendation(db, id, patch);
    await Promise.all([detail.mutate(), mutate((key) => Array.isArray(key) && key[0] === "gt" && (key[1] === "recs" || key[1] === "rec-summary"))]);
  }

  return (
    <DataState state={detail} skeletonRows={8}>
      {(d) => (
        <>
          <SheetHeader className="gap-1 border-b border-[#edf0eb] bg-[#fbfcfa] p-5 pr-14">
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle className="text-[18px] font-semibold tracking-[-0.4px] text-[#1f2c24]">{d.summary.name}</SheetTitle>
              <LevelBadge level={d.prediction.overall} suffix="overall risk" />
            </div>
            <SheetDescription className="text-[14px] text-[#4b564e]">
              {d.summary.student_id} · {d.summary.department} · Section {d.summary.section} · mentor {d.summary.mentor_id}
            </SheetDescription>
            {d.prediction.overall !== "Low" && <p className="mt-1.5 text-[14.5px] leading-5 text-[#46564a]"><span className="font-semibold">Main reason: </span>{d.prediction.reason}</p>}
            <div className="mt-2 flex flex-wrap gap-4 text-[14px] font-semibold text-[#28684e]">
              <Link href={`/student/dashboard/student/${studentId}`} className="inline-flex items-center gap-1 hover:underline">Student portal <ExternalLink size={11} aria-hidden="true" /></Link>
              <Link href={`/student/dashboard/student/${studentId}/forecast`} className="inline-flex items-center gap-1 hover:underline">What the student sees <ExternalLink size={11} aria-hidden="true" /></Link>
            </div>
          </SheetHeader>

          <div className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {OUTCOME_ORDER.map((k) => <OutcomeCard key={k} outcome={k} pred={d.prediction[k]} note={k === "engagement" ? "Our least certain forecast: treat it as a prompt for a conversation." : undefined} />)}
            </div>

            <Panel title="Why: the drivers" subtitle="Largest effects first, in the student's own numbers">
              <div className="space-y-5">
                {OUTCOME_ORDER.map((k) => (
                  <div key={k}>
                    <h4 className="mb-2 text-[14.5px] font-semibold text-[#252f28]">{OUTCOME_META[k].label}</h4>
                    <DriverList drivers={d.prediction[k].drivers} />
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Key facts at the end of semester 5">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {factList.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[13px] text-[#556057]">{k}</dt>
                    <dd className="text-[14.5px] font-semibold text-[#252f28]">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel title="What if…?" subtitle="Move an input and see how the forecast would change">
              {model && d.whatIf ? <WhatIfPanel key={studentId} model={model} student={d.whatIf} /> : <p className="text-[14px] text-[#556057]">{whatIfModel.error ?? "The what-if model is not available for this student."}</p>}
            </Panel>

            <Panel title={`Recommended actions (${d.recommendations.length})`} subtitle={canEdit ? "Move each through open, accepted and done; the change is saved for everyone" : "Read only"}>
              {d.recommendations.length === 0 ? (
                <p className="text-[14px] text-[#556057]">No action is recommended: nothing in this student&apos;s forecast calls for one.</p>
              ) : (
                <div className="space-y-3">
                  {d.recommendations.map((r) => <RecommendationCard key={r.id} rec={r} canEdit={canEdit} compact onUpdate={(patch) => change(r.id, patch)} />)}
                </div>
              )}
            </Panel>
            <SyntheticNote />
          </div>
        </>
      )}
    </DataState>
  );
}
