// Public view shapes returned by the state endpoint, per role. Resume codes
// and host codes never appear in any DTO — they are bearer tokens that travel
// only in request bodies.

import { BingoConfig, GameStatus, MarkStatus } from "./types";

export interface RosterEntry {
  id: string;
  name: string;
  isHost: boolean;
  status: "active" | "left" | "kicked";
}

export interface CellView {
  index: number;
  text: string;
  free: boolean;
  mark: {
    status: Extract<MarkStatus, "pending" | "confirmed">;
    verifierId: string;
    verifierName: string;
  } | null;
}

export interface PendingPrompt {
  markId: string;
  claimerId: string;
  claimerName: string;
  statementText: string;
  createdAt: string;
}

export interface TickerItem {
  claimerName: string;
  verifierName: string;
  statementText: string;
  at: string;
}

export interface PodiumEntry {
  playerId: string;
  name: string;
  rank: number;
  at: string;
  secondsFromStart: number | null;
}

export interface Finale {
  players: { id: string; name: string; degree: number }[];
  edges: { claimerId: string; verifierId: string; statementText: string }[];
  podium: PodiumEntry[];
  totals: {
    confirmedMarks: number;
    uniquePairs: number;
    playersConnected: number;
  };
}

interface StateBase {
  gameId: string;
  title: string;
  status: GameStatus;
  config: BingoConfig;
  roster: RosterEntry[];
}

export interface BoardState extends StateBase {
  joinPin: string;
  progress: { confirmed: number; totalCells: number };
  ticker: TickerItem[];
  podium: PodiumEntry[];
  finale: Finale | null;
}

export interface PlayerState extends StateBase {
  playerId: string;
  board: {
    cells: CellView[];
    bingoAt: string | null;
    bingoRank: number | null;
  } | null; // null while in lobby
  incoming: PendingPrompt[]; // oldest first — client shows one at a time
  outgoing: {
    markId: string;
    cellIndex: number;
    verifierId: string;
    verifierName: string;
  } | null;
  podium: PodiumEntry[];
}

export interface HostState extends BoardState {
  pendingMarks: {
    markId: string;
    claimerName: string;
    verifierName: string;
    statementText: string;
    ageSec: number;
  }[];
}

export interface StatementSetSummary {
  id: string;
  title: string;
  audience: "kirke" | "skole" | "generell";
  isBuiltin: boolean;
  statementCount: number;
}

export interface StatementSetDetail {
  id: string;
  title: string;
  audience: "kirke" | "skole" | "generell";
  isBuiltin: boolean;
  statements: { id: string; text: string }[];
}
