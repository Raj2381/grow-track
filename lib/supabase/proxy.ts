import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAppRole, safeNext, supabaseConfig, type AppRole } from "./config";

export { STAFF_PREFIXES, PUBLIC_PATHS, WORKSPACE_PREFIX, FORECAST_PAGES, decide, type Decision } from "@/lib/access";
import { decide } from "@/lib/access";

/** Refreshes the Supabase session cookie on every request and applies decide(). */
export async function updateSession(request: NextRequest) {
  const { url, key } = supabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // getClaims() verifies the token's signature; never trust getSession() on the server
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; app_metadata?: { role?: unknown; student_id?: unknown } } | undefined;
  const user = claims?.sub
    ? {
        role: isAppRole(claims.app_metadata?.role) ? claims.app_metadata!.role as AppRole : null,
        studentId: typeof claims.app_metadata?.student_id === "string" ? claims.app_metadata.student_id : null,
      }
    : null;

  const decision = decide(request.nextUrl.pathname, user);
  if (decision.action === "redirect") {
    const target = request.nextUrl.clone();
    const [pathname, query] = decision.to.split("?");
    target.pathname = pathname;
    target.search = query ? `?${query}` : "";
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));   // keep any refreshed session cookies
    return redirect;
  }
  return response;
}

export { safeNext };
