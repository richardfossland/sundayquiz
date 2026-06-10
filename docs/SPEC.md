# SundayQuiz — Build Plan & Technical Specification

**Target:** A live, social game platform for classrooms and church gatherings. First shipped game mode: **Bli-kjent-bingo** (human bingo / icebreaker bingo) — peer-verified, phone-based, with a big-screen board. Architecture is built as a *platform* so that quiz (Kahoot-style Q&A) and announcer-bingo can be added as modes later without restructuring.

**Deployment target:** `quiz.sundaysuite.app`.

**Naming decision (deliberate):** the product is called SundayQuiz even though the first module is bingo. SundayQuiz is the umbrella for all live "join with a code and play together" experiences in the suite. Bingo proves the platform; quiz mode is the obvious second module and the domain name anticipates it. Do not build quiz mode in v1 — but do not paint it into a corner either (see §2 and §10).

**Relationship to siblings:** reuses the SundaySjakk/SundayTurnering patterns — PIN join, resume codes, board-vs-participant split, Supabase Broadcast/Presence, onboarding wizard, Norwegian-first locale. Participants DO have devices (like SundaySjakk, unlike SundayTurnering). No realtime rules engine needed; event volume is low (a mark every few seconds at most).

**This document is the source of truth.** Build in phase order; respect "Done when" gates.

---

## 0. Decisions already made (fixed constraints)

