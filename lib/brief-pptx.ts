/** Writes the brief (lib/brief.ts) as a PowerPoint deck. Used by `npm run build:brief` (Node) and the page's download button (browser). */
import type PptxGenJS from "pptxgenjs";
import { totalSeconds, type Slide } from "./brief";

const C = { dark: "193F31", mid: "28684E", soft: "EAF3EE", ink: "252F28", grey: "6D786F", line: "E2E7DF", warn: "7A5A14" };

export function drawDeck(pptx: PptxGenJS, slides: Slide[]) {
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.title = "GrowTrack executive brief";
  pptx.author = "GrowTrack";
  slides.forEach((s, index) => {
    const slide = pptx.addSlide();
    const first = index === 0;
    slide.background = { color: first ? C.dark : "F5F7F4" };
    const ink = first ? "FFFFFF" : C.ink;
    slide.addText(s.kicker.toUpperCase(), { x: 0.6, y: 0.35, w: 12, h: 0.3, fontSize: 11, bold: true, color: first ? "B5D7BD" : C.mid, charSpacing: 2 });
    slide.addText(s.title, { x: 0.6, y: 0.7, w: 12.1, h: first ? 1.6 : 0.9, fontSize: first ? 40 : 28, bold: true, color: ink, fontFace: "Calibri", valign: "top" });
    let y = first ? 2.6 : 1.8;

    if (s.stats?.length) {
      const w = 12.1 / s.stats.length;
      s.stats.forEach((st, k) => {
        slide.addShape(pptx.ShapeType.roundRect, { x: 0.6 + k * w, y, w: w - 0.2, h: 1.55, fill: { color: "FFFFFF" }, line: { color: C.line, width: 1 }, rectRadius: 0.06 });
        slide.addText(st.label, { x: 0.8 + k * w, y: y + 0.12, w: w - 0.6, h: 0.35, fontSize: 11, color: C.grey, bold: true });
        slide.addText(st.value, { x: 0.8 + k * w, y: y + 0.45, w: w - 0.6, h: 0.65, fontSize: 30, bold: true, color: C.dark });
        if (st.note) slide.addText(st.note, { x: 0.8 + k * w, y: y + 1.08, w: w - 0.6, h: 0.4, fontSize: 9.5, color: C.grey });
      });
      y += 1.85;
    }
    if (s.table) {
      const head = s.table.head.map((h) => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: C.mid }, fontSize: 12 } }));
      const rows = s.table.rows.map((r) => r.map((c, k) => ({ text: c, options: { fontSize: 12, color: C.ink, bold: k === 0, fill: { color: "FFFFFF" } } })));
      slide.addTable([head, ...rows], { x: 0.6, y, w: 12.1, border: { type: "solid", color: C.line, pt: 1 }, rowH: 0.42 });
      y += 0.5 + 0.42 * s.table.rows.length;
    }
    if (s.bullets?.length) {
      slide.addText(s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })), { x: 0.6, y, w: 12.1, h: Math.max(1, 7 - y - 0.9), fontSize: first ? 18 : 15, color: ink, valign: "top", paraSpaceAfter: 6 });
    }
    if (s.footnote) slide.addText(s.footnote, { x: 0.6, y: 6.85, w: 12.1, h: 0.4, fontSize: 10, italic: true, color: first ? "B5D7BD" : C.warn });
    slide.addText(`${index + 1} / ${slides.length}`, { x: 11.9, y: 7.05, w: 0.9, h: 0.3, fontSize: 9, color: C.grey, align: "right" });
    slide.addNotes(`${s.say} (about ${s.seconds} seconds)`);
  });
  return { slides: slides.length, seconds: totalSeconds(slides) };
}
