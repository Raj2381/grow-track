"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  Search,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import { AdminPageShell } from "@/components/admin-page-shell";

const topics = [
  {
    id: "dashboard",
    title: "Using the administrator dashboard",
    keywords: "overview metrics navigation dashboard",
    icon: BookOpen,
    content: [
      "Use Overview to review institutional indicators and students that may need attention.",
      "Use the workspace links to open Students, Academic performance, Attendance management, Placement readiness, and Interventions.",
      "Use Settings to update the administrator profile, preferences, and academic alert thresholds. Settings are saved in this browser.",
    ],
  },
  {
    id: "students",
    title: "Adding and managing students",
    keywords: "add create edit manage directory",
    icon: CheckCircle2,
    content: [
      "Open Students to search the directory and filter records by department or risk level. Select a student record to review its available details.",
      "Administrators can add a student with the Add a student form on the Students page. The student is saved to the database and appears in the list straight away; marks, attendance and forecasts appear once their records are loaded.",
      "Interventions can be created for any student in the current directory.",
    ],
  },
  {
    id: "academics",
    title: "Reviewing academic performance",
    keywords: "academic score subjects semester performance",
    icon: BookOpen,
    content: [
      "Open Academic performance from the workspace navigation.",
      "Search by student name or ID, then filter by department or semester to narrow the results.",
      "Review score summaries and student-level subject results.",
    ],
  },
  {
    id: "attendance",
    title: "Creating and submitting attendance",
    keywords: "attendance session mark present absent late submit percentage",
    icon: ClipboardCheck,
    content: [
      "Open Attendance management and complete the session title, subject, department, year, date, and start/end time, then choose Create and take attendance.",
      "In the draft register, review each student's status and select Present, Absent, or Late. The bulk actions can mark every listed student present or absent before individual corrections.",
      "Select Submit attendance and confirm. Submitted sessions become read-only and only submitted sessions contribute to attendance percentages.",
      "Use the attendance views to review percentages. Percentage is calculated as (Present + Late) / submitted sessions with a record for that student × 100. A student with no submitted sessions has no recorded percentage.",
      "Where a student in the attendance console cannot be matched by name to a student in the directory, the recorded percentage is shown instead.",
    ],
  },
  {
    id: "interventions",
    title: "Managing interventions",
    keywords: "support plan follow up priority planned in progress completed",
    icon: Settings2,
    content: [
      "Open Interventions to see students below the saved attendance or academic-score thresholds. High priority is assigned below 65% attendance or 50 academic score; medium priority below 75% or 60; lower-priority threshold alerts follow the values in Settings.",
      "Choose Create intervention (or Create beside a student), then select a student, enter the reason and action plan, select priority and status, and set the follow-up date.",
      "Use each plan's status selector to move it between Planned, In Progress, and Completed. Edit and Delete actions update the saved plan. Intervention data is stored in this browser's localStorage.",
    ],
  },
  {
    id: "settings",
    title: "Settings and alert thresholds",
    keywords: "profile email role theme notification minimum attendance score",
    icon: Settings2,
    content: [
      "Open Settings to update the administrator's name, email, and role, choose a dashboard theme preference, and enable or disable notification preferences.",
      "Set minimum attendance and academic-score percentages from 0 to 100. A student is listed for support when either score falls below its saved threshold.",
      "Select Save settings to persist your changes. Reset to defaults asks for confirmation before replacing saved settings.",
    ],
  },
];

const faqs = [
  {
    question: "Why does a student not appear on the interventions list?",
    answer:
      "The list includes directory students whose attendance or academic score is below the saved Settings threshold. Confirm the thresholds and the available student values.",
  },
  {
    question: "Do draft attendance sessions affect attendance percentages?",
    answer:
      "No. Only submitted sessions contribute to the percentage calculation. Draft sessions can still be edited in the attendance console.",
  },
  {
    question: "Where are interventions and settings saved?",
    answer:
      "This project has no connected database. Intervention records and administrator settings are saved in localStorage in the current browser and remain available after a refresh in that browser.",
  },
  {
    question: "Can I add a student from the current dashboard?",
    answer:
      "The Students page lists every student in the database. Administrators can add a student there; faculty, heads of department and the placement officer see only the students in their scope.",
  },
  {
    question: "What if my saved data cannot be loaded?",
    answer:
      "Check that browser storage is enabled for this site. Storage errors are shown on the relevant page. Clearing site data may permanently remove locally saved settings and interventions.",
  },
];

