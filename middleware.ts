import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { sharedCookieOptions } from "@/lib/supabase/cookies";

// SSO host middleware. Two jobs, scoped to the host/auth surface ONLY:
//  1. refresh the Sunday Account session cookie so it doesn't expire mid-use;
//  2. gate the SIGNED-IN host dashboard (`/host`) behind a login.
//
// Everything else — anonymous join/play (`/play`), the board (`/board/*`), the
// projector, the create wizard (`/ny`), the per-game host console
// (`/host/<gameId>`, which authenticates with the code-based host_code) — is
// untouched and never sees this middleware (see the matcher below).

/** Reachable without a signed-in Sunday host. */
const PUBLIC_PREFIXES = ["/host/login", "/auth/"];

/** Paths under /host that use the legacy code-based host auth (host_code in the
 * body), NOT Sunday Account — must stay anonymous. Anything matching
 * `/host/<id>` is the per-game console; only the bare `/host` dashboard is
 * gated. */
function isCodeBasedHostRoute(path: string): boolean {
  // `/host` and `/host/` → dashboard (gated). `/host/<segment>` → console (open).
  const rest = path.replace(/^\/host\/?/, "");
  return rest.length > 0;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUNDAY_AUTH_URL!,
    process.env.NEXT_PUBLIC_SUNDAY_AUTH_ANON_KEY!,
    {
      cookieOptions: sharedCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet)
            request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, options);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const isPublic = PUBLIC_PREFIXES.some((p) => path.startsWith(p));
  // The per-game host console authenticates itself (code-based) — leave it open.
  if (isPublic || isCodeBasedHostRoute(path)) return response;

  // Bare `/host` dashboard: require a signed-in Sunday host.
  if (path === "/host" || path === "/host/") {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/host/login";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  // ONLY the host dashboard surface + the auth callback. Anonymous play, board,
  // projector, join and the create wizard are never matched here.
  matcher: ["/host", "/host/", "/host/login", "/auth/:path*"],
};
