"use client";

import { useEffect, useState } from "react";

const COLORS = ["#ebb84b", "#f6dd97", "#ff8a5c", "#5ec27a", "#faf7f0"];

interface Piece {
  key: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
}

/** Lightweight CSS confetti burst. Pieces are randomised once after mount
 * (random in an effect keeps render pure); prefers-reduced-motion users see
 * (almost) nothing — the fall animation is globally disabled in globals.css. */
export function Confetti({ count = 80 }: { count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    let cancelled = false;
    requestAnimationFrame(() => {
      if (cancelled) return;
      setPieces(
        Array.from({ length: count }, (_, i) => ({
          key: i,
          left: Math.random() * 100,
          delay: Math.random() * 0.9,
          duration: 2.4 + Math.random() * 2.2,
          color: COLORS[i % COLORS.length],
          rotate: Math.random() * 360,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [count]);

  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.key}
          className="confetti-piece"
          style={{
            left: `${p.left}vw`,
            background: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </>
  );
}
