(function() {
  'use strict';

  // ============================================================
  // WITCH GAME ANALYZER PRO v12.0 — CONTENT SCRIPT
  // Tabs: Grid | Packets | Probe | RNG | Decode | Diff | Server
  // Pure passive analysis. NO auto-clicking. Ever.
  // ============================================================

  var state = {
    grid: null,
    gridSource: null,
    frequency: null,
    stats: { totalGames: 0, requestsCaptured: 0, hasLiveGrid: false, decodeFindings: 0, timelineEvents: 0, version: '12.0' },
    recentRequests: [],
    recentResponses: [],
    seedHistory: [],
    decodeFindings: [],
    diffResults: [],
    timeline: [],
    rngAnalysis: null,
    isMinimized: false,
    activeTab: 'grid'
  };

  // ============================================================
  // INJECT injected.js INTO PAGE CONTEXT
  // ============================================================
  function inject() {
    try {
      var s = document.createElement('script');
      s.src = chrome.runtime.getURL('injected.js');
      s.onload = function() { this.remove(); };
      (document.head || document.documentElement).prepend(s);
    } catch(e) {
      console.error('[Witch v12] Inject failed:', e);
    }
  }

  inject();

  // ============================================================
  // LISTEN TO MESSAGES FROM injected.js
  // ============================================================
  window.addEventListener('message', function(evt) {
    if (!evt.data || evt.data.source !== 'witch-injected-v11') return;
    var type = evt.data.type;
    var data = evt.data.data;

    switch (type) {
      case 'ready':
        console.log('[Witch v12] Injected ready. History:', data.historyCount, 'games. v' + data.version);
        requestState();
        break;

      case 'grid_captured':
        state.grid = data.grid;
        state.gridSource = data.source;
        state.frequency = data.frequency;
        state.stats.hasLiveGrid = true;
        state.stats.totalGames = data.totalGames || state.stats.totalGames;
        updateOverlay();
        notifyBackground('grid_captured', data);
        console.log('[Witch v12] Grid captured from:', data.source, data.decodedFrom ? '(decoded via ' + data.decodedFrom.method + ')' : '');
        break;

      case 'frequency_ready':
        state.frequency = data;
        updateOverlay();
        break;

      case 'seeds_extracted':
        state.seedHistory.unshift(data);
        if (state.seedHistory.length > 20) state.seedHistory.pop();
        notifyBackground('seeds_extracted', data);
        break;

      case 'rng_analysis':
        state.rngAnalysis = data;
        notifyBackground('rng_analysis', data);
        if (state.activeTab === 'rng') renderTabContent();
        break;

      case 'decode_findings':
        if (data.findings && data.findings.length > 0) {
          state.decodeFindings.unshift(data);
          if (state.decodeFindings.length > 30) state.decodeFindings.pop();
          state.stats.decodeFindings = state.decodeFindings.length;
          updateDecodeBadge();
          if (state.activeTab === 'decode') renderTabContent();
        }
        break;

      case 'diff_results':
        state.diffResults = data.diffs || [];
        updateDiffBadge(data);
        if (state.activeTab === 'diff') renderTabContent();
        break;

      case 'timeline_event':
        state.timeline.unshift(data);
        if (state.timeline.length > 100) state.timeline.pop();
        state.stats.timelineEvents = state.timeline.length;
        break;

      case 'request':
        state.recentRequests.unshift(data);
        if (state.recentRequests.length > 30) state.recentRequests.pop();
        state.stats.requestsCaptured = (state.stats.requestsCaptured || 0) + 1;
        updateStatsBar();
        if (state.activeTab === 'packets') renderTabContent();
        break;

      case 'response':
        state.recentResponses.unshift(data);
        if (state.recentResponses.length > 30) state.recentResponses.pop();
        if (state.activeTab === 'packets') renderTabContent();
        break;

      case 'state':
        state.grid = data.grid;
        state.gridSource = data.gridSource;
        state.frequency = data.frequency;
        state.stats = data.stats || state.stats;
        state.recentRequests = data.recentRequests || [];
        state.recentResponses = data.recentResponses || [];
        state.seedHistory = data.seedHistory || [];
        state.decodeFindings = data.decodeFindings || [];
        state.diffResults = data.diffResults || [];
        state.timeline = data.timeline || [];
        updateOverlay();
        break;

      case 'probe_result':
        updateProbeResult(data);
        notifyBackground('probe_result', data);
        break;

      case 'history_cleared':
        state.grid = null;
        state.frequency = null;
        state.stats.hasLiveGrid = false;
        state.decodeFindings = [];
        state.diffResults = [];
        state.timeline = [];
        updateOverlay();
        break;

      case 'ws_message':
        notifyBackground('ws_message', data);
        break;
    }
  });

  function sendToInjected(cmd, payload) {
    window.postMessage({ source: 'witch-content-v11', cmd: cmd, ...(payload || {}) }, '*');
  }

  function requestState() { sendToInjected('get_state'); }

  function notifyBackground(type, data) {
    try { chrome.runtime.sendMessage({ type: type, data: data }); } catch(e) {}
  }

  // ============================================================
  // OVERLAY — tab-based layout
  // ============================================================
  var overlay = null;

  var TABS = [
    { id: 'grid',    label: '📋 Grid'    },
    { id: 'decode',  label: '🔓 Decode'  },
    { id: 'diff',    label: '🔄 Diff'    },
    { id: 'packets', label: '📡 Packets' },
    { id: 'rng',     label: '🧬 RNG'    },
    { id: 'probe',   label: '🔬 Probe'  },
    { id: 'server',  label: '🖥 Server'  }
  ];

  function createOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'witch-overlay-v11';
    document.body.appendChild(overlay);
    injectStyles();
    overlay.innerHTML = buildShell();
    makeDraggable(overlay, overlay.querySelector('.witch-header'));
    overlay.querySelector('#witch-minimize').addEventListener('click', toggleMinimize);
    overlay.querySelector('#witch-close').addEventListener('click', hideOverlay);

    // Tab clicks
    overlay.querySelectorAll('.witch-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.activeTab = btn.dataset.tab;
        overlay.querySelectorAll('.witch-tab').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        renderTabContent();
      });
    });

    // Initial render
    overlay.querySelector('.witch-tab[data-tab="grid"]').classList.add('active');
    updateOverlay();
  }

  function buildShell() {
    var tabsHTML = TABS.map(function(t) {
      return '<button class="witch-tab" data-tab="' + t.id + '">' + t.label + '</button>';
    }).join('');

    return '<div class="witch-header">' +
      '<span class="witch-title">🔮 Witch Analyzer Pro <span style="font-size:9px;color:#6366f1">v12</span></span>' +
      '<div class="witch-controls">' +
        '<button id="witch-minimize" title="Minimize">−</button>' +
        '<button id="witch-close" title="Close">✕</button>' +
      '</div>' +
    '</div>' +
    '<div id="witch-stats-bar" class="witch-stats-bar"></div>' +
    '<div class="witch-tabs">' + tabsHTML + '</div>' +
    '<div id="witch-body" class="witch-body"></div>';
  }

  function updateOverlay() {
    if (!overlay) return;
    updateStatsBar();
    renderTabContent();
  }

  function renderTabContent() {
    if (!overlay) return;
    var body = overlay.querySelector('#witch-body');
    if (!body) return;
    switch (state.activeTab) {
      case 'grid':    body.innerHTML = renderGrid(); break;
      case 'decode':  body.innerHTML = renderDecode(); break;
      case 'diff':    body.innerHTML = renderDiff(); break;
      case 'packets': body.innerHTML = renderPackets(); break;
      case 'rng':     body.innerHTML = renderRNG(); break;
      case 'probe':   body.innerHTML = renderProbe(); attachProbeHandler(); break;
      case 'server':  body.innerHTML = renderServer(); attachServerHandler(); break;
      default:        body.innerHTML = renderGrid();
    }
  }

  // ============================================================
  // TAB: GRID
  // ============================================================
  function renderGrid() {
    var html = '<div class="witch-section">';

    if (state.grid) {
      var src = state.gridSource || '';
      var srcShort = src.split('/').pop().substring(0, 40);
      html += '<div class="witch-section-title">📋 Cell Recommendations <span class="badge badge-green">🟢 Live Grid</span></div>';
      html += buildGridTable(state.grid, 'live');
      html += '<div class="witch-source">From: ' + srcShort + '</div>';

    } else if (state.frequency && state.frequency.recommendations && state.frequency.recommendations.length) {
      var games = state.frequency.totalGames || 0;
      html += '<div class="witch-section-title">📋 Cell Recommendations <span class="badge badge-yellow">🟡 Statistical (' + games + ' games)</span></div>';
      html += buildFreqTable(state.frequency);
      html += '<div class="witch-source">Based on ' + games + ' historical games</div>';

    } else {
      html += '<div class="witch-section-title">📋 Cell Recommendations <span class="badge badge-gray">No Data</span></div>';
      html += '<div class="witch-empty">Waiting for game data...<br>Open the Witch game page.</div>';
    }

    html += '</div>';

    // Row-by-row safe cell list
    if (state.grid || (state.frequency && state.frequency.recommendations && state.frequency.recommendations.length)) {
      html += '<div class="witch-section">';
      html += '<div class="witch-section-title" style="font-size:10px">Row Summary</div>';
      var recs = state.grid ? gridToRecs(state.grid) : state.frequency.recommendations;
      html += '<div style="font-size:10px;line-height:1.6">';
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i];
        html += '<div style="color:#6ee7b7">Row ' + r.row + ': <span style="color:#34d399;font-weight:bold">';
        if (r.cells) {
          html += r.cells.join(', ');
        } else {
          html += 'C' + r.cell + (r.pct ? ' <span style="color:#888">(' + r.pct + '%)</span>' : '');
        }
        html += '</span></div>';
      }
      html += '</div></div>';
    }

    html += '<div class="witch-section">' +
      '<button id="witch-clear-grid" class="witch-btn witch-btn-danger">🗑 Clear Saved History</button>' +
      '<button id="witch-refresh-grid" class="witch-btn" style="margin-top:4px">↻ Refresh Data</button>' +
    '</div>';

    return html;
  }

  function gridToRecs(grid) {
    var recs = [];
    for (var r = 0; r < grid.length; r++) {
      var cells = [];
      for (var c = 0; c < 5; c++) {
        if (grid[r][c]) cells.push('C' + (c + 1));
      }
      recs.push({ row: r + 1, cells: cells });
    }
    return recs;
  }

  function attachGridHandlers() {
    var clr = overlay.querySelector('#witch-clear-grid');
    if (clr) clr.addEventListener('click', clearHistory);
    var ref = overlay.querySelector('#witch-refresh-grid');
    if (ref) ref.addEventListener('click', requestState);
  }

  // ============================================================
  // TAB: DECODE — shows all decoding attempts on response fields
  // ============================================================
  function renderDecode() {
    var html = '<div class="witch-section">' +
      '<div class="witch-section-title">🔓 Field Decoder Engine' +
        '<span class="badge badge-gray" style="margin-left:4px">' + (state.decodeFindings.length || 0) + ' batches</span>' +
      '</div>' +
      '<div style="font-size:9px;color:#666;margin-bottom:6px">Tries Base64 · Hex→ASCII · XOR · URL · Double-JSON · Reverse · Bitmask50</div>';

    if (!state.decodeFindings.length) {
      html += '<div class="witch-empty">No decodable fields found yet.<br>Play a game — all response fields will be scanned.</div>';
    } else {
      // Show findings, grid candidates first
      var allFindings = [];
      for (var bi = 0; bi < state.decodeFindings.length; bi++) {
        var batch = state.decodeFindings[bi];
        for (var fi = 0; fi < (batch.findings || []).length; fi++) {
          allFindings.push({ finding: batch.findings[fi], url: batch.url });
        }
      }
      // Grid candidates first
      allFindings.sort(function(a, b) {
        if (a.finding.gridCandidate && !b.finding.gridCandidate) return -1;
        if (!a.finding.gridCandidate && b.finding.gridCandidate) return 1;
        return 0;
      });

      var limit = Math.min(allFindings.length, 30);
      for (var i = 0; i < limit; i++) {
        var f = allFindings[i].finding;
        var isGrid = !!f.gridCandidate;
        html += '<div class="decode-item' + (isGrid ? ' decode-grid' : '') + '">';
        if (isGrid) {
          html += '<div style="color:#ffd700;font-weight:bold;font-size:10px">★ POSSIBLE GRID (Bitmask)</div>';
          html += '<div style="color:#888;font-size:9px">Field: <span style="color:#60a5fa">' + esc(f.key) + '</span> · Method: ' + f.method + '</div>';
          html += buildGridTable(f.gridCandidate, 'live');
        } else {
          html += '<div style="color:#a78bfa;font-size:10px;font-weight:bold">' + f.method + '</div>';
          html += '<div style="color:#888;font-size:9px">Field: <span style="color:#60a5fa">' + esc(f.key) + '</span></div>';
          html += '<div style="color:#555;font-size:9px">Raw: ' + esc(String(f.raw || '').substring(0, 30)) + '</div>';
          html += '<div class="decode-value">' + esc(String(f.decoded || '').substring(0, 200)) + '</div>';
        }
        html += '</div>';
      }
    }

    html += '</div>';

    // Manual decode tool
    html += '<div class="witch-section">' +
      '<div class="witch-section-title" style="font-size:10px">Manual Decode</div>' +
      '<div class="witch-row"><input id="witch-decode-val" placeholder="Paste any value to decode..." /></div>' +
      '<button id="witch-decode-btn" class="witch-btn">Decode</button>' +
      '<div id="witch-decode-result" class="witch-result-box" style="display:none"></div>' +
    '</div>';

    return html;
  }

  function attachDecodeHandler() {
    var btn = overlay.querySelector('#witch-decode-btn');
    if (btn) btn.addEventListener('click', function() {
      var inp = overlay.querySelector('#witch-decode-val');
      var val = inp ? inp.value.trim() : '';
      if (!val) return;
      sendToInjected('decode_value', { key: 'manual', value: val });
      var box = overlay.querySelector('#witch-decode-result');
      if (box) { box.style.display = 'block'; box.textContent = 'Decoding...'; }
    });
  }

  function updateDecodeBadge() {
    if (!overlay) return;
    var tab = overlay.querySelector('.witch-tab[data-tab="decode"]');
    if (tab && state.decodeFindings.length > 0) {
      // Highlight if any grid candidates found
      var hasGrid = state.decodeFindings.some(function(b) {
        return b.findings && b.findings.some(function(f) { return f.gridCandidate; });
      });
      if (hasGrid) tab.style.color = '#ffd700';
      else tab.style.color = '#34d399';
    }
  }

  // ============================================================
  // TAB: DIFF — field-by-field comparison between consecutive games
  // ============================================================
  function renderDiff() {
    var html = '<div class="witch-section">' +
      '<div class="witch-section-title">🔄 Inter-Game Field Diff' +
        '<span class="badge badge-gray" style="margin-left:4px">' + (state.diffResults.length || 0) + ' changes</span>' +
      '</div>' +
      '<div style="font-size:9px;color:#666;margin-bottom:6px">Fields that change between games — may reveal pre-generated results</div>';

    if (!state.diffResults.length) {
      html += '<div class="witch-empty">Play at least 2 games to see what changes between rounds.<br>Changing fields may contain encoded grid data.</div>';
    } else {
      // Sort: CHANGED first, then ADDED, then REMOVED
      var sorted = state.diffResults.slice().sort(function(a, b) {
        var order = { CHANGED: 0, ADDED: 1, REMOVED: 2 };
        return (order[a.type] || 0) - (order[b.type] || 0);
      });

      for (var i = 0; i < Math.min(sorted.length, 50); i++) {
        var d = sorted[i];
        var color = d.type === 'CHANGED' ? '#60a5fa' : d.type === 'ADDED' ? '#34d399' : '#f87171';
        var icon = d.type === 'CHANGED' ? '↔' : d.type === 'ADDED' ? '+' : '−';
        html += '<div class="diff-item">';
        html += '<span style="color:' + color + ';font-weight:bold;font-size:10px">' + icon + ' ' + d.type + '</span> ';
        html += '<span style="color:#a78bfa;font-size:10px">' + esc(d.key) + '</span><br>';
        if (d.type === 'CHANGED') {
          html += '<div style="font-size:9px">';
          html += '<span style="color:#f87171">−&nbsp;' + esc(String(d.before || '').substring(0, 60)) + '</span><br>';
          html += '<span style="color:#34d399">+&nbsp;' + esc(String(d.after || '').substring(0, 60)) + '</span>';
          html += '</div>';
        } else if (d.type === 'ADDED') {
          html += '<div style="font-size:9px;color:#34d399">+&nbsp;' + esc(String(d.after || '').substring(0, 80)) + '</div>';
        } else {
          html += '<div style="font-size:9px;color:#f87171">−&nbsp;' + esc(String(d.before || '').substring(0, 80)) + '</div>';
        }
        html += '</div>';
      }
    }

    html += '</div>';

    // Timeline
    if (state.timeline.length) {
      html += '<div class="witch-section">';
      html += '<div class="witch-section-title" style="font-size:10px">Game Timeline</div>';
      var limit = Math.min(state.timeline.length, 15);
      for (var ti = 0; ti < limit; ti++) {
        var ev = state.timeline[ti];
        var evColor = ev.type === 'GAME_START' ? '#34d399' : ev.type === 'ROW_CLICK' ? '#60a5fa' : '#888';
        html += '<div style="font-size:9px;margin-bottom:2px;color:' + evColor + '">';
        html += '[' + ev.type + ']' + (ev.gameNum ? ' #' + ev.gameNum : '') + ' ';
        html += (ev.gridFound ? '✓grid ' : '') + '<span style="color:#555">' + esc((ev.url || '').substring(0, 40)) + '</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    return html;
  }

  function updateDiffBadge(data) {
    if (!overlay) return;
    var tab = overlay.querySelector('.witch-tab[data-tab="diff"]');
    if (tab && data && data.interestingDiffs > 0) {
      tab.style.color = '#60a5fa';
    }
  }

  // ============================================================
  // TAB: PACKETS
  // ============================================================
  function renderPackets() {
    var html = '<div class="witch-section">' +
      '<div class="witch-section-title">📡 Captured Packets (' + state.recentRequests.length + ')</div>';

    if (!state.recentRequests.length) {
      html += '<div class="witch-empty">No requests captured yet.</div>';
    } else {
      var limit = Math.min(state.recentRequests.length, 15);
      for (var i = 0; i < limit; i++) {
        var req = state.recentRequests[i];
        var urlShort = (req.url || '').replace(/^https?:\/\/[^/]+/, '').substring(0, 50);
        var isGame = (req.url || '').includes('game') || (req.url || '').includes('bet');
        html += '<div class="packet-item' + (isGame ? ' packet-game' : '') + '">';
        html += '<span style="color:#6366f1;font-size:9px">' + (req.method || 'GET') + '</span> ';
        html += '<span style="color:#60a5fa;font-size:9px">' + esc(urlShort) + '</span>';
        if (req.body && typeof req.body === 'object') {
          html += '<div style="color:#555;font-size:8px">' + esc(JSON.stringify(req.body).substring(0, 80)) + '</div>';
        }
        html += '</div>';
      }
    }

    html += '</div><div class="witch-section">' +
      '<div class="witch-section-title">📥 Responses (' + state.recentResponses.length + ')</div>';

    if (!state.recentResponses.length) {
      html += '<div class="witch-empty">No responses yet.</div>';
    } else {
      var rlimit = Math.min(state.recentResponses.length, 10);
      for (var ri = 0; ri < rlimit; ri++) {
        var resp = state.recentResponses[ri];
        var rUrlShort = (resp.url || '').replace(/^https?:\/\/[^/]+/, '').substring(0, 45);
        var statusColor = resp.status >= 200 && resp.status < 300 ? '#34d399' : '#f87171';
        html += '<div class="packet-item">';
        html += '<span style="color:' + statusColor + ';font-size:9px">' + (resp.status || '?') + '</span> ';
        html += '<span style="color:#60a5fa;font-size:9px">' + esc(rUrlShort) + '</span>';
        if (resp.rawText) {
          html += '<div style="color:#555;font-size:8px">' + esc(resp.rawText.substring(0, 80)) + '</div>';
        }
        html += '</div>';
      }
    }

    html += '</div>';
    return html;
  }

  // ============================================================
  // TAB: RNG
  // ============================================================
  function renderRNG() {
    var analysis = state.rngAnalysis;
    var h = loadSeedHistory();

    var html = '<div class="witch-section">' +
      '<div class="witch-section-title">🧬 RNG Pattern Analysis</div>';

    if (h.length > 0) {
      html += '<div style="font-size:9px;color:#888;margin-bottom:4px">Samples: ' + h.length + ' | Fields: ';
      var fieldsSeen = {};
      h.forEach(function(s) { Object.keys(s.fields || {}).forEach(function(k) { fieldsSeen[k] = true; }); });
      html += Object.keys(fieldsSeen).join(', ');
      html += '</div>';
    }

    if (!analysis) {
      html += '<div class="witch-empty">Collecting seed data...<br>Need ≥2 samples to detect patterns.</div>';
    } else {
      if (analysis.patterns && analysis.patterns.length) {
        for (var i = 0; i < analysis.patterns.length; i++) {
          var p = analysis.patterns[i];
          html += '<div class="rng-pattern">';
          html += '<span class="rng-high">⚡ ' + p.type + ' [' + p.confidence + ']</span><br>';
          html += '<span style="color:#888;font-size:9px">Field: </span><span style="color:#60a5fa">' + esc(p.field) + '</span><br>';
          if (p.increment !== undefined) html += '<span style="font-size:9px">Increment: ' + p.increment + '</span><br>';
          if (p.modulus) html += '<span style="font-size:9px">Modulus: ' + p.modulus + '</span><br>';
          if (p.nextPredicted !== undefined) html += '<span style="color:#34d399;font-weight:bold">Next predicted: ' + p.nextPredicted + '</span>';
          html += '</div>';
        }
      }
      if (analysis.rngHints && analysis.rngHints.length) {
        for (var j = 0; j < analysis.rngHints.length; j++) {
          var hint = analysis.rngHints[j];
          html += '<div class="rng-pattern">';
          html += '<span class="rng-med">🔑 ' + hint.type + '</span><br>';
          html += '<span style="color:#888;font-size:9px">Field: </span><span style="color:#60a5fa">' + esc(hint.field) + '</span><br>';
          html += '<span style="font-size:9px">' + esc(hint.note) + '</span><br>';
          html += '<span style="font-size:9px;color:#555">Samples: ' + hint.count + '</span>';
          html += '</div>';
        }
      }
      if ((!analysis.patterns || !analysis.patterns.length) && (!analysis.rngHints || !analysis.rngHints.length)) {
        html += '<div style="color:#888;font-size:9px;padding:4px">Samples: ' + analysis.totalSamples + '<br>No patterns detected yet...</div>';
      }
    }

    // Raw seed log
    html += '</div><div class="witch-section">';
    html += '<div class="witch-section-title" style="font-size:10px">Raw Seed History</div>';
    if (!h.length) {
      html += '<div class="witch-empty">No seeds captured.</div>';
    } else {
      html += '<div class="witch-result-box" style="max-height:150px">';
      var showLimit = Math.min(h.length, 5);
      for (var si = 0; si < showLimit; si++) {
        var s = h[si];
        var fields = s.fields || {};
        html += Object.keys(fields).map(function(k) {
          return '<span style="color:#6366f1">' + esc(k) + '</span>: ' + esc(String(fields[k]).substring(0, 30));
        }).join('<br>');
        html += '<br><span style="color:#333">─────</span><br>';
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function loadSeedHistory() {
    return state.seedHistory || [];
  }

  // ============================================================
  // TAB: PROBE
  // ============================================================
  function renderProbe() {
    var lastUrl = '';
    for (var i = 0; i < state.recentRequests.length; i++) {
      var req = state.recentRequests[i];
      if (req.url && (req.url.includes('game') || req.url.includes('bet'))) {
        lastUrl = req.url;
        break;
      }
    }

    return '<div class="witch-section">' +
      '<div class="witch-section-title">🔬 Server Probe</div>' +
      '<div style="font-size:9px;color:#666;margin-bottom:4px">Replay any captured request. Credentials are included automatically.</div>' +
      '<div class="witch-row"><input id="witch-probe-url" placeholder="URL to probe..." value="' + esc(lastUrl) + '" /></div>' +
      '<div class="witch-row"><select id="witch-probe-method" style="width:100%;background:#1a1a2e;border:1px solid #3a3a5a;color:#e0e0ff;padding:4px;border-radius:4px;font-size:10px">' +
        '<option value="GET">GET</option><option value="POST">POST</option>' +
        '<option value="PUT">PUT</option><option value="OPTIONS">OPTIONS</option>' +
      '</select></div>' +
      '<div class="witch-row"><textarea id="witch-probe-body" placeholder=\'{"key":"val"} or leave empty\' rows="2"></textarea></div>' +
      '<button id="witch-probe-btn" class="witch-btn">Send Probe</button>' +
      '<div id="witch-probe-result" class="witch-result-box" style="display:none;margin-top:6px"></div>' +
    '</div>' +
    '<div class="witch-section">' +
      '<div class="witch-section-title" style="font-size:10px">Recent Capturable URLs</div>';
  }

  function attachProbeHandler() {
    var btn = overlay.querySelector('#witch-probe-btn');
    if (btn && !btn._bound) {
      btn._bound = true;
      btn.addEventListener('click', runProbe);
    }
  }

  function runProbe() {
    var urlInput = overlay.querySelector('#witch-probe-url');
    var bodyInput = overlay.querySelector('#witch-probe-body');
    var methodInput = overlay.querySelector('#witch-probe-method');
    var url = urlInput ? urlInput.value.trim() : '';
    var method = methodInput ? methodInput.value : 'GET';
    if (!url) {
      var box = overlay.querySelector('#witch-probe-result');
      if (box) { box.style.display = 'block'; box.textContent = 'Enter a URL first.'; }
      return;
    }
    var body = null;
    if (bodyInput && bodyInput.value.trim()) {
      try { body = JSON.parse(bodyInput.value.trim()); } catch(e) {}
    }
    var box = overlay.querySelector('#witch-probe-result');
    if (box) { box.style.display = 'block'; box.textContent = 'Probing ' + method + ' ' + url + '...'; }
    sendToInjected('probe', { config: { url: url, method: method, body: body, credentials: 'include', probeId: 'probe_' + Date.now() } });
  }

  function updateProbeResult(data) {
    if (!overlay) return;
    var box = overlay.querySelector('#witch-probe-result');
    if (!box) return;
    box.style.display = 'block';
    if (data.status === 'error') {
      box.innerHTML = '<span style="color:#f87171">Error: ' + esc(data.error) + '</span>';
    } else {
      var summary = 'Status: OK\n';
      if (data.parsed) {
        if (data.parsed.RS) summary += '⚡ RS field found — checking for grid...\n';
        summary += JSON.stringify(data.parsed, null, 1).substring(0, 1000);
      } else {
        summary += (data.rawText || '').substring(0, 600);
      }
      box.textContent = summary;
    }
  }

  // ============================================================
  // TAB: SERVER (connection)
  // ============================================================
  function renderServer() {
    return '<div class="witch-section">' +
      '<div class="witch-section-title">🖥 Server Connection</div>' +
      '<div style="font-size:9px;color:#888;margin-bottom:6px">Connect to Witch Analyzer relay server for remote monitoring.</div>' +
      '<div class="witch-row"><input id="witch-server-url" placeholder="ws://your-server/ws or http://..." /></div>' +
      '<button id="witch-server-connect" class="witch-btn">Connect</button>' +
      '<button id="witch-server-disconnect" class="witch-btn" style="margin-top:4px;background:#7f1d1d">Disconnect</button>' +
      '<div id="witch-server-status" class="witch-result-box" style="display:none;margin-top:6px"></div>' +
    '</div>' +
    '<div class="witch-section">' +
      '<div class="witch-section-title" style="font-size:10px">Version Info</div>' +
      '<div style="font-size:9px;color:#888">' +
        'Witch Analyzer Pro v12<br>' +
        'Engines: Base64 · Hex→ASCII · XOR · URL · Double-JSON · Reverse<br>' +
        'Bitmask50 (10×5 grid) · LCG Pattern · Response Diff · Timeline<br>' +
        'Games analysed: <span style="color:#34d399">' + (state.stats.totalGames || 0) + '</span>' +
      '</div>' +
    '</div>';
  }

  function attachServerHandler() {
    var connectBtn = overlay.querySelector('#witch-server-connect');
    var disconnectBtn = overlay.querySelector('#witch-server-disconnect');
    if (connectBtn && !connectBtn._bound) {
      connectBtn._bound = true;
      connectBtn.addEventListener('click', function() {
        var urlInput = overlay.querySelector('#witch-server-url');
        var url = urlInput ? urlInput.value.trim() : '';
        if (!url) return;
        var box = overlay.querySelector('#witch-server-status');
        if (box) { box.style.display = 'block'; box.textContent = 'Connecting...'; }
        notifyBackground('connect', { url: url });
        setTimeout(function() {
          if (box) box.textContent = 'Connected (check background logs)';
        }, 2000);
      });
    }
    if (disconnectBtn && !disconnectBtn._bound) {
      disconnectBtn._bound = true;
      disconnectBtn.addEventListener('click', function() {
        notifyBackground('disconnect', {});
        var box = overlay.querySelector('#witch-server-status');
        if (box) { box.style.display = 'block'; box.textContent = 'Disconnected.'; }
      });
    }
  }

  // ============================================================
  // SHARED GRID/FREQ TABLE BUILDERS
  // ============================================================
  function buildGridTable(grid, mode) {
    var html = '<table class="witch-grid-table"><tr><th class="row-label">Row</th><th>C1</th><th>C2</th><th>C3</th><th>C4</th><th>C5</th></tr>';
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
    return html;
  }

  function buildFreqTable(ft) {
    if (!ft) return '<div class="witch-empty">No frequency data.</div>';

    if (ft.freq) {
      var html = '<table class="witch-grid-table"><tr><th class="row-label">Row</th><th>C1</th><th>C2</th><th>C3</th><th>C4</th><th>C5</th></tr>';
      for (var r = 0; r < 10; r++) {
        if (!ft.freq[r]) continue;
        var rowData = ft.freq[r];
        var bestPct = -1;
        for (var c2 = 0; c2 < 5; c2++) {
          if (rowData[c2] && rowData[c2].pct > bestPct) bestPct = rowData[c2].pct;
        }
        html += '<tr><td class="row-label">' + (r + 1) + '</td>';
        for (var c = 0; c < 5; c++) {
          var f = rowData[c];
          var pct = f ? f.pct : 0;
          var cls = pct >= 50 ? 'cell-freq-high' : pct >= 30 ? 'cell-freq-mid' : pct > 0 ? 'cell-freq-low' : 'cell-empty';
          var label = f && f.total > 0 ? pct + '%' : '?';
          html += '<td class="' + cls + '">' + label + '</td>';
        }
        html += '</tr>';
      }
      return html + '</table>';
    }

    if (ft.recommendations) {
      var html2 = '<table class="witch-grid-table"><tr><th class="row-label">Row</th><th colspan="5">Best Cell → Win%</th></tr>';
      for (var i = 0; i < ft.recommendations.length; i++) {
        var rec = ft.recommendations[i];
        html2 += '<tr><td class="row-label">' + rec.row + '</td>' +
          '<td colspan="5" style="color:#34d399;text-align:left;padding-left:4px">Cell ' + rec.cell + ' → ' + rec.pct + '%</td></tr>';
      }
      return html2 + '</table>';
    }
    return '<div class="witch-empty">No data.</div>';
  }

  // ============================================================
  // STATS BAR
  // ============================================================
  function updateStatsBar() {
    if (!overlay) return;
    var bar = overlay.querySelector('#witch-stats-bar');
    if (!bar) return;
    var s = state.stats;
    bar.innerHTML =
      '<span style="color:' + (s.totalGames > 0 ? '#34d399' : '#555') + '">Games: ' + (s.totalGames || 0) + '</span>' +
      '<span style="color:' + (s.requestsCaptured > 0 ? '#60a5fa' : '#555') + '">Reqs: ' + (s.requestsCaptured || 0) + '</span>' +
      '<span style="color:' + (s.hasLiveGrid ? '#34d399' : '#555') + '">Grid: ' + (s.hasLiveGrid ? '✓' : '—') + '</span>' +
      '<span style="color:' + (s.decodeFindings > 0 ? '#fbbf24' : '#555') + '">Dec: ' + (s.decodeFindings || 0) + '</span>';
  }

  // ============================================================
  // HELPER
  // ============================================================
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ============================================================
  // AFTER RENDER — attach dynamic handlers
  // ============================================================
  var _origRenderTabContent = renderTabContent;
  renderTabContent = function() {
    _origRenderTabContent();
    // Attach handlers after render
    setTimeout(function() {
      if (state.activeTab === 'grid') attachGridHandlers();
      if (state.activeTab === 'decode') attachDecodeHandler();
      if (state.activeTab === 'probe') attachProbeHandler();
      if (state.activeTab === 'server') attachServerHandler();
    }, 10);
  };

  // ============================================================
  // OVERLAY CONTROLS
  // ============================================================
  function toggleMinimize() {
    state.isMinimized = !state.isMinimized;
    overlay.classList.toggle('minimized', state.isMinimized);
    overlay.querySelector('#witch-minimize').textContent = state.isMinimized ? '+' : '−';
  }

  function hideOverlay() {
    if (overlay) overlay.style.display = 'none';
  }

  function clearHistory() {
    if (confirm('Clear all saved game history? This cannot be undone.')) {
      sendToInjected('clear_history');
      state.grid = null; state.frequency = null;
      state.stats.hasLiveGrid = false; state.stats.totalGames = 0;
      state.decodeFindings = []; state.diffResults = []; state.timeline = [];
      updateOverlay();
    }
  }

  // ============================================================
  // DRAG SUPPORT
  // ============================================================
  function makeDraggable(el, handle) {
    if (!handle) return;
    var ox = 0, oy = 0, ex = 0, ey = 0;
    handle.addEventListener('mousedown', function(e) {
      e.preventDefault(); ex = e.clientX; ey = e.clientY;
      document.onmousemove = drag; document.onmouseup = stopDrag;
    });
    function drag(e) {
      ox = ex - e.clientX; oy = ey - e.clientY;
      ex = e.clientX; ey = e.clientY;
      el.style.top = (el.offsetTop - oy) + 'px';
      el.style.left = (el.offsetLeft - ox) + 'px';
      el.style.right = 'auto';
    }
    function stopDrag() { document.onmouseup = null; document.onmousemove = null; }
  }

  // ============================================================
  // TOGGLE BUTTON
  // ============================================================
  function createToggleButton() {
    var existing = document.getElementById('witch-toggle-v11');
    if (existing) return;
    var btn = document.createElement('button');
    btn.id = 'witch-toggle-v11';
    btn.textContent = '🔮';
    btn.title = 'Witch Analyzer v12';
    btn.style.cssText = 'position:fixed!important;bottom:20px!important;right:20px!important;width:44px!important;height:44px!important;border-radius:50%!important;background:#4f46e5!important;color:white!important;border:none!important;cursor:pointer!important;font-size:20px!important;z-index:2147483646!important;box-shadow:0 4px 12px rgba(0,0,0,0.4)!important;display:flex!important;align-items:center!important;justify-content:center!important';
    btn.addEventListener('click', function() {
      if (!overlay) { createOverlay(); }
      else { overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none'; }
    });
    document.body.appendChild(btn);
  }

  // ============================================================
  // BACKGROUND / POPUP LISTENER
  // ============================================================
  chrome.runtime.onMessage.addListener(function(msg) {
    if (!msg) return;
    if (msg.type === 'get_state') requestState();
    else if (msg.type === 'probe') sendToInjected('probe', { config: msg.config });
    else if (msg.type === 'clear_history') sendToInjected('clear_history');
    else if (msg.type === 'show_overlay') { if (!overlay) createOverlay(); overlay.style.display = 'block'; }
  });

  // ============================================================
  // STYLES
  // ============================================================
  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = `
      #witch-overlay-v11 {
        position:fixed!important;top:60px!important;right:16px!important;
        width:310px!important;max-height:92vh!important;
        background:#0f0f1a!important;border:1px solid #2a2a5a!important;
        border-radius:10px!important;box-shadow:0 8px 32px rgba(0,0,0,0.7)!important;
        z-index:2147483647!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,monospace!important;
        font-size:12px!important;color:#e0e0ff!important;overflow:hidden!important;user-select:none!important;
      }
      #witch-overlay-v11 .witch-header {
        background:#1a1a3a!important;padding:7px 10px!important;display:flex!important;
        align-items:center!important;justify-content:space-between!important;
        cursor:move!important;border-bottom:1px solid #2a2a5a!important;
      }
      #witch-overlay-v11 .witch-title { font-weight:bold!important;font-size:13px!important;color:#a78bfa!important; }
      #witch-overlay-v11 .witch-controls { display:flex!important;gap:4px!important; }
      #witch-overlay-v11 .witch-controls button {
        background:#2a2a4a!important;border:1px solid #3a3a6a!important;color:#ccc!important;
        width:22px!important;height:22px!important;border-radius:4px!important;cursor:pointer!important;
        font-size:11px!important;padding:0!important;display:flex!important;align-items:center!important;justify-content:center!important;
      }
      #witch-overlay-v11 .witch-controls button:hover { background:#3a3a6a!important;color:#fff!important; }
      #witch-overlay-v11 .witch-stats-bar {
        display:flex!important;gap:8px!important;padding:3px 8px!important;
        background:#12122a!important;border-bottom:1px solid #1a1a3a!important;
        font-size:9px!important;color:#888!important;flex-wrap:wrap!important;
      }
      #witch-overlay-v11 .witch-tabs {
        display:flex!important;flex-wrap:wrap!important;gap:2px!important;
        padding:4px 6px!important;background:#0d0d1e!important;border-bottom:1px solid #1a1a3a!important;
      }
      #witch-overlay-v11 .witch-tab {
        background:#1a1a3a!important;border:1px solid #2a2a5a!important;color:#888!important;
        padding:3px 7px!important;border-radius:4px!important;cursor:pointer!important;
        font-size:9px!important;font-weight:500!important;white-space:nowrap!important;
      }
      #witch-overlay-v11 .witch-tab:hover { background:#2a2a5a!important;color:#ccc!important; }
      #witch-overlay-v11 .witch-tab.active { background:#4f46e5!important;border-color:#6366f1!important;color:#fff!important; }
      #witch-overlay-v11 .witch-body {
        overflow-y:auto!important;max-height:calc(92vh - 110px)!important;padding:8px!important;
      }
      #witch-overlay-v11 .witch-section {
        background:#13132a!important;border:1px solid #2a2a4a!important;border-radius:8px!important;
        padding:8px!important;margin-bottom:8px!important;
      }
      #witch-overlay-v11 .witch-section-title {
        font-weight:bold!important;font-size:11px!important;color:#a78bfa!important;
        margin-bottom:6px!important;display:flex!important;align-items:center!important;gap:6px!important;
      }
      #witch-overlay-v11 .badge { font-size:9px!important;padding:1px 5px!important;border-radius:4px!important; }
      #witch-overlay-v11 .badge-green { background:#064e3b!important;color:#34d399!important; }
      #witch-overlay-v11 .badge-yellow { background:#451a03!important;color:#fbbf24!important; }
      #witch-overlay-v11 .badge-gray { background:#1f2937!important;color:#9ca3af!important; }
      #witch-overlay-v11 .badge-red { background:#450a0a!important;color:#f87171!important; }
      #witch-overlay-v11 .witch-empty { color:#555!important;font-size:10px!important;padding:8px 4px!important;text-align:center!important;line-height:1.6!important; }
      #witch-overlay-v11 .witch-row { margin-bottom:6px!important; }
      #witch-overlay-v11 input, #witch-overlay-v11 textarea, #witch-overlay-v11 select {
        width:100%!important;background:#1a1a2e!important;border:1px solid #3a3a5a!important;
        color:#e0e0ff!important;padding:4px 6px!important;border-radius:4px!important;
        font-size:10px!important;box-sizing:border-box!important;resize:vertical!important;
      }
      #witch-overlay-v11 .witch-btn {
        width:100%!important;padding:5px 8px!important;background:#4f46e5!important;
        color:white!important;border:none!important;border-radius:5px!important;
        cursor:pointer!important;font-size:11px!important;font-weight:500!important;
      }
      #witch-overlay-v11 .witch-btn:hover { background:#4338ca!important; }
      #witch-overlay-v11 .witch-btn-danger { background:#7f1d1d!important;margin-top:4px!important; }
      #witch-overlay-v11 .witch-btn-danger:hover { background:#991b1b!important; }
      #witch-overlay-v11 .witch-result-box {
        background:#0a0a18!important;border:1px solid #2a2a4a!important;border-radius:4px!important;
        padding:6px!important;font-size:9px!important;color:#a0a0cc!important;
        max-height:130px!important;overflow-y:auto!important;white-space:pre-wrap!important;word-break:break-all!important;
      }
      #witch-overlay-v11 .witch-source { font-size:9px!important;color:#555!important;margin-top:4px!important;word-break:break-all!important; }
      #witch-overlay-v11 .witch-grid-table { width:100%!important;border-collapse:collapse!important;font-size:11px!important; }
      #witch-overlay-v11 .witch-grid-table th { color:#6366f1!important;padding:2px 3px!important;text-align:center!important;font-size:10px!important;border-bottom:1px solid #2a2a4a!important; }
      #witch-overlay-v11 .witch-grid-table td { padding:2px 3px!important;text-align:center!important;border:1px solid #1a1a3a!important;border-radius:3px!important; }
      #witch-overlay-v11 .cell-safe { background:#064e3b!important;color:#34d399!important;font-weight:bold!important; }
      #witch-overlay-v11 .cell-unsafe { background:#1f0a0a!important;color:#3a1010!important; }
      #witch-overlay-v11 .cell-freq-high { background:#064e3b!important;color:#34d399!important;font-weight:bold!important; }
      #witch-overlay-v11 .cell-freq-mid { background:#1a2e1a!important;color:#6ee7b7!important; }
      #witch-overlay-v11 .cell-freq-low { background:#1f1a0a!important;color:#92400e!important; }
      #witch-overlay-v11 .cell-empty { background:#111!important;color:#333!important; }
      #witch-overlay-v11 .row-label { color:#6366f1!important;font-size:10px!important;font-weight:bold!important;width:22px!important; }
      #witch-overlay-v11.minimized .witch-body, #witch-overlay-v11.minimized .witch-tabs, #witch-overlay-v11.minimized .witch-stats-bar { display:none!important; }
      #witch-overlay-v11 .rng-pattern { background:#0a1a0a!important;border:1px solid #1a3a1a!important;border-radius:4px!important;padding:5px!important;margin-bottom:4px!important;font-size:10px!important; }
      #witch-overlay-v11 .rng-high { color:#34d399!important;font-weight:bold!important; }
      #witch-overlay-v11 .rng-med { color:#fbbf24!important; }
      #witch-overlay-v11 .decode-item { background:#0a0a18!important;border:1px solid #2a2a4a!important;border-radius:4px!important;padding:5px!important;margin-bottom:5px!important; }
      #witch-overlay-v11 .decode-grid { border-color:#ffd700!important;background:#1a1a00!important; }
      #witch-overlay-v11 .decode-value { color:#60a5fa!important;font-size:9px!important;margin-top:3px!important;word-break:break-all!important;max-height:60px!important;overflow:hidden!important; }
      #witch-overlay-v11 .diff-item { background:#0a0a18!important;border:1px solid #1a1a3a!important;border-radius:4px!important;padding:5px!important;margin-bottom:4px!important; }
      #witch-overlay-v11 .packet-item { padding:3px 5px!important;border-bottom:1px solid #1a1a2e!important; }
      #witch-overlay-v11 .packet-game { background:#0a1a0a!important;border-left:2px solid #34d399!important; }
    `;
    document.head.appendChild(style);
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    var url = window.location.href;
    var isGamePage = url.includes('witch') || url.includes('1xbet') || url.includes('1x-bet') ||
                     url.includes('game') || url.includes('casino');
    if (!isGamePage) return;

    setTimeout(function() {
      createToggleButton();
      createOverlay();
    }, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }

  window.addEventListener('load', function() {
    if (!overlay && document.body) setTimeout(function() { createToggleButton(); createOverlay(); }, 800);
  });

  setInterval(function() { requestState(); }, 12000);

  console.log('[Witch v12] Content script loaded — Decode + Diff + Timeline tabs active');

})();
