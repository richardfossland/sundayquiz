import { describe, expect, it } from "vitest";
import {
  checkStatement,
  sanitizeStatements,
  MAX_LEN,
} from "@/lib/ai/safety";

describe("checkStatement — accepts warm/inclusive statements", () => {
  const good = [
    "Har vært i utlandet i år",
    "Spiller et instrument",
    "Liker vinter bedre enn sommer",
    "Har vært på leir",
    "Synger i koret",
    "Lager god kaffe",
    "Kan plystre en hel melodi",
    "Har bakt brød selv",
  ];
  for (const s of good) {
    it(`accepts "${s}"`, () => {
      expect(checkStatement(s).ok).toBe(true);
    });
  }
});

describe("checkStatement — rejects the SPEC §10 safety bar", () => {
  it("rejects body/appearance", () => {
    expect(checkStatement("Veier mindre enn 70 kg").reason).toBe("body");
    expect(checkStatement("Synes egen kropp er fin").reason).toBe("body");
    expect(checkStatement("Har hatt en spiseforstyrrelse").reason).toBe("body");
  });

  it("rejects family situation", () => {
    expect(checkStatement("Har skilte foreldre").reason).toBe("family");
    expect(checkStatement("Har mistet noen i år").reason).toBe("family");
    expect(checkStatement("Er adoptert").reason).toBe("family");
  });

  it("rejects economy/money", () => {
    expect(checkStatement("Har god råd").reason).toBe("economy");
    expect(checkStatement("Tjener mye penger").reason).toBe("economy");
    expect(checkStatement("Er arbeidsløs").reason).toBe("economy");
  });

  it("rejects beliefs-as-gotcha", () => {
    expect(checkStatement("Er frelst").reason).toBe("belief_gotcha");
    expect(checkStatement("Tror på Gud").reason).toBe("belief_gotcha");
    expect(checkStatement("Ber hver dag").reason).toBe("belief_gotcha");
  });
});

describe("checkStatement — diacritic folding", () => {
  it("catches banned stems written with æ/ø/å", () => {
    // "lønn" folds to "lonn" which matches the "loenn" stem
    expect(checkStatement("Har høyere lønn enn snittet").reason).toBe("economy");
    // "død" folds to "dod" matching "doed"
    expect(checkStatement("Har opplevd dødsfall nær").reason).toBe("family");
  });
});

describe("checkStatement — shape rules", () => {
  it("rejects too-short", () => {
    expect(checkStatement("a").reason).toBe("too_short");
  });
  it("rejects too-long", () => {
    expect(checkStatement("x".repeat(MAX_LEN + 1)).reason).toBe("too_long");
  });
  it("rejects multiline", () => {
    expect(checkStatement("Har vært på leir\nog likte det").reason).toBe(
      "multiline",
    );
  });
  it("rejects questions", () => {
    expect(checkStatement("Liker du kaffe?").reason).toBe("is_question");
  });
});

describe("checkStatement — boundary anchoring avoids false positives", () => {
  it("does not flag 'rekord' for the 'kort' stem", () => {
    expect(checkStatement("Har satt en personlig rekord i år").ok).toBe(true);
  });
});

describe("sanitizeStatements", () => {
  it("filters banned, keeps good, in order", () => {
    const { accepted, rejected } = sanitizeStatements([
      "Spiller et instrument",
      "Er frelst",
      "Har vært på leir",
      "Tjener mye penger",
    ]);
    expect(accepted).toEqual(["Spiller et instrument", "Har vært på leir"]);
    expect(rejected.map((r) => r.reason)).toEqual([
      "belief_gotcha",
      "economy",
    ]);
  });

  it("de-duplicates case-insensitively without counting as rejection", () => {
    const { accepted, rejected } = sanitizeStatements([
      "Spiller et instrument",
      "spiller et instrument",
      "  Spiller et instrument  ",
    ]);
    expect(accepted).toEqual(["Spiller et instrument"]);
    expect(rejected).toHaveLength(0);
  });

  it("returns empty accepted when everything is unsafe", () => {
    const { accepted } = sanitizeStatements(["Er frelst", "Har god råd"]);
    expect(accepted).toEqual([]);
  });
});
