import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isAuthRequired, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Next.js 16 `proxy` (the former middleware). Keeps the Supabase session fresh and applies the role-based routing
 * rules, but ONLY when login is switched on (NEXT_PUBLIC_REQUIRE_AUTH=true) and Supabase is configured, so the app keeps
 * working while the database is being set up.
 */
export async function proxy(request: NextRequest) {
  if (!isAuthRequired() || !isSupabaseConfigured()) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  // everything except Next internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|data/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wasm|json|csv|ico)$).*)"],
};
