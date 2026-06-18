-- SundayQuiz — 0006 — Sunday Account host ownership.
--
-- The host SSO dashboard ("Spillene mine") needs to tie a game to the Sunday
-- account that created it. The owner column is `quiz.games.host_user_id`
-- (already present since 0001_schema.sql) — it holds the issuer-project auth
-- user id (a uuid). It is NULLABLE on purpose: anonymous, code-based hosting
-- stays fully working with owner left null.
--
-- This migration is IDEMPOTENT and additive: it (re)asserts the column + lookup
-- index so a DB at any prior state lands in the same place. It does NOT add a
-- foreign key — the auth users live in the *issuer* Supabase project, not this
-- data project, so referential integrity can't be enforced cross-project.

-- Ensure the owner column exists (no-op if 0001 already created it).
alter table quiz.games
  add column if not exists host_user_id uuid;

-- Dashboard query is `where host_user_id = $me order by created_at desc`.
create index if not exists games_host_user_idx
  on quiz.games (host_user_id)
  where host_user_id is not null;

comment on column quiz.games.host_user_id is
  'Sunday Account (issuer project) auth user id of the host who created this '
  'game while signed in. NULL for anonymous/code-only games. No cross-project '
  'FK — integrity is enforced in the app layer.';
