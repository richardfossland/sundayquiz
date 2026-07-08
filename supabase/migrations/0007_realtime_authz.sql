-- SundayQuiz — 0007 — Realtime Authorization for the quiz:<gameId> broadcast
-- channel.
--
-- Today the game channel (quiz:<gameId>, lib/realtime.ts channels.game) is
-- PUBLIC: anyone who learns the game's UUID can subscribe AND .send() a
-- forged broadcast event. Most events are harmless refetch nudges (payloads
-- are hints, never trusted), but two are NOT:
--   - `bingo` (BoardClient.tsx): the board screen renders payload.displayName
--     + payload.rank DIRECTLY into a full-screen celebration overlay — a
--     forged event puts an arbitrary name on the big screen as the "winner".
--   - `mark_resolved` (PlayerGame.tsx): a forged event whose payload
--     targetPlayerId matches a real player pops a fake "avvist"/"utløpt"
--     toast on that phone.
--
-- Fix: the client marks the game channel `private: true`
-- (lib/client/useChannel.ts), which makes Realtime authorize every
-- subscriber against RLS on realtime.messages. This policy lets anon +
-- authenticated RECEIVE (SELECT) on quiz:* topics but grants NO client
-- INSERT → a forged client .send() is denied by default-deny RLS. Server
-- publish is unaffected: lib/server/broadcast.ts posts via the REST
-- broadcast endpoint using the service_role key, which bypasses RLS.
--
-- Scope note: the game channel is the ONLY one going private here. The
-- separate `quiz:<gameId>:presence` channel (lib/client/usePresence.ts,
-- roster "who's here" bubbles + the isHost badge) stays public/unauthenticated
-- — it is never marked `private: true` client-side, so this policy does not
-- change its behaviour at all. Forging presence only affects a cosmetic "(vert)"
-- label, never an authorization decision (real host actions are gated
-- server-side by host_code / Sunday Account auth, not presence data).
--
-- Verified: grepped the whole app for `supabase.channel(` (2 call sites:
-- useChannel.ts + usePresence.ts) and `.send(` — no client code calls
-- `.send()` today; every broadcast() call is server-side (service role) in
-- app/api/**/route.ts. So this migration only needs a RECEIVE policy, no
-- client-INSERT allowance anywhere.
--
-- realtime.messages is a Supabase-managed object absent from the vanilla
-- postgres:16 test harness, so the policy is guarded on its presence and is a
-- clean no-op there (scripts/smoke.mjs verifies the live receive behavior
-- instead). Idempotent / safe to re-run.
--
-- Deploy order: apply this migration BEFORE deploying the client build that
-- sets `private: true` — flipping the client flag before the policy exists
-- would deny every subscriber (CHANNEL_ERROR) and blank the board/phones.

do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'realtime.messages absent (test harness) — skipping Realtime RLS policy';
    return;
  end if;

  -- RECEIVE: a private-channel subscriber reads realtime.messages for its
  -- topic. realtime.topic() returns the topic being authorized; the %
  -- wildcard covers quiz:<gameId> (the only channel marked private today).
  execute 'drop policy if exists "quiz_game_receive" on realtime.messages';
  execute $p$
    create policy "quiz_game_receive"
      on realtime.messages
      for select
      to anon, authenticated
      using ( realtime.topic() like 'quiz:%' )
  $p$;

  -- NO insert/update/delete policy for anon/authenticated → client broadcasts
  -- (forged events) are denied by default-deny RLS. Server publish bypasses
  -- RLS via service_role.
end $$;
