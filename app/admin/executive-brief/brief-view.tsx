"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Timer } from "lucide-react";
import { DataState, PageHeader } from "@/components/forecast/ui";
import { useData } from "@/lib/data/hooks";
import { fetchModelMetrics, fetchRiskTrends, fetchSegments } from "@/lib/data/insights";
import { fetchPredictionSummary } from "@/lib/data/predictions";
import { fetchRecommendationSummary, fetchRecommendations } from "@/lib/data/recommendations";
import { buildBrief, totalSeconds, type BriefInputs, type Slide } from "@/lib/brief";

async function fetchInputs(db: Parameters<typeof fetchPredictionSummary>[0]): Promise<BriefInputs> {
  const [summary, recs, trends, metrics, segments, top, seg] = await Promise.all([
    fetchPredictionSummary(db, {}), fetchRecommendationSummary(db), fetchRiskTrends(db), fetchModelMetrics(db), fetchSegments(db),
    fetchRecommendations(db, { status: "open", priority: "Critical", targetType: "student" }, 0, 3),
    fetchRecommendations(db, { targetType: "segment" }, 0, 6),
  ]);
  return { summary, recs, trends, metrics, segments, topActions: top.rows, segmentActions: seg.rows };
}

/** The executive brief, drawn from the loaded forecast. Arrow keys move between slides; the same slides can be downloaded as a PowerPoint file. */
export function BriefView() {
  const inputs = useData(["brief-inputs"], fetchInputs, { revalidateOnFocus: false });
  return (
    <>
      <PageHeader eyebrow="EXECUTIVE BRIEF" title="Four-minute brief" subtitle="Every number below comes from the current forecast, so the story updates when the data does. Use the arrow keys to move between slides." />
      <DataState state={inputs} skeletonRows={4}>{(i) => <Deck inputs={i} />}</DataState>
    </>
  );
}

function Deck({ inputs }: { inputs: BriefInputs }) {
  const slides = useMemo(() => buildBrief(inputs), [inputs]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const go = useCallback((n: number) => setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + n))), [slides.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  async function download() {
    setBusy(true);
    try {
      const [{ default: PptxGenJS }, { drawDeck }] = await Promise.all([import("pptxgenjs"), import("@/lib/brief-pptx")]);
      const pptx = new PptxGenJS();
      drawDeck(pptx, slides);
      await pptx.writeFile({ fileName: "growtrack-executive-brief.pptx" });
    } finally {
      setBusy(false);
    }
  }

  const s = slides[index];
  const minutes = Math.round(totalSeconds(slides) / 6) / 10;
  return (
    <section aria-label="Slides">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-[14px] text-[#4b564e]"><Timer size={16} aria-hidden="true" /> {slides.length} slides · about {minutes} minutes</p>
        <button type="button" onClick={download} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-[#28684e] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#1f5340] disabled:opacity-60">
          <Download size={16} aria-hidden="true" /> {busy ? "Preparing…" : "Download PowerPoint"}
        </button>
      </div>
      <SlideCard slide={s} index={index} total={slides.length} />
      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" onClick={() => go(-1)} disabled={index === 0} className="inline-flex items-center gap-1.5 rounded-md border border-[#cfd8cd] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#1f2c24] disabled:opacity-40"><ChevronLeft size={16} aria-hidden="true" /> Previous</button>
        <div className="flex gap-1.5" role="tablist" aria-label="Slides">
          {slides.map((x, i) => <button key={x.id} type="button" role="tab" aria-selected={i === index} aria-label={`Slide ${i + 1}: ${x.title}`} onClick={() => setIndex(i)} className={`h-2.5 w-2.5 rounded-full ${i === index ? "bg-[#28684e]" : "bg-[#cfd8cd]"}`} />)}
        </div>
        <button type="button" onClick={() => go(1)} disabled={index === slides.length - 1} className="inline-flex items-center gap-1.5 rounded-md border border-[#cfd8cd] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#1f2c24] disabled:opacity-40">Next <ChevronRight size={16} aria-hidden="true" /></button>
      </div>
      <p className="mt-4 rounded-md bg-[#f1f7f3] px-4 py-3 text-[14px] leading-6 text-[#1f3a2c]"><span className="font-semibold">Say: </span>{s.say} <span className="text-[#4b564e]">(about {s.seconds} seconds)</span></p>
    </section>
  );
}

function SlideCard({ slide, index, total }: { slide: Slide; index: number; total: number }) {
  return (
    <article className="min-h-[420px] rounded-md border border-[#dfe5dc] bg-white p-7 shadow-[0_4px_14px_rgba(16,24,40,0.08)] sm:p-9">
      <p className="text-[12px] font-bold uppercase tracking-[1.8px] text-[#2f6a4f]">{slide.kicker}</p>
      <h2 className="mt-2 text-[28px] font-semibold leading-tight text-[#1f2c24] sm:text-[34px]">{slide.title}</h2>
      {slide.stats && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {slide.stats.map((st) => (
            <div key={st.label} className="rounded-md border border-[#e2e7df] bg-[#fafbf9] p-4">
              <p className="text-[13px] font-medium text-[#4b564e]">{st.label}</p>
              <p className="mt-1 text-[32px] font-semibold text-[#193f31]">{st.value}</p>
              {st.note && <p className="mt-1 text-[13px] text-[#4b564e]">{st.note}</p>}
            </div>
          ))}
        </div>
      )}
      {slide.table && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[15px]">
            <thead><tr className="bg-[#28684e] text-[13px] uppercase tracking-[0.8px] text-white">{slide.table.head.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{slide.table.rows.map((r) => <tr key={r[0]} className="border-b border-[#eef1ec]">{r.map((c, k) => <td key={k} className={`px-4 py-3 ${k === 0 ? "font-semibold text-[#1f2c24]" : "tabular-nums text-[#1f2c24]"}`}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      {slide.bullets && <ul className="mt-6 list-disc space-y-2.5 pl-6 text-[17px] leading-7 text-[#1f2c24]">{slide.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
      {slide.footnote && <p className="mt-6 text-[14px] italic text-[#6b4a0a]">{slide.footnote}</p>}
      <p className="mt-8 text-right text-[13px] text-[#4b564e]">{index + 1} / {total}</p>
    </article>
  );
}
