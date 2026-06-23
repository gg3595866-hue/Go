(function() {
  'use strict';

  // ============================================================
  // WITCH ANALYZER PRO v11.0 — POPUP SCRIPT
  // ============================================================

  var appState = {
    grid: null,
    gridSource: null,
    frequency: null,
    stats: {},
    recentRequests: [],
    recentResponses: [],
    seedHistory: [],
    rngAnalysis: null,
    lastGameRequest: null,
    isConnected: false,
    serverUrl: '',
    authToken: null,
    sessionToken: null
  };

  // ============================================================
  // TABS
  // ============================================================
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
      tab.classList.add('active');
      var panel = document.getElementById('tab-' + tab.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });

  // ============================================================
  // LOAD SAVED SERVER URL + AUTH TOKEN
  // ============================================================
  chrome.storage.local.get(['serverUrl', 'isConnected', 'authToken'], function(result) {
    if (result.serverUrl) {
      appState.serverUrl = result.serverUrl;
      document.getElementById('server-url').value = result.serverUrl;
    }
    if (result.authToken) {
      appState.authToken = result.authToken;
      showHasTokenUI(result.authToken);
    } else {
      showNoTokenUI();
    }
    updateConnectionUI(result.isConnected || false);
  });

  // ============================================================
  // MESSAGING
  // ============================================================
  function sendToBackground(type, data) {
    return new Promise(function(resolve) {
      try {
        chrome.runtime.sendMessage({ type: type, data: data }, function(resp) {
          resolve(resp);
        });
      } catch(e) { resolve(null); }
    });
  }

  function sendToActiveTab(type, data) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || !tabs[0]) return;
      try { chrome.tabs.sendMessage(tabs[0].id, { type: type, data: data }); } catch(e) {}
    });
  }

  // Listen for live updates pushed from background
  chrome.runtime.onMessage.addListener(function(msg) {
    if (!msg) return;
    switch (msg.type) {
      case 'session_token':
        // ★ Fresh x-auth token captured from the live game session
        appState.sessionToken = msg.data.token;
        showSessionTokenStatus(true, msg.data.token);
        break;

      case 'session_expired':
        // ★ 401 received — game session token is no longer valid
        showSessionTokenStatus(false, null);
        break;

      case 'grid_captured':
        appState.grid = msg.data.grid;
        appState.gridSource = msg.data.source;
        appState.frequency = msg.data.frequency;
        if (msg.data.totalGames) appState.stats.totalGames = msg.data.totalGames;
        appState.stats.hasLiveGrid = true;
        updateGridTab();
        break;
      case 'seeds_extracted':
        appState.seedHistory.unshift(msg.data);
        if (appState.seedHistory.length > 30) appState.seedHistory.pop();
        updatePacketsTab();
        updateRngTab();
        break;
      case 'rng_analysis':
        appState.rngAnalysis = msg.data;
        updateRngTab();
        break;
      case 'state_update':
        applyState(msg.data);
        break;
      case 'probe_result':
        handleProbeResult(msg.data);
        break;
    }
  });

  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  function loadState() {
    sendToBackground('get_state').then(function(resp) {
      if (resp && resp.state) applyState(resp.state);
    });
    sendToActiveTab('get_state', {});
    chrome.storage.local.get(['lastState'], function(result) {
      if (result.lastState) applyState(result.lastState);
    });
  }

  function applyState(s) {
    if (!s) return;
    if (s.grid !== undefined) appState.grid = s.grid;
    if (s.gridSource) appState.gridSource = s.gridSource;
    if (s.frequency) appState.frequency = s.frequency;
    if (s.stats) Object.assign(appState.stats, s.stats);
    if (s.recentRequests) appState.recentRequests = s.recentRequests;
    if (s.recentResponses) appState.recentResponses = s.recentResponses;
    if (s.seedHistory) appState.seedHistory = s.seedHistory;
    if (s.rngAnalysis) appState.rngAnalysis = s.rngAnalysis;

    // Track last game request for replay
    for (var i = 0; i < appState.recentRequests.length; i++) {
      var req = appState.recentRequests[i];
      if (req.url && (req.url.includes('game') || req.url.includes('bet') || req.url.includes('witch'))) {
        appState.lastGameRequest = req;
        break;
      }
    }

    renderAll();
  }

  function renderAll() {
    updateGridTab();
    updatePacketsTab();
    updateRngTab();
  }

  // ============================================================
  // GRID TAB
  // ============================================================
  function updateGridTab() {
    updateStatsUI();

    var display = document.getElementById('grid-display');
    var badge   = document.getElementById('conf-badge');
    var source  = document.getElementById('grid-source');
    if (!display) return;

    if (appState.grid) {
      badge.className = 'badge badge-green';
      badge.textContent = '🟢 Live Grid';
      source.textContent = 'From: ' + shortUrl(appState.gridSource || '');
      display.innerHTML = buildGridTable(appState.grid);

    } else if (appState.frequency &&
               ((appState.frequency.recommendations && appState.frequency.recommendations.length) ||
                appState.frequency.freq)) {
      badge.className = 'badge badge-yellow';
      badge.textContent = '🟡 Statistical (' + (appState.frequency.totalGames || 0) + ' games)';
      source.textContent = (appState.frequency.totalGames || 0) + ' historical games';
      display.innerHTML = buildFreqTable(appState.frequency);

    } else {
      badge.className = 'badge badge-gray';
      badge.textContent = 'No Data';
      source.textContent = '';
      display.innerHTML = '<div class="empty-state">Open the Witch game page.<br><br>Data captures automatically from page load — even before you click Play.</div>';
    }
  }

  function buildGridTable(grid) {
    var html = '<table class="grid-table">';
    html += '<tr><th class="row-label">Row</th><th>C1</th><th>C2</th><th>C3</th><th>C4</th><th>C5</th></tr>';
    for (var r = 0; r < grid.length; r++) {
      var row = grid[r];
      html += '<tr><td class="row-label">' + (r + 1) + '</td>';
      for (var c = 0; c < 5; c++) {
        var safe = row[c];
        html += '<td class="' + (safe ? 'cell-safe' : 'cell-unsafe') + '">' + (safe ? '✓' : '✗') + '</td>';
      }
      html += '</tr>';
    }
    html += '</table>';
    html += '<div style="font-size:9px;color:#444;margin-top:5px;">';
    for (var r2 = 0; r2 < grid.length; r2++) {
      var safe = [];
      for (var c2 = 0; c2 < grid[r2].length; c2++) { if (grid[r2][c2]) safe.push('C' + (c2+1)); }
      html += 'Row ' + (r2+1) + ': <span style="color:#34d399;">' + (safe.join(', ') || 'None safe') + '</span> &nbsp;';
    }
    html += '</div>';
    return html;
  }

  function buildFreqTable(ft) {
    if (!ft) return '<div class="empty-state">No data</div>';

    // Recommendations list format
    if (ft.recommendations && !ft.freq) {
      var html = '<table class="grid-table">';
      html += '<tr><th class="row-label">Row</th><th>Best Cell</th><th>Win%</th><th>n</th></tr>';
      for (var i = 0; i < ft.recommendations.length; i++) {
        var rec = ft.recommendations[i];
        html += '<tr><td class="row-label">' + rec.row + '</td>';
        html += '<td class="cell-freq-high">Cell ' + rec.cell + '</td>';
        html += '<td style="color:#fbbf24;">' + rec.pct + '%</td>';
        html += '<td style="color:#555;">' + (rec.games || 0) + '</td></tr>';
      }
      html += '</table>';
      return html;
    }

    // Full frequency grid
    if (ft.freq) {
      var html = '<table class="grid-table">';
      html += '<tr><th class="row-label">Row</th><th>C1</th><th>C2</th><th>C3</th><th>C4</th><th>C5</th></tr>';
      for (var r = 0; r < 10; r++) {
        var rowData = ft.freq[r];
        if (!rowData) continue;
        var bestPct = 0;
        for (var c = 0; c < 5; c++) { if (rowData[c] && rowData[c].pct > bestPct) bestPct = rowData[c].pct; }
        html += '<tr><td class="row-label">' + (r+1) + '</td>';
        for (var c2 = 0; c2 < 5; c2++) {
          var f = rowData[c2];
          var pct = f ? f.pct : 0;
          var isBest = pct === bestPct && pct > 0;
          var cls = isBest ? 'cell-freq-high' : pct >= 30 ? 'cell-freq-mid' : pct > 0 ? 'cell-freq-low' : 'cell-empty';
          var label = f && f.total > 0 ? pct + '%' : '?';
          html += '<td class="' + cls + '"' + (isBest ? ' title="Best"' : '') + '>' + label + '</td>';
        }
        html += '</tr>';
      }
      html += '</table>';
      return html;
    }

    return '<div class="empty-state">No frequency data</div>';
  }

  function updateStatsUI() {
    var s = appState.stats || {};
    setText('stat-total-games', s.totalGames || 0);
    setText('stat-reqs', s.requestsCaptured || appState.recentRequests.length || 0);
    setText('stat-seeds', appState.seedHistory.length);
    var liveEl = document.getElementById('stat-live-grid');
    if (liveEl) {
      liveEl.textContent = s.hasLiveGrid ? '✓ Captured' : '—';
      liveEl.style.color = s.hasLiveGrid ? '#34d399' : '#888';
    }
  }

  // ============================================================
  // PACKETS TAB
  // ============================================================
  function updatePacketsTab() {
    var reqs  = appState.recentRequests  || [];
    var resps = appState.recentResponses || [];

    setText('req-count',  reqs.length);
    setText('resp-count', resps.length);

    renderLogBox('req-log', reqs.slice(0, 20), function(r) {
      return '<span class="log-time">' + ts8(r.ts) + '</span> ' +
             '<span style="color:#a78bfa;">' + (r.method || 'GET') + '</span> ' +
             '<span class="log-url">' + shortUrl(r.url) + '</span>';
    }, 'No requests captured yet.');

    renderLogBox('resp-log', resps.slice(0, 20), function(r) {
      var hasGrid = r.rawText && (r.rawText.includes('"RS"') || r.rawText.includes('"F":[['));
      return '<span class="log-time">' + ts8(r.ts) + '</span> ' +
             '<span class="' + (r.status < 400 ? 'log-status' : 'log-error') + '">' + r.status + '</span> ' +
             '<span class="log-url">' + shortUrl(r.url) + '</span>' +
             (hasGrid ? ' <span style="color:#34d399;font-weight:bold;">★GRID</span>' : '');
    }, 'No responses yet.');

    renderLogBox('seed-log', appState.seedHistory.slice(0, 10), function(s) {
      var fields = Object.entries(s.fields || {}).slice(0, 4).map(function(e) {
        return '<span class="rng-field">' + e[0] + '</span>:<span class="rng-value">' + String(e[1]).substring(0, 20) + '</span>';
      }).join('  ');
      return fields || '(empty)';
    }, 'No seed/crypto fields found yet.');
  }

  function renderLogBox(id, items, formatter, emptyMsg) {
    var box = document.getElementById(id);
    if (!box) return;
    if (!items || items.length === 0) {
      box.innerHTML = '<div class="empty-state">' + emptyMsg + '</div>';
      return;
    }
    box.innerHTML = items.map(function(item) {
      return '<div class="log-entry">' + formatter(item) + '</div>';
    }).join('');
  }

  // ============================================================
  // RNG TAB
  // ============================================================
  function updateRngTab() {
    var rngDisplay  = document.getElementById('rng-display');
    var freqDisplay = document.getElementById('freq-display');
    var seedDetail  = document.getElementById('seed-detail');

    if (rngDisplay && appState.rngAnalysis) {
      var a = appState.rngAnalysis;
      var html = '<div style="font-size:10px;color:#555;margin-bottom:6px;">Samples: ' + a.totalSamples +
                 ' &nbsp;|&nbsp; Fields: ' + (a.fieldNames || []).join(', ') + '</div>';

      if (a.patterns && a.patterns.length) {
        a.patterns.forEach(function(p) {
          html += '<div class="rng-pattern">';
          html += '<div style="color:' + (p.confidence === 'HIGH' ? '#34d399' : '#fbbf24') + ';font-weight:bold;">⚡ ' + p.type + ' [' + p.confidence + ']</div>';
          html += '<div>Field: <span class="rng-field">' + p.field + '</span></div>';
          if (p.increment !== undefined) html += '<div>Increment per game: <span class="rng-value">' + p.increment + '</span></div>';
          if (p.nextPredicted !== undefined) html += '<div>Next predicted: <span class="rng-value" style="font-size:14px;color:#34d399;">' + p.nextPredicted + '</span></div>';
          if (p.modulus) html += '<div>Modulus detected: <span class="rng-value">' + p.modulus + '</span></div>';
          if (p.values) html += '<div style="color:#555;font-size:9px;">Recent: ' + p.values.join(', ') + '</div>';
          html += '</div>';
        });
      } else {
        html += '<div style="color:#555;font-size:10px;">No predictable linear patterns yet. Keep playing to accumulate more samples.</div>';
      }

      if (a.rngHints && a.rngHints.length) {
        html += '<div style="color:#888;font-size:10px;margin:6px 0 3px;">Hash/Crypto Fields:</div>';
        a.rngHints.forEach(function(h) {
          html += '<div class="rng-pattern"><div class="rng-note">🔑 ' + h.field + ' — ' + h.note + '</div>' +
                  '<div style="color:#444;font-size:9px;">' + (h.sample || '') + '</div></div>';
        });
      }

      rngDisplay.innerHTML = html;
    } else if (rngDisplay) {
      rngDisplay.innerHTML = '<div class="empty-state">Accumulating data...<br><br>Play several rounds and the analyser will detect patterns in the server\'s seed/nonce values.</div>';
    }

    if (freqDisplay) {
      freqDisplay.innerHTML = (appState.frequency && (appState.frequency.freq || appState.frequency.recommendations))
        ? buildFreqTable(appState.frequency)
        : '<div class="empty-state">No frequency data yet. Each completed game adds to the heatmap.</div>';
    }

    if (seedDetail) {
      if (!appState.seedHistory.length) {
        seedDetail.innerHTML = '<div class="empty-state">No seeds captured yet.</div>';
      } else {
        seedDetail.textContent = appState.seedHistory.slice(0, 15).map(function(s, idx) {
          var fields = Object.entries(s.fields || {}).map(function(e) {
            return '  ' + e[0] + ': ' + String(e[1]).substring(0, 40);
          }).join('\n');
          return '[' + (idx+1) + '] ' + shortUrl(s.url || '') + '\n' + fields;
        }).join('\n─────\n');
      }
    }
  }

  // ============================================================
  // PROBE TAB
  // ============================================================
  document.getElementById('btn-probe').addEventListener('click', function() {
    var url     = (document.getElementById('probe-url').value || '').trim();
    var method  = document.getElementById('probe-method').value;
    var bodyStr = (document.getElementById('probe-body').value || '').trim();
    var hdrStr  = (document.getElementById('probe-headers').value || '').trim();

    if (!url) { showProbeResult('Enter a URL to probe.', false); return; }

    var body = null, headers = {};
    if (bodyStr) {
      try { body = JSON.parse(bodyStr); }
      catch(e) { showProbeResult('Invalid JSON body: ' + e.message, false); return; }
    }
    if (hdrStr) {
      try { headers = JSON.parse(hdrStr); }
      catch(e) { showProbeResult('Invalid JSON headers: ' + e.message, false); return; }
    }

    showProbeResult('Probing...', true);
    sendToActiveTab('probe', { config: { url: url, method: method, body: body, headers: headers, probeId: 'popup_' + Date.now() } });

    setTimeout(function() {
      var box = document.getElementById('probe-result');
      if (box && box.textContent === 'Probing...') {
        box.textContent = 'Waiting for response... (ensure the Witch game tab is open)';
      }
    }, 5000);
  });

  document.getElementById('btn-probe-last').addEventListener('click', function() {
    if (!appState.lastGameRequest) {
      showProbeResult('No game request captured yet. Open the Witch game page first.', false);
      return;
    }
    var req = appState.lastGameRequest;
    document.getElementById('probe-url').value = req.url || '';
    document.getElementById('probe-method').value = (req.method || 'GET').toUpperCase();
    if (req.body && typeof req.body === 'object') {
      document.getElementById('probe-body').value = JSON.stringify(req.body, null, 2);
    }
    // ★ Also populate original headers (including x-auth)
    if (req.headers && Object.keys(req.headers).length > 0) {
      document.getElementById('probe-headers').value = JSON.stringify(req.headers, null, 2);
    }
    showProbeResult('✅ Loaded with original headers (x-auth included). Click Send Probe.', true);
  });

  document.getElementById('btn-rapid-probe').addEventListener('click', function() {
    var url = (document.getElementById('probe-url').value || '').trim();
    var count = Math.min(20, Math.max(2, parseInt(document.getElementById('probe-count').value) || 5));
    if (!url) {
      var r = document.getElementById('rapid-result');
      r.style.display = 'block'; r.textContent = 'Enter a URL above first.'; return;
    }
    var r = document.getElementById('rapid-result');
    r.style.display = 'block'; r.textContent = 'Sending ' + count + ' probes 300ms apart...';
    for (var i = 0; i < count; i++) {
      (function(idx) {
        setTimeout(function() {
          sendToActiveTab('probe', { config: { url: url, method: 'GET', probeId: 'rapid_' + idx + '_' + Date.now() } });
        }, idx * 300);
      })(i);
    }
    setTimeout(function() {
      r.textContent = count + ' probes sent. Watch the RNG tab for pattern analysis.';
    }, count * 300 + 2000);
  });

  function showProbeResult(msg, neutral) {
    var box = document.getElementById('probe-result');
    if (!box) return;
    box.style.display = 'block';
    box.style.color = neutral ? '#a0a0cc' : '#f87171';
    box.textContent = msg;
  }

  function handleProbeResult(data) {
    var box = document.getElementById('probe-result');
    if (!box) return;
    box.style.display = 'block';
    if (data.status === 'error') {
      box.style.color = '#f87171';
      box.textContent = 'Error: ' + data.error;
    } else {
      box.style.color = '#a0a0cc';
      var out = 'URL: ' + shortUrl(data.url) + '\n\n';
      if (data.parsed) {
        if (data.parsed.RS) out += '⚡ RS FIELD FOUND — may contain the grid!\n\n';
        out += JSON.stringify(data.parsed, null, 2).substring(0, 1200);
      } else {
        out += (data.rawText || '').substring(0, 800);
      }
      box.textContent = out;
    }
  }

  // ============================================================
  // GAME SESSION TOKEN STATUS (x-auth from live game page)
  // ============================================================
  function showSessionTokenStatus(active, token) {
    var dot   = document.getElementById('session-dot');
    var label = document.getElementById('session-label');
    var btn   = document.getElementById('btn-copy-session-token');
    if (!dot) return;
    if (active && token) {
      dot.style.background = '#34d399';
      dot.style.boxShadow  = '0 0 5px #34d399';
      if (label) label.style.color = '#34d399';
      if (label) label.textContent = '✅ Live x-auth token captured — probes auto-authenticated';
      if (btn) btn.style.display = 'block';
      appState.sessionToken = token;
    } else if (active === false) {
      dot.style.background = '#f87171';
      dot.style.boxShadow  = 'none';
      if (label) label.style.color = '#f87171';
      if (label) label.textContent = '⚠ Session expired (401) — refresh the game page';
      if (btn) btn.style.display = 'none';
      appState.sessionToken = null;
    } else {
      dot.style.background = '#555';
      dot.style.boxShadow  = 'none';
      if (label) label.style.color = '#666';
      if (label) label.textContent = 'Game session: waiting for page...';
      if (btn) btn.style.display = 'none';
    }
  }

  // Wire up copy-session-token button
  var copySessionBtn = document.getElementById('btn-copy-session-token');
  if (copySessionBtn) {
    copySessionBtn.addEventListener('click', function() {
      if (!appState.sessionToken) return;
      navigator.clipboard.writeText('Bearer ' + appState.sessionToken).then(function() {
        var orig = copySessionBtn.textContent;
        copySessionBtn.textContent = '✅ Copied!';
        setTimeout(function() { copySessionBtn.textContent = orig; }, 2000);
      }).catch(function() {});
    });
  }

  // ============================================================
  // TOKEN UI HELPERS
  // ============================================================
  function showNoTokenUI() {
    var nv = document.getElementById('no-token-view');
    var hv = document.getElementById('has-token-view');
    if (nv) nv.style.display = 'block';
    if (hv) hv.style.display = 'none';
    var ai = document.getElementById('auth-status-info');
    if (ai) { ai.textContent = 'No token'; ai.style.color = '#888'; }
  }

  function showHasTokenUI(token) {
    var nv = document.getElementById('no-token-view');
    var hv = document.getElementById('has-token-view');
    if (nv) nv.style.display = 'none';
    if (hv) hv.style.display = 'block';
    var td = document.getElementById('token-display');
    if (td && token) {
      td.textContent = token;
    }
    var ai = document.getElementById('auth-status-info');
    if (ai) { ai.textContent = 'Token ready ✓'; ai.style.color = '#34d399'; }
  }

  // ============================================================
  // GET TOKEN (one-click — no credentials)
  // ============================================================
  function requestToken(btnId) {
    var serverUrl = (document.getElementById('server-url').value || appState.serverUrl || '').trim();
    var errEl = document.getElementById('token-error');

    if (!serverUrl) {
      if (errEl) { errEl.textContent = 'Enter the Server URL below first.'; errEl.style.display = 'block'; }
      return;
    }
    if (errEl) errEl.style.display = 'none';

    var btn = document.getElementById(btnId);
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating...'; }

    fetch(serverUrl.replace(/\/$/, '') + '/api/auth/token', { method: 'POST' })
    .then(function(res) { return res.json().then(function(d) { return { ok: res.ok, data: d }; }); })
    .then(function(result) {
      if (btn) { btn.disabled = false; btn.textContent = btnId === 'btn-get-token' ? '🔑 Get My Token' : '🔄 Get New Token'; }
      if (!result.ok || !result.data.token) {
        if (errEl) { errEl.textContent = 'Server error — check URL is correct.'; errEl.style.display = 'block'; }
        return;
      }
      var token = result.data.token;
      appState.authToken = token;
      appState.serverUrl = serverUrl;
      chrome.storage.local.set({ authToken: token, serverUrl: serverUrl });
      sendToBackground('set_token', { token: token });
      showHasTokenUI(token);
    })
    .catch(function(err) {
      if (btn) { btn.disabled = false; btn.textContent = btnId === 'btn-get-token' ? '🔑 Get My Token' : '🔄 Get New Token'; }
      if (errEl) { errEl.textContent = 'Could not reach server: ' + err.message; errEl.style.display = 'block'; }
    });
  }

  document.getElementById('btn-get-token').addEventListener('click', function() { requestToken('btn-get-token'); });
  document.getElementById('btn-renew-token').addEventListener('click', function() { requestToken('btn-renew-token'); });

  // ============================================================
  // COPY TOKEN
  // ============================================================
  function copyToken() {
    if (!appState.authToken) return;
    navigator.clipboard.writeText(appState.authToken).then(function() {
      var btn = document.getElementById('btn-copy-token');
      var orig = btn.textContent;
      btn.textContent = '✅ Copied!';
      setTimeout(function() { btn.textContent = orig; }, 2000);
    }).catch(function() {});
  }
  document.getElementById('btn-copy-token').addEventListener('click', copyToken);
  var td = document.getElementById('token-display');
  if (td) td.addEventListener('click', copyToken);

  // ============================================================
  // CLEAR TOKEN
  // ============================================================
  document.getElementById('btn-clear-token').addEventListener('click', function() {
    appState.authToken = null;
    chrome.storage.local.remove(['authToken']);
    sendToBackground('set_token', { token: null });
    sendToBackground('disconnect').then(function() {
      updateConnectionUI(false);
      chrome.storage.local.set({ isConnected: false });
    });
    showNoTokenUI();
  });

  // ============================================================
  // SERVER CONNECTION TAB
  // ============================================================
  document.getElementById('btn-connect').addEventListener('click', function() {
    var url = (document.getElementById('server-url').value || '').trim();
    if (!url) return;
    if (!appState.authToken) {
      var errEl = document.getElementById('login-error');
      if (errEl) { errEl.textContent = 'Login first to get a token before connecting.'; errEl.style.display = 'block'; }
      var ls = document.getElementById('login-section');
      if (ls) ls.style.display = 'block';
      return;
    }
    appState.serverUrl = url;
    chrome.storage.local.set({ serverUrl: url });
    updateConnectionUI('connecting');
    sendToBackground('connect', { url: url, token: appState.authToken }).then(function(resp) {
      updateConnectionUI(resp && resp.success ? true : false);
      chrome.storage.local.set({ isConnected: !!(resp && resp.success) });
    });
  });

  document.getElementById('btn-disconnect').addEventListener('click', function() {
    sendToBackground('disconnect').then(function() {
      updateConnectionUI(false);
      chrome.storage.local.set({ isConnected: false });
    });
  });

  // Handle auth_required broadcast from background (token expired/missing)
  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg && msg.type === 'auth_required') {
      updateConnectionUI(false);
      showNoTokenUI();
      var errEl = document.getElementById('token-error');
      if (errEl) { errEl.textContent = 'Token expired. Get a new one.'; errEl.style.display = 'block'; }
    }
  });

  function updateConnectionUI(status) {
    var dot    = document.getElementById('conn-dot');
    var label  = document.getElementById('conn-status');
    if (!dot) return;
    if (status === 'connecting') {
      dot.className = 'conn-dot connecting';
      if (label) label.textContent = 'Connecting...';
    } else if (status === true) {
      dot.className = 'conn-dot connected';
      appState.isConnected = true;
      if (label) label.textContent = 'Connected to ' + (appState.serverUrl || 'server');
    } else {
      dot.className = 'conn-dot disconnected';
      appState.isConnected = false;
      if (label) label.textContent = 'Not connected';
    }
  }

  // ============================================================
  // GRID TAB BUTTONS
  // ============================================================
  document.getElementById('btn-clear-history').addEventListener('click', function() {
    if (confirm('Delete all saved game history? This will reset the frequency heatmap.')) {
      sendToActiveTab('clear_history', {});
      appState.grid = null; appState.frequency = null;
      appState.stats.hasLiveGrid = false; appState.stats.totalGames = 0;
      updateGridTab(); updateRngTab();
    }
  });

  document.getElementById('btn-refresh').addEventListener('click', loadState);

  // ============================================================
  // HELPERS
  // ============================================================
  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function ts8(ts) {
    if (!ts) return '?';
    try { return ts.split('T')[1].substring(0, 8); } catch(e) { return ''; }
  }

  function shortUrl(url) {
    if (!url) return '';
    try {
      var u = new URL(url);
      var p = u.pathname.substring(0, 35);
      var q = u.search ? '?' + u.search.substring(1, 15) : '';
      return p + q;
    } catch(e) { return url.substring(0, 45); }
  }

  // ============================================================
  // API PROXY TAB
  // ============================================================
  var apiParsed = null;
  var apiResult = null;
  var apiCurrentFormat = 'pretty';

  var API_FORMATS = [
    { id: 'pretty',  label: 'Pretty JSON' },
    { id: 'raw',     label: 'Raw' },
    { id: 'minified',label: 'Minified' },
    { id: 'yaml',    label: 'YAML' },
    { id: 'table',   label: 'Table' },
    { id: 'headers', label: 'Resp Headers' },
    { id: 'base64',  label: 'Base64' },
    { id: 'hex',     label: 'Hex' },
    { id: 'summary', label: 'Summary' },
    { id: 'curl',    label: 'cURL' },
  ];

  function parseFetchCallExt(raw) {
    try {
      var urlMatch = raw.match(/fetch\s*\(\s*["'`]([^"'`]+)["'`]/);
      if (!urlMatch) return null;
      var url = urlMatch[1];
      var optionsMatch = raw.match(/fetch\s*\([^,]+,\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/);
      if (!optionsMatch) return { url: url, method: 'GET', headers: {}, body: null };
      var optText = optionsMatch[1];
      var methodMatch = optText.match(/"method"\s*:\s*"([A-Z]+)"/);
      var method = methodMatch ? methodMatch[1] : 'GET';
      var bodyMatch = optText.match(/"body"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      var body = null;
      if (bodyMatch) body = bodyMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      var headersMatch = optText.match(/"headers"\s*:\s*\{([\s\S]*?)\},/);
      var headers = {};
      if (headersMatch) {
        var hBlock = headersMatch[1];
        var pairs = hBlock.matchAll(/"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
        for (var pair of pairs) {
          headers[pair[1]] = pair[2].replace(/\\"/g, '"');
        }
      }
      return { url: url, method: method, headers: headers, body: body };
    } catch(e) { return null; }
  }

  function apiToYaml(obj, indent) {
    indent = indent || 0;
    if (obj === null) return 'null';
    if (typeof obj === 'boolean' || typeof obj === 'number') return String(obj);
    if (typeof obj === 'string') return obj.length > 60 ? '"' + obj.substring(0, 60) + '..."' : obj;
    if (Array.isArray(obj)) return obj.slice(0, 10).map(function(v) { return '  '.repeat(indent) + '- ' + apiToYaml(v, indent + 1); }).join('\n');
    return Object.entries(obj).slice(0, 30).map(function(kv) {
      var val = typeof kv[1] === 'object' && kv[1] !== null ? '\n' + apiToYaml(kv[1], indent + 1) : ' ' + apiToYaml(kv[1], indent);
      return '  '.repeat(indent) + kv[0] + ':' + val;
    }).join('\n');
  }

  function apiToHex(str) {
    return Array.from((str || '').substring(0, 256)).map(function(c) { return c.charCodeAt(0).toString(16).padStart(2, '0'); }).join(' ');
  }

  function apiToBase64(str) {
    try { return btoa(unescape(encodeURIComponent((str || '').substring(0, 2000)))); } catch(e) { return btoa((str || '').substring(0, 500)); }
  }

  function apiFlattenObj(obj, prefix) {
    var rows = [];
    prefix = prefix || '';
    Object.entries(obj || {}).forEach(function(kv) {
      var fullKey = prefix ? prefix + '.' + kv[0] : kv[0];
      if (kv[1] !== null && typeof kv[1] === 'object' && !Array.isArray(kv[1])) {
        rows = rows.concat(apiFlattenObj(kv[1], fullKey));
      } else {
        rows.push({ key: fullKey, value: Array.isArray(kv[1]) ? JSON.stringify(kv[1]) : String(kv[1] !== null && kv[1] !== undefined ? kv[1] : ''), type: typeof kv[1] });
      }
    });
    return rows;
  }

  function apiGetFormatContent(formatId) {
    if (!apiResult) return '';
    var p = apiResult.parsed;
    var raw = apiResult.rawText || '';
    var flat = p ? apiFlattenObj(p) : [];
    switch (formatId) {
      case 'pretty':   return p ? JSON.stringify(p, null, 2) : raw;
      case 'raw':      return raw;
      case 'minified': return p ? JSON.stringify(p) : raw;
      case 'yaml':     return p ? apiToYaml(p) : raw;
      case 'table':
        if (!flat.length) return raw;
        return flat.map(function(r) { return r.key + '\t' + r.type + '\t' + r.value.substring(0, 100); }).join('\n');
      case 'headers':  return JSON.stringify(apiResult.headers || {}, null, 2);
      case 'base64':   return apiToBase64(raw);
      case 'hex':      return apiToHex(raw);
      case 'summary':
        var lines = [
          'HTTP ' + apiResult.status + ' ' + apiResult.statusText + ' — ' + apiResult.elapsed + 'ms',
          'URL: ' + (apiParsed ? apiParsed.url : ''),
          'Method: ' + (apiParsed ? apiParsed.method : ''),
          'Response size: ' + raw.length + ' chars',
          'Flat fields: ' + flat.length,
          'Top-level keys: ' + (p && typeof p === 'object' ? Object.keys(p).join(', ') : 'N/A'),
          '',
          'Values:'
        ];
        if (p && typeof p === 'object') {
          Object.entries(p).slice(0, 20).forEach(function(kv) {
            lines.push('  ' + kv[0] + ': ' + JSON.stringify(kv[1]).substring(0, 80));
          });
        } else { lines.push(raw.substring(0, 300)); }
        return lines.join('\n');
      case 'curl':
        var curlLines = ['curl -X ' + (apiParsed ? apiParsed.method : 'GET') + ' \\', "  '" + (apiParsed ? apiParsed.url : '') + "' \\"];
        Object.entries(apiParsed ? apiParsed.headers : {}).forEach(function(kv) { curlLines.push("  -H '" + kv[0] + ': ' + kv[1] + "' \\"); });
        if (apiParsed && apiParsed.body) curlLines.push("  -d '" + apiParsed.body + "'");
        return curlLines.join('\n');
      default: return raw;
    }
  }

  function apiRenderFormatBtns() {
    var container = document.getElementById('api-format-btns');
    if (!container) return;
    container.innerHTML = '';
    API_FORMATS.forEach(function(f) {
      var btn = document.createElement('button');
      btn.textContent = f.label;
      btn.style.cssText = 'padding:2px 7px;border:1px solid ' + (f.id === apiCurrentFormat ? '#a78bfa' : '#2a2a4a') + ';border-radius:4px;background:' + (f.id === apiCurrentFormat ? '#2a1a5a' : '#1a1a2e') + ';color:' + (f.id === apiCurrentFormat ? '#a78bfa' : '#888') + ';font-size:9px;cursor:pointer;margin:0;width:auto;transition:all 0.1s;';
      btn.addEventListener('click', function() {
        apiCurrentFormat = f.id;
        apiRenderResult();
        apiRenderFormatBtns();
      });
      container.appendChild(btn);
    });
  }

  function apiRenderResult() {
    var box = document.getElementById('api-result-box');
    var section = document.getElementById('api-result-section');
    var badge = document.getElementById('api-status-badge');
    if (!box || !apiResult) return;
    section.style.display = 'block';
    var statusOk = apiResult.status < 300;
    badge.textContent = 'HTTP ' + apiResult.status + ' · ' + apiResult.elapsed + 'ms';
    badge.className = 'badge ' + (statusOk ? 'badge-green' : 'badge-red');
    var content = apiGetFormatContent(apiCurrentFormat);
    box.textContent = content.substring(0, 3000) + (content.length > 3000 ? '\n...(truncated)' : '');
    apiRenderFormatBtns();
  }

  document.getElementById('btn-api-parse').addEventListener('click', function() {
    var raw = (document.getElementById('api-fetch-input').value || '').trim();
    var errEl = document.getElementById('api-parse-error');
    var infoEl = document.getElementById('api-parsed-info');
    errEl.style.display = 'none';
    infoEl.style.display = 'none';
    if (!raw) { errEl.textContent = 'Paste a fetch() call first.'; errEl.style.display = 'block'; return; }
    var p = parseFetchCallExt(raw);
    if (!p) { errEl.textContent = 'Could not parse — paste the full fetch() JS snippet from DevTools.'; errEl.style.display = 'block'; return; }
    apiParsed = p;
    var hCount = Object.keys(p.headers).length;
    infoEl.textContent = '✓ ' + p.method + ' ' + p.url.substring(0, 70) + (p.url.length > 70 ? '…' : '') + ' | ' + hCount + ' headers' + (p.body ? ' | body: ' + p.body.substring(0, 30) : '');
    infoEl.style.color = '#34d399';
    infoEl.style.display = 'block';
    document.getElementById('btn-api-go').disabled = false;
  });

  document.getElementById('btn-api-go').addEventListener('click', function() {
    if (!apiParsed) return;
    var serverUrl = (appState.serverUrl || '').replace(/\/$/, '');
    if (!serverUrl) {
      var errEl = document.getElementById('api-parse-error');
      errEl.textContent = '⚠ Set your Server URL in the Server tab first.';
      errEl.style.display = 'block';
      return;
    }
    var btn = document.getElementById('btn-api-go');
    btn.disabled = true;
    btn.textContent = '⏳ Sending…';
    var errEl = document.getElementById('api-parse-error');
    errEl.style.display = 'none';

    fetch(serverUrl + '/api/witch/proxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: apiParsed.url, method: apiParsed.method, headers: apiParsed.headers, body: apiParsed.body })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      btn.disabled = false;
      btn.textContent = '🚀 Go';
      apiResult = data;
      apiCurrentFormat = 'pretty';
      apiRenderResult();
    })
    .catch(function(err) {
      btn.disabled = false;
      btn.textContent = '🚀 Go';
      errEl.textContent = 'Error: ' + err.message + '. Check Server URL in the Server tab.';
      errEl.style.display = 'block';
    });
  });

  document.getElementById('btn-api-autofill').addEventListener('click', function() {
    var token = appState.sessionToken;
    var lastReq = appState.lastGameRequest;
    var input = document.getElementById('api-fetch-input');
    var errEl = document.getElementById('api-parse-error');
    errEl.style.display = 'none';
    if (!token && !lastReq) {
      errEl.textContent = '⚠ No session token captured yet. Open the Witch game page first.';
      errEl.style.display = 'block';
      return;
    }
    if (lastReq && lastReq.url) {
      var headers = Object.assign({}, lastReq.headers || {});
      if (token) headers['x-auth'] = 'Bearer ' + token;
      var snippet = 'fetch("' + lastReq.url + '", {\n' +
        '  "headers": ' + JSON.stringify(headers, null, 4) + ',\n' +
        '  "body": ' + (lastReq.body ? JSON.stringify(JSON.stringify(lastReq.body)) : 'null') + ',\n' +
        '  "method": "' + (lastReq.method || 'POST') + '"\n' +
        '});';
      input.value = snippet;
    } else if (token) {
      var infoEl = document.getElementById('api-parsed-info');
      infoEl.textContent = '✓ Token captured: Bearer ' + token.substring(0, 30) + '… — paste your fetch() URL above and it will be injected automatically.';
      infoEl.style.color = '#fbbf24';
      infoEl.style.display = 'block';
    }
  });

  document.getElementById('btn-api-copy').addEventListener('click', function() {
    var content = apiGetFormatContent(apiCurrentFormat);
    navigator.clipboard.writeText(content).then(function() {
      var btn = document.getElementById('btn-api-copy');
      var orig = btn.textContent;
      btn.textContent = '✅ Copied!';
      setTimeout(function() { btn.textContent = orig; }, 1800);
    }).catch(function() {});
  });

  document.getElementById('btn-api-clear').addEventListener('click', function() {
    apiResult = null; apiParsed = null;
    document.getElementById('api-result-section').style.display = 'none';
    document.getElementById('api-parsed-info').style.display = 'none';
    document.getElementById('api-fetch-input').value = '';
    document.getElementById('btn-api-go').disabled = true;
  });

  // ============================================================
  // INIT
  // ============================================================
  loadState();
  setInterval(loadState, 3000);

})();
