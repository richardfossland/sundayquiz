"use client";

// Local persistence of bearer identities for crash-recovery (spec §0.7). Only
// codes live here — never authoritative game state, which is always refetched
// from the server on mount.

const HOST_KEY = (id: string) => `quiz:host:${id}`;
const PLAYER_KEY = "quiz:player"; // single active player session per browser

export interface StoredPlayer {
  gameId: string;
  playerId: string;
  resumeCode: string;
  displayName: string;
}

export const identity = {
  saveHostCode(gameId: string, hostCode: string) {
    try {
      localStorage.setItem(HOST_KEY(gameId), hostCode);
    } catch {}
  },
  hostCode(gameId: string): string | null {
    try {
      return localStorage.getItem(HOST_KEY(gameId));
    } catch {
      return null;
    }
  },
  savePlayer(p: StoredPlayer) {
    try {
      localStorage.setItem(PLAYER_KEY, JSON.stringify(p));
    } catch {}
  },
  player(): StoredPlayer | null {
    try {
      const raw = localStorage.getItem(PLAYER_KEY);
      return raw ? (JSON.parse(raw) as StoredPlayer) : null;
    } catch {
      return null;
    }
  },
  clearPlayer() {
    try {
      localStorage.removeItem(PLAYER_KEY);
    } catch {}
  },
};
