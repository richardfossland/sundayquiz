import "server-only";

// Assembles the per-role view DTOs from authoritative rows. The state GET is
// the refetch target for every realtime hint, so it must always be a complete,
// self-consistent snapshot.

import {
  BoardState,
  CellView,
  Finale,
  HostState,
  PendingPrompt,
  PlayerState,
  PodiumEntry,
  TickerItem,
} from "@/lib/dto";
import { BoardRow, GameRow, MarkRow, PlayerRow, isFreeCell } from "@/lib/types";
import { listBoards, listMarks, listPlayers } from "@/lib/server/store";

const TICKER_SIZE = 20;

function rosterOf(players: PlayerRow[]) {
  return players.map((p) => ({
    id: p.id,
    name: p.display_name,
    isHost: p.is_host,
    status: p.status,
  }));
}

function nameMap(players: PlayerRow[]): Map<string, string> {
  return new Map(players.map((p) => [p.id, p.display_name]));
}

function podiumOf(
  boards: BoardRow[],
  players: PlayerRow[],
  game: GameRow,
): PodiumEntry[] {
  const names = nameMap(players);
  const started = game.started_at ? Date.parse(game.started_at) : null;
  return boards
    .filter((b) => b.bingo_at !== null && b.bingo_rank !== null)
    .sort((a, b) => (a.bingo_rank ?? 0) - (b.bingo_rank ?? 0))
    .map((b) => ({
      playerId: b.player_id,
      name: names.get(b.player_id) ?? "?",
      rank: b.bingo_rank as number,
      at: b.bingo_at as string,
      secondsFromStart:
        started !== null
          ? Math.round((Date.parse(b.bingo_at as string) - started) / 1000)
          : null,
    }));
}

function buildFinale(
  marks: MarkRow[],
  players: PlayerRow[],
  boards: BoardRow[],
  game: GameRow,
): Finale {
  const confirmed = marks.filter((m) => m.status === "confirmed");
  const partners = new Map<string, Set<string>>();
  const pairs = new Set<string>();
  for (const m of confirmed) {
    const [a, b] = [m.claimer_id, m.verifier_id].sort();
    pairs.add(`${a}:${b}`);
    if (!partners.has(a)) partners.set(a, new Set());
    if (!partners.has(b)) partners.set(b, new Set());
    partners.get(a)!.add(b);
    partners.get(b)!.add(a);
  }
  return {
    players: players
      .filter((p) => p.status === "active" || partners.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.display_name,
        degree: partners.get(p.id)?.size ?? 0,
      })),
    edges: confirmed.map((m) => ({
      claimerId: m.claimer_id,
      verifierId: m.verifier_id,
      statementText: m.statement_text,
    })),
    podium: podiumOf(boards, players, game),
    totals: {
      confirmedMarks: confirmed.length,
      uniquePairs: pairs.size,
      playersConnected: [...partners.values()].filter((s) => s.size > 0).length,
    },
  };
}

export async function buildBoardState(game: GameRow): Promise<BoardState> {
  const [players, boards, marks] = await Promise.all([
    listPlayers(game.id),
    listBoards(game.id),
    listMarks(game.id),
  ]);
  const names = nameMap(players);
  const confirmed = marks.filter((m) => m.status === "confirmed");
  const gridTotal = game.config.gridSize * game.config.gridSize;
  const activeBoards = boards.length;

  const ticker: TickerItem[] = confirmed
    .slice(-TICKER_SIZE)
    .reverse()
    .map((m) => ({
      claimerName: names.get(m.claimer_id) ?? "?",
      verifierName: names.get(m.verifier_id) ?? "?",
      statementText: m.statement_text,
      at: m.resolved_at ?? m.created_at,
    }));

  return {
    gameId: game.id,
    title: game.title,
    status: game.status,
    config: game.config,
    joinPin: game.join_pin,
    roster: rosterOf(players),
    progress: { confirmed: confirmed.length, totalCells: activeBoards * gridTotal },
    ticker,
    podium: podiumOf(boards, players, game),
    finale:
      game.status === "finished"
        ? buildFinale(marks, players, boards, game)
        : null,
  };
}

export async function buildPlayerState(
  game: GameRow,
  player: PlayerRow,
): Promise<PlayerState> {
  const [players, boards, marks] = await Promise.all([
    listPlayers(game.id),
    listBoards(game.id),
    listMarks(game.id),
  ]);
  const names = nameMap(players);
  const board = boards.find((b) => b.player_id === player.id) ?? null;

  let cells: CellView[] | null = null;
  let outgoing: PlayerState["outgoing"] = null;
  if (board) {
    const byCell = new Map<number, MarkRow>();
    for (const m of marks) {
      if (
        m.board_id === board.id &&
        (m.status === "pending" || m.status === "confirmed")
      ) {
        byCell.set(m.cell_index, m);
      }
    }
    cells = board.cells.map((cell, index) => {
      const free = isFreeCell(cell);
      const m = byCell.get(index);
      return {
        index,
        text: free ? "" : cell.text,
        free,
        mark: m
          ? {
              status: m.status as "pending" | "confirmed",
              verifierId: m.verifier_id,
              verifierName: names.get(m.verifier_id) ?? "?",
            }
          : null,
      };
    });
    const pendingOut = marks.find(
      (m) => m.board_id === board.id && m.status === "pending",
    );
    if (pendingOut) {
      outgoing = {
        markId: pendingOut.id,
        cellIndex: pendingOut.cell_index,
        verifierId: pendingOut.verifier_id,
        verifierName: names.get(pendingOut.verifier_id) ?? "?",
      };
    }
  }

  const incoming: PendingPrompt[] = marks
    .filter((m) => m.verifier_id === player.id && m.status === "pending")
    .map((m) => ({
      markId: m.id,
      claimerId: m.claimer_id,
      claimerName: names.get(m.claimer_id) ?? "?",
      statementText: m.statement_text,
      createdAt: m.created_at,
    }));

  return {
    gameId: game.id,
    title: game.title,
    status: game.status,
    config: game.config,
    roster: rosterOf(players),
    playerId: player.id,
    board: board
      ? { cells: cells!, bingoAt: board.bingo_at, bingoRank: board.bingo_rank }
      : null,
    incoming,
    outgoing,
    podium: podiumOf(boards, players, game),
  };
}

export async function buildHostState(game: GameRow): Promise<HostState> {
  const base = await buildBoardState(game);
  const [players, marks] = await Promise.all([
    listPlayers(game.id),
    listMarks(game.id),
  ]);
  const names = nameMap(players);
  const now = Date.now();
  return {
    ...base,
    pendingMarks: marks
      .filter((m) => m.status === "pending")
      .map((m) => ({
        markId: m.id,
        claimerName: names.get(m.claimer_id) ?? "?",
        verifierName: names.get(m.verifier_id) ?? "?",
        statementText: m.statement_text,
        ageSec: Math.round((now - Date.parse(m.created_at)) / 1000),
      })),
  };
}
