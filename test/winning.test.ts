// TS twin of quiz.eval_win (0002_mark_rpcs.sql) — keep in lockstep.
import { describe, expect, it } from "vitest";
import { completedLines, evalWin, gridLines } from "@/lib/winning";
import { BoardCell } from "@/lib/types";

function plainCells(n: number): BoardCell[] {
  return Array.from({ length: n * n }, (_, i) => ({
    statementId: `s${i}`,
    text: `Utsagn ${i}`,
  }));
}

describe("gridLines", () => {
  it("yields rows + columns + 2 diagonals", () => {
    expect(gridLines(3)).toHaveLength(8);
    expect(gridLines(4)).toHaveLength(10);
    expect(gridLines(5)).toHaveLength(12);
  });
});

describe("evalWin — line", () => {
  const cells = plainCells(4);
  it("detects a complete row", () => {
    expect(evalWin(cells, new Set([4, 5, 6, 7]), 4, "line")).toBe(true);
  });
  it("detects a complete column", () => {
    expect(evalWin(cells, new Set([2, 6, 10, 14]), 4, "line")).toBe(true);
  });
  it("detects the main diagonal", () => {
    expect(evalWin(cells, new Set([0, 5, 10, 15]), 4, "line")).toBe(true);
  });
  it("detects the anti-diagonal", () => {
    expect(evalWin(cells, new Set([3, 6, 9, 12]), 4, "line")).toBe(true);
  });
  it("rejects an incomplete line", () => {
    expect(evalWin(cells, new Set([0, 1, 2]), 4, "line")).toBe(false);
  });
});

describe("evalWin — two_lines", () => {
  const cells = plainCells(3);
  it("needs two completed lines", () => {
    expect(evalWin(cells, new Set([0, 1, 2]), 3, "two_lines")).toBe(false);
    // row 0 + column 0 share cell 0
    expect(evalWin(cells, new Set([0, 1, 2, 3, 6]), 3, "two_lines")).toBe(true);
  });
});

describe("evalWin — blackout", () => {
  const cells = plainCells(3);
  it("requires every cell", () => {
    const all = new Set(Array.from({ length: 9 }, (_, i) => i));
    expect(evalWin(cells, all, 3, "blackout")).toBe(true);
    all.delete(4);
    expect(evalWin(cells, all, 3, "blackout")).toBe(false);
  });
});

describe("evalWin — free centre", () => {
  const cells: BoardCell[] = plainCells(3).map((c, i) =>
    i === 4 ? { free: true } : c,
  );
  it("counts the free cell as marked in lines", () => {
    // middle column: 1, 4(free), 7
    expect(evalWin(cells, new Set([1, 7]), 3, "line")).toBe(true);
    // main diagonal through the centre
    expect(evalWin(cells, new Set([0, 8]), 3, "line")).toBe(true);
  });
  it("counts the free cell in blackout", () => {
    const others = new Set([0, 1, 2, 3, 5, 6, 7, 8]);
    expect(evalWin(cells, others, 3, "blackout")).toBe(true);
  });
  it("reports completed lines for highlighting", () => {
    expect(completedLines(cells, new Set([0, 8]), 3)).toEqual([[0, 4, 8]]);
  });
});
