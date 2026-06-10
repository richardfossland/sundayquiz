import { describe, expect, it } from "vitest";
import { cellsNeeded, generateBoard, shuffle } from "@/lib/server/boards";
import { isFreeCell } from "@/lib/types";

const pool = Array.from({ length: 30 }, (_, i) => ({
  id: `s${i}`,
  text: `Utsagn ${i}`,
}));

function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("shuffle", () => {
  it("keeps all elements and does not mutate the input", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, lcg(7));
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
  it("is deterministic under an injected RNG", () => {
    expect(shuffle([1, 2, 3, 4], lcg(42))).toEqual(shuffle([1, 2, 3, 4], lcg(42)));
  });
});

describe("cellsNeeded", () => {
  it("is the full grid without free centre", () => {
    expect(cellsNeeded(4, false)).toBe(16);
    expect(cellsNeeded(5, false)).toBe(25);
  });
  it("subtracts one only for odd grids with free centre", () => {
    expect(cellsNeeded(3, true)).toBe(8);
    expect(cellsNeeded(5, true)).toBe(24);
    expect(cellsNeeded(4, true)).toBe(16); // even grid: freeCentre is a no-op
  });
});

describe("generateBoard", () => {
  it("produces gridSize² unique statements", () => {
    const cells = generateBoard(pool, 4, false, lcg(1));
    expect(cells).toHaveLength(16);
    const ids = cells.map((c) => (isFreeCell(c) ? "free" : c.statementId));
    expect(new Set(ids).size).toBe(16);
  });

  it("places the free centre at the middle index on odd grids", () => {
    const cells = generateBoard(pool, 5, true, lcg(2));
    expect(cells).toHaveLength(25);
    expect(isFreeCell(cells[12])).toBe(true);
    expect(cells.filter((c) => isFreeCell(c))).toHaveLength(1);
  });

  it("gives different players different boards", () => {
    const a = generateBoard(pool, 4, false, lcg(3));
    const b = generateBoard(pool, 4, false, lcg(99));
    expect(a.map((c) => (isFreeCell(c) ? "" : c.statementId)).join(",")).not.toBe(
      b.map((c) => (isFreeCell(c) ? "" : c.statementId)).join(","),
    );
  });

  it("rejects a pool smaller than the grid", () => {
    expect(() => generateBoard(pool.slice(0, 10), 4, false, lcg(4))).toThrow(
      "pool_too_small",
    );
  });
});