1. **First module = Bli-kjent-bingo.** Each player gets a personal grid (4×4 default, 3×3 and 5×5 selectable) of statements ("har vært i utlandet i år", "spiller et instrument"). To mark a square, the player must find *another person in the room* who matches the statement, and that person **confirms on their own phone**. The game is a social engine: the mechanic forces conversation.
2. **Peer verification is the core mechanic, and it must be featherweight.** Flow: A taps a square → picks B from a live player list (searchable) → B gets a one-tap prompt: "Kristian sier at du spiller et instrument — stemmer det?" → Ja/Nei. On Ja, the square marks. One tap for the verifier, no typing. A pending request times out after 60s and returns the square to unmarked.
3. **Same person can only verify a limited number of your squares** (default 1, configurable 1–3). This is THE anti-cluster rule: it forces players to spread out instead of two friends filling each other's boards. Enforced server-side.
4. **Randomised boards from a statement pool.** The host picks/creates a statement *set* (pool ≥ grid size; recommended pool ≈ 1.5–2× grid cells). Each player's grid is a random sample + shuffle, so boards differ. Free centre square is OFF by default (it's a 4×4 world here, and centre-free only applies to odd grids; offer it for 3×3/5×5).
5. **Win conditions configurable in onboarding:** first **row/column/diagonal** (default), **two lines**, or **fullt brett (blackout)**. Game continues after first bingo until the host ends it — multiple bingo moments are celebrated, ranked by time. The host decides when the game is over (gatherings have natural endings; don't hard-stop people mid-conversation).
6. **Statement sets are first-class content.** Bundled Norwegian starter sets ship with the app (see §7). Hosts can edit a copy, build from scratch (bulk-paste one per line), and — with an optional Sunday account — save sets for reuse. Without an account, the set lives only in that game.
7. **Identity = codes, not accounts** (same as SundaySjakk): 6-digit game PIN on the big screen, display name on join, personal resume code for crash recovery. Host gets a host resume code; optional real account to reopen games and save sets.
8. **Single-session, in-room, synchronous.** Resume codes are crash recovery, not async play.
9. **The ending is a feature: the connection graph.** Every verified mark is an edge "A met B". At game end, the board screen shows a celebration: total conversations sparked, the connection graph (names as nodes, verifications as edges), most-connected players, and the bingo podium. For a church wanting newcomers to feel seen, this is the emotional payoff — invest in it.
10. **Privacy:** display names only, host is told in onboarding to use first names. Statements must never be sensitive (the bundled sets model this). No photos, no PII. The connection graph is shown live in the room, not published anywhere.

---

## 1. Tech stack

- **Framework:** Next.js (App Router), TypeScript, mounted at `quiz.sundaysuite.app`.
- **DB + realtime + auth:** Supabase. Broadcast for game events (marks, bingos, game state), Presence for the live player roster (which also powers the "pick a person" verification list). Authoritative state in Postgres; broadcasts are refetch nudges.
- **Server logic:** Next.js Route Handlers. All marking/verification/win-detection server-side — a bingo claim is validated against stored state, never trusted from the client (same philosophy as SundaySjakk moves, vastly simpler).
- **Graph rendering (end screen):** a small force-directed layout. Use d3-force on a canvas/SVG; keep it dependency-light.
- **Styling:** SundaySuite tokens; `frontend-design` skill conventions if tokens are absent. Norwegian (Bokmål) first, strings in `no.ts`.

---

## 2. Platform shape (so quiz mode fits later)

Model a **game** as: `game_type` + type-specific config + a shared shell (PIN, players, resume codes, board screen, lifecycle status). The shell (Phases 1) is generic; bingo is the first `game_type='bingo'`. A future `game_type='quiz'` reuses the shell untouched. Do NOT abstract the in-game logic itself — bingo marking and quiz answering share nothing; resist premature generalisation. The reusable parts are exactly: join flow, identity/resume, presence roster, board/participant routing, lifecycle (`lobby → live → finished`), and the celebration framework.

---

## 3. Data model (Postgres)

`uuid` PKs, `timestamptz`, RLS everywhere, clients never write tables directly (service role via API routes).

```
games
  id            uuid pk
  join_pin      text unique          -- 6 digits
  host_code     text
  host_user_id  uuid null
  game_type     text                 -- 'bingo' (v1)
  title         text
  status        text                 -- 'lobby' | 'live' | 'finished'
  config        jsonb                -- bingo: { gridSize:3|4|5, winCondition:'line'|'two_lines'|'blackout',
                                     --          maxVerificationsPerPair:int, freeCentre:bool,
                                     --          statementSetId:uuid }
  created_at    timestamptz default now()

players
  id            uuid pk
  game_id       uuid fk
  display_name  text
  resume_code   text                 -- unique within game
  status        text                 -- 'active' | 'left'
  joined_at     timestamptz default now()

statement_sets
  id            uuid pk
  owner_user_id uuid null            -- null = bundled/built-in set
  title         text
  audience      text                 -- 'kirke' | 'skole' | 'generell' (filter chips)
  is_builtin    bool default false
  language      text default 'nb'

statements
  id            uuid pk
  set_id        uuid fk
  text          text                 -- "Har vært i utlandet i år"
  sort_order    int

boards                                -- one per player per game
  id            uuid pk
  game_id       uuid fk
  player_id     uuid fk unique-per-game
  cells         jsonb                -- ordered array of { statementId, row, col }
  bingo_at      timestamptz null     -- first time this board hit the win condition
  bingo_rank    int null

marks
  id            uuid pk
  game_id       uuid fk
  board_id      uuid fk
  cell_index    int
  claimer_id    uuid fk -> players   -- whose board
  verifier_id   uuid fk -> players   -- who confirmed
  status        text                 -- 'pending' | 'confirmed' | 'rejected' | 'expired'
  created_at    timestamptz default now()
  resolved_at   timestamptz null
```

`marks` doubles as the **edge list for the connection graph** (confirmed rows) and the audit trail. Pair-limit rule = count confirmed marks per (claimer, verifier) pair, enforced in the mark-creation endpoint. Note the pair limit is directional but SHOULD be checked both ways combined if config says so — v1: count both directions together (A↔B is one relationship).

---

## 4. The verification flow (the critical path)

1. A taps an unmarked square → participant UI shows the live roster (Presence-backed, searchable, minus A themself) → A picks B.
2. POST `/api/mark` `{ boardId, cellIndex, verifierId }`. Server checks: game live, cell unmarked, no pending mark on the cell, pair limit not exceeded. Creates `marks(status='pending')`, broadcasts a targeted event to B.
3. B's phone shows a non-blocking banner/sheet: "**Kristian** sier at du *spiller et instrument* — stemmer det?" → **Ja** / **Nei**. (If B is mid-verification of their own square, queue the prompts; never stack modals.)
4. POST `/api/mark/respond` → server flips to confirmed/rejected, marks the cell, re-evaluates win condition **server-side** on confirm. If bingo: set `bingo_at`, assign `bingo_rank`, broadcast a `bingo` event (board screen celebrates, all phones get a toast).
5. Pending marks expire after 60s (cron or lazy expiry on next read) → cell returns to tappable, A is told "ingen respons — prøv igjen eller spør noen andre".
6. Reconnect: resume code → fetch board + marks → exact state restored, including any pending prompt waiting for the player.

**Anti-abuse niceties:** B can tap Nei without social awkwardness (A just sees "ikke bekreftet"). Rate-limit mark creation per player (e.g. 1 pending at a time, max N per minute) so nobody spams the room.

**Done when:** two phones complete the full claim→confirm→mark loop in under 3 seconds; pair limit blocks a third mutual verification; a killed tab resumes to identical state including a pending incoming prompt; win detection fires exactly once per board and ranks correctly across simultaneous bingos.

---

## 5. The three surfaces

### Board / big screen (`/board/[gameId]`)
- **Lobby:** giant PIN + QR + join URL, live roster bubbling in (Presence), player count, "Start"-knapp status (host starts from their phone OR from the board — both work).
- **Live:** ambient and glanceable, NOT a wall of data. Show: total squares marked (a filling progress bar for the whole room), a live ticker of recent connections ("Maria ✓ Jonas — spiller fotball"), bingo celebrations as full-screen moments (confetti, name, time), bingo leaderboard so far. Do NOT show individual boards — the game happens between people, the screen is atmosphere + momentum.
- **Finished:** the payoff screen (§0.9): connection graph animating in, stats (X samtaler, mest sosiale spiller, raskeste bingo), podium.

### Participant (`/play` → PIN → name → resume code)
- Their grid, fat touch targets, marked cells visually distinct (verifier's name shown small in the cell).
- Tap cell → roster picker → waiting state on the cell ("venter på Maria…").
- Incoming verification prompts as a bottom sheet, one at a time, queued.
- Bingo state: celebration + "fortsett å fylle brettet" (game continues to blackout/host-end).

### Host (`/host/[gameId]`, the host's phone — host is usually also playing or walking the room)
- Pre-game: pick/edit statement set, config (grid size, win condition, pair limit), open lobby.
- Live: start/end game, kick a player, see a compact status (marks count, bingos), manually expire a stuck pending mark.
- Host can join as a player too (toggle at start) — in small groups the leader playing along matters.

---

## 6. Onboarding wizard (host, pre-lobby)

1. **Hva slags samling?** chips: Kirke/ungdomsgruppe, Skoleklasse, Annet → filters suggested sets.
2. **Velg utsagnssett:** bundled sets shown as cards with preview; "Lag eget" → editor (add/edit lines, bulk-paste one-per-line, min count validated against grid size); "Kopier og tilpass" on any bundled set. Account holders see their saved sets and can save new ones.
3. **Brett og regler:** grid 3×3 / 4×4 (default) / 5×5; win condition (line default, two lines, blackout); pair limit (1 default); free centre toggle (odd grids only).
4. **Oppsummering → Opprett** → PIN + host code, lobby opens on board.
Defaults are good enough that steps 3 can be skipped entirely; a leader should get from landing page to open lobby in under 60 seconds using a bundled set.

Config locks at start. Statement set edits lock at start (boards are sampled from it).

---

## 7. Bundled statement sets (ship with v1, Norwegian)

Author these as seed data, ~25–35 statements each, all safe/inclusive (nothing about body, family situation, economy, or beliefs-as-gotcha):

1. **Bli kjent — generell** ("Har vært i utlandet i år", "Spiller et instrument", "Har en yngre søster", "Liker vinter bedre enn sommer", "Har sett soloppgangen i år"…)
2. **Bli kjent — ungdomsskole** (school-flavoured: "Går eller sykler til skolen", "Har vunnet noe i en konkurranse", "Kan navnet på alle lærerne sine"…)
3. **Ny i menigheten / kirkekveld** (warm, low-threshold: "Har gått i denne kirka i mindre enn ett år", "Spiller eller synger", "Har vært på leir", "Lager god kaffe"…)
4. **Jul/sesong** (one seasonal set to model that sets can be themed).

Write these carefully — they ARE the product experience for a first-time host. Tone: varm, inkluderende, null flaut.

---

## 8. Build phases (strict order)

**Phase 0 — Skeleton.** Next.js at subdomain, Supabase, tables + RLS, locale, seed script for bundled sets. Done when: routes render, seeds load.

**Phase 1 — Shell: join, lobby, presence, resume.** Generic game shell (§2): create game (hardcoded config), PIN join, names, resume codes, board lobby with live roster, lifecycle statuses. Done when: 3 phones join and appear on the board; resume code restores a session; host can flip lobby→live→finished.

**Phase 2 — Boards & the verification loop.** Board generation (random sample per player), participant grid UI, full §4 mark flow with pair limit, expiry, queued prompts, server-side win detection. **Spend the most time here.** Done when: §4 "Done when" passes with 4 real devices.

**Phase 3 — Board screen live experience.** Progress, ticker, bingo celebration moments, leaderboard. Done when: a bingo on a phone produces a board celebration within 1s.

**Phase 4 — Onboarding + statement set editor.** Full §6 wizard, set editor with bulk paste, copy-and-customise, account save (if logged in). Done when: a fresh host reaches an open lobby in <60s with a bundled set, and can create a custom set end-to-end.

**Phase 5 — The finale.** Connection graph (d3-force), end-of-game stats, podium, host "avslutt spillet" flow. Done when: a finished 10-player game renders a correct, readable graph and accurate stats.

**Phase 6 — Polish.** Reconnect hardening, empty/error states, accessibility (contrast, reduced motion for confetti), Norwegian copy review, projector layout pass, rate limiting, lazy mark expiry verified.

**Phase 7 — Suite integration.** Subdomain deploy, shared tokens, optional suite auth for saved sets and reopening games.

---

## 9. Explicit non-goals for v1

- No quiz (Q&A) mode — platform-ready, not built.
- No announcer-bingo mode (leader calls out items) — natural v2, same boards, different marking.
- No teams/pairs play.
- No photos or avatars.
- No public/published results; the graph lives in the room.
- No moderation queue for custom statements (the host owns their room) — but bundled sets model good tone.
- No offline mode.

## 10. Open questions to revisit later (non-blocking)

- Quiz mode (the namesake): when built, it reuses the §2 shell wholesale; plan it as its own document.
- Announcer-bingo: cheap second module; decide after v1 ships.
- Should confirmed connections optionally show *what* the statement was on the end graph edges? (Fun, but busier — try in Phase 5 and judge visually.)
- Export the end screen as an image (share to the youth group chat)? Easy win later; the suite has rendering tooling.

---

### Shared with siblings
PIN/resume-code identity, Broadcast/Presence usage, board-vs-participant split, onboarding-wizard style, Norwegian-first locale file, "server decides, client displays" philosophy. Keep visual consistency with SundaySjakk and SundayTurnering; separate codebase/deploy.
