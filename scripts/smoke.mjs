// End-to-end smoke against a running server (dev or prod):
//   BASE=http://localhost:3000 node scripts/smoke.mjs
// Drives the full bingo loop: create → join ×4 → start (host plays) →
// claim/confirm/reject/pair-limit/one-pending → bingo rank 1 + 2 → host
// force-expire → late join → resume → end → finale payload.

const BASE = process.env.BASE || "http://localhost:3000";
const BUILTIN_SET = "a1000000-0000-4000-8000-000000000001";

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}
const post = (path, body) => req("POST", path, body);
const get = (path) => req("GET", path);

async function main() {
  console.log(`Smoke against ${BASE}`);

  // 1. Create a 3×3 line game, pair limit 1.
  const created = await post("/api/games", {
    title: "Røyktest",
    config: { gridSize: 3, winCondition: "line", maxVerificationsPerPair: 1, freeCentre: false },
    statementSet: { id: BUILTIN_SET },
  });
  check("create game", created.status === 200 && created.json?.gameId, JSON.stringify(created.json));
  const { gameId, joinPin, hostCode } = created.json;

  // 2. Four players join in the lobby.
  const players = {};
  for (const name of ["Anna", "Bjørn", "Clara", "David"]) {
    const j = await post("/api/join", { pin: joinPin, displayName: name });
    check(`join ${name}`, j.status === 200 && j.json?.playerId);
    players[name] = j.json;
  }

  // 3. Board state shows the lobby roster.
  let board = await get(`/api/games/${gameId}/state?role=board`);
  check("board lobby", board.json?.status === "lobby");
  check("roster 4", board.json?.roster?.filter((r) => r.status === "active").length === 4);

  // 4. Start, host plays along.
  const started = await post(`/api/games/${gameId}/start`, {
    hostCode,
    hostPlays: { displayName: "Vert" },
  });
  check("start", started.status === 200 && started.json?.playerId);
  players["Vert"] = {
    playerId: started.json.playerId,
    resumeCode: started.json.resumeCode,
    gameId,
  };

  const pstate = (name) =>
    post(`/api/games/${gameId}/state`, {
      role: "player",
      playerId: players[name].playerId,
      code: players[name].resumeCode,
    });

  let anna = await pstate("Anna");
  check("Anna live board 9 cells", anna.json?.board?.cells?.length === 9, JSON.stringify(anna.json)?.slice(0, 200));

  const claim = (claimer, cellIndex, verifier) =>
    post("/api/mark", {
      gameId,
      playerId: players[claimer].playerId,
      code: players[claimer].resumeCode,
      cellIndex,
      verifierId: players[verifier].playerId,
    });
  const respond = (verifier, markId, accept) =>
    post("/api/mark/respond", {
      gameId,
      playerId: players[verifier].playerId,
      code: players[verifier].resumeCode,
      markId,
      accept,
    });

  // 5. Claim → one-pending guard → confirm.
  const m0 = await claim("Anna", 0, "Bjørn");
  check("claim cell0", m0.status === 200 && m0.json?.markId, JSON.stringify(m0.json));
  const dup = await claim("Anna", 1, "Clara");
  check("second pending rejected (already_pending)", dup.status === 409 && dup.json?.error === "already_pending", JSON.stringify(dup.json));

  // Verifier sees the incoming prompt.
  let bj = await pstate("Bjørn");
  check("Bjørn has incoming prompt", bj.json?.incoming?.length === 1 && bj.json.incoming[0].claimerName === "Anna");

  const r0 = await respond("Bjørn", m0.json.markId, true);
  check("confirm cell0", r0.status === 200 && r0.json?.status === "confirmed");

  // 6. Pair limit blocks Anna↔Bjørn again.
  const pl = await claim("Anna", 1, "Bjørn");
  check("pair limit blocks (Anna↔Bjørn)", pl.status === 409 && pl.json?.error === "pair_limit", JSON.stringify(pl.json));

  // 7. Reject path: Clara says Nei, the cell frees up.
  const m1 = await claim("Anna", 1, "Clara");
  check("claim cell1", m1.status === 200);
  const rj = await respond("Clara", m1.json.markId, false);
  check("reject works", rj.status === 200 && rj.json?.status === "rejected");
  const m1b = await claim("Anna", 1, "Clara");
  check("cell reclaimable after reject", m1b.status === 200, JSON.stringify(m1b.json));
  await respond("Clara", m1b.json.markId, true);

  // 8. Third confirm completes row 0 → bingo rank 1.
  const m2 = await claim("Anna", 2, "David");
  const r2 = await respond("David", m2.json.markId, true);
  check("bingo fires on line completion", r2.json?.bingo?.rank === 1, JSON.stringify(r2.json));
  anna = await pstate("Anna");
  check("Anna board has bingoRank 1", anna.json?.board?.bingoRank === 1);

  // 9. Bjørn races to rank 2 via Clara/David/Vert (Anna is pair-blocked).
  for (const [cell, verifier] of [[0, "Clara"], [1, "David"], [2, "Vert"]]) {
    const m = await claim("Bjørn", cell, verifier);
    check(`Bjørn claim cell${cell}`, m.status === 200, JSON.stringify(m.json));
    const r = await respond(verifier, m.json.markId, true);
    check(`${verifier} confirms`, r.status === 200 && r.json?.status === "confirmed");
    if (cell === 2) check("Bjørn bingo rank 2", r.json?.bingo?.rank === 2, JSON.stringify(r.json));
  }

  // 10. Host force-expires a stuck pending mark.
  const stuck = await claim("Clara", 4, "David");
  check("Clara claim pending", stuck.status === 200);
  const fx = await post(`/api/games/${gameId}/expire-mark`, { hostCode, markId: stuck.json.markId });
  check("host force-expire", fx.status === 200);
  const clara = await pstate("Clara");
  const cell4 = clara.json?.board?.cells?.[4];
  check("expired cell is tappable again", cell4 && cell4.mark === null, JSON.stringify(cell4));

  // 11. Late join during live gets a fresh board.
  const erik = await post("/api/join", { pin: joinPin, displayName: "Erik" });
  check("late join allowed", erik.status === 200);
  players["Erik"] = erik.json;
  const es = await pstate("Erik");
  check("late joiner has a board", es.json?.board?.cells?.length === 9);

  // 12. Resume restores a session.
  const res = await post("/api/resume", { resumeCode: players["Anna"].resumeCode, gameId });
  check("resume Anna", res.status === 200 && res.json?.playerId === players["Anna"].playerId);
  const hres = await post("/api/resume", { resumeCode: hostCode, gameId });
  check("resume host", hres.status === 200 && hres.json?.role === "host");

  // 13. End → finale payload.
  const ended = await post(`/api/games/${gameId}/end`, { hostCode });
  check("end game", ended.status === 200);
  board = await get(`/api/games/${gameId}/state?role=board`);
  const finale = board.json?.finale;
  check("finale present", !!finale);
  check("finale 7 confirmed marks", finale?.totals?.confirmedMarks === 7, JSON.stringify(finale?.totals));
  check("finale podium 2", finale?.podium?.length === 2);
  check(
    "finale edges match",
    finale?.edges?.length === 7 &&
      finale.edges.every((e) => e.statementText.length > 0),
  );
  const annaNode = finale?.players?.find((p) => p.name === "Anna");
  check("Anna degree 3", annaNode?.degree === 3, JSON.stringify(annaNode));

  // 14. Finished game rejects joins; PIN is freed for reuse.
  const lateJoin = await post("/api/join", { pin: joinPin, displayName: "Frida" });
  check("join after finish rejected", lateJoin.status === 404 || lateJoin.status === 409, JSON.stringify(lateJoin.json));

  console.log(failures === 0 ? "\nSMOKE GREEN" : `\nSMOKE RED: ${failures} failures`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
