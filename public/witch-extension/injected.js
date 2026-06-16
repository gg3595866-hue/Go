(function() {
  'use strict';

  // ============================================================
  // WITCH GAME ANALYZER PRO v11.0 — PASSIVE ONLY, NO AUTO-CLICK
  // Captures ALL network traffic from page load before Play button
  // ============================================================

  var GRID_HISTORY_KEY = 'witch_grids_v3';
  var MAX_HISTORY = 300;

  // State
  var capturedGrid = null;
  var gridSource = null;
  var allResponses = [];
  var allRequests = [];
  var wsMessages = [];
  var probeResults = [];
  var seedHistory = [];

  function ts() { return new Date().toISOString(); }

  function emit(type, data) {
    try {
      window.postMessage({ source: 'witch-injected-v11', type: type, data: data, ts: ts() }, '*');
    } catch(e) {}
  }

  // ============================================================
  // LOCAL STORAGE — bounded, never corrupts page
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
      // Keep only last MAX_HISTORY grids
      if (h.grids.length > MAX_HISTORY) {
        h.grids = h.grids.slice(-MAX_HISTORY);
      }
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
  // FREQUENCY TABLE — build statistical safe-cell map
  // ============================================================
  function buildFrequencyTable() {
    var h = loadHistory();
    if (!h.grids.length) return null;

    var freq = {};
    var numRows = 10;
    var numCols = 5;

    for (var r = 0; r < numRows; r++) {
      freq[r] = {};
      for (var c = 0; c < numCols; c++) {
        freq[r][c] = { safe: 0, total: 0, pct: 0 };
      }
    }

    for (var gi = 0; gi < h.grids.length; gi++) {
      var grid = h.grids[gi].grid;
      for (var ri = 0; ri < grid.length && ri < numRows; ri++) {
        var row = grid[ri];
        if (!Array.isArray(row)) continue;
        for (var ci = 0; ci < row.length && ci < numCols; ci++) {
          freq[ri][ci].total++;
          if (row[ci]) freq[ri][ci].safe++;
        }
      }
    }

    for (var r2 = 0; r2 < numRows; r2++) {
      for (var c2 = 0; c2 < numCols; c2++) {
        var f = freq[r2][c2];
        f.pct = f.total > 0 ? Math.round((f.safe / f.total) * 100) : 0;
      }
    }

    return { freq: freq, totalGames: h.totalGames };
  }

  // Build best cell per row from frequency
  function getBestCellsFromFrequency() {
    var ft = buildFrequencyTable();
    if (!ft) return null;
    var recs = [];
    for (var r = 0; r < 10; r++) {
      var best = -1, bestPct = -1;
      for (var c = 0; c < 5; c++) {
        var f = ft.freq[r][c];
        if (f.total > 0 && f.pct > bestPct) {
          bestPct = f.pct;
          best = c;
        }
      }
      if (best >= 0) {
        recs.push({ row: r + 1, cell: best + 1, pct: bestPct, games: ft.freq[r][best].total });
      }
    }
    return { recommendations: recs, totalGames: ft.totalGames, freq: ft.freq };
  }

  // ============================================================
  // GRID PARSER — finds RS[0].F or any boolean 5-col grid
  // ============================================================
  function parseGrid(body) {
    if (!body || typeof body !== 'object') return null;

    // Primary: RS[0].F (confirmed 1xbet format)
    try {
      var rsArr = body.RS || body.rs;
      if (Array.isArray(rsArr) && rsArr.length > 0) {
        var rs0 = rsArr[0];
        var f = rs0 && (rs0.F || rs0.f);
        if (Array.isArray(f) && f.length >= 5) {
          if (isValidGrid(f)) return f;
        }
      }
    } catch(e) {}

    // Deep search fallback
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
  // SEED / CRYPTO FIELD EXTRACTOR
  // ============================================================
  var SEED_KEYS = [
    'seed','nonce','hash','key','salt','AN','SB','BS','AI','RN','token',
    'random','entropy','serverSeed','clientSeed','provablyFair','iv',
    'signature','hmac','sha','md5'
  ];

  function extractSeeds(obj, url) {
    if (!obj || typeof obj !== 'object') return null;
    var found = {};
    extractSeedsDeep(obj, found, 0);
    if (Object.keys(found).length > 0) {
      return { fields: found, url: url, ts: ts() };
    }
    return null;
  }

  function extractSeedsDeep(obj, found, depth) {
    if (depth > 8 || !obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (var i = 0; i < Math.min(obj.length, 20); i++) {
        extractSeedsDeep(obj[i], found, depth + 1);
      }
    } else {
      var keys = Object.keys(obj);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var val = obj[key];
        var lk = key.toLowerCase();
        for (var si = 0; si < SEED_KEYS.length; si++) {
          if (lk.indexOf(SEED_KEYS[si].toLowerCase()) !== -1) {
            if (typeof val === 'string' || typeof val === 'number') {
              found[key] = val;
            }
          }
        }
        if (val && typeof val === 'object') {
          extractSeedsDeep(val, found, depth + 1);
        }
      }
    }
  }

  // ============================================================
  // RESPONSE PROCESSOR — runs on EVERY response
  // ============================================================
  function processResponse(resp) {
    if (!resp) return;
    var body = resp.body;
    if (!body) return;

    // Try to parse if string
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { return; }
    }

    // 1. Try to find grid
    var grid = parseGrid(body);
    if (grid) {
      capturedGrid = grid;
      gridSource = resp.url || 'unknown';
      var totalGames = addGridToHistory(grid, { url: resp.url, ts: ts() });
      var ft = getBestCellsFromFrequency();

      console.log('%c[WITCH v11] ★★★ GRID FOUND — RS[0].F ★★★',
        'color:#00ff00;font-weight:bold;font-size:16px;background:#002200;');
      for (var ri = 0; ri < grid.length; ri++) {
        var safeCells = [];
        for (var ci = 0; ci < grid[ri].length; ci++) {
          if (grid[ri][ci]) safeCells.push('Cell ' + (ci + 1));
        }
        console.log('%c[WITCH v11] Row ' + (ri + 1) + ': ' + (safeCells.length ? safeCells.join(', ') : 'NONE SAFE'),
          'color:#00ffff;');
      }

      emit('grid_captured', {
        grid: grid,
        source: resp.url,
        totalGames: totalGames,
        frequency: ft
      });
    }

    // 2. Extract seeds/crypto
    var seeds = extractSeeds(body, resp.url);
    if (seeds) {
      seedHistory.push(seeds);
      if (seedHistory.length > 100) seedHistory = seedHistory.slice(-100);
      emit('seeds_extracted', seeds);

      // Run pattern analysis
      analyzeSeeds();
    }
  }

  // ============================================================
  // SEED PATTERN ANALYSIS — find RNG patterns
  // ============================================================
  function analyzeSeeds() {
    if (seedHistory.length < 2) return;
    var analysis = {
      totalSamples: seedHistory.length,
      fieldNames: [],
      patterns: [],
      rngHints: []
    };

    // Collect field names seen
    var fieldSeen = {};
    for (var i = 0; i < seedHistory.length; i++) {
      var fields = seedHistory[i].fields;
      for (var k in fields) {
        fieldSeen[k] = true;
      }
    }
    analysis.fieldNames = Object.keys(fieldSeen);

    // Check numeric sequences — look for linear PRNG (LCG)
    for (var fk in fieldSeen) {
      var vals = [];
      for (var si = 0; si < seedHistory.length; si++) {
        var v = seedHistory[si].fields[fk];
        if (typeof v === 'number') vals.push(v);
        else if (typeof v === 'string' && /^\d+$/.test(v)) vals.push(parseInt(v, 10));
      }
      if (vals.length >= 3) {
        // Check for arithmetic sequence (LCG additive)
        var diffs = [];
        for (var di = 1; di < vals.length; di++) {
          diffs.push(vals[di] - vals[di - 1]);
        }
        var allSameDiff = diffs.every(function(d) { return d === diffs[0]; });
        if (allSameDiff && diffs[0] !== 0) {
          analysis.patterns.push({
            field: fk,
            type: 'LINEAR_SEQUENCE',
            increment: diffs[0],
            values: vals.slice(-5),
            nextPredicted: vals[vals.length - 1] + diffs[0],
            confidence: 'HIGH'
          });
        }

        // Check for modular pattern
        if (vals.length >= 5) {
          var mod = detectModulus(vals);
          if (mod) {
            analysis.patterns.push({
              field: fk,
              type: 'LCG_MODULUS',
              modulus: mod,
              confidence: 'MEDIUM'
            });
          }
        }
      }
    }

    // Hash analysis — check if any values look like hex hashes
    for (var fk2 in fieldSeen) {
      var hexVals = [];
      for (var si2 = 0; si2 < seedHistory.length; si2++) {
        var v2 = seedHistory[si2].fields[fk2];
        if (typeof v2 === 'string' && /^[0-9a-f]{8,}$/i.test(v2)) {
          hexVals.push(v2);
        }
      }
      if (hexVals.length >= 2) {
        analysis.rngHints.push({
          field: fk2,
          type: 'HEX_HASH',
          length: hexVals[0].length,
          sample: hexVals[0].substring(0, 16) + '...',
          count: hexVals.length,
          note: hexVals[0].length === 64 ? 'SHA-256 likely' :
                hexVals[0].length === 32 ? 'MD5 or SHA-128 likely' :
                hexVals[0].length === 40 ? 'SHA-1 likely' : 'Unknown hash',
          consecutive: hexVals.slice(-3)
        });
      }
    }

    if (analysis.patterns.length > 0 || analysis.rngHints.length > 0) {
      emit('rng_analysis', analysis);
    }
  }

  function detectModulus(vals) {
    // Try common moduli
    var mods = [256, 512, 1024, 2048, 4096, 65536, 1000000, 2147483648];
    for (var m = 0; m < mods.length; m++) {
      var mod = mods[m];
      var residuals = vals.map(function(v) { return v % mod; });
      if (residuals.every(function(v) { return v < mod; }) &&
          Math.max.apply(null, residuals) > mod * 0.1) {
        return mod;
      }
    }
    return null;
  }

  // ============================================================
  // SERVER PROBING — replay requests with varied params
  // ============================================================
  window.__witch_probe = function(probeConfig) {
    // Called from content.js to probe the server
    // probeConfig: { url, method, body, headers, probeId }
    var probeId = probeConfig.probeId || ('probe_' + Date.now());
    var originalFetch = window.__witch_original_fetch || fetch;

    originalFetch(probeConfig.url, {
      method: probeConfig.method || 'GET',
      headers: probeConfig.headers || {},
      body: probeConfig.body ? JSON.stringify(probeConfig.body) : undefined
    })
    .then(function(r) { return r.text(); })
    .then(function(text) {
      var parsed = null;
      try { parsed = JSON.parse(text); } catch(e) {}
      emit('probe_result', {
        probeId: probeId,
        url: probeConfig.url,
        status: 'ok',
        rawText: text.substring(0, 3000),
        parsed: parsed
      });
      if (parsed) {
        processResponse({ url: probeConfig.url, body: parsed });
      }
    })
    .catch(function(err) {
      emit('probe_result', {
        probeId: probeId,
        url: probeConfig.url,
        status: 'error',
        error: err.message
      });
    });
  };

  // ============================================================
  // FETCH HOOK — passive interception
  // ============================================================
  var originalFetch = window.fetch;
  window.__witch_original_fetch = originalFetch;

  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input :
              (input && input.url) ? input.url : 'unknown';
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
        processResponse(respData);
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
    this._witch = {
      id: 'x_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      method: method, url: url, headers: {}, ts: ts()
    };
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
      self.addEventListener('load', function() {
        var text = self.responseText || '';
        var parsed = null;
        try { parsed = JSON.parse(text); } catch(e) {}
        var respData = {
          id: spy.id, type: 'xhr_response', url: spy.url,
          status: self.status, ts: ts(),
          body: parsed || text, rawText: text.substring(0, 5000)
        };
        allResponses.push(respData);
        if (allResponses.length > 500) allResponses = allResponses.slice(-500);
        emit('response', respData);
        processResponse(respData);
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
      // Scan WebSocket messages for grid data too
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
      if (h instanceof Headers) {
        h.forEach(function(v, k) { out[k] = v; });
      } else if (typeof h === 'object') {
        out = Object.assign({}, h);
      }
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
    clearHistory: function() {
      try { localStorage.removeItem(GRID_HISTORY_KEY); } catch(e) {}
      seedHistory = [];
      capturedGrid = null;
      emit('history_cleared', {});
    },
    getStats: function() {
      var h = loadHistory();
      return { totalGames: h.totalGames, requestsCaptured: allRequests.length,
               responsesCaptured: allResponses.length, wsCaptured: wsMessages.length,
               hasLiveGrid: !!capturedGrid };
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
        grid: capturedGrid,
        gridSource: gridSource,
        frequency: getBestCellsFromFrequency(),
        stats: window.__witch_api.getStats(),
        recentRequests: allRequests.slice(-20),
        recentResponses: allResponses.slice(-10),
        seedHistory: seedHistory.slice(-10)
      });
    } else if (cmd === 'probe') {
      window.__witch_probe(evt.data.config);
    } else if (cmd === 'clear_history') {
      window.__witch_api.clearHistory();
    } else if (cmd === 'replay_request') {
      // Replay a specific captured request
      var req = evt.data.req;
      if (req) window.__witch_probe({ url: req.url, method: req.method, body: req.body, probeId: 'replay_' + req.id });
    }
  });

  // ============================================================
  // INIT
  // ============================================================
  emit('ready', {
    version: '11.0',
    captureActive: true,
    autoClickDisabled: true,
    historyCount: (function() {
      var h = loadHistory(); return h.totalGames;
    })()
  });

  // Emit initial frequency table
  var initFt = getBestCellsFromFrequency();
  if (initFt) {
    emit('frequency_ready', initFt);
  }

  console.log('%c[WITCH v11] Passive Analyzer loaded — capturing all requests (no auto-click)',
    'color:#00ffff;font-weight:bold;font-size:14px;background:#001a2e;padding:4px 8px;');

})();
