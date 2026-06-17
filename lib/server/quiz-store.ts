import "server-only";

// Data access for QUIZ mode. Parallel to lib/server/store.ts (bingo) but a
// separate module so the two in-game logics never entangle (spec §2). All
// functions use the service-role client; nothing here is browser-reachable.

import { createServiceClient } from "@/lib/supabase/service";
import { generatePin, generateHostCode } from "@/lib/codes";
import { GameRow } from "@/lib/types";
import {
  AnswerRow,
  QuestionRow,
  QuestionSetRow,
  QuizConfig,
  QuizStateRow,
} from "@/lib/quiz-types";

type Db = ReturnType<typeof createServiceClient>;
function db(): Db {
  return createServiceClient();
}
function isUniqueViolation(err: { code?: string } | null): boolean {
  return err?.code === "23505";
}

// ---------- question sets ----------

export async function listQuestionSets(): Promise<
  (QuestionSetRow & { questions: { count: number }[] })[]
> {
  const { data, error } = await db()
    .from("question_sets")
    .select("id,title,audience,is_builtin,game_id,questions(count)")
    .is("game_id", null)
    .order("title");
  if (error) throw new Error(error.message);
  return (
    (data as (QuestionSetRow & { questions: { count: number }[] })[]) ?? []
  );
}

export async function getQuestionSet(
  id: string,
): Promise<QuestionSetRow | null> {
  const { data } = await db()
    .from("question_sets")
    .select()
    .eq("id", id)
    .maybeSingle();
  return (data as QuestionSetRow) ?? null;
}

export async function listQuestions(setId: string): Promise<QuestionRow[]> {
  const { data, error } = await db()
    .from("questions")
    .select()
    .eq("set_id", setId)
    .order("sort_order")
    .order("id");
  if (error) throw new Error(error.message);
  return (data as QuestionRow[]) ?? [];
}

// ---------- game creation (quiz) ----------

export interface CreateQuizInput {
  title: string;
  config: Omit<QuizConfig, "questionSetId">;
  questionSet:
    | { id: string }
    | {
        title: string;
        questions: {
          prompt: string;
          options: string[];
          correctIndex: number;
        }[];
      };
}

export async function createQuizGame(input: CreateQuizInput): Promise<{
  game: GameRow;
  joinPin: string;
  hostCode: string;
}> {
  const client = db();
  const hostCode = generateHostCode();

  let game: GameRow | null = null;
  for (let i = 0; i < 7 && !game; i++) {
    const joinPin = generatePin();
    const { data, error } = await client
      .from("games")
      .insert({
        join_pin: joinPin,
        host_code: hostCode,
        game_type: "quiz",
        title: input.title,
        config: { ...input.config, questionSetId: null },
      })
      .select()
      .single();
    if (error) {
      if (isUniqueViolation(error)) continue;
      throw new Error(error.message);
    }
    game = data as GameRow;
  }
  if (!game) throw new Error("pin_generation_failed");

  // Resolve the question set: a bundled id, or a game-local custom set.
  let setId: string;
  if ("id" in input.questionSet) {
    const set = await getQuestionSet(input.questionSet.id);
    if (!set || set.game_id !== null) throw new Error("set_not_found");
    setId = set.id;
  } else {
    const { data: set, error } = await client
      .from("question_sets")
      .insert({
        title: input.questionSet.title || "Eget sett",
        audience: "generell",
        game_id: game.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setId = (set as QuestionSetRow).id;
    const rows = input.questionSet.questions.map((q, i) => ({
      set_id: setId,
      prompt: q.prompt,
      options: q.options,
      correct_index: q.correctIndex,
      sort_order: i + 1,
    }));
    const { error: qErr } = await client.from("questions").insert(rows);
    if (qErr) throw new Error(qErr.message);
  }

  const config: QuizConfig = { ...input.config, questionSetId: setId };
  const { data: updated, error: cfgErr } = await client
    .from("games")
    .update({ config })
    .eq("id", game.id)
    .select()
    .single();
  if (cfgErr) throw new Error(cfgErr.message);

  const final = updated as GameRow;
  return { game: final, joinPin: final.join_pin, hostCode };
}

// ---------- live state ----------

export async function getQuizState(gameId: string): Promise<QuizStateRow | null> {
  const { data } = await db()
    .from("quiz_state")
    .select()
    .eq("game_id", gameId)
    .maybeSingle();
  return (data as QuizStateRow) ?? null;
}

export async function listAnswers(gameId: string): Promise<AnswerRow[]> {
  const { data, error } = await db()
    .from("answers")
    .select()
    .eq("game_id", gameId);
  if (error) throw new Error(error.message);
  return (data as AnswerRow[]) ?? [];
}

// ---------- atomic RPCs (authoritative; TS twin scoring in lib/quiz-scoring) -

export interface AdvanceResult {
  state: QuizStateRow;
  totalQuestions: number;
}

export async function rpcAdvanceQuestion(args: {
  gameId: string;
  action: "next" | "reveal" | "end";
}): Promise<AdvanceResult> {
  const { data, error } = await db().rpc("advance_question", {
    p_game_id: args.gameId,
    p_action: args.action,
  });
  if (error) throw new Error(error.message);
  return data as AdvanceResult;
}

export async function rpcSubmitAnswer(args: {
  gameId: string;
  playerId: string;
  questionId: string;
  choice: number;
}): Promise<AnswerRow> {
  const { data, error } = await db().rpc("submit_answer", {
    p_game_id: args.gameId,
    p_player_id: args.playerId,
    p_question_id: args.questionId,
    p_choice: args.choice,
  });
  if (error) throw new Error(error.message);
  return data as AnswerRow;
}
