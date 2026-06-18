import { describe, expect, it } from "vitest";
import {
  buildRequest,
  parseStatements,
  SYSTEM_PROMPT,
} from "@/lib/ai/generate";
import { ANTHROPIC_MODEL } from "@/lib/server/llm";

describe("buildRequest", () => {
  it("targets the current Opus model with adaptive thinking", () => {
    const body = buildRequest({
      theme: "konfirmantleir",
      audience: "kirke",
      count: 30,
    });
    expect(body.model).toBe(ANTHROPIC_MODEL);
    expect(body.model).toBe("claude-opus-4-8");
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.system).toBe(SYSTEM_PROMPT);
  });

  it("puts the theme + audience + count in the user message", () => {
    const body = buildRequest({
      theme: "menighetsweekend",
      audience: "kirke",
      count: 28,
    });
    const msgs = body.messages as { role: string; content: string }[];
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content).toContain("menighetsweekend");
    expect(msgs[0].content).toContain("28");
  });

  it("system prompt encodes the safety bar", () => {
    expect(SYSTEM_PROMPT).toContain("kropp");
    expect(SYSTEM_PROMPT).toContain("familiesituasjon");
    expect(SYSTEM_PROMPT).toContain("økonomi");
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("gotcha");
  });
});

// Canned Anthropic Messages API response fixtures — no network, no key.
function fixture(text: string): unknown {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
  };
}

describe("parseStatements", () => {
  it("parses a clean JSON response", () => {
    const r = fixture(
      JSON.stringify({ statements: ["Spiller et instrument", "Har vært på leir"] }),
    );
    expect(parseStatements(r)).toEqual([
      "Spiller et instrument",
      "Har vært på leir",
    ]);
  });

  it("tolerates a fenced ```json code block", () => {
    const r = fixture(
      'Her er forslagene:\n```json\n{"statements": ["Liker te", "Kan sykle"]}\n```',
    );
    expect(parseStatements(r)).toEqual(["Liker te", "Kan sykle"]);
  });

  it("tolerates prose around a raw JSON object", () => {
    const r = fixture('Sure! {"statements": ["A", "B"]} Hope that helps.');
    expect(parseStatements(r)).toEqual(["A", "B"]);
  });

  it("interleaves thinking blocks and keeps only text", () => {
    const r = {
      content: [
        { type: "thinking", thinking: "let me think" },
        { type: "text", text: '{"statements": ["X"]}' },
      ],
    };
    expect(parseStatements(r)).toEqual(["X"]);
  });

  it("trims and drops empty strings", () => {
    const r = fixture(JSON.stringify({ statements: ["  Hei  ", "", "  "] }));
    expect(parseStatements(r)).toEqual(["Hei"]);
  });

  it("returns [] on garbled / non-JSON output", () => {
    expect(parseStatements(fixture("sorry, I cannot"))).toEqual([]);
  });

  it("returns [] when statements is missing or not an array", () => {
    expect(parseStatements(fixture('{"foo": 1}'))).toEqual([]);
    expect(parseStatements(fixture('{"statements": "nope"}'))).toEqual([]);
  });

  it("returns [] on a malformed response shape (never throws)", () => {
    expect(parseStatements(null)).toEqual([]);
    expect(parseStatements({})).toEqual([]);
    expect(parseStatements({ content: "nope" })).toEqual([]);
  });
});
