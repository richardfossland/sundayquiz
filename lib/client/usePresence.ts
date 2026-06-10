"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { channels } from "@/lib/realtime";

export interface PresencePlayer {
  playerId: string;
  name: string;
  isHost: boolean;
}

/** Live "who is in the room" roster via Supabase Presence on the game channel.
 * Powers the lobby bubbles and the verifier picker. Pass self=null to observe
 * without tracking (board screen). */
export function usePresence(
  gameId: string | null,
  self: PresencePlayer | null,
): PresencePlayer[] {
  const [players, setPlayers] = useState<PresencePlayer[]>([]);

  useEffect(() => {
    if (!gameId) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

    const supabase = createClient();
    const channel = supabase.channel(`${channels.game(gameId)}:presence`, {
      config: { presence: { key: self?.playerId ?? `obs-${Math.random()}` } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const st = channel.presenceState<PresencePlayer>();
      const list: PresencePlayer[] = [];
      for (const key of Object.keys(st)) {
        const meta = st[key][0];
        if (meta && meta.playerId) {
          list.push({
            playerId: meta.playerId,
            name: meta.name,
            isHost: meta.isHost ?? false,
          });
        }
      }
      setPlayers(list);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && self) {
        channel.track({
          playerId: self.playerId,
          name: self.name,
          isHost: self.isHost,
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, self?.playerId, self?.name, self?.isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  return players;
}
