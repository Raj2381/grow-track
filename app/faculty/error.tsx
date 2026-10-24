"use client";

import { ErrorBlock } from "@/components/forecast/ui";

/** Route-level safety net: a rendering failure shows a plain message and a retry, never a stack trace. */
export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <ErrorBlock message="This page could not be shown. Please try again; if it keeps happening, tell an administrator." onRetry={reset} />
    </div>
  );
}
