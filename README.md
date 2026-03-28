# Short Link Bot

Short Link Bot is a modular ESM Node.js automation that visits short link services, attempts to bypass intermediate pages, captures HAR-like traces, and records leads/debug artifacts.

## Quick Scripts

- `npm run run:main` — Run the main orchestrator (`index.js`).
- `npm run run:single` — Run a single debug/headful run (`run_single.js`).
- `npm run start:server` — Start control server (`control-server.js`).
- `npm run dev:server` — Start control server under `nodemon` for development.
- `npm run clean` — Remove common debug artifacts produced by runs.
- `npm run audit` — Run `npm audit` and save JSON to `npm-audit.json`.
- `npm run audit:fix` — Attempt `npm audit fix`.

## Environment Flags

- `HEADFUL=1` — Run Puppeteer in headful mode.
- `NO_PROXY=1` — Disable proxy usage.
- `SINGLE_LINK` — Provide a single short link to run against.
- `HAR_CAPTURE=1` — Enable HAR-like capture (writes `last_run_har.json`).

## Useful files

- `index.js` — Main orchestrator.
- `run_single.js` — Single-run debug harness (HAR, screenshot, debug page).
- `control-server.js` — Control UI server (Express + SSE).
- `lib/` — Helper modules.
- `public/` — Web UI assets.

## Audit and Cleanup

1. Install dependencies:

```bash
npm install
```

2. Run an audit:

```bash
npm run audit
# review npm-audit.json
```

3. Clean debug artifacts:

```bash
npm run clean
```

If you want me to run the audit and produce findings, say "Run audit now" and I'll execute `npm run audit` and report results.
