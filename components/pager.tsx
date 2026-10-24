"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Paged<T> = {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  pageItems: T[];
  setPage: (page: number) => void;
};

/**
 * Client-side pagination. `resetKey` should change whenever the filters change so the list returns to page 1
 * (derived during render, so there is no extra effect or flash of a stale page).
 */
export function usePaged<T>(items: T[], resetKey: string, pageSize = 25): Paged<T> {
  const [state, setState] = useState({ key: resetKey, page: 0 });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = state.key === resetKey ? Math.min(state.page, pageCount - 1) : 0;
  return {
    page,
    pageCount,
    pageSize,
    total: items.length,
    pageItems: items.slice(page * pageSize, (page + 1) * pageSize),
    setPage: (next) => setState({ key: resetKey, page: Math.max(0, Math.min(next, pageCount - 1)) }),
  };
}

export function Pager<T>({ paged, noun = "records" }: { paged: Paged<T>; noun?: string }) {
  if (paged.total <= paged.pageSize) return null;
  const from = paged.page * paged.pageSize + 1;
  const to = Math.min(paged.total, (paged.page + 1) * paged.pageSize);
  const button =
    "inline-flex h-8 items-center gap-1 rounded-md border border-[#dbe5dc] bg-white px-2.5 text-[13.5px] font-medium text-[#315c47] transition-colors hover:bg-[#f0f5f1] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-[13.5px] text-[#59675b]">
      <span>
        {from}–{to} of {paged.total} {noun}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className={button} disabled={paged.page === 0} onClick={() => paged.setPage(0)}>
          First
        </button>
        <button type="button" className={button} disabled={paged.page === 0} onClick={() => paged.setPage(paged.page - 1)}>
          <ChevronLeft size={14} /> Previous
        </button>
        <span aria-live="polite">
          Page {paged.page + 1} of {paged.pageCount}
        </span>
        <button type="button" className={button} disabled={paged.page >= paged.pageCount - 1} onClick={() => paged.setPage(paged.page + 1)}>
          Next <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
}
