---
name: Witch Extension Architecture
description: v11 extension design decisions — passive capture, no auto-click, overlay, RNG probing
---

# Witch Game Analyzer Pro v11 — Architecture

## Core rule: ZERO AUTO-CLICKING, ever
- The user explicitly requires no auto-clicking in any form
- `autoPlay` state and `startAutoClick()` have been completely removed from content.js and witch-analyzer.tsx
- All auto-click functions from previous versions (v1–v10) are stripped

## How it works
1. `injected.js` injects at `document_start` before Play button is visible
2. Hooks `window.fetch`, `XMLHttpRequest`, and `WebSocket` passively
3. Scans EVERY response for `RS[0].F` (1xbet Witch grid: 10 rows × 5 booleans, true=safe)
4. Sends data to `content.js` via `window.postMessage({ source: 'witch-injected-v11' })`
5. `content.js` shows a floating overlay panel on the game page with per-row safe cell recommendations
6. Grid history stored in `localStorage` key `witch_grids_v3` (max 300 entries)

## Message protocol
- injected → content: `{ source: 'witch-injected-v11', type, data, ts }`
- content → injected: `{ source: 'witch-content-v11', cmd, ...payload }`
- content → background: `chrome.runtime.sendMessage({ type, data })`

## Key message types (injected → content)
- `ready` — injected.js loaded, historyCount included
- `grid_captured` — RS[0].F grid found, includes frequency table
- `seeds_extracted` — crypto/seed fields found in any response
- `rng_analysis` — LCG/hash pattern analysis result
- `request` / `response` — passive network capture
- `probe_result` — result of a manual server probe

## Grid confidence levels in overlay
- 🟢 Live Grid: RS[0].F found in a real response this session
- 🟡 Statistical: frequency table from localStorage history (N games)
- ⚫ No Data: nothing captured yet

## Server WebSocket (background.js → /ws/witch)
- background.js connects to `/ws` at the server URL
- Sends `hello` message on connect with version + totalGames
- Server (routes.ts) handles: `grid_captured`, `seeds_extracted`, `rng_analysis`, `probe_result`, `hello`, `ping`
- Server relays ALL extension messages to webapp clients (witchClients)

## RNG Analysis (injected.js)
- Extracts fields matching: seed, nonce, hash, key, salt, AN, SB, BS, AI, RN, token, random, entropy, serverSeed, etc.
- Detects LINEAR_SEQUENCE (constant increment = LCG additive component)
- Detects LCG_MODULUS (common power-of-2 moduli)
- Detects HEX_HASH fields (SHA-256=64 chars, MD5=32, SHA-1=40)
- Predictions only possible with LINEAR_SEQUENCE pattern

## Server probe tool
- `window.__witch_probe(config)` in injected.js sends fetch using original (unhooked) fetch
- Content.js sends `probe` command to injected.js, injected.js does the actual request
- Popup has rapid probe mode: N requests at 300ms intervals to detect seed sequence

## Browser corruption prevention
- All arrays bounded (max 300 grids, max 500 requests/responses)
- localStorage writes bounded and try/catch'd
- No response modification — only observation
- No infinite loops

**Why:** Previous versions (v1-v10) caused browser issues via aggressive DOM manipulation, unbounded localStorage, and auto-clicking that interfered with the game's event handling.
