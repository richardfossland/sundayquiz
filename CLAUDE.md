# SundayQuiz

Live social game platform at quiz.sundaysuite.app. Two game_types share a
generic shell (PIN join, resume codes, presence roster, lobby→live→finished):
**bli-kjent-bingo** and the namesake **quiz** (live Q&A on the big screen).
Spec: docs/SPEC.md. Gate: `npm run check` (tsc + eslint + vitest); DB changes:
`./scripts/test-db.sh` (ephemeral Postgres in Docker).
Supabase: shared project, dedicated `quiz` schema — all writes via API routes
(service role). Per-mode logic is deliberately NOT shared (spec §2):
- bingo: atomic plpgsql in supabase/migrations/0002_mark_rpcs.sql (TS twin
  lib/winning.ts).
- quiz: atomic plpgsql in supabase/migrations/0004_quiz_mode.sql
  (advance_question + submit_answer; speed/flat scoring; TS twin
  lib/quiz-scoring.ts). Keep each twin in lockstep with its RPC.
