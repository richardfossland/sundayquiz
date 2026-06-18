import "server-only";

// Sunday Account (host SSO) authorization — the ONE place that decides whether a
// signed-in Sunday user is allowed to act as a quiz host. This is DISTINCT from
// the code-based host/player auth in lib/server/auth.ts (host_code in the body),
// which is left fully intact: anonymous, code-based hosting still works.
//
// The signed-in user is resolved from the issuer-project session cookie; the
// allow-list is QUIZ_ADMIN_EMAILS (comma/space separated). Keeping authz here
// means routes only ever call requireHostUser().

import type { User } from "@supabase/supabase-js";

import { createAuthClient } from "@/lib/supabase/auth-server";

export class HostAuthError extends Error {
  status: number;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.name = "HostAuthError";
  }
}

/** Parse the QUIZ_ADMIN_EMAILS allow-list into a lowercase Set. */
export function adminEmailSet(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0),
  );
}

/** Pure authz predicate — does this email belong to the admin allow-list?
 * An empty/unset allow-list authorizes NOBODY (fail closed). */
export function isAdminEmail(
  email: string | null | undefined,
  raw: string | undefined = process.env.QUIZ_ADMIN_EMAILS,
): boolean {
  if (!email) return false;
  const set = adminEmailSet(raw);
  if (set.size === 0) return false;
  return set.has(email.trim().toLowerCase());
}

/**
 * Resolve + authorize the signed-in Sunday host. Throws HostAuthError:
 *  - 401 if there is no valid session.
 *  - 403 if the user's email is not in QUIZ_ADMIN_EMAILS.
 * Returns the authenticated User on success.
 */
export async function requireHostUser(): Promise<User> {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new HostAuthError(401, "not_signed_in");
  if (!isAdminEmail(user.email)) throw new HostAuthError(403, "not_a_host");
  return user;
}

/** Best-effort current host user (no throw) — for RSC that branch on login. */
export async function getHostUser(): Promise<User | null> {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !isAdminEmail(user.email)) return null;
    return user;
  } catch {
    return null;
  }
}

/** Uniform catch → Response for API routes (mirrors authFail in auth.ts). */
export function hostAuthFail(err: unknown): Response | null {
  if (err instanceof HostAuthError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  return null;
}
