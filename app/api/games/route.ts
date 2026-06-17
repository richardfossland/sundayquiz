import { createGame } from "@/lib/server/store";
import { fail, ok, readJson, rateLimit, clientIp } from "@/lib/server/http";
import { rpcErrorStatus } from "@/lib/server/errors";
import { cellsNeeded } from "@/lib/server/boards";
import { listStatements } from "@/lib/server/store";
import { BingoConfig, DEFAULT_CONFIG, GridSize, WinCondition } from "@/lib/types";
import { createQuizGame, listQuestions } from "@/lib/server/quiz-store";
import { DEFAULT_QUIZ_CONFIG, PointsMode } from "@/lib/quiz-types";

interface CreatePayload {
  gameType?: "bingo" | "quiz";
  title?: string;
  config?: Partial<Omit<BingoConfig, "statementSetId">>;
  statementSet?: { id: string } | { title?: string; statements?: string[] };
  // quiz mode
  quizConfig?: { perQuestionSeconds?: number; pointsMode?: PointsMode };
  questionSet?:
    | { id: string }
    | {
        title?: string;
        questions?: {
          prompt: string;
          options: string[];
          correctIndex: number;
        }[];
      };
}

const GRIDS: GridSize[] = [3, 4, 5];
const WINS: WinCondition[] = ["line", "two_lines", "blackout"];

// POST /api/games — host creates a game from the wizard. game_type routes to
// bingo (statement-set boards) or quiz (a shared question stream). Config locks
// at start; until then this is the only write path for it.
export async function POST(req: Request) {
  if (!rateLimit(`create:${clientIp(req)}`, 10, 60_000)) {
    return fail(429, "rate_limited");
  }
  const body = await readJson<CreatePayload>(req);
  if (!body) return fail(400, "bad_request");
  if (body.gameType === "quiz") return createQuiz(body);
  if (!body?.statementSet) return fail(400, "missing_set");

  const gridSize = (body.config?.gridSize ?? DEFAULT_CONFIG.gridSize) as GridSize;
  const winCondition = (body.config?.winCondition ??
    DEFAULT_CONFIG.winCondition) as WinCondition;
  const maxPair = body.config?.maxVerificationsPerPair ?? 1;
  const freeCentre = body.config?.freeCentre ?? false;

  if (!GRIDS.includes(gridSize)) return fail(400, "invalid_grid");
  if (!WINS.includes(winCondition)) return fail(400, "invalid_win");
  if (!Number.isInteger(maxPair) || maxPair < 1 || maxPair > 3) {
    return fail(400, "invalid_pair_limit");
  }

  const config = {
    gridSize,
    winCondition,
    maxVerificationsPerPair: maxPair,
    // Free centre only applies to odd grids (spec §0.4).
    freeCentre: freeCentre && gridSize % 2 === 1,
  };

  // Validate the pool up front so the host hears about a too-small set in the
  // wizard, not when starting the game.
  const needed = cellsNeeded(config.gridSize, config.freeCentre);
  let statementSet: { id: string } | { title: string; statements: string[] };
  if ("id" in body.statementSet && body.statementSet.id) {
    const pool = await listStatements(body.statementSet.id);
    if (pool.length < needed) return fail(400, "pool_too_small");
    statementSet = { id: body.statementSet.id };
  } else {
    const statements = (
      ("statements" in body.statementSet ? body.statementSet.statements : []) ??
      []
    )
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0 && s.length <= 200)
      .slice(0, 200);
    if (statements.length < needed) return fail(400, "pool_too_small");
    statementSet = {
      title:
        ("title" in body.statementSet ? body.statementSet.title : "") ||
        "Eget sett",
      statements,
    };
  }

  try {
    const { game, joinPin, hostCode } = await createGame({
      title: (body.title ?? "").toString().slice(0, 80),
      config,
      statementSet,
    });
    return ok({ gameId: game.id, joinPin, hostCode });
  } catch (err) {
    const { status, code } = rpcErrorStatus((err as Error).message);
    console.error("[games:create]", err);
    return fail(status === 500 ? 500 : status, code === "internal" ? "create_failed" : code);
  }
}

const MODES: PointsMode[] = ["speed", "flat"];

// ---------- quiz mode creation ----------
async function createQuiz(body: CreatePayload): Promise<Response> {
  if (!body.questionSet) return fail(400, "missing_set");

  const perQuestionSeconds = Math.max(
    5,
    Math.min(
      180,
      Math.round(
        body.quizConfig?.perQuestionSeconds ??
          DEFAULT_QUIZ_CONFIG.perQuestionSeconds,
      ),
    ),
  );
  const pointsMode = (body.quizConfig?.pointsMode ??
    DEFAULT_QUIZ_CONFIG.pointsMode) as PointsMode;
  if (!MODES.includes(pointsMode)) return fail(400, "invalid_points_mode");

  // A quiz needs at least one question.
  let questionSet:
    | { id: string }
    | {
        title: string;
        questions: { prompt: string; options: string[]; correctIndex: number }[];
      };
  if ("id" in body.questionSet && body.questionSet.id) {
    const pool = await listQuestions(body.questionSet.id);
    if (pool.length < 1) return fail(400, "pool_too_small");
    questionSet = { id: body.questionSet.id };
  } else {
    const raw =
      ("questions" in body.questionSet ? body.questionSet.questions : []) ?? [];
    const questions = raw
      .map((q) => ({
        prompt: String(q?.prompt ?? "").trim().slice(0, 300),
        options: Array.isArray(q?.options)
          ? q.options.map((o) => String(o ?? "").trim().slice(0, 120))
          : [],
        correctIndex: Number(q?.correctIndex),
      }))
      .filter(
        (q) =>
          q.prompt.length > 0 &&
          q.options.length === 4 &&
          q.options.every((o) => o.length > 0) &&
          Number.isInteger(q.correctIndex) &&
          q.correctIndex >= 0 &&
          q.correctIndex <= 3,
      )
      .slice(0, 60);
    if (questions.length < 1) return fail(400, "pool_too_small");
    questionSet = {
      title:
        ("title" in body.questionSet ? body.questionSet.title : "") ||
        "Eget sett",
      questions,
    };
  }

  try {
    const { game, joinPin, hostCode } = await createQuizGame({
      title: (body.title ?? "").toString().slice(0, 80),
      config: { perQuestionSeconds, pointsMode },
      questionSet,
    });
    return ok({ gameId: game.id, joinPin, hostCode });
  } catch (err) {
    const { status, code } = rpcErrorStatus((err as Error).message);
    console.error("[games:create:quiz]", err);
    return fail(
      status === 500 ? 500 : status,
      code === "internal" ? "create_failed" : code,
    );
  }
}
