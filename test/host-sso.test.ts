import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Sunday Account host SSO: authz predicate + owner-scoped query + the DELETE
// route's 401/403/404/200 contract. The DB + auth clients are mocked so this
// stays in the plain-Node test env like the rest of the suite.
// ---------------------------------------------------------------------------

import { adminEmailSet, isAdminEmail } from "@/lib/server/auth-host";

describe("isAdminEmail (the ONE authz predicate)", () => {
  it("matches case-insensitively and trims", () => {
    expect(isAdminEmail("Host@Example.com", "host@example.com")).toBe(true);
    expect(isAdminEmail("  host@example.com ", "host@example.com")).toBe(true);
  });
  it("rejects non-listed emails", () => {
    expect(isAdminEmail("nope@example.com", "host@example.com")).toBe(false);
  });
  it("fails closed on an empty allow-list (nobody is a host)", () => {
    expect(isAdminEmail("host@example.com", "")).toBe(false);
    expect(isAdminEmail("host@example.com", "   ")).toBe(false);
  });
  it("falls back to QUIZ_ADMIN_EMAILS env when the arg is omitted", () => {
    const prev = process.env.QUIZ_ADMIN_EMAILS;
    process.env.QUIZ_ADMIN_EMAILS = "host@example.com";
    expect(isAdminEmail("host@example.com")).toBe(true);
    expect(isAdminEmail("nope@example.com")).toBe(false);
    process.env.QUIZ_ADMIN_EMAILS = prev;
  });
  it("rejects null/empty email", () => {
    expect(isAdminEmail(null, "host@example.com")).toBe(false);
    expect(isAdminEmail(undefined, "host@example.com")).toBe(false);
  });
  it("parses comma / space / semicolon separated lists", () => {
    const set = adminEmailSet("a@x.com, b@x.com;c@x.com  d@x.com");
    expect(set).toEqual(new Set(["a@x.com", "b@x.com", "c@x.com", "d@x.com"]));
    expect(isAdminEmail("c@x.com", "a@x.com, b@x.com;c@x.com")).toBe(true);
  });
});

// ---- Mock the service-role DB so we can test the store + route in isolation --

type GameRecord = { id: string; host_user_id: string | null; title: string };

const state: { games: GameRecord[] } = { games: [] };

vi.mock("@/lib/supabase/service", () => {
  function from() {
    return makeQuery();
  }
  function makeQuery() {
    const filters: { col: string; val: unknown }[] = [];
    let op: "select" | "delete" = "select";
    let selectCols = "";
    const q = {
      select(cols: string) {
        op = "select";
        selectCols = cols;
        return q;
      },
      delete() {
        op = "delete";
        return q;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, val });
        return q;
      },
      order() {
        return q;
      },
      match(rows: GameRecord[]) {
        return rows.filter((r) =>
          filters.every((f) => (r as Record<string, unknown>)[f.col] === f.val),
        );
      },
      async maybeSingle() {
        const hit = q.match(state.games)[0];
        return { data: hit ?? null, error: null };
      },
      then(resolve: (v: { data: unknown; error: null }) => void) {
        // `await query` (no maybeSingle): list select OR delete.
        if (op === "delete") {
          const toDelete = new Set(q.match(state.games).map((r) => r.id));
          state.games = state.games.filter((r) => !toDelete.has(r.id));
          return resolve({ data: null, error: null });
        }
        const rows = q.match(state.games).map((r) => {
          if (!selectCols || selectCols === "*") return r;
          const out: Record<string, unknown> = {};
          for (const c of selectCols.split(","))
            out[c.trim()] = (r as Record<string, unknown>)[c.trim()];
          return out;
        });
        return resolve({ data: rows, error: null });
      },
    };
    return q;
  }
  return { createServiceClient: () => ({ from }) };
});

// requireHostUser → drive its resolved/empty/forbidden user via this mock.
const authState: { user: { id: string; email: string } | null } = { user: null };
vi.mock("@/lib/supabase/auth-server", () => ({
  createAuthClient: async () => ({
    auth: { getUser: async () => ({ data: { user: authState.user } }) },
  }),
}));

import { deleteOwnedGame, listGamesByOwner } from "@/lib/server/host-games";
import { DELETE } from "@/app/api/games/[id]/route";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  process.env.QUIZ_ADMIN_EMAILS = "host@example.com";
  state.games = [
    { id: "g-mine-1", host_user_id: ME, title: "Mine A" },
    { id: "g-mine-2", host_user_id: ME, title: "Mine B" },
    { id: "g-other", host_user_id: OTHER, title: "Andres" },
    { id: "g-anon", host_user_id: null, title: "Anonym" },
  ];
  authState.user = null;
});
afterEach(() => vi.clearAllMocks());

describe("listGamesByOwner", () => {
  it("returns only the caller's own games (anonymous + others excluded)", async () => {
    const mine = await listGamesByOwner(ME);
    expect(mine.map((g) => g.id).sort()).toEqual(["g-mine-1", "g-mine-2"]);
  });
  it("returns nothing for a user with no games", async () => {
    expect(await listGamesByOwner(OTHER + "x")).toEqual([]);
  });
});

describe("deleteOwnedGame (owner gate)", () => {
  it("deletes a game the user owns", async () => {
    expect(await deleteOwnedGame("g-mine-1", ME)).toBe(true);
    expect(state.games.find((g) => g.id === "g-mine-1")).toBeUndefined();
  });
  it("refuses to delete another host's game", async () => {
    expect(await deleteOwnedGame("g-other", ME)).toBe(false);
    expect(state.games.find((g) => g.id === "g-other")).toBeDefined();
  });
  it("refuses to delete an anonymous game", async () => {
    expect(await deleteOwnedGame("g-anon", ME)).toBe(false);
    expect(state.games.find((g) => g.id === "g-anon")).toBeDefined();
  });
  it("returns false for a missing game", async () => {
    expect(await deleteOwnedGame("nope", ME)).toBe(false);
  });
});

function delReq(id: string): Promise<Response> {
  return DELETE(new Request("http://x/api/games/" + id, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

describe("DELETE /api/games/[id] — auth contract", () => {
  it("401 when not signed in", async () => {
    authState.user = null;
    const res = await delReq("g-mine-1");
    expect(res.status).toBe(401);
    expect(state.games.find((g) => g.id === "g-mine-1")).toBeDefined();
  });

  it("403 when signed in but email not in the allow-list", async () => {
    authState.user = { id: ME, email: "stranger@example.com" };
    const res = await delReq("g-mine-1");
    expect(res.status).toBe(403);
    expect(state.games.find((g) => g.id === "g-mine-1")).toBeDefined();
  });

  it("403 when host tries to delete a game they don't own", async () => {
    authState.user = { id: ME, email: "host@example.com" };
    const res = await delReq("g-other");
    expect(res.status).toBe(403);
    expect(state.games.find((g) => g.id === "g-other")).toBeDefined();
  });

  it("404 when the game doesn't exist", async () => {
    authState.user = { id: ME, email: "host@example.com" };
    const res = await delReq("does-not-exist");
    expect(res.status).toBe(404);
  });

  it("200 + row gone when the owner deletes their own game", async () => {
    authState.user = { id: ME, email: "host@example.com" };
    const res = await delReq("g-mine-1");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(state.games.find((g) => g.id === "g-mine-1")).toBeUndefined();
  });
});
