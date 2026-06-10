-- SundayQuiz — schema. Lives in its own `quiz` schema inside the shared
-- Supabase project (SundayChess owns `public`, SundayTurnering owns
-- `turnering`). All access goes through Next.js Route Handlers with the
-- service role; RLS is enabled with zero policies so anon/authenticated have
-- no direct table access.

create schema if not exists quiz;

-- ---------- games (the generic shell: PIN, lifecycle, type-specific config) ----------
create table quiz.games (
  id            uuid primary key default gen_random_uuid(),
  join_pin      text not null,
  host_code     text not null,
  host_user_id  uuid,
  game_type     text not null default 'bingo' check (game_type in ('bingo')),
  title         text not null default '',
  status        text not null default 'lobby' check (status in ('lobby','live','finished')),
  -- bingo config: { gridSize: 3|4|5, winCondition: 'line'|'two_lines'|'blackout',
  --                 maxVerificationsPerPair: int, freeCentre: bool, statementSetId: uuid }
  config        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  ended_at      timestamptz
);
-- PIN must be unique among games that can still be joined; finished games free
-- their PIN for reuse.
create unique index games_active_pin_uq on quiz.games (join_pin) where status <> 'finished';
create index games_host_user_idx on quiz.games (host_user_id) where host_user_id is not null;

-- ---------- players (code identity, no accounts) ----------
create table quiz.players (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references quiz.games (id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 40),
  resume_code  text not null,
  is_host      boolean not null default false,
  status       text not null default 'active' check (status in ('active','left','kicked')),
  joined_at    timestamptz not null default now(),
  unique (game_id, resume_code)
);
create index players_game_idx on quiz.players (game_id);

-- ---------- statement sets (bundled or game-local custom) ----------
create table quiz.statement_sets (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid,                                   -- reserved for suite auth (v2)
  game_id       uuid references quiz.games (id) on delete cascade, -- custom set: lives with its game
  title         text not null check (length(title) between 1 and 80),
  audience      text not null default 'generell' check (audience in ('kirke','skole','generell')),
  is_builtin    boolean not null default false,
  language      text not null default 'nb',
  created_at    timestamptz not null default now()
);
create index statement_sets_game_idx on quiz.statement_sets (game_id) where game_id is not null;

create table quiz.statements (
  id         uuid primary key default gen_random_uuid(),
  set_id     uuid not null references quiz.statement_sets (id) on delete cascade,
  text       text not null check (length(text) between 1 and 200),
  sort_order int not null default 0
);
create index statements_set_idx on quiz.statements (set_id);

-- ---------- boards (one per player per game) ----------
create table quiz.boards (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references quiz.games (id) on delete cascade,
  player_id  uuid not null references quiz.players (id) on delete cascade,
  -- ordered row-major: [{ "statementId": uuid, "text": "…" } | { "free": true }, …]
  cells      jsonb not null,
  bingo_at   timestamptz,
  bingo_rank int,
  unique (game_id, player_id)
);
create index boards_game_idx on quiz.boards (game_id);

-- ---------- marks (claims + audit trail + connection-graph edge list) ----------
create table quiz.marks (
  id             uuid primary key default gen_random_uuid(),
  game_id        uuid not null references quiz.games (id) on delete cascade,
  board_id       uuid not null references quiz.boards (id) on delete cascade,
  cell_index     int not null check (cell_index >= 0),
  claimer_id     uuid not null references quiz.players (id) on delete cascade,
  verifier_id    uuid not null references quiz.players (id) on delete cascade,
  statement_id   uuid,
  -- snapshot at claim time → ticker/prompts/graph are single-table reads
  statement_text text not null default '',
  status         text not null default 'pending'
                   check (status in ('pending','confirmed','rejected','expired')),
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  check (claimer_id <> verifier_id)
);
-- Race-closers: at most one live claim per cell, at most one pending claim per
-- player. The indexes ARE the enforcement; the RPCs map violations to errors.
create unique index marks_active_cell_uq on quiz.marks (board_id, cell_index)
  where status in ('pending','confirmed');
create unique index marks_one_pending_per_claimer_uq on quiz.marks (claimer_id)
  where status = 'pending';
create index marks_game_status_idx on quiz.marks (game_id, status);
create index marks_pending_verifier_idx on quiz.marks (verifier_id) where status = 'pending';
create index marks_pair_idx on quiz.marks (game_id, claimer_id, verifier_id);

-- ---------- RLS: lock everything to the service role ----------
alter table quiz.games          enable row level security;
alter table quiz.players        enable row level security;
alter table quiz.statement_sets enable row level security;
alter table quiz.statements     enable row level security;
alter table quiz.boards         enable row level security;
alter table quiz.marks          enable row level security;
-- No policies on purpose → anon/authenticated get zero direct access.

-- Expose the schema to PostgREST roles (REST/RPC routing). RLS still governs
-- row access; service_role bypasses it.
grant usage on schema quiz to anon, authenticated, service_role;
grant all on all tables in schema quiz to service_role;
grant execute on all functions in schema quiz to service_role;
alter default privileges in schema quiz grant all on tables to service_role;
alter default privileges in schema quiz grant execute on functions to service_role;
