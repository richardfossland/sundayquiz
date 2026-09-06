# Decisions

Lightweight ADRs. Newest first.

---

## ADR-001 — TypeScript 7 via `@typescript/native`; the `typescript` name stays on the 6.0 API; Next uses the API type-checker

- **Date:** 2026-09-06
- **Status:** accepted
- **Context:**

  TypeScript 7 is the native (Go) compiler. Adopting it in a Next/OpenNext app
  runs into two independent tools that both reach for the bare package name
  `typescript`, and want different things from it.

  1. **typescript-eslint** (which `eslint-config-next/typescript` pulls in)
     declares `typescript: ">=4.8.4 <6.1.0"` on every published channel and
     hard-throws at import time on TS >= 7:
     `Error: typescript-eslint does not support TS 7.0.`
     Note that `npm install` does **not** fail on this — it emits an ERESOLVE
     warning at most and installs TS 7 anyway. The break only appears when
     eslint runs. Tracking: typescript-eslint#10940.

  2. **Next 16** type-checks the build by resolving `typescript/package.json`
     and reading `packageJson.bin.tsc`, then spawning that file as a
     subprocess (`experimental.useTypeScriptCli`, which defaults to **true**).

- **Decision:**

  Use the side-by-side layout Microsoft documents in the TS 7.0 announcement —
  two npm aliases instead of one dependency:

  ```json
  "@typescript/native": "npm:typescript@~7.0.2",
  "typescript":         "npm:@typescript/typescript6@^6.0.2"
  ```

  `node_modules/.bin/tsc` therefore resolves to TS 7 (used by `npm run
  typecheck`, and so by `npm run check` and CI), while `require("typescript")`
  resolves to the TS 6.0 API that typescript-eslint parses with. The compat
  package deliberately names its binary `tsc6` so the two never collide.

  Because the compat package has no `bin.tsc`, Next's default CLI type-checker
  finds nothing to spawn and aborts the build. So we additionally set
  `experimental.useTypeScriptCli: false` in `next.config.ts`, which moves Next
  onto its in-process API type-checker. That path needs
  `typescript/lib/typescript.js` instead — which the compat package does ship,
  and which is exactly the API Next 16 asks for by name (its own auto-install
  hint for that slot is `typescript@^6.0.0`).

- **Consequences:**

  - **The `"typescript": "npm:@typescript/typescript6@..."` line is not a
    downgrade.** It is the parser API for eslint and the type-check API for
    Next. The compiler is `@typescript/native`. Do not "fix" it back to
    `"typescript": "^7"` — that re-breaks `npm run lint`.
  - **`experimental.useTypeScriptCli: false` is load-bearing, not a preference.**
    Remove it and `next build` / `npm run cf:build` fail with
    "It looks like you're trying to use TypeScript but do not have the required
    package(s) installed".
  - Type checking happens twice, at two versions: `npm run typecheck` runs the
    real TS 7 compiler over the whole project, and `next build` re-checks with
    the TS 6 API (verified: it still fails the build on a type error). TS 7 is
    the authoritative gate; nothing is left unchecked, one check is simply a
    version behind.
  - eslint *parses* with TS 6. Syntax only TS 7 understands would typecheck but
    fail to lint. We use no such syntax today.
  - `eslint-config-next/typescript` is `typescript-eslint/recommended`, i.e. not
    type-aware, so no rule reads TS 6 semantics while `tsc` reads TS 7. (Probed
    separately: type-aware rules *do* work against the TS 6 parser and our
    TS 7-shaped tsconfig, so enabling them later is possible — it would just
    make the version split meaningful and should be revisited then.)
  - Revisit when typescript-eslint ships TS >= 7.1 support
    (typescript-eslint#10940). At that point both aliases collapse back into a
    single `"typescript": "^7"`, and `useTypeScriptCli` can go back to its
    default — Next 16's CLI path already has explicit TS 7 handling.

- **TS 7 default changes, and why they did not bite here:**

  TS 7 removes `baseUrl` (`paths` targets are now relative to the tsconfig and
  need a leading `./`), removes `moduleResolution: node`/`node10`/`classic` and
  `target: es5`, and flips `strict`, `module: esnext`,
  `noUncheckedSideEffectImports: true` and `types: []` to be the defaults.

  Our `tsconfig.json` needed **no changes at all**: it never had `baseUrl`, its
  `paths` target was already `./*`, and it already set `moduleResolution:
  "bundler"`, `module: "esnext"`, `strict: true`.

  The two new defaults that *would* have bitten are both neutralised by Next's
  own ambient types — `next/types/global.d.ts` carries
  `/// <reference types="node" />`, `declare module '*.css'` and a
  `server-only` declaration:

  - `types: []` would otherwise drop `@types/node`, and this app uses `process`
    and `__dirname` widely.
  - `noUncheckedSideEffectImports: true` would otherwise reject
    `import "./globals.css"` and the twelve `import "server-only"` lines
    (`server-only` is not even installed as a real package — Next resolves it
    at bundle time).

  That rescue reaches the program through `next.config.ts`'s `import ... from
  "next"`, not only through `next-env.d.ts` — which matters because
  `next-env.d.ts` is gitignored and therefore absent on a fresh CI checkout.
  Verified: typecheck is clean with both `next-env.d.ts` and `.next/` deleted.

---
