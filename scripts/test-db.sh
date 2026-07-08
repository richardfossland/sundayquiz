#!/usr/bin/env bash
# DB test harness: spin up an ephemeral Postgres in Docker, apply the schema +
# RPC migrations into a `quiz` schema, then run SQL assertions against the
# authoritative scoring/lifecycle RPCs. This is the real-Postgres counterpart
# to the pure TS twin tests (lib/quiz-scoring.ts unit tests) and the
# server-driven scripts/smoke.mjs.
#
#   ./scripts/test-db.sh
#
# Requires Docker. Uses the postgres:16 image. Tears the container down on exit.
set -euo pipefail

CONTAINER="sundayquiz-testdb"
PORT=55442
PW=postgres
IMG=postgres:16
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/supabase/migrations"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

echo "Starting ephemeral Postgres ($IMG) on :$PORT …"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD="$PW" \
  -p "$PORT:5432" "$IMG" >/dev/null

# psql runs INSIDE the container so no host psql client is needed.
PSQL() { docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }

echo "Waiting for Postgres to accept connections …"
for i in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 0.5
  if [ "$i" -eq 60 ]; then echo "Postgres did not come up"; exit 1; fi
done

# The migrations assume Supabase roles (service_role, anon, authenticated) and
# gen_random_uuid()/pgcrypto. Provide them so the SQL applies verbatim.
PSQL <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create extension if not exists pgcrypto;
SQL

# 0007_realtime_authz is guarded on realtime.messages presence → a clean
# no-op on the vanilla postgres harness, but applied here to prove it parses
# + is idempotent (scripts/smoke.mjs verifies the live receive behavior).
echo "Applying migrations …"
for f in 0001_schema.sql 0002_mark_rpcs.sql 0003_seed_sets.sql 0004_quiz_mode.sql 0004_seed_more_sets.sql 0005_seed_quiz_questions.sql 0006_host_owner.sql 0007_realtime_authz.sql; do
  echo "  - $f"
  PSQL < "$MIG/$f" >/dev/null
done

echo "Re-applying 0004 + 0006 + 0007 (idempotency check) …"
PSQL < "$MIG/0004_quiz_mode.sql" >/dev/null
PSQL < "$MIG/0006_host_owner.sql" >/dev/null
PSQL < "$MIG/0007_realtime_authz.sql" >/dev/null

echo "Running assertions …"
PSQL <<'SQL'
\set ON_ERROR_STOP on
do $$
declare
  v_set    uuid := 'b2000000-0000-4000-8000-000000000001';
  v_game   uuid;
  v_p1     uuid;
  v_p2     uuid;
  v_p3     uuid;
  v_q      uuid;
  v_res    jsonb;
  v_n      int;
  v_pts    int;
  v_ans    jsonb;
