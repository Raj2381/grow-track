"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const Loading = () => (
  <div
    id="growthtrack-portal"
    className="grid min-h-screen place-items-center bg-brand-950 text-sm text-white"
    aria-label="Loading student dashboard"
  >
    Loading student dashboard…
  </div>
);

const StudentPortalRuntime = dynamic(() => import("./student-portal-runtime"), { ssr: false, loading: Loading });

// The portal renders only in the browser; the Suspense boundary is what lets Next prerender this route's shell.
export default function StudentPortalApp() {
  return (
    <Suspense fallback={<Loading />}>
      <StudentPortalRuntime />
    </Suspense>
  );
}
