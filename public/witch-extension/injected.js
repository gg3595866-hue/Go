(function() {
  'use strict';

  // ============================================================
  // WITCH GAME ANALYZER PRO v12.0 — PASSIVE ONLY, NO AUTO-CLICK
  // Advanced: Decoder Engine + Bitmask Grid + Diff Engine + Timeline
  // ============================================================

  var GRID_HISTORY_KEY = 'witch_grids_v3';
  var MAX_HISTORY = 300;
  var VERSION = '12.0';

  // State
  var capturedGrid = null;
  var gridSource = null;
  var allResponses = [];
  var allRequests = [];
  var wsMessages = [];
  var probeResults = [];
  var seedHistory = [];
  var decodeFindings = [];    // suspicious decoded fields
  var gameTimeline = [];      // ordered game events
  var lastGameSnapshot = null; // full response body snapshot at game-start
  var prevGameSnapshot = null; // previous game's snapshot for diff
  var diffResults = [];       // field diffs between consecutive games
  var gameCount = 0;

  function ts() { return new Date().toISOString(); }

  function emit(type, data) {
    try {
      window.postMessage({ source: 'witch-injected-v11', type: type, data: data, ts: ts() }, '*');
    } catch(e) {}
  }

  // ============================================================
  // URL / BODY FILTERS — only process actual game API responses
  // ============================================================

  // Static file extensions to always skip
  var STATIC_EXT_RE = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|mp3|mp4|map)(\?|$|#)/i;

  // Known noise URL fragments (CDN, CMS, analytics, app manifests)
  var NOISE_URL_FRAGMENTS = [
    'genfiles/cms', 'genfiles/web-app', 'media_as', 'web-app-manifest',
    'traincdn.com', 'google-analytics', 'googletagmanager', 'facebook.net',
    'hotjar', 'sentry', 'datadog', 'newrelic', 'amplitude', 'mixpanel',
    '/lang/', '/locale/', '/i18n/', '/translations/', '/cms/'
  ];

  // Game API signal fragments — URL must contain at least one
  var GAME_URL_SIGNALS = [
    'witch', 'game', '/bet', 'play', 'round', 'result', 'spin',
    'service-api', 'bff-api', 'game-api', 'gaming-api',
    'getgame', 'getsession', 'getround', 'startgame', 'finishgame',
    'crash', 'mines', 'lucky', 'slot', 'casino-api', 'gameserver'
  ];

  function isGameUrl(url) {
    if (!url || typeof url !== 'string') return false;
    var u = url.toLowerCase();

    // Skip static files immediately
    if (STATIC_EXT_RE.test(u)) return false;

    // Skip known noise sources
    for (var i = 0; i < NOISE_URL_FRAGMENTS.length; i++) {
      if (u.indexOf(NOISE_URL_FRAGMENTS[i]) !== -1) return false;
    }

    // Must contain at least one game signal
    for (var j = 0; j < GAME_URL_SIGNALS.length; j++) {
      if (u.indexOf(GAME_URL_SIGNALS[j]) !== -1) return true;
    }

    return false;
  }

  // Detect translation / localization JSON bodies:
  // if >80% of top-level values are strings → it's a translation file, not game data
  function isNoiseBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
    var keys = Object.keys(body);
    if (keys.length < 15) return false;
    var strCount = 0;
    var checkCount = Math.min(keys.length, 60);
    for (var i = 0; i < checkCount; i++) {
      if (typeof body[keys[i]] === 'string') strCount++;
    }
    return (strCount / checkCount) > 0.8;
  }

  // ============================================================
  // LOCAL STORAGE
  // ============================================================
  function loadHistory() {
    try {
      var raw = localStorage.getItem(GRID_HISTORY_KEY);
      if (raw) {
        var h = JSON.parse(raw);
        if (h && Array.isArray(h.grids)) return h;
      }
    } catch(e) {}
    return { grids: [], totalGames: 0 };
  }

  function saveHistory(h) {
    try {
      if (h.grids.length > MAX_HISTORY) h.grids = h.grids.slice(-MAX_HISTORY);
      localStorage.setItem(GRID_HISTORY_KEY, JSON.stringify(h));
    } catch(e) {}
  }

  function addGridToHistory(grid, meta) {
    if (!grid || grid.length < 5) return;
    var h = loadHistory();
    h.grids.push({ grid: grid, ts: Date.now(), meta: meta || {} });
    h.totalGames = h.grids.length;
    saveHistory(h);
    return h.totalGames;
  }

  // ============================================================
  // FREQUENCY TABLE
  // ============================================================
  function buildFrequencyTable() {
    var h = loadHistory();
    if (!h.grids.length) return null;
    var freq = {};
    for (var r = 0; r < 10; r++) {
      freq[r] = {};
      for (var c = 0; c < 5; c++) freq[r][c] = { safe: 0, total: 0, pct: 0 };
    }
    for (var gi = 0; gi < h.grids.length; gi++) {
      var grid = h.grids[gi].grid;
      for (var ri = 0; ri < grid.length && ri < 10; ri++) {
        var row = grid[ri];
        if (!Array.isArray(row)) continue;
        for (var ci = 0; ci < row.length && ci < 5; ci++) {
          freq[ri][ci].total++;
          if (row[ci]) freq[ri][ci].safe++;
        }
      }
    }
    for (var r2 = 0; r2 < 10; r2++) {
      for (var c2 = 0; c2 < 5; c2++) {
        var f = freq[r2][c2];
        f.pct = f.total > 0 ? Math.round((f.safe / f.total) * 100) : 0;
      }
    }
    return { freq: freq, totalGames: h.totalGames };
  }

  function getBestCellsFromFrequency() {
    var ft = buildFrequencyTable();
    if (!ft) return null;
    var recs = [];
    for (var r = 0; r < 10; r++) {
      var best = -1, bestPct = -1;
      for (var c = 0; c < 5; c++) {
        var f = ft.freq[r][c];
        if (f.total > 0 && f.pct > bestPct) { bestPct = f.pct; best = c; }
      }
      if (best >= 0) recs.push({ row: r + 1, cell: best + 1, pct: bestPct, games: ft.freq[r][best].total });
    }
    return { recommendations: recs, totalGames: ft.totalGames, freq: ft.freq };
  }

  // ============================================================
  // GRID PARSER — RS[0].F or any boolean 5-col grid
  // ============================================================
  function parseGrid(body) {
    if (!body || typeof body !== 'object') return null;
    try {
      var rsArr = body.RS || body.rs;
      if (Array.isArray(rsArr) && rsArr.length > 0) {
        var rs0 = rsArr[0];
        var f = rs0 && (rs0.F || rs0.f);
        if (Array.isArray(f) && f.length >= 5 && isValidGrid(f)) return f;
      }
    } catch(e) {}
    return deepSearchGrid(body, 0);
  }

  function isValidGrid(arr) {
    if (!Array.isArray(arr) || arr.length < 5) return false;
    var boolRows = 0;
    for (var i = 0; i < arr.length; i++) {
      var row = arr[i];
      if (!Array.isArray(row) || row.length !== 5) return false;
      var allBool = true;
      for (var j = 0; j < row.length; j++) {
        if (typeof row[j] !== 'boolean') { allBool = false; break; }
      }
      if (allBool) boolRows++;
    }
    return boolRows >= 5;
  }

  function deepSearchGrid(obj, depth) {
    if (depth > 12 || !obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) {
      if (isValidGrid(obj)) return obj;
      for (var i = 0; i < obj.length; i++) {
        var r = deepSearchGrid(obj[i], depth + 1);
        if (r) return r;
      }
    } else {
      var keys = Object.keys(obj);
      for (var k = 0; k < keys.length; k++) {
        var r2 = deepSearchGrid(obj[keys[k]], depth + 1);
        if (r2) return r2;
      }
    }
    return null;
  }

  // ============================================================
  // ★ DECODER ENGINE v12 — tries all encoding schemes on a value
  // ============================================================

  // Try to decode a Base64 string → returns decoded text or null
  function tryBase64(s) {
    if (typeof s !== 'string' || s.length < 4) return null;
    // Must look like base64
    if (!/^[A-Za-z0-9+/=_-]{4,}$/.test(s)) return null;
    try {
      // Standard base64
      var decoded = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
      // Only return if it has printable characters
      var printable = 0;
      for (var i = 0; i < decoded.length; i++) {
        var cc = decoded.charCodeAt(i);
        if (cc >= 32 && cc < 127) printable++;
      }
      if (printable / decoded.length > 0.7) return decoded;
    } catch(e) {}
    return null;
  }

  // Try to decode a hex string → ASCII text or null
  function tryHexDecode(s) {
    if (typeof s !== 'string' || s.length < 4 || s.length % 2 !== 0) return null;
    if (!/^[0-9a-fA-F]+$/.test(s)) return null;
    try {
      var out = '';
      for (var i = 0; i < s.length; i += 2) {
        out += String.fromCharCode(parseInt(s.substr(i, 2), 16));
      }
      var printable = 0;
      for (var j = 0; j < out.length; j++) {
        var cc = out.charCodeAt(j);
        if (cc >= 32 && cc < 127) printable++;
      }
      if (out.length > 0 && printable / out.length > 0.7) return out;
    } catch(e) {}
    return null;
  }

  // Try URL decode
  function tryUrlDecode(s) {
    if (typeof s !== 'string' || s.indexOf('%') === -1) return null;
    try {
      var decoded = decodeURIComponent(s);
      if (decoded !== s) return decoded;
    } catch(e) {}
    return null;
  }

  // Try JSON parse (double-encoded)
  function tryDoubleJson(s) {
    if (typeof s !== 'string' || s.length < 2) return null;
    if (s[0] !== '"' && s[0] !== '[' && s[0] !== '{') return null;
    try {
      var inner = JSON.parse(s);
      if (typeof inner === 'object' && inner !== null) return JSON.stringify(inner, null, 2);
      if (typeof inner === 'string') {
        try {
          var deeper = JSON.parse(inner);
          return '[2x] ' + JSON.stringify(deeper, null, 2);
        } catch(e) {}
        return '[str] ' + inner;
      }
    } catch(e) {}
    return null;
  }

  // Try XOR with common single-byte keys
  function tryXorDecode(s) {
    if (typeof s !== 'string' || s.length < 4) return null;
    var keys = [0x55, 0xAA, 0xFF, 0x0F, 0xF0, 0x12, 0x34, 0x42];
    for (var ki = 0; ki < keys.length; ki++) {
      var key = keys[ki];
      var out = '';
      var printable = 0;
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i) ^ key;
        out += String.fromCharCode(c);
        if (c >= 32 && c < 127) printable++;
      }
      if (printable / s.length > 0.8) {
        return '[XOR 0x' + key.toString(16) + '] ' + out;
      }
    }
    return null;
  }

  // Try reverse string
  function tryReverse(s) {
    if (typeof s !== 'string' || s.length < 4) return null;
    var rev = s.split('').reverse().join('');
    // Check if reversed looks like JSON
    if (rev[0] === '{' || rev[0] === '[') {
      try {
        var parsed = JSON.parse(rev);
        return '[REV] ' + JSON.stringify(parsed, null, 2);
      } catch(e) {}
    }
    return null;
  }

  // ★ BITMASK GRID DECODER — tries any integer as a 50-bit grid
  // 10 rows × 5 cols = 50 bits. If a number falls in [1, 2^50], test it.
  function bitmaskToGrid(num) {
    if (typeof num !== 'number' || num <= 0 || !isFinite(num)) return null;
    // Must fit within 50 bits (1125899906842624)
    if (num > 1125899906842624) return null;
    var grid = [];
    var n = num;
    // Decode LSB-first: bit 0 = row0/col0, bit 1 = row0/col1, etc.
    for (var r = 0; r < 10; r++) {
      var row = [];
      var safeCells = 0;
      for (var c = 0; c < 5; c++) {
        var bit = (n & 1) === 1;
        row.push(bit);
        if (bit) safeCells++;
        n = Math.floor(n / 2);
      }
      // Each row should have at least 1 and at most 4 safe cells (plausible)
      if (safeCells === 0 || safeCells === 5) return null;
      grid.push(row);
    }
    // n should be 0 now if it was exactly 50 bits
    if (n !== 0) return null;
    return grid;
  }

  // Also try MSB-first bitmask
  function bitmaskToGridMSB(num) {
    if (typeof num !== 'number' || num <= 0 || !isFinite(num)) return null;
    if (num > 1125899906842624) return null;
    var grid = [];
    var n = num;
    // MSB-first: bit 49 = row0/col0
    var bits = [];
    var tmp = n;
    for (var i = 0; i < 50; i++) {
      bits.unshift((tmp & 1) === 1);
      tmp = Math.floor(tmp / 2);
    }
    if (tmp !== 0) return null;
    for (var r = 0; r < 10; r++) {
      var row = [];
      var safeCells = 0;
      for (var c = 0; c < 5; c++) {
        var bit = bits[r * 5 + c];
        row.push(bit);
        if (bit) safeCells++;
      }
      if (safeCells === 0 || safeCells === 5) return null;
      grid.push(row);
    }
    return grid;
  }

  // Try decoding a string that might be a decimal or hex integer as a bitmask
  function tryBitmaskDecode(val) {
    var results = [];
    var num = null;
    if (typeof val === 'number') {
      num = val;
    } else if (typeof val === 'string') {
      // Try decimal
      if (/^\d{6,}$/.test(val)) num = parseInt(val, 10);
      // Try hex integer
      else if (/^0x[0-9a-f]{4,}$/i.test(val)) num = parseInt(val, 16);
    }
    if (num !== null) {
      var g1 = bitmaskToGrid(num);
      if (g1) results.push({ method: 'BITMASK_LSB', grid: g1, value: num });
      var g2 = bitmaskToGridMSB(num);
      if (g2 && JSON.stringify(g2) !== JSON.stringify(g1)) {
        results.push({ method: 'BITMASK_MSB', grid: g2, value: num });
      }
    }
    return results.length > 0 ? results : null;
  }

  // Full decode attempt on a single value — returns array of findings
  function decodeAttempts(key, val) {
    var findings = [];

    if (typeof val === 'string' && val.length > 2) {
      var b64 = tryBase64(val);
      if (b64) findings.push({ method: 'BASE64', key: key, raw: val.substring(0, 40), decoded: b64.substring(0, 200) });

      var hex = tryHexDecode(val);
      if (hex) findings.push({ method: 'HEX→ASCII', key: key, raw: val.substring(0, 40), decoded: hex.substring(0, 200) });

      var url = tryUrlDecode(val);
      if (url) findings.push({ method: 'URL_DECODE', key: key, raw: val.substring(0, 40), decoded: url.substring(0, 200) });

      var dj = tryDoubleJson(val);
      if (dj) findings.push({ method: 'DOUBLE_JSON', key: key, raw: val.substring(0, 40), decoded: dj.substring(0, 200) });

      var rev = tryReverse(val);
      if (rev) findings.push({ method: 'REVERSE', key: key, raw: val.substring(0, 40), decoded: rev.substring(0, 200) });

      var xor = tryXorDecode(val);
      if (xor) findings.push({ method: 'XOR', key: key, raw: val.substring(0, 40), decoded: xor.substring(0, 200) });
    }

    // Bitmask on numbers and numeric strings
    var bm = tryBitmaskDecode(val);
    if (bm) {
      for (var bi = 0; bi < bm.length; bi++) {
        findings.push({ method: bm[bi].method, key: key, raw: String(val).substring(0, 20),
                        decoded: '[POSSIBLE GRID]', gridCandidate: bm[bi].grid });
      }
    }

    return findings;
  }

  // Deep scan every field in a response object
  function scanAllFieldsForEncodings(obj, url) {
    var allFindings = [];
    scanDeep(obj, '', allFindings, 0);
    if (allFindings.length > 0) {
      // Prioritize grid candidates first
      allFindings.sort(function(a, b) {
        if (a.gridCandidate && !b.gridCandidate) return -1;
        if (!a.gridCandidate && b.gridCandidate) return 1;
        return 0;
      });
      var pkg = { url: url, ts: ts(), findings: allFindings };
      decodeFindings.unshift(pkg);
      if (decodeFindings.length > 50) decodeFindings.pop();
      emit('decode_findings', pkg);

      // If we found a grid candidate and don't have a live grid yet, promote it
      for (var fi = 0; fi < allFindings.length; fi++) {
        var f = allFindings[fi];
        if (f.gridCandidate && !capturedGrid) {
          capturedGrid = f.gridCandidate;
          gridSource = url + ' [' + f.method + ':' + f.key + ']';
          var totalGames = addGridToHistory(f.gridCandidate, { url: url, method: f.method, key: f.key, ts: ts() });
          var ft = getBestCellsFromFrequency();
          emit('grid_captured', {
            grid: f.gridCandidate,
            source: gridSource,
            totalGames: totalGames,
            frequency: ft,
            decodedFrom: { method: f.method, key: f.key }
          });
          console.log('%c[WITCH v12] ★ BITMASK GRID DECODED from field "' + f.key + '" via ' + f.method,
            'color:#ff0;font-weight:bold;font-size:14px;background:#1a1a00;');
        }
      }
    }
    return allFindings;
  }

  function scanDeep(obj, path, findings, depth) {
    if (depth > 10 || !obj) return;
    if (typeof obj === 'string' || typeof obj === 'number') {
      var fa = decodeAttempts(path, obj);
      for (var i = 0; i < fa.length; i++) findings.push(fa[i]);
      return;
    }
    if (typeof obj === 'object') {
      var keys = Array.isArray(obj) ? null : Object.keys(obj);
      if (keys) {
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k];
          var childPath = path ? path + '.' + key : key;
          var val = obj[key];
          if (typeof val === 'string' || typeof val === 'number') {
            var fa2 = decodeAttempts(childPath, val);
            for (var fi = 0; fi < fa2.length; fi++) findings.push(fa2[fi]);
          } else if (val && typeof val === 'object') {
            scanDeep(val, childPath, findings, depth + 1);
          }
        }
      } else {
        // Array
        var limit = Math.min(obj.length, 30);
        for (var ai = 0; ai < limit; ai++) {
          scanDeep(obj[ai], path + '[' + ai + ']', findings, depth + 1);
        }
      }
    }
  }

  // ============================================================
  // ★ RESPONSE DIFF ENGINE v12
  // Compares snapshots of full response bodies between games
  // ============================================================
  function flattenObject(obj, prefix, out, depth) {
    if (depth > 8 || !obj) return;
    prefix = prefix || '';
    out = out || {};
    if (typeof obj !== 'object') {
      out[prefix] = obj;
      return out;
    }
    if (Array.isArray(obj)) {
      out[prefix] = JSON.stringify(obj).substring(0, 200);
      return out;
    }
    var keys = Object.keys(obj);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var child = obj[key];
      var childKey = prefix ? prefix + '.' + key : key;
      if (child === null || typeof child !== 'object') {
        out[childKey] = child;
      } else {
        flattenObject(child, childKey, out, depth + 1);
      }
    }
    return out;
  }

  function diffObjects(before, after) {
    if (!before || !after) return [];
    var flatBefore = flattenObject(before, '', {}, 0);
    var flatAfter = flattenObject(after, '', {}, 0);
    var diffs = [];
    var allKeys = {};
    Object.keys(flatBefore).forEach(function(k) { allKeys[k] = true; });
    Object.keys(flatAfter).forEach(function(k) { allKeys[k] = true; });
    Object.keys(allKeys).forEach(function(k) {
      var vb = flatBefore[k];
      var va = flatAfter[k];
      if (vb === undefined && va !== undefined) {
        diffs.push({ key: k, type: 'ADDED', after: String(va).substring(0, 100) });
      } else if (vb !== undefined && va === undefined) {
        diffs.push({ key: k, type: 'REMOVED', before: String(vb).substring(0, 100) });
      } else if (String(vb) !== String(va)) {
        diffs.push({ key: k, type: 'CHANGED', before: String(vb).substring(0, 100), after: String(va).substring(0, 100) });
      }
    });
    return diffs;
  }

  // ============================================================
  // ★ GAME EVENT CLASSIFIER v12
  // Classifies each request as GAME_START, ROW_CLICK, or OTHER
  // ============================================================
  function classifyRequest(req, resp) {
    var url = (req.url || '').toLowerCase();
    var body = req.body;
    var respBody = resp && resp.body;

    // Signals of a game-start request
    var isGameStart = false;
    var isRowClick = false;

    // URL patterns
    if (url.includes('start') || url.includes('init') || url.includes('new') || url.includes('begin')) isGameStart = true;
    if (url.includes('click') || url.includes('select') || url.includes('pick') || url.includes('step')) isRowClick = true;

    // Response contains the full grid (RS[0].F) = game start
    if (respBody && parseGrid(respBody)) isGameStart = true;

    // Request body clues
    if (body && typeof body === 'object') {
      var bodyStr = JSON.stringify(body).toLowerCase();
      if (bodyStr.includes('start') || bodyStr.includes('play') || bodyStr.includes('init')) isGameStart = true;
      if (bodyStr.includes('row') || bodyStr.includes('cell') || bodyStr.includes('click') || bodyStr.includes('choice')) isRowClick = true;
    }

    if (isGameStart) return 'GAME_START';
    if (isRowClick) return 'ROW_CLICK';
    return 'OTHER';
  }

  function addToTimeline(event) {
    gameTimeline.unshift(event);
    if (gameTimeline.length > 100) gameTimeline.pop();
    emit('timeline_event', event);
  }

  // ============================================================
  // SEED / CRYPTO FIELD EXTRACTOR
  // ============================================================
  var SEED_KEYS = [
    'seed','nonce','hash','key','salt','AN','SB','BS','AI','RN','token',
    'random','entropy','serverSeed','clientSeed','provablyFair','iv',
    'signature','hmac','sha','md5','gameId','roundId','sessionId'
  ];

  function extractSeeds(obj, url) {
    if (!obj || typeof obj !== 'object') return null;
    var found = {};
    extractSeedsDeep(obj, found, 0);
    if (Object.keys(found).length > 0) return { fields: found, url: url, ts: ts() };
    return null;
  }

  function extractSeedsDeep(obj, found, depth) {
    if (depth > 8 || !obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (var i = 0; i < Math.min(obj.length, 20); i++) extractSeedsDeep(obj[i], found, depth + 1);
    } else {
      var keys = Object.keys(obj);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var val = obj[key];
        var lk = key.toLowerCase();
        for (var si = 0; si < SEED_KEYS.length; si++) {
          if (lk.indexOf(SEED_KEYS[si].toLowerCase()) !== -1) {
            if (typeof val === 'string' || typeof val === 'number') found[key] = val;
          }
        }
        if (val && typeof val === 'object') extractSeedsDeep(val, found, depth + 1);
      }
    }
  }

  // ============================================================
  // RESPONSE PROCESSOR — runs on EVERY response
  // ============================================================
  function processResponse(resp, reqRef) {
    if (!resp) return;
    var body = resp.body;
    if (!body) return;

    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { return; }
    }

    var url = resp.url || 'unknown';

    // ★ NOISE GATE: skip CDN/CMS/analytics/localization responses
    if (!isGameUrl(url)) return;
    if (isNoiseBody(body)) return;

    var eventType = reqRef ? classifyRequest(reqRef, resp) : 'OTHER';

    // 1. Try to find grid directly (RS[0].F)
    var grid = parseGrid(body);
    if (grid) {
      capturedGrid = grid;
      gridSource = url;
      var totalGames = addGridToHistory(grid, { url: url, ts: ts() });
      var ft = getBestCellsFromFrequency();
      gameCount++;

      // ★ Run grid statistical analysis after each new game result
      analyzeGridHistory();

      // Snapshot for diff engine
      prevGameSnapshot = lastGameSnapshot;
      lastGameSnapshot = { body: body, url: url, ts: ts(), gameNum: gameCount };

      // Run diff if we have two snapshots
      if (prevGameSnapshot) {
        var diffs = diffObjects(prevGameSnapshot.body, body);
        var interestingDiffs = diffs.filter(function(d) {
          // Focus on fields that are not obviously timing or counts
          return !d.key.includes('time') && !d.key.includes('Time') &&
                 !d.key.includes('ts') && !d.key.includes('count');
        });
        diffResults = interestingDiffs;
        emit('diff_results', {
          diffs: interestingDiffs,
          gameA: prevGameSnapshot.gameNum,
          gameB: gameCount,
          totalDiffs: diffs.length,
          interestingDiffs: interestingDiffs.length
        });
      }

      addToTimeline({ type: 'GAME_START', url: url, gameNum: gameCount, ts: ts(), gridFound: true });

      console.log('%c[WITCH v12] ★★★ LIVE GRID — RS[0].F ★★★',
        'color:#00ff00;font-weight:bold;font-size:16px;background:#002200;');
      for (var ri = 0; ri < grid.length; ri++) {
        var safeCells = [];
        for (var ci = 0; ci < grid[ri].length; ci++) {
          if (grid[ri][ci]) safeCells.push('C' + (ci + 1));
        }
        console.log('%c[WITCH v12] Row ' + (ri + 1) + ': ' + (safeCells.length ? safeCells.join(' ') : 'NONE'),
          'color:#00ffff;');
      }

      emit('grid_captured', { grid: grid, source: url, totalGames: totalGames, frequency: ft });
    } else if (eventType === 'GAME_START' || url.includes('game') || url.includes('bet')) {
      // No grid found directly — run full decoder engine
      addToTimeline({ type: eventType, url: url, ts: ts(), gridFound: false });
      scanAllFieldsForEncodings(body, url);
    }

    // 2. Extract seeds/crypto fields (only from game URLs, already filtered above)
    var seeds = extractSeeds(body, url);
    if (seeds) {
      seedHistory.push(seeds);
      if (seedHistory.length > 100) seedHistory = seedHistory.slice(-100);
      emit('seeds_extracted', seeds);
    }
  }

  // ============================================================
  // ★ GRID STATISTICAL ANALYSIS — chi-square test on historical results
  // Replaces seed-field guessing with real mathematical analysis of outcomes
  // ============================================================
  function analyzeGridHistory() {
    var h = loadHistory();
    var totalGames = h.grids.length;
    if (totalGames < 2) return;

    var analysis = {
      totalGames: totalGames,
      cellStats: [],       // 10 rows × 5 cols win rates + chi-square
      hotCells: [],        // cells significantly above 20% (biased safe)
      coldCells: [],       // cells significantly below 20% (biased unsafe)
      correlations: [],    // sequential game correlations
      fairnessScore: 100,  // 0–100 (100 = perfectly random)
      summary: ''
    };

    // ── Per-cell win rate + chi-square ─────────────────────────
    // Expected: each cell is safe 20% of the time in a fair 5-cell game
    var totalChiSq = 0;
    var cellCount = 0;

    for (var r = 0; r < 10; r++) {
      var rowStats = [];
      for (var c = 0; c < 5; c++) {
        var safeCount = 0;
        var gamesWithRow = 0;
        for (var g = 0; g < totalGames; g++) {
          var grid = h.grids[g].grid;
          if (!grid || !grid[r]) continue;
          gamesWithRow++;
          if (grid[r][c]) safeCount++;
        }
        if (gamesWithRow === 0) { rowStats.push(null); continue; }
        var rate = safeCount / gamesWithRow;
        // Chi-square: (observed – expected)² / expected
        var expected = gamesWithRow * 0.2;
        var chiSq = expected > 0 ? Math.pow(safeCount - expected, 2) / expected : 0;
        // p < 0.05 critical value for 1 df = 3.841
        var significant = chiSq > 3.841 && gamesWithRow >= 10;
        var stat = {
          row: r + 1, col: c + 1,
          safeCount: safeCount,
          games: gamesWithRow,
          rate: Math.round(rate * 100),
          chiSq: Math.round(chiSq * 10) / 10,
          significant: significant
        };
        rowStats.push(stat);
        totalChiSq += chiSq;
        cellCount++;
        if (significant) {
          if (rate > 0.2) analysis.hotCells.push(stat);
          else            analysis.coldCells.push(stat);
        }
      }
      analysis.cellStats.push(rowStats);
    }

    // Sort hot/cold by deviation size
    analysis.hotCells.sort(function(a, b) { return b.rate - a.rate; });
    analysis.coldCells.sort(function(a, b) { return a.rate - b.rate; });

    // ── Sequential correlation ─────────────────────────────────
    // Does game N share an unusual number of safe cells with game N+1?
    if (totalGames >= 10) {
      var sharedTotal = 0;
      var pairsChecked = 0;
      for (var g2 = 0; g2 < totalGames - 1; g2++) {
        var gA = h.grids[g2].grid;
        var gB = h.grids[g2 + 1].grid;
        if (!gA || !gB) continue;
        var shared = 0;
        for (var r2 = 0; r2 < Math.min(gA.length, gB.length, 10); r2++) {
          if (!gA[r2] || !gB[r2]) continue;
          for (var c2 = 0; c2 < 5; c2++) {
            if (gA[r2][c2] && gB[r2][c2]) shared++;
          }
        }
        sharedTotal += shared;
        pairsChecked++;
      }
      if (pairsChecked > 0) {
        // Expected overlap per game pair: 10 rows × 1 safe cell per row × 20% chance = 2.0
        var avgShared = Math.round((sharedTotal / pairsChecked) * 10) / 10;
        var expectedShared = 2.0; // 10 rows × (1/5 × 1/5 × 5 cells overlap) ≈ 2.0
        if (avgShared > 3.5) {
          analysis.correlations.push({
            type: 'SEQUENTIAL_REPEAT',
            avgSharedCells: avgShared,
            expected: expectedShared,
            confidence: avgShared > 5 ? 'HIGH' : 'MEDIUM',
            note: 'Avg ' + avgShared + ' safe cells repeat between consecutive games (expected ~2). Suggests non-random seeding or short PRNG cycle.'
          });
        }
      }
    }

    // ── Cycle detection — look for repeating grid patterns ─────
    if (totalGames >= 6) {
      for (var period = 2; period <= Math.min(20, Math.floor(totalGames / 2)); period++) {
        var matchCount = 0;
        var testPairs = 0;
        for (var g3 = 0; g3 + period < totalGames; g3++) {
          var gX = h.grids[g3].grid;
          var gY = h.grids[g3 + period].grid;
          if (!gX || !gY) continue;
          var identical = true;
          for (var r3 = 0; r3 < Math.min(gX.length, gY.length, 10) && identical; r3++) {
            if (!gX[r3] || !gY[r3]) { identical = false; break; }
            for (var c3 = 0; c3 < 5 && identical; c3++) {
              if (gX[r3][c3] !== gY[r3][c3]) identical = false;
            }
          }
          if (identical) matchCount++;
          testPairs++;
        }
        if (testPairs > 0 && matchCount / testPairs > 0.5) {
          analysis.correlations.push({
            type: 'CYCLE_DETECTED',
            period: period,
            matchRate: Math.round((matchCount / testPairs) * 100),
            confidence: matchCount / testPairs > 0.8 ? 'HIGH' : 'MEDIUM',
            note: 'Grid repeats every ' + period + ' games (' + Math.round((matchCount / testPairs) * 100) + '% match rate). PRNG cycle length = ' + period + '.'
          });
          break; // report shortest cycle found
        }
      }
    }

    // ── Fairness score (0–100) ─────────────────────────────────
    var avgChiSq = cellCount > 0 ? totalChiSq / cellCount : 0;
    analysis.fairnessScore = Math.max(0, Math.min(100, Math.round(100 - avgChiSq * 8)));

    // ── Summary line ───────────────────────────────────────────
    var biasedCells = analysis.hotCells.length + analysis.coldCells.length;
    if (biasedCells === 0 && analysis.correlations.length === 0) {
      analysis.summary = 'No significant bias detected (' + totalGames + ' games). Collect more data for higher confidence.';
    } else if (biasedCells > 0) {
      analysis.summary = biasedCells + ' biased cell(s) detected (p < 0.05). ' +
        (analysis.hotCells.length ? analysis.hotCells.length + ' hot' : '') +
        (analysis.coldCells.length ? (analysis.hotCells.length ? ', ' : '') + analysis.coldCells.length + ' cold' : '') + '.';
    } else {
      analysis.summary = 'Sequential correlation detected — game results may not be independent.';
    }

    emit('grid_rng_analysis', analysis);
  }

  // ============================================================
  // SERVER PROBING
  // ============================================================
  window.__witch_probe = function(probeConfig) {
    var probeId = probeConfig.probeId || ('probe_' + Date.now());
    var originalFetch = window.__witch_original_fetch || fetch;

    originalFetch(probeConfig.url, {
      method: probeConfig.method || 'GET',
      headers: probeConfig.headers || {},
      body: probeConfig.body ? JSON.stringify(probeConfig.body) : undefined,
      credentials: probeConfig.credentials || 'include'
    })
    .then(function(r) { return r.text(); })
    .then(function(text) {
      var parsed = null;
      try { parsed = JSON.parse(text); } catch(e) {}
      emit('probe_result', {
        probeId: probeId, url: probeConfig.url, status: 'ok',
        rawText: text.substring(0, 3000), parsed: parsed
      });
      if (parsed) processResponse({ url: probeConfig.url, body: parsed });
    })
    .catch(function(err) {
      emit('probe_result', { probeId: probeId, url: probeConfig.url, status: 'error', error: err.message });
    });
  };

  // ============================================================
  // FETCH HOOK — passive interception
  // ============================================================
  var originalFetch = window.fetch;
  window.__witch_original_fetch = originalFetch;

  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) ? input.url : 'unknown';
    var method = (init && init.method) || 'GET';
    var reqId = 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    var reqData = {
      id: reqId, type: 'fetch', url: url, method: method, ts: ts(),
      headers: (init && init.headers) ? extractHeaders(init.headers) : {},
      body: parseBody(init && init.body)
    };
    allRequests.push(reqData);
    if (allRequests.length > 500) allRequests = allRequests.slice(-500);
    emit('request', reqData);

    var result = originalFetch.apply(this, arguments);
    result.then(function(response) {
      var respClone = response.clone();
      respClone.text().then(function(text) {
        var parsed = null;
        try { parsed = JSON.parse(text); } catch(e) {}
        var respData = {
          id: reqId, type: 'fetch_response', url: url,
          status: response.status, ts: ts(),
          body: parsed || text, rawText: text.substring(0, 5000)
        };
        allResponses.push(respData);
        if (allResponses.length > 500) allResponses = allResponses.slice(-500);
        emit('response', respData);
        processResponse(respData, reqData);
      }).catch(function() {});
    }).catch(function() {});

    return result;
  };

  // ============================================================
  // XHR HOOK — passive interception
  // ============================================================
  var OrigXHROpen = XMLHttpRequest.prototype.open;
  var OrigXHRSend = XMLHttpRequest.prototype.send;
  var OrigXHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._witch = { id: 'x_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), method: method, url: url, headers: {}, ts: ts() };
    return OrigXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (this._witch) this._witch.headers[name] = value;
    return OrigXHRSetHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    if (this._witch) {
      var spy = this._witch;
      spy.body = parseBody(body);
      allRequests.push({ type: 'xhr', id: spy.id, url: spy.url, method: spy.method, ts: spy.ts, body: spy.body });
      emit('request', { type: 'xhr', id: spy.id, url: spy.url, method: spy.method });
      var self = this;
      var reqRef = { url: spy.url, method: spy.method, body: spy.body };
      self.addEventListener('load', function() {
        var text = self.responseText || '';
        var parsed = null;
        try { parsed = JSON.parse(text); } catch(e) {}
        var respData = {
          id: spy.id, type: 'xhr_response', url: spy.url,
          status: self.status, ts: ts(), body: parsed || text, rawText: text.substring(0, 5000)
        };
        allResponses.push(respData);
        if (allResponses.length > 500) allResponses = allResponses.slice(-500);
        emit('response', respData);
        processResponse(respData, reqRef);
      });
    }
    return OrigXHRSend.apply(this, arguments);
  };

  // ============================================================
  // WEBSOCKET HOOK — passive interception
  // ============================================================
  var OrigWS = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    var wsId = 'ws_' + Date.now();
    var ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
    emit('ws_opened', { id: wsId, url: url, ts: ts() });

    var origSend = ws.send.bind(ws);
    ws.send = function(data) {
      var decoded = decodeWsData(data);
      wsMessages.push({ dir: 'out', id: wsId, data: decoded, ts: ts() });
      emit('ws_message', { dir: 'out', id: wsId, url: url, data: decoded });
      return origSend(data);
    };

    ws.addEventListener('message', function(evt) {
      var decoded = decodeWsData(evt.data);
      wsMessages.push({ dir: 'in', id: wsId, data: decoded, ts: ts() });
      emit('ws_message', { dir: 'in', id: wsId, url: url, data: decoded });
      if (decoded && typeof decoded === 'object') {
        processResponse({ url: url + '[WS]', body: decoded });
      } else if (typeof decoded === 'string') {
        try {
          var parsed = JSON.parse(decoded);
          processResponse({ url: url + '[WS]', body: parsed });
        } catch(e) {}
      }
    });

    return ws;
  };
  window.WebSocket.prototype = OrigWS.prototype;
  window.WebSocket.CONNECTING = OrigWS.CONNECTING;
  window.WebSocket.OPEN = OrigWS.OPEN;
  window.WebSocket.CLOSING = OrigWS.CLOSING;
  window.WebSocket.CLOSED = OrigWS.CLOSED;

  // ============================================================
  // HELPERS
  // ============================================================
  function parseBody(body) {
    if (!body) return null;
    if (typeof body === 'string') {
      try { return JSON.parse(body); } catch(e) { return body.substring(0, 500); }
    }
    return '[Binary]';
  }

  function extractHeaders(h) {
    if (!h) return {};
    var out = {};
    try {
      if (h instanceof Headers) h.forEach(function(v, k) { out[k] = v; });
      else if (typeof h === 'object') out = Object.assign({}, h);
    } catch(e) {}
    return out;
  }

  function decodeWsData(data) {
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch(e) { return data; }
    }
    if (data instanceof ArrayBuffer) {
      try {
        var text = new TextDecoder('utf-8').decode(data);
        try { return JSON.parse(text); } catch(e) { return text; }
      } catch(e) {}
      return '[Binary ' + data.byteLength + ' bytes]';
    }
    return '[Unknown]';
  }

  // ============================================================
  // API EXPOSED TO CONTENT.JS
  // ============================================================
  window.__witch_api = {
    getGrid: function() { return capturedGrid; },
    getGridSource: function() { return gridSource; },
    getRequests: function() { return allRequests.slice(-50); },
    getResponses: function() { return allResponses.slice(-50); },
    getWsMessages: function() { return wsMessages.slice(-50); },
    getSeedHistory: function() { return seedHistory.slice(-50); },
    getFrequency: function() { return getBestCellsFromFrequency(); },
    getDecodeFindings: function() { return decodeFindings.slice(-20); },
    getDiffResults: function() { return diffResults; },
    getTimeline: function() { return gameTimeline.slice(-50); },
    clearHistory: function() {
      try { localStorage.removeItem(GRID_HISTORY_KEY); } catch(e) {}
      seedHistory = []; capturedGrid = null; decodeFindings = [];
      gameTimeline = []; diffResults = []; lastGameSnapshot = null; prevGameSnapshot = null;
      emit('history_cleared', {});
    },
    getStats: function() {
      var h = loadHistory();
      return {
        totalGames: h.totalGames, requestsCaptured: allRequests.length,
        responsesCaptured: allResponses.length, wsCaptured: wsMessages.length,
        hasLiveGrid: !!capturedGrid, decodeFindings: decodeFindings.length,
        timelineEvents: gameTimeline.length, version: VERSION
      };
    }
  };

  // ============================================================
  // HANDLE COMMANDS FROM CONTENT.JS
  // ============================================================
  window.addEventListener('message', function(evt) {
    if (!evt.data || evt.data.source !== 'witch-content-v11') return;
    var cmd = evt.data.cmd;

    if (cmd === 'get_state') {
      emit('state', {
        grid: capturedGrid, gridSource: gridSource,
        frequency: getBestCellsFromFrequency(),
        stats: window.__witch_api.getStats(),
        recentRequests: allRequests.slice(-20),
        recentResponses: allResponses.slice(-10),
        seedHistory: seedHistory.slice(-10),
        decodeFindings: decodeFindings.slice(-10),
        diffResults: diffResults,
        timeline: gameTimeline.slice(-20)
      });
    } else if (cmd === 'probe') {
      window.__witch_probe(evt.data.config);
    } else if (cmd === 'clear_history') {
      window.__witch_api.clearHistory();
    } else if (cmd === 'replay_request') {
      var req = evt.data.req;
      if (req) window.__witch_probe({ url: req.url, method: req.method, body: req.body, probeId: 'replay_' + req.id });
    } else if (cmd === 'decode_value') {
      // Manually decode a value sent from UI
      var findings = decodeAttempts(evt.data.key || 'manual', evt.data.value);
      emit('decode_findings', { url: 'manual', ts: ts(), findings: findings });
    }
  });

  // ============================================================
  // INIT
  // ============================================================
  emit('ready', {
    version: VERSION,
    captureActive: true,
    autoClickDisabled: true,
    historyCount: (function() { var h = loadHistory(); return h.totalGames; })()
  });

  var initFt = getBestCellsFromFrequency();
  if (initFt) emit('frequency_ready', initFt);

  // ★ Run grid analysis on existing saved history immediately at load
  analyzeGridHistory();

  console.log('%c[WITCH v12] Analyzer loaded — Decoder + Bitmask + Diff + Timeline active (no auto-click)',
    'color:#00ffff;font-weight:bold;font-size:14px;background:#001a2e;padding:4px 8px;');
  console.log('%c[WITCH v12] Engines: Base64 | Hex→ASCII | XOR | URL | Bitmask50 | JSON2x | Reverse | Diff | LCG',
    'color:#a78bfa;font-size:11px;background:#001a2e;padding:2px 8px;');

})();
