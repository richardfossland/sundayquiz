import { describe, it, expect, vi } from "vitest";

// The rate-limit key is derived from clientIp; if that key is spoofable the
// per-IP limit (incl. the costly AI-generate endpoint) is trivially bypassed.
import { clientIp, rateLimit } from "@/lib/server/http";

const reqWith = (headers: Record<string, string>) =>
  new Request("https://quiz.example/api", { headers });

let n = 0;
const uniqueKey = (p: string) => `${p}-${n++}`;

describe("clientIp — the rate-limit key must not be spoofable", () => {
  it("prefers Cloudflare's non-spoofable CF-Connecting-IP", () => {
    expect(clientIp(reqWith({ "cf-connecting-ip": "1.2.3.4" }))).toBe("1.2.3.4");
  });

  it("ignores a spoofed X-Forwarded-For when CF-Connecting-IP is present", () => {
    // attacker prepends a rotating fake hop to dodge the per-IP limit
    expect(
      clientIp(reqWith({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "5.5.5.5, 1.2.3.4" })),
    ).toBe("1.2.3.4");
  });

  it("falls back to the first X-Forwarded-For hop when there is no CF header", () => {
    expect(clientIp(reqWith({ "x-forwarded-for": "8.8.8.8, 9.9.9.9" }))).toBe("8.8.8.8");
  });

  it("falls back to a constant when no IP header is present", () => {
    expect(clientIp(reqWith({}))).toBe("local");
  });
});

describe("rateLimit", () => {
  it("allows up to the limit, then blocks within the window", () => {
    const key = uniqueKey("allow");
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(false);
  });

  it("resets once the window elapses", () => {
    vi.useFakeTimers();
    try {
      const key = uniqueKey("reset");
      expect(rateLimit(key, 1, 1_000)).toBe(true);
      expect(rateLimit(key, 1, 1_000)).toBe(false);
      vi.advanceTimersByTime(1_001);
      expect(rateLimit(key, 1, 1_000)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
