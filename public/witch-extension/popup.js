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
    serverUrl: ''
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
  // LOAD SAVED SERVER URL
  // ============================================================
  chrome.storage.local.get(['serverUrl', 'isConnected'], function(result) {
    if (result.serverUrl) {
      appState.serverUrl = result.serverUrl;
      document.getElementById('server-url').value = result.serverUrl;
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
    showProbeResult('Loaded last game request URL. Click Send Probe to replay it.', true);
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
  // SERVER CONNECTION TAB
  // ============================================================
  document.getElementById('btn-connect').addEventListener('click', function() {
    var url = (document.getElementById('server-url').value || '').trim();
    if (!url) return;
    appState.serverUrl = url;
    chrome.storage.local.set({ serverUrl: url });
    updateConnectionUI('connecting');
    sendToBackground('connect', { url: url }).then(function(resp) {
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
  // INIT
  // ============================================================
  loadState();
  setInterval(loadState, 3000);

})();
