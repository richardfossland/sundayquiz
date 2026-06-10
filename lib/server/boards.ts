// Board generation (spec §0.4): each player's grid is a random sample +
// shuffle from the statement pool, so boards differ. Pure + injectable RNG so
// it is deterministic under test. Generation is not race-prone (one insert
// per player, guarded by the boards (game_id, player_id) unique constraint),
// so it lives in TS rather than SQL.

import type { Rng } from "@/lib/codes";
import { BoardCell, GridSize } from "@/lib/types";

export interface PoolStatement {
  id: string;
  text: string;
}

/** Fisher–Yates shuffle (copy, not in place). */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** How many statements a config needs from the pool. */
export function cellsNeeded(gridSize: GridSize, freeCentre: boolean): number {
  const total = gridSize * gridSize;
  return freeCentre && gridSize % 2 === 1 ? total - 1 : total;
}

/** Generate one player's board: random sample + shuffle, row-major. Free
 * centre (odd grids only) becomes `{ free: true }` at the middle index. */
export function generateBoard(
  pool: readonly PoolStatement[],
  gridSize: GridSize,
  freeCentre: boolean,
  rng: Rng = Math.random,
): BoardCell[] {
  const needed = cellsNeeded(gridSize, freeCentre);
  if (pool.length < needed) {
    throw new Error("pool_too_small");
  }
  const sample = shuffle(pool, rng).slice(0, needed);
  const cells: BoardCell[] = sample.map((s) => ({
    statementId: s.id,
    text: s.text,
  }));
  if (needed < gridSize * gridSize) {
    cells.splice(Math.floor((gridSize * gridSize) / 2), 0, { free: true });
  }
  return cells;
}
