import { describe, expect, it } from "vitest";
import { rpcErrorStatus } from "@/lib/server/errors";

describe("rpcErrorStatus", () => {
  it("maps known RPC codes to HTTP statuses", () => {
    expect(rpcErrorStatus("pair_limit")).toEqual({ status: 409, code: "pair_limit" });
    expect(rpcErrorStatus("cell_taken")).toEqual({ status: 409, code: "cell_taken" });
    expect(rpcErrorStatus("already_pending").status).toBe(409);
    expect(rpcErrorStatus("mark_not_found").status).toBe(404);
    expect(rpcErrorStatus("not_your_mark").status).toBe(403);
    expect(rpcErrorStatus("game_not_live").status).toBe(409);
    expect(rpcErrorStatus("pool_too_small").status).toBe(400);
  });
  it("falls back to 500/internal for unknown messages", () => {
    expect(rpcErrorStatus("connection refused")).toEqual({
      status: 500,
      code: "internal",
    });
  });
  it("tolerates surrounding whitespace", () => {
    expect(rpcErrorStatus(" pair_limit ").code).toBe("pair_limit");
  });
});
