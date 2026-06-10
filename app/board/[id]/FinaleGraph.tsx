"use client";

// The connection graph (spec §0.9): names as nodes, verifications as edges.
// d3-force layout rendered as SVG; multi-edges between a pair collapse to one
// line whose width grows with the number of shared statements.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { Finale } from "@/lib/dto";

interface Node extends SimulationNodeDatum {
  id: string;
  name: string;
  degree: number;
}
interface Link extends SimulationLinkDatum<Node> {
  weight: number;
}

const W = 920;
const H = 560;

export function FinaleGraph({ finale }: { finale: Finale }) {
  const { nodes, links } = useMemo(() => {
    const nodes: Node[] = finale.players
      .filter((p) => p.degree > 0)
      .map((p) => ({ id: p.id, name: p.name, degree: p.degree }));
    const ids = new Set(nodes.map((n) => n.id));
    const byPair = new Map<string, Link>();
    for (const e of finale.edges) {
      if (!ids.has(e.claimerId) || !ids.has(e.verifierId)) continue;
      const [a, b] = [e.claimerId, e.verifierId].sort();
      const key = `${a}:${b}`;
      const existing = byPair.get(key);
      if (existing) existing.weight += 1;
      else byPair.set(key, { source: a, target: b, weight: 1 });
    }
    return { nodes, links: [...byPair.values()] };
  }, [finale]);

  const [tick, setTick] = useState(0);
  const simDone = useRef(false);

  useEffect(() => {
    if (nodes.length === 0) return;
    simDone.current = false;
    const sim = forceSimulation<Node>(nodes)
      .force(
        "link",
        forceLink<Node, Link>(links)
          .id((d) => d.id)
          .distance(110)
          .strength(0.5),
      )
      .force("charge", forceManyBody().strength(-260))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide(38))
      .on("tick", () => setTick((n) => n + 1))
      .on("end", () => {
        simDone.current = true;
      });
    return () => {
      sim.stop();
    };
  }, [nodes, links]);

  if (nodes.length === 0) {
    return (
      <div className="graph-shell center-screen" style={{ minHeight: 280 }}>
        <p className="faint">Ingen bekreftede møter å tegne ennå.</p>
      </div>
    );
  }

  const maxDegree = Math.max(...nodes.map((n) => n.degree), 1);

  return (
    <div className="graph-shell">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        data-tick={tick}
        role="img"
        aria-label="Graf over hvem som snakket med hvem"
      >
        {links.map((l, i) => {
          const s = l.source as Node;
          const t = l.target as Node;
          if (s.x === undefined || t.x === undefined) return null;
          return (
            <line
              key={i}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke="rgba(235, 184, 75, 0.4)"
              strokeWidth={1 + Math.min(l.weight, 4)}
            />
          );
        })}
        {nodes.map((n) => {
          if (n.x === undefined || n.y === undefined) return null;
          const r = 14 + (n.degree / maxDegree) * 14;
          return (
            <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
              <circle
                r={r}
                fill="url(#goldGrad)"
                stroke="rgba(255,255,255,0.25)"
              />
              <text
                y={r + 16}
                textAnchor="middle"
                fill="var(--txt)"
                fontSize={14}
                fontWeight={700}
                fontFamily="var(--body)"
              >
                {n.name}
              </text>
            </g>
          );
        })}
        <defs>
          <radialGradient id="goldGrad">
            <stop offset="0%" stopColor="#f6dd97" />
            <stop offset="100%" stopColor="#c9982f" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}