export function HelpContent() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTopics = useMemo(
    () =>
      topics.filter((topic) =>
        `${topic.title} ${topic.keywords} ${topic.content.join(" ")}`
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [normalizedQuery],
  );
  const filteredFaqs = faqs.filter((faq) =>
    `${faq.question} ${faq.answer}`.toLowerCase().includes(normalizedQuery),
  );

  return (
    <>
      <section className="mb-7">
        <p className="mb-2 text-[13px] font-bold tracking-[1.7px] text-[#28684e]">
          GROWTHTRACK GUIDE
        </p>
        <h1 className="text-[27px] font-semibold leading-tight tracking-[-1px] sm:text-[30px]">
          Help and documentation
        </h1>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-5 text-[#7a847b]">
          Search dashboard guidance, workflow instructions, troubleshooting
          tips, and frequently asked questions.
        </p>
      </section>

      <label className="relative mb-6 block max-w-xl">
        <Search
          size={17}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#556057]"
        />
        <input
          className="w-full rounded-md border border-[#dfe5dc] bg-white py-3 pl-10 pr-3 text-[15px] outline-none focus:border-[#57906f] focus:ring-2 focus:ring-[#e0eee4]"
          type="search"
          placeholder="Search help topics"
          aria-label="Search help topics"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#2c4031]">Help topics</h2>
        {filteredTopics.length ? (
          filteredTopics.map(({ id, title, icon: Icon, content }) => (
            <article
              key={id}
              id={id}
              className="rounded-lg border border-[#e2e7df] bg-white p-5 sm:p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded-md bg-[#edf4ef] p-2 text-[#28684e]">
                  <Icon size={18} />
                </span>
                <h3 className="font-semibold text-[#2c4031]">{title}</h3>
              </div>
              <ol className="space-y-2 pl-5 text-[15px] leading-6 text-[#657268]">
                {content.map((step, index) => (
                  <li className="list-decimal pl-1" key={`${id}-${index}`}>
                    {step}
                  </li>
                ))}
              </ol>
            </article>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-[#dfe5dc] bg-white px-4 py-8 text-center text-[15px] text-[#748075]">
            No help topics match “{query}”.
          </p>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-[#e2e7df] bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-md bg-[#edf4ef] p-2 text-[#28684e]">
            <CircleHelp size={18} />
          </span>
          <h2 className="font-semibold text-[#2c4031]">Frequently asked questions</h2>
        </div>
        <div className="divide-y divide-[#edf0eb]">
          {filteredFaqs.length ? (
            filteredFaqs.map((faq) => (
              <details className="group py-4" key={faq.question}>
                <summary className="cursor-pointer list-none pr-6 text-[15px] font-medium text-[#46564a] marker:hidden">
                  {faq.question}
                </summary>
                <p className="mt-3 text-[15px] leading-6 text-[#748075]">
                  {faq.answer}
                </p>
              </details>
            ))
          ) : (
            <p className="py-4 text-[15px] text-[#748075]">
              No frequently asked questions match this search.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert size={19} className="mt-0.5 shrink-0 text-amber-800" />
          <div>
            <h2 className="font-semibold text-amber-950">Contact support</h2>
            <p className="mt-1 text-[15px] leading-6 text-amber-900">
              No support email, help-desk link, or ticketing integration is
              configured in this project, so there is no in-app support
              channel to open. Contact the GrowthTrack project administrator
              through your organization&apos;s existing support process.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

export default function HelpPage() {
  return (
    <AdminPageShell title="Help and documentation">
      <HelpContent />
    </AdminPageShell>
  );
}