begin
  -- seed sanity
  select count(*) into v_n from quiz.questions where set_id = v_set;
  assert v_n = 10, format('expected 10 seeded questions, got %s', v_n);
  select count(*) into v_n from quiz.questions
    where set_id = v_set and jsonb_array_length(options) <> 4;
  assert v_n = 0, 'every seeded question must have 4 options';

  -- game_type CHECK admits quiz
  insert into quiz.games (join_pin, host_code, game_type, status, config)
  values ('111111', 'HCODE-1', 'quiz', 'lobby',
          jsonb_build_object('questionSetId', v_set::text,
                             'perQuestionSeconds', 20,
                             'pointsMode', 'speed'))
  returning id into v_game;

  insert into quiz.players (game_id, display_name, resume_code) values
    (v_game, 'Anna', 'AAAA-11') returning id into v_p1;
  insert into quiz.players (game_id, display_name, resume_code) values
    (v_game, 'Bjorn', 'BBBB-22') returning id into v_p2;
  insert into quiz.players (game_id, display_name, resume_code) values
    (v_game, 'Clara', 'CCCC-33') returning id into v_p3;

  -- pure scoring function
  assert quiz.score_answer(false, 'speed', 0, 20000) = 0, 'wrong = 0';
  assert quiz.score_answer(true, 'flat', 19000, 20000) = 1000, 'flat = 1000';
  assert quiz.score_answer(true, 'speed', 0, 20000) = 1000, 'instant speed = 1000';
  assert quiz.score_answer(true, 'speed', 20000, 20000) = 100, 'buzzer speed = 100';
  v_pts := quiz.score_answer(true, 'speed', 10000, 20000);
  assert v_pts = 550, format('half-time speed should be 550, got %s', v_pts);
  assert quiz.score_answer(true, 'speed', 30000, 20000) = 100, 'overrun clamps to 100';
  assert quiz.score_answer(true, 'speed', 5000, 0) = 100, 'zero window → floor';

  -- advance: 'next' opens the first question and flips lobby → live
  v_res := quiz.advance_question(v_game, 'next');
  assert (v_res #>> '{state,phase}') = 'question', 'phase should be question';
  assert (v_res #>> '{state,current_index}') = '0', 'index should be 0';
  assert (v_res ->> 'totalQuestions') = '10', 'totalQuestions 10';
  assert (select status from quiz.games where id = v_game) = 'live', 'game flips live';

  -- current open question (index 0)
  select id into v_q from quiz.questions where set_id = v_set
    order by sort_order, id offset 0 limit 1;

  -- cannot 'next' while a question is open
  begin
    perform quiz.advance_question(v_game, 'next');
    assert false, 'next during open question should fail';
  exception when others then
    assert sqlerrm = 'question_open', format('expected question_open, got %s', sqlerrm);
  end;

  -- Anna answers correctly; speed points > floor
  v_ans := quiz.submit_answer(v_game, v_p1, v_q,
            (select correct_index from quiz.questions where id = v_q));
  assert (v_ans ->> 'correct')::boolean, 'Anna correct';
  assert (v_ans ->> 'points')::int >= 100, 'Anna scores at least floor';

  -- Anna cannot answer twice
  begin
    perform quiz.submit_answer(v_game, v_p1, v_q, 0);
    assert false, 'double answer should fail';
  exception when others then
    assert sqlerrm = 'already_answered', format('expected already_answered, got %s', sqlerrm);
  end;

  -- Bjorn answers wrong → 0 points
  v_ans := quiz.submit_answer(v_game, v_p2, v_q,
            (select (correct_index + 1) % 4 from quiz.questions where id = v_q));
  assert not (v_ans ->> 'correct')::boolean, 'Bjorn wrong';
  assert (v_ans ->> 'points')::int = 0, 'Bjorn scores 0';

  -- answering a question that is NOT the open one is rejected
  begin
    perform quiz.submit_answer(v_game, v_p3,
      (select id from quiz.questions where set_id = v_set order by sort_order, id offset 5 limit 1), 0);
    assert false, 'wrong-question answer should fail';
  exception when others then
    assert sqlerrm = 'wrong_question', format('expected wrong_question, got %s', sqlerrm);
  end;

  -- reveal closes answering
  v_res := quiz.advance_question(v_game, 'reveal');
  assert (v_res #>> '{state,phase}') = 'reveal', 'phase reveal';
  begin
    perform quiz.submit_answer(v_game, v_p3, v_q, 0);
    assert false, 'answer during reveal should fail';
  exception when others then
    assert sqlerrm = 'no_open_question', format('expected no_open_question, got %s', sqlerrm);
  end;

  -- reveal → next advances to question 2 and reopens answering
  v_res := quiz.advance_question(v_game, 'next');
  assert (v_res #>> '{state,phase}') = 'question', 'reveal→next reopens question';
  assert (v_res #>> '{state,current_index}') = '1', 'index advances to 1';
  -- Clara can now answer the SECOND question
  v_ans := quiz.submit_answer(v_game, v_p3,
    (select id from quiz.questions where set_id = v_set order by sort_order, id offset 1 limit 1), 0);
  assert (v_ans ->> 'question_id') is not null, 'Clara answers q2';

  -- leaderboard: Anna ahead of Bjorn, Clara at 0 (never answered)
  assert (select sum(points) from quiz.answers where game_id = v_game and player_id = v_p1)
         > coalesce((select sum(points) from quiz.answers where game_id = v_game and player_id = v_p2), 0),
         'Anna outscores Bjorn';

  -- end finishes the game
  v_res := quiz.advance_question(v_game, 'end');
  assert (v_res #>> '{state,phase}') = 'ended', 'phase ended';
  assert (select status from quiz.games where id = v_game) = 'finished', 'game finished';

  -- bingo path still works (regression: 0004 must not break 0002)
  declare
    v_bgame uuid;
  begin
    insert into quiz.games (join_pin, host_code, game_type, status, config)
    values ('222222', 'HCODE-2', 'bingo', 'lobby', '{}'::jsonb)
    returning id into v_bgame;
    assert (select game_type from quiz.games where id = v_bgame) = 'bingo', 'bingo still allowed';
  end;

  -- invalid game_type still rejected
  begin
    insert into quiz.games (join_pin, host_code, game_type, status, config)
    values ('333333', 'HCODE-3', 'wordle', 'lobby', '{}'::jsonb);
    assert false, 'invalid game_type should be rejected';
  exception when check_violation then
    null; -- expected
  end;

  raise notice 'ALL DB ASSERTIONS PASSED';
end $$;
SQL

echo "DB TEST GREEN"
