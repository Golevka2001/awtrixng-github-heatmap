# CLAUDE.md

Guidance for AI coding agents working in this repository.

## What this is

A GitHub contribution heatmap for AWTRIX NG (32×8 LED matrix clock). Two components, each deliberately a single file:

- `github-heatmap.ax` — AWTRIX NG custom app written in Berry. No imports: the refresh/poll logic is inlined so the app stays one paste-able script.
- `worker/` — Cloudflare Worker. Zero npm dependencies by design.

The worker renders everything server-side and returns a JSON array of exactly 256 packed `0xRRGGBB` integers; the app only paints pixels. The app treats any response that is not exactly 256 integers as a failure and backs off — never change the response shape.

## Commands

- `cd worker && node test.mjs` — offline tests for the rendering logic. Zero dependencies; no `npm install` needed.
- `cd worker && npx wrangler dev` — run the worker locally. Needs `.dev.vars` with `GITHUB_TOKEN=ghp_...` (gitignored — never commit it).
- Deploy: `npx wrangler secret put GITHUB_TOKEN`, then `npx wrangler deploy`.
- The `.ax` app has no build step; upload it in the AWTRIX NG web UI.

## Rendering contract (worker → app)

- 256 integers, row-major: index `i` → column `i/8`, row `i%8`.
- Newest week is the rightmost column; 32 columns ≈ the last 32 weeks.
- Rows 1–7 map Sunday–Saturday. Row 0 holds the month marker: grey (`0x666666`), or a per-month hue when rainbow is on.
- Request options: `X-User` header or `?user=` (required); `X-Rainbow` (default on); `X-Split` (default off — a week straddling two months shares one column; when on, each month gets its own column, newest rightmost).

## Berry notes (`github-heatmap.ax`)

- Blocks close with `end`; lambdas are `/ x -> ...`; there is no Berry formatter — match the existing 2-space style by hand.
- The device has a 96 KB heap. The app parses responses with `re.matchall` instead of `json.load`, and serializes TLS handshakes across apps through `shared` keys (concurrent handshakes OOM the device). Keep that logic; its comments document constraints that are not visible in code.

## Worker notes

- Only web-standard APIs (`fetch`, `URL`, `Response`) so it can run outside Cloudflare. Do not add npm dependencies.
- `GITHUB_TOKEN` is a classic PAT with `read:user`; only public data is read.
- Tests use fixed dates (no `Date.now()`) and must stay deterministic.

## Conventions

- Commit messages: conventional style, lowercase, terse — `feat: rainbow month markers`.
- Worker options mirror 1:1 as bool `@config` entries in the app, forwarded as `X-` headers. Defaults encode the v1 behavior: rainbow on, split off.

## Deliberately absent

- Avatar display (left 8×8 panel) is not in this version. An earlier implementation (GraphQL `avatarUrl`, jpeg-js/upng-js decoding, contrast boost, `X-Avatar`/`X-Contrast`) was dropped with v1; a full backup of that code exists outside this repo (`../awtrixng-github-heatmap-backup-20260829` on the original machine). Re-adding the feature means bringing back those dependencies — which conflicts with the zero-dependency worker note above.
