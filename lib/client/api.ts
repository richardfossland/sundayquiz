"use client";

// Thin typed fetch wrappers for the API routes. Every helper throws an Error
// whose message is the server's machine error code (e.g. "pair_limit") so the
// UI can map it to Norwegian copy.

import {
  BoardState,
  HostState,
  PlayerState,
  StatementSetDetail,
  StatementSetSummary,
} from "@/lib/dto";
import { BingoConfig } from "@/lib/types";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...init,
  });
  const body = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!res.ok) {
    throw new Error(body?.error ?? `http_${res.status}`);
  }
  return body as T;
}

const post = <T>(path: string, payload: unknown) =>
  call<T>(path, { method: "POST", body: JSON.stringify(payload) });

export interface CreateGamePayload {
  title: string;
  config: Omit<BingoConfig, "statementSetId">;
  statementSet: { id: string } | { title: string; statements: string[] };
}

export const api = {
  createGame: (payload: CreateGamePayload) =>
    post<{ gameId: string; joinPin: string; hostCode: string }>(
      "/api/games",
      payload,
    ),

  join: (pin: string, displayName: string) =>
    post<{
      gameId: string;
      playerId: string;
      resumeCode: string;
      displayName: string;
      gameStatus: string;
    }>("/api/join", { pin, displayName }),

  resume: (resumeCode: string, opts: { gameId?: string; pin?: string }) =>
    post<{
      role: "player" | "host";
      gameId: string;
      playerId?: string;
      displayName?: string;
      gameStatus: string;
    }>("/api/resume", { resumeCode, ...opts }),

  boardState: (gameId: string) =>
    call<BoardState>(`/api/games/${gameId}/state?role=board`),

  playerState: (gameId: string, playerId: string, code: string) =>
    post<PlayerState>(`/api/games/${gameId}/state`, {
      role: "player",
      playerId,
      code,
    }),

  hostState: (gameId: string, code: string) =>
    post<HostState>(`/api/games/${gameId}/state`, { role: "host", code }),

  createMark: (args: {
    gameId: string;
    playerId: string;
    code: string;
    cellIndex: number;
    verifierId: string;
  }) => post<{ markId: string }>("/api/mark", args),

  respondMark: (args: {
    gameId: string;
    playerId: string;
    code: string;
    markId: string;
    accept: boolean;
  }) =>
    post<{ status: string; bingo: { rank: number } | null }>(
      "/api/mark/respond",
      args,
    ),

  cancelMark: (args: {
    gameId: string;
    playerId: string;
    code: string;
    markId: string;
  }) => post<{ ok: true }>("/api/mark/cancel", args),

  startGame: (gameId: string, hostCode: string, hostPlays?: { displayName: string }) =>
    post<{ ok: true; playerId?: string; resumeCode?: string }>(
      `/api/games/${gameId}/start`,
      { hostCode, hostPlays },
    ),

  endGame: (gameId: string, hostCode: string) =>
    post<{ ok: true }>(`/api/games/${gameId}/end`, { hostCode }),

  kickPlayer: (gameId: string, hostCode: string, playerId: string) =>
    post<{ ok: true }>(`/api/games/${gameId}/kick`, { hostCode, playerId }),

  expireMark: (gameId: string, hostCode: string, markId: string) =>
    post<{ ok: true }>(`/api/games/${gameId}/expire-mark`, {
      hostCode,
      markId,
    }),

  listSets: () =>
    call<{ sets: StatementSetSummary[]; aiAvailable: boolean }>(
      "/api/statement-sets",
    ),

  getSet: (id: string) => call<StatementSetDetail>(`/api/statement-sets/${id}`),

  generateSet: (theme: string, audience: "kirke" | "skole" | "generell") =>
    post<{
      title: string;
      audience: "kirke" | "skole" | "generell";
      statements: string[];
      rejectedCount: number;
    }>("/api/statement-sets/generate", { theme, audience }),
};
