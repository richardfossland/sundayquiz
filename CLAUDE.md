# SundayQuiz

Live social game platform (first module: bli-kjent-bingo) at quiz.sundaysuite.app.
Spec: docs/SPEC.md. Gate: `npm run check` (tsc + eslint + vitest).
Supabase: shared project, dedicated `quiz` schema — all writes via API routes
(service role); the mark/win logic is atomic plpgsql RPCs in
supabase/migrations/0002_mark_rpcs.sql (TS twin in lib/winning.ts — keep in lockstep).
