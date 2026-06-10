"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { channels } from "@/lib/realtime";
import { useChannel } from "@/lib/client/useChannel";

const POLL_MS = 5000;

/** Authoritative-state hook: fetch on mount, refetch on every broadcast hint,
 * on tab focus/online, and on a polling backstop while visible (the poll also
 * drives lazy mark-expiry on the server). `fetcher` must be stable or wrapped
 * in useCallback by the caller. */
export function useGameState<T>(
  gameId: string | null,
  fetcher: (() => Promise<T | null>) | null,
  onEvent?: (event: string, payload: Record<string, unknown>) => void,
) {
  const [state, setState] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);
  const fetcherRef = useRef(fetcher);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    fetcherRef.current = fetcher;
    onEventRef.current = onEvent;
  });

  const refetch = useCallback(async () => {
    const f = fetcherRef.current;
    if (!f || inflight.current) return;
    inflight.current = true;
    try {
      const next = await f();
      if (next !== null) {
        setState(next);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch_failed");
    } finally {
      inflight.current = false;
    }
  }, []);

  // Initial + whenever the game changes.
  useEffect(() => {
    if (gameId && fetcher) void refetch();
  }, [gameId, fetcher, refetch]);

  // Broadcast hints → refetch (and let the caller react to specific events,
  // e.g. fire confetti on `bingo`).
  useChannel(gameId ? channels.game(gameId) : null, (event, payload) => {
    onEventRef.current?.(event, payload);
    void refetch();
  });

  // Reconnect hardening: tab focus / network back → re-sync missed hints.
  useEffect(() => {
    if (!gameId) return;
    const sync = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", sync);
    const timer = setInterval(sync, POLL_MS);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", sync);
      clearInterval(timer);
    };
  }, [gameId, refetch]);

  return { state, error, refetch };
}
