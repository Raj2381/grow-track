"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, ArrowRight, BarChart3, BookOpen, Building2, BriefcaseBusiness, GraduationCap, Sparkles, Target, UsersRound, type LucideIcon } from "lucide-react";

const HEADLINE: { text: string; blue?: boolean }[] = [
  { text: "One" }, { text: "campus." }, { text: "Two", blue: true }, { text: "ways", blue: true }, { text: "to" }, { text: "move" }, { text: "forward." },
];
const PHRASES = ["student insights", "growth and progress", "the right next step", "early support", "placement readiness"];

type Entry = { href: string; label: string; sub: string; icon: LucideIcon };
const EDUCATORS: Entry[] = [
  { href: "/faculty/dashboard", label: "Enter As Faculty", sub: "Mentees and attendance", icon: GraduationCap },
  { href: "/hod/dashboard", label: "Enter As HOD", sub: "Department and faculty", icon: Building2 },
  { href: "/tpo/dashboard", label: "Enter As TPO", sub: "Placement and skills", icon: BriefcaseBusiness },
];

export function LandingPage() {
  const [phrase, setPhrase] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setPhrase((p) => (p + 1) % PHRASES.length), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="lp-bg relative isolate min-h-screen overflow-hidden text-[#0f2a5f]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <span className="lp-blob -left-24 top-24 h-72 w-72 bg-[#bfdbfe]" />
        <span className="lp-blob right-0 top-0 h-80 w-80 bg-[#c7e3ff]" style={{ animationDelay: "-5s" }} />
        <span className="lp-blob bottom-0 left-1/3 h-72 w-72 bg-[#d6ecff]" style={{ animationDelay: "-9s" }} />
      </div>

      <header className="mx-auto flex w-full max-w-[1360px] items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="GrowthTrack home">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0f2a5f] text-white shadow-[0_10px_24px_-10px_rgba(15,42,95,.8)]"><GraduationCap size={24} strokeWidth={1.8} /></span>
          <span>
            <span className="block text-[20px] font-bold tracking-[-0.4px]">GrowthTrack</span>
            <span className="mt-0.5 block text-[10px] font-bold tracking-[2px] text-[#4b6a9b]">STUDENT SUCCESS PLATFORM</span>
          </span>
        </Link>
        <span className="hidden items-center gap-2 rounded-full border border-[#d6e4f7] bg-white/80 px-4 py-2 text-[13px] font-medium text-[#34527f] shadow-sm backdrop-blur sm:inline-flex">
          <span className="lp-dot h-2 w-2 rounded-full bg-[#0b78d1]" /> One campus. Every next step.
        </span>
      </header>

      <section className="mx-auto grid w-full max-w-[1360px] items-center gap-12 px-5 pb-20 pt-6 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:pt-14">
        <div>
          <span className="lp-bob inline-flex items-center gap-2 rounded-full border border-[#d6e4f7] bg-white px-4 py-2 text-[13px] font-semibold text-[#0b57d0] shadow-sm">
            <Sparkles size={15} aria-hidden="true" /> A clearer path to student success
          </span>
          <h1 className="lp-h1 mt-7" aria-label="One campus. Two ways to move forward.">
            {HEADLINE.map((w, i) => (
              <span key={w.text} aria-hidden="true">
                <span className="lp-word text-[#0f2a5f]" style={{ animationDelay: `${i * 110}ms` }}><span className={w.blue ? "lp-gradient-text" : ""}>{w.text}</span></span>{" "}
              </span>
            ))}
          </h1>
          <p className="mt-6 max-w-xl text-[18px] leading-8 text-[#4b5f80]">
            Bring progress into focus. Choose your workspace to explore{" "}
            <span key={phrase} className="lp-swap" aria-live="polite">{PHRASES[phrase]}</span>
            {" "}and find what to do next.
          </p>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[14px] font-medium text-[#34527f]">
            {["Academic progress", "Attendance and skills", "Practical next steps"].map((t, i) => (
              <li key={t} className="inline-flex items-center gap-2"><span className="lp-dot h-2 w-2 rounded-full bg-[#2563eb]" style={{ animationDelay: `${i * 400}ms` }} />{t}</li>
            ))}
          </ul>
        </div>

        <div className="lp-stage grid items-start gap-5 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          <TiltCard
            eyebrow="FOR EDUCATORS" title="Admin dashboard" titleHref="/admin/dashboard" tagline="Turn insight into action"
            theme="navy" icon={UsersRound}
            chips={[{ icon: UsersRound, label: "Success" }, { icon: BarChart3, label: "Trends" }, { icon: Activity, label: "Support" }]}
            entries={EDUCATORS}
          />
          <TiltCard
            eyebrow="FOR STUDENTS" title="Student dashboard" tagline="Your progress, one place"
            theme="sky" icon={GraduationCap}
            chips={[{ icon: BookOpen, label: "Academics" }, { icon: Activity, label: "Attendance" }, { icon: Target, label: "Placement" }]}
            entries={[{ href: "/student/dashboard", label: "Enter As Student", sub: "Plan, scores and skills", icon: GraduationCap }]}
            delay={120}
          />
        </div>
      </section>
    </main>
  );
}

const THEMES = {
  navy: { head: "linear-gradient(135deg, #0b2a66 0%, #1550b8 55%, #2f7bf0 100%)", glow: "rgba(47,123,240,.55)", chip: "bg-white/15 text-white" },
  sky: { head: "linear-gradient(135deg, #0a5aa8 0%, #0e9bd8 55%, #36d1dc 100%)", glow: "rgba(34,211,238,.55)", chip: "bg-white/20 text-white" },
} as const;

function TiltCard({ eyebrow, title, titleHref, tagline, theme, icon: Icon, chips, entries, delay = 0 }: {
  eyebrow: string; title: string; titleHref?: string; tagline: string; theme: keyof typeof THEMES; icon: LucideIcon;
  chips: { icon: LucideIcon; label: string }[]; entries: Entry[]; delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const t = THEMES[theme];
  const move = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${x * 9}deg) rotateX(${-y * 9}deg) translateZ(0)`;
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ""; };
  return (
    <article
      ref={ref} onMouseMove={move} onMouseLeave={leave}
      className="lp-card lp-word flex flex-col overflow-hidden rounded-[26px] border border-[#cfe0f7] bg-white shadow-[0_28px_60px_-30px_rgba(15,42,95,.55)]"
      style={{ animationDelay: `${500 + delay}ms` }}
    >
      <div className="relative overflow-hidden px-5 pb-5 pt-5 text-white" style={{ background: t.head }}>
        <span aria-hidden="true" className="lp-blob -right-10 -top-12 h-40 w-40 bg-white/25" />
        <div className="relative flex items-start justify-between gap-3">
          <p className="text-[12px] font-bold tracking-[2.2px] text-white/85">{eyebrow}</p>
          <span className="lp-lift lp-bob grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20 shadow-[0_10px_24px_-8px_rgba(0,0,0,.45)] backdrop-blur"><Icon size={22} aria-hidden="true" /></span>
        </div>
        <h2 className="lp-h2 lp-on-dark relative mt-1 whitespace-nowrap text-white" style={{ fontSize: "1.45rem" }}>{titleHref ? <Link href={titleHref} className="hover:underline" style={{ color: "inherit" }}>{title}</Link> : title}</h2>
        <p className="relative mt-0.5 text-[14px] font-medium text-white/90">{tagline}</p>
        <ul className="relative mt-3 flex flex-wrap gap-1.5">
          {chips.map(({ icon: C, label }) => (
            <li key={label} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${t.chip}`}><C size={14} aria-hidden="true" />{label}</li>
          ))}
        </ul>
      </div>
      <div className="grid gap-2.5 p-4">
        {entries.map((e) => <EnterButton key={e.href} {...e} />)}
      </div>
    </article>
  );
}

function EnterButton({ href, label, sub, icon: Icon }: Entry): ReactNode {
  return (
    <Link href={href} className="lp-btn flex min-h-[56px] items-center gap-3 rounded-xl px-3.5 py-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#93c5fd] focus-visible:ring-offset-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15"><Icon size={18} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block whitespace-nowrap text-[15px] font-bold leading-tight">{label}</span>
        <span className="mt-0.5 block truncate text-[12.5px] font-medium text-white/85">{sub}</span>
      </span>
      <ArrowRight size={18} className="lp-arrow shrink-0" aria-hidden="true" />
    </Link>
  );
}
