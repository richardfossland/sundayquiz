// Win-condition evaluation — TypeScript twin of quiz.eval_win in
// supabase/migrations/0002_mark_rpcs.sql. The SQL function is authoritative
// (it runs inside respond_mark); this twin exists for client-side display
// ("én rute igjen til bingo!") and so the logic is unit-testable. Keep the two
// in lockstep.

import { BoardCell, WinCondition, isFreeCell } from "./types";

function isOn(cells: BoardCell[], marked: ReadonlySet<number>, i: number): boolean {
  const cell = cells[i];
  return marked.has(i) || (cell !== undefined && isFreeCell(cell));
}

/** All index-lines (rows, columns, both diagonals) for an n×n grid. */
export function gridLines(n: number): number[][] {
  const lines: number[][] = [];
  for (let r = 0; r < n; r++) {
    lines.push(Array.from({ length: n }, (_, c) => r * n + c));
  }
  for (let c = 0; c < n; c++) {
    lines.push(Array.from({ length: n }, (_, r) => r * n + c));
  }
  lines.push(Array.from({ length: n }, (_, r) => r * n + r));
  lines.push(Array.from({ length: n }, (_, r) => r * n + (n - 1 - r)));
  return lines;
}

export function completedLines(
  cells: BoardCell[],
  marked: ReadonlySet<number>,
  gridSize: number,
): number[][] {
  return gridLines(gridSize).filter((line) =>
    line.every((i) => isOn(cells, marked, i)),
  );
}

export function evalWin(
  cells: BoardCell[],
  marked: ReadonlySet<number>,
  gridSize: number,
  condition: WinCondition,
): boolean {
  if (condition === "blackout") {
    for (let i = 0; i < gridSize * gridSize; i++) {
      if (!isOn(cells, marked, i)) return false;
    }
    return true;
  }
  const lines = completedLines(cells, marked, gridSize).length;
  return condition === "two_lines" ? lines >= 2 : lines >= 1;
}
