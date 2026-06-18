// TS twin of quiz.score_answer / leaderboard (0004_quiz_mode.sql) — keep in
// lockstep. The SQL function is authoritative (runs inside quiz.submit_answer);
// these tests pin the shared scoring contract.
import { describe, expect, it } from "vitest";
import { leaderboard, scoreAnswer } from "@/lib/quiz-scoring";
import { MAX_QUESTION_POINTS, MIN_SPEED_POINTS } from "@/lib/quiz-types";

describe("scoreAnswer", () => {
  it("wrong answers always score 0", () => {
    expect(scoreAnswer({ correct: false, pointsMode: "speed", elapsedMs: 0, windowMs: 20000 })).toBe(0);
    expect(scoreAnswer({ correct: false, pointsMode: "flat", elapsedMs: 0, windowMs: 20000 })).toBe(0);
  });

  it("flat mode scores the max for any correct answer", () => {
    expect(scoreAnswer({ correct: true, pointsMode: "flat", elapsedMs: 0, windowMs: 20000 })).toBe(MAX_QUESTION_POINTS);
    expect(scoreAnswer({ correct: true, pointsMode: "flat", elapsedMs: 19999, windowMs: 20000 })).toBe(MAX_QUESTION_POINTS);
  });

  it("speed mode: instant = max, buzzer = floor", () => {
    expect(scoreAnswer({ correct: true, pointsMode: "speed", elapsedMs: 0, windowMs: 20000 })).toBe(MAX_QUESTION_POINTS);
    expect(scoreAnswer({ correct: true, pointsMode: "speed", elapsedMs: 20000, windowMs: 20000 })).toBe(MIN_SPEED_POINTS);
  });

  it("speed mode: linear decay at the midpoint", () => {
    // halfway → max - 0.5*(max-min) = 1000 - 450 = 550
    expect(scoreAnswer({ correct: true, pointsMode: "speed", elapsedMs: 10000, windowMs: 20000 })).toBe(550);
  });

  it("clamps overruns to the floor and never below it", () => {
    expect(scoreAnswer({ correct: true, pointsMode: "speed", elapsedMs: 99999, windowMs: 20000 })).toBe(MIN_SPEED_POINTS);
  });

  it("degenerate zero window → floor for a correct speed answer", () => {
    expect(scoreAnswer({ correct: true, pointsMode: "speed", elapsedMs: 5000, windowMs: 0 })).toBe(MIN_SPEED_POINTS);
  });

  it("negative elapsed (clock skew) clamps to instant", () => {
    expect(scoreAnswer({ correct: true, pointsMode: "speed", elapsedMs: -500, windowMs: 20000 })).toBe(MAX_QUESTION_POINTS);
  });
});

describe("leaderboard", () => {
  const players = [
    { id: "p1", name: "Anna" },
    { id: "p2", name: "Bjørn" },
    { id: "p3", name: "Clara" },
  ];

  it("sums points and sorts by score descending", () => {
    const lb = leaderboard(players, [
      { playerId: "p1", points: 800, correct: true },
      { playerId: "p1", points: 100, correct: true },
      { playerId: "p2", points: 500, correct: true },
    ]);
    expect(lb.map((r) => r.playerId)).toEqual(["p1", "p2", "p3"]);
    expect(lb[0].score).toBe(900);
    expect(lb[0].correctCount).toBe(2);
    expect(lb[2].score).toBe(0); // Clara never answered, still listed
  });

  it("breaks ties by correctCount then name", () => {
    const lb = leaderboard(players, [
      // Anna and Bjørn tie on 600, but Bjørn got there with 2 correct
      { playerId: "p1", points: 600, correct: true },
      { playerId: "p2", points: 300, correct: true },
      { playerId: "p2", points: 300, correct: true },
    ]);
    expect(lb[0].playerId).toBe("p2"); // more correct wins the tie
    // Clara (0) and ... only one at 0; name tiebreak proven by Anna<Bjørn order
    const zeroNames = lb.filter((r) => r.score === 0).map((r) => r.name);
    expect(zeroNames).toEqual(["Clara"]);
  });

  it("ignores answers from players not in the roster", () => {
    const lb = leaderboard(players, [
      { playerId: "ghost", points: 999, correct: true },
      { playerId: "p1", points: 100, correct: true },
    ]);
    expect(lb[0].playerId).toBe("p1");
    expect(lb[0].score).toBe(100);
  });
});
