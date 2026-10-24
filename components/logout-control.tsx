"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/** The shells' "Logout" control. There is no login, so it simply returns to the landing page. */
export function LogoutControl({ className, title, children }: { className: string; title?: string; children: ReactNode }) {
  return (
    <Link href="/" className={className} title={title} aria-label="Back to the start page">
      {children}
    </Link>
  );
}
