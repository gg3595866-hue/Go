(function() {
  'use strict';

  // ============================================================
  // WITCH GAME ANALYZER PRO v11.0 — CONTENT SCRIPT
  // Pure passive analysis. NO auto-clicking. Ever.
  // ============================================================

  var state = {
    grid: null,
    gridSource: null,
    frequency: null,
    stats: { totalGames: 0, requestsCaptured: 0, hasLiveGrid: false },
    recentRequests: [],
    recentResponses: [],
    seedHistory: [],
    isMinimized: false,
    overlayVisible: true
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
      console.error('[Witch v11] Inject failed:', e);
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
        console.log('[Witch v11] Injected script ready. History:', data.historyCount, 'games');
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
        console.log('[Witch v11] Grid captured from:', data.source);
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
        notifyBackground('rng_analysis', data);
        updateRngPanel(data);
        break;

      case 'request':
        state.recentRequests.unshift(data);
        if (state.recentRequests.length > 30) state.recentRequests.pop();
        state.stats.requestsCaptured = (state.stats.requestsCaptured || 0) + 1;
        updateStatsBar();
        break;

      case 'response':
        state.recentResponses.unshift(data);
        if (state.recentResponses.length > 30) state.recentResponses.pop();
        break;

      case 'state':
        state.grid = data.grid;
        state.gridSource = data.gridSource;
        state.frequency = data.frequency;
        state.stats = data.stats;
        state.recentRequests = data.recentRequests || [];
        state.seedHistory = data.seedHistory || [];
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

  function requestState() {
    sendToInjected('get_state');
  }

  function notifyBackground(type, data) {
    try {
      chrome.runtime.sendMessage({ type: type, data: data });
    } catch(e) {}
  }

  // ============================================================
  // OVERLAY PANEL UI
  // ============================================================
  var overlay = null;
  var rngPanel = null;

  function createOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'witch-overlay-v11';
    overlay.innerHTML = getOverlayHTML();
    applyOverlayStyles(overlay);
    document.body.appendChild(overlay);

    // Drag support
    makeDraggable(overlay, overlay.querySelector('.witch-header'));

    // Buttons
    overlay.querySelector('#witch-minimize').addEventListener('click', toggleMinimize);
    overlay.querySelector('#witch-close').addEventListener('click', hideOverlay);
    overlay.querySelector('#witch-clear').addEventListener('click', clearHistory);
    overlay.querySelector('#witch-probe-btn').addEventListener('click', runProbe);
    overlay.querySelector('#witch-refresh').addEventListener('click', requestState);

    updateOverlay();
  }

  function getOverlayHTML() {
    return `
      <div class="witch-header">
        <span class="witch-title">🔮 Witch Analyzer v11</span>
        <div class="witch-controls">
          <button id="witch-refresh" title="Refresh data">↻</button>
          <button id="witch-minimize" title="Minimize">−</button>
          <button id="witch-close" title="Close">✕</button>
        </div>
      </div>
      <div class="witch-body" id="witch-body">
        <div id="witch-stats-bar" class="witch-stats-bar">
          <span id="witch-stat-games">Games: 0</span>
          <span id="witch-stat-reqs">Requests: 0</span>
          <span id="witch-stat-grid">Grid: —</span>
        </div>

        <div id="witch-grid-section" class="witch-section">
          <div class="witch-section-title" id="witch-grid-label">
            📋 Cell Recommendations
            <span id="witch-confidence-badge" class="badge badge-gray">No Data</span>
          </div>
          <div id="witch-grid-display"></div>
          <div id="witch-source-label" class="witch-source"></div>
        </div>

        <div id="witch-probe-section" class="witch-section">
          <div class="witch-section-title">🔬 Server Probe</div>
          <div class="witch-row">
            <input id="witch-probe-url" placeholder="URL to probe..." />
          </div>
          <div class="witch-row">
            <textarea id="witch-probe-body" placeholder='{"key":"val"} or leave empty' rows="2"></textarea>
          </div>
          <button id="witch-probe-btn" class="witch-btn">Send Probe</button>
          <div id="witch-probe-result" class="witch-result-box"></div>
        </div>

        <div id="witch-rng-section" class="witch-section">
          <div class="witch-section-title">🧬 RNG Analysis</div>
          <div id="witch-rng-display" class="witch-result-box">Capturing data...</div>
        </div>

        <div class="witch-row">
          <button id="witch-clear" class="witch-btn witch-btn-danger">🗑 Clear History</button>
        </div>
      </div>
    `;
  }

  function applyOverlayStyles(el) {
    var style = document.createElement('style');
    style.textContent = `
      #witch-overlay-v11 {
        position: fixed !important;
        top: 80px !important;
        right: 16px !important;
        width: 280px !important;
        max-height: 90vh !important;
        background: #0f0f1a !important;
        border: 1px solid #2a2a5a !important;
        border-radius: 10px !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace !important;
        font-size: 12px !important;
        color: #e0e0ff !important;
        overflow: hidden !important;
        user-select: none !important;
      }
      #witch-overlay-v11 .witch-header {
        background: #1a1a3a !important;
        padding: 8px 12px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        cursor: move !important;
        border-bottom: 1px solid #2a2a5a !important;
      }
      #witch-overlay-v11 .witch-title {
        font-weight: bold !important;
        font-size: 13px !important;
        color: #a78bfa !important;
      }
      #witch-overlay-v11 .witch-controls {
        display: flex !important;
        gap: 4px !important;
      }
      #witch-overlay-v11 .witch-controls button {
        background: #2a2a4a !important;
        border: 1px solid #3a3a6a !important;
        color: #ccc !important;
        width: 22px !important;
        height: 22px !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        font-size: 11px !important;
        padding: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      #witch-overlay-v11 .witch-controls button:hover {
        background: #3a3a6a !important;
        color: #fff !important;
      }
      #witch-overlay-v11 .witch-body {
        overflow-y: auto !important;
        max-height: calc(90vh - 44px) !important;
        padding: 8px !important;
      }
      #witch-overlay-v11 .witch-stats-bar {
        display: flex !important;
        gap: 8px !important;
        padding: 4px 8px !important;
        background: #1a1a2e !important;
        border-radius: 6px !important;
        margin-bottom: 8px !important;
        font-size: 10px !important;
        color: #888 !important;
        flex-wrap: wrap !important;
      }
      #witch-overlay-v11 .witch-section {
        background: #13132a !important;
        border: 1px solid #2a2a4a !important;
        border-radius: 8px !important;
        padding: 8px !important;
        margin-bottom: 8px !important;
      }
      #witch-overlay-v11 .witch-section-title {
        font-weight: bold !important;
        font-size: 11px !important;
        color: #a78bfa !important;
        margin-bottom: 6px !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
      }
      #witch-overlay-v11 .badge {
        font-size: 9px !important;
        padding: 1px 5px !important;
        border-radius: 4px !important;
        font-weight: normal !important;
      }
      #witch-overlay-v11 .badge-green { background: #064e3b !important; color: #34d399 !important; }
      #witch-overlay-v11 .badge-yellow { background: #451a03 !important; color: #fbbf24 !important; }
      #witch-overlay-v11 .badge-gray { background: #1f2937 !important; color: #9ca3af !important; }
      #witch-overlay-v11 .badge-red { background: #450a0a !important; color: #f87171 !important; }
      #witch-overlay-v11 .witch-grid-table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 11px !important;
      }
      #witch-overlay-v11 .witch-grid-table th {
        color: #6366f1 !important;
        padding: 2px 3px !important;
        text-align: center !important;
        font-size: 10px !important;
        border-bottom: 1px solid #2a2a4a !important;
      }
      #witch-overlay-v11 .witch-grid-table td {
        padding: 2px 3px !important;
        text-align: center !important;
        border: 1px solid #1a1a3a !important;
        border-radius: 3px !important;
        cursor: default !important;
      }
      #witch-overlay-v11 .cell-safe {
        background: #064e3b !important;
        color: #34d399 !important;
        font-weight: bold !important;
      }
      #witch-overlay-v11 .cell-unsafe {
        background: #1f0a0a !important;
        color: #4a1a1a !important;
      }
      #witch-overlay-v11 .cell-freq-high {
        background: #064e3b !important;
        color: #34d399 !important;
        font-weight: bold !important;
      }
      #witch-overlay-v11 .cell-freq-mid {
        background: #1a2e1a !important;
        color: #6ee7b7 !important;
      }
      #witch-overlay-v11 .cell-freq-low {
        background: #1f1a0a !important;
        color: #92400e !important;
      }
      #witch-overlay-v11 .cell-empty {
        background: #111 !important;
        color: #333 !important;
      }
      #witch-overlay-v11 .row-label {
        color: #6366f1 !important;
        font-size: 10px !important;
        font-weight: bold !important;
        width: 22px !important;
      }
      #witch-overlay-v11 .witch-row {
        margin-bottom: 6px !important;
      }
      #witch-overlay-v11 input, #witch-overlay-v11 textarea {
        width: 100% !important;
        background: #1a1a2e !important;
        border: 1px solid #3a3a5a !important;
        color: #e0e0ff !important;
        padding: 4px 6px !important;
        border-radius: 4px !important;
        font-size: 10px !important;
        box-sizing: border-box !important;
        resize: vertical !important;
      }
      #witch-overlay-v11 .witch-btn {
        width: 100% !important;
        padding: 5px 8px !important;
        background: #4f46e5 !important;
        color: white !important;
        border: none !important;
        border-radius: 5px !important;
        cursor: pointer !important;
        font-size: 11px !important;
        font-weight: 500 !important;
      }
      #witch-overlay-v11 .witch-btn:hover { background: #4338ca !important; }
      #witch-overlay-v11 .witch-btn-danger {
        background: #7f1d1d !important;
        margin-top: 4px !important;
      }
      #witch-overlay-v11 .witch-btn-danger:hover { background: #991b1b !important; }
      #witch-overlay-v11 .witch-result-box {
        background: #0a0a18 !important;
        border: 1px solid #2a2a4a !important;
        border-radius: 4px !important;
        padding: 6px !important;
        font-size: 10px !important;
        color: #a0a0cc !important;
        max-height: 120px !important;
        overflow-y: auto !important;
        margin-top: 6px !important;
        white-space: pre-wrap !important;
        word-break: break-all !important;
      }
      #witch-overlay-v11 .witch-source {
        font-size: 9px !important;
        color: #555 !important;
        margin-top: 4px !important;
        word-break: break-all !important;
      }
      #witch-overlay-v11.minimized .witch-body { display: none !important; }
      #witch-overlay-v11 .rng-pattern {
        background: #0a1a0a !important;
        border: 1px solid #1a3a1a !important;
        border-radius: 4px !important;
        padding: 4px !important;
        margin-bottom: 4px !important;
      }
      #witch-overlay-v11 .rng-high { color: #34d399 !important; font-weight: bold !important; }
      #witch-overlay-v11 .rng-med { color: #fbbf24 !important; }
    `;
    document.head.appendChild(style);
  }

  // ============================================================
  // UPDATE OVERLAY WITH CURRENT STATE
  // ============================================================
  function updateOverlay() {
    if (!overlay) return;

    updateStatsBar();

    var gridDisplay = overlay.querySelector('#witch-grid-display');
    var sourceLabel = overlay.querySelector('#witch-source-label');
    var badge = overlay.querySelector('#witch-confidence-badge');

    if (state.grid) {
      // HIGH CONFIDENCE: live RS[0].F grid
      badge.className = 'badge badge-green';
      badge.textContent = '🟢 Live Grid';
      sourceLabel.textContent = 'Source: ' + (state.gridSource || 'unknown').split('/').pop();
      gridDisplay.innerHTML = buildGridTable(state.grid, 'live');

    } else if (state.frequency && state.frequency.recommendations && state.frequency.recommendations.length > 0) {
      // MEDIUM CONFIDENCE: frequency table
      badge.className = 'badge badge-yellow';
      badge.textContent = '🟡 Statistical (' + (state.frequency.totalGames || 0) + ' games)';
      sourceLabel.textContent = 'Based on ' + (state.frequency.totalGames || 0) + ' historical games';
      gridDisplay.innerHTML = buildFrequencyTable(state.frequency);

    } else {
      // NO DATA
      badge.className = 'badge badge-gray';
      badge.textContent = 'No Data';
      sourceLabel.textContent = '';
      gridDisplay.innerHTML = '<div style="color:#555;font-size:10px;padding:8px;text-align:center;">Waiting for game data...<br>Open the Witch game page.</div>';
    }
  }

  function buildGridTable(grid, mode) {
    var html = '<table class="witch-grid-table">';
    html += '<tr><th class="row-label">Row</th><th>C1</th><th>C2</th><th>C3</th><th>C4</th><th>C5</th></tr>';
    for (var r = 0; r < grid.length; r++) {
      var row = grid[r];
      html += '<tr>';
      html += '<td class="row-label">' + (r + 1) + '</td>';
      for (var c = 0; c < 5; c++) {
        var safe = row[c];
        html += '<td class="' + (safe ? 'cell-safe' : 'cell-unsafe') + '">' +
                (safe ? '✓' : '✗') + '</td>';
      }
      html += '</tr>';
    }
    html += '</table>';
    return html;
  }

  function buildFrequencyTable(ft) {
    if (!ft || !ft.freq) {
      // Simple recommendations list
      if (ft && ft.recommendations) {
        var html = '<table class="witch-grid-table">';
        html += '<tr><th class="row-label">Row</th><th colspan="5">Best Cell → Win%</th></tr>';
        for (var i = 0; i < ft.recommendations.length; i++) {
          var rec = ft.recommendations[i];
          html += '<tr><td class="row-label">' + rec.row + '</td>';
          html += '<td colspan="5" style="color:#34d399;text-align:left;padding-left:4px;">Cell ' + rec.cell + ' → ' + rec.pct + '% (' + (rec.games || 0) + 'g)</td>';
          html += '</tr>';
        }
        html += '</table>';
        return html;
      }
      return '<div style="color:#555;font-size:10px;padding:4px;">No frequency data yet</div>';
    }

    var html = '<table class="witch-grid-table">';
    html += '<tr><th class="row-label">Row</th><th>C1</th><th>C2</th><th>C3</th><th>C4</th><th>C5</th></tr>';
    for (var r = 0; r < 10; r++) {
      if (!ft.freq[r]) continue;
      var rowData = ft.freq[r];
      // Find best cell
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
        var isBest = pct === bestPct && pct > 0 ? ' title="Best cell for this row"' : '';
        html += '<td class="' + cls + '"' + isBest + '>' + label + '</td>';
      }
      html += '</tr>';
    }
    html += '</table>';
    return html;
  }

  function updateStatsBar() {
    if (!overlay) return;
    var s = state.stats;
    var bar = overlay.querySelector('#witch-stats-bar');
    if (!bar) return;
    bar.innerHTML = `
      <span id="witch-stat-games" style="color:${s.totalGames > 0 ? '#34d399' : '#888'}">
        Games: ${s.totalGames || 0}
      </span>
      <span id="witch-stat-reqs" style="color:${s.requestsCaptured > 0 ? '#60a5fa' : '#888'}">
        Reqs: ${s.requestsCaptured || 0}
      </span>
      <span id="witch-stat-grid" style="color:${s.hasLiveGrid ? '#34d399' : '#888'}">
        Grid: ${s.hasLiveGrid ? '✓ Live' : '—'}
      </span>
    `;
  }

  function updateRngPanel(analysis) {
    if (!overlay) return;
    var panel = overlay.querySelector('#witch-rng-display');
    if (!panel) return;

    var html = '';
    if (analysis.patterns && analysis.patterns.length > 0) {
      for (var i = 0; i < analysis.patterns.length; i++) {
        var p = analysis.patterns[i];
        html += '<div class="rng-pattern">';
        html += '<span class="rng-high">⚡ ' + p.type + '</span>\n';
        html += 'Field: ' + p.field + '\n';
        if (p.increment !== undefined) html += 'Increment: ' + p.increment + '\n';
        if (p.nextPredicted !== undefined) html += 'Next predicted: <span class="rng-high">' + p.nextPredicted + '</span>\n';
        if (p.modulus) html += 'Modulus: ' + p.modulus + '\n';
        html += 'Confidence: ' + p.confidence;
        html += '</div>';
      }
    }
    if (analysis.rngHints && analysis.rngHints.length > 0) {
      for (var j = 0; j < analysis.rngHints.length; j++) {
        var h = analysis.rngHints[j];
        html += '<div class="rng-pattern">';
        html += '<span class="rng-med">🔑 ' + h.type + '</span>\n';
        html += 'Field: ' + h.field + '\n';
        html += 'Note: ' + h.note + '\n';
        html += 'Samples: ' + h.count;
        html += '</div>';
      }
    }
    if (!html) html = 'Samples: ' + analysis.totalSamples + '\nFields: ' + (analysis.fieldNames || []).join(', ') + '\nNo patterns detected yet...';
    panel.innerHTML = html;
  }

  function updateProbeResult(data) {
    if (!overlay) return;
    var box = overlay.querySelector('#witch-probe-result');
    if (!box) return;
    if (data.status === 'error') {
      box.innerHTML = '<span style="color:#f87171">Error: ' + data.error + '</span>';
    } else {
      var summary = 'Status: ' + (data.rawText ? 'OK' : 'Empty') + '\n';
      if (data.parsed) {
        // Check if grid found
        if (data.parsed.RS) summary += '⚡ RS field found!\n';
        summary += JSON.stringify(data.parsed).substring(0, 800);
      } else {
        summary += (data.rawText || '').substring(0, 500);
      }
      box.textContent = summary;
    }
  }

  // ============================================================
  // BUTTON HANDLERS
  // ============================================================
  function toggleMinimize() {
    state.isMinimized = !state.isMinimized;
    overlay.classList.toggle('minimized', state.isMinimized);
    overlay.querySelector('#witch-minimize').textContent = state.isMinimized ? '+' : '−';
  }

  function hideOverlay() {
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  function clearHistory() {
    if (confirm('Clear all saved game history? This cannot be undone.')) {
      sendToInjected('clear_history');
      state.grid = null;
      state.frequency = null;
      state.stats.hasLiveGrid = false;
      state.stats.totalGames = 0;
      updateOverlay();
    }
  }

  function runProbe() {
    var urlInput = overlay.querySelector('#witch-probe-url');
    var bodyInput = overlay.querySelector('#witch-probe-body');
    var url = urlInput ? urlInput.value.trim() : '';
    if (!url) {
      // Auto-fill last captured game URL if available
      if (state.recentRequests.length > 0) {
        for (var i = 0; i < state.recentRequests.length; i++) {
          var req = state.recentRequests[i];
          if (req.url && (req.url.includes('game') || req.url.includes('bet') || req.url.includes('witch'))) {
            urlInput.value = req.url;
            url = req.url;
            break;
          }
        }
      }
    }
    if (!url) {
      var box = overlay.querySelector('#witch-probe-result');
      if (box) box.textContent = 'Enter a URL to probe. Tip: Captured game request URLs appear in the probe URL field automatically.';
      return;
    }
    var body = null;
    if (bodyInput && bodyInput.value.trim()) {
      try { body = JSON.parse(bodyInput.value.trim()); } catch(e) {}
    }
    var probeId = 'probe_' + Date.now();
    var box = overlay.querySelector('#witch-probe-result');
    if (box) box.textContent = 'Probing...';
    sendToInjected('probe', { config: { url: url, method: body ? 'POST' : 'GET', body: body, probeId: probeId } });
  }

  // ============================================================
  // DRAG SUPPORT
  // ============================================================
  function makeDraggable(el, handle) {
    var ox = 0, oy = 0, ex = 0, ey = 0;
    handle.addEventListener('mousedown', function(e) {
      e.preventDefault();
      ex = e.clientX; ey = e.clientY;
      document.onmousemove = drag;
      document.onmouseup = stopDrag;
    });
    function drag(e) {
      ox = ex - e.clientX; oy = ey - e.clientY;
      ex = e.clientX; ey = e.clientY;
      el.style.top = (el.offsetTop - oy) + 'px';
      el.style.left = (el.offsetLeft - ox) + 'px';
      el.style.right = 'auto';
    }
    function stopDrag() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  // ============================================================
  // SHOW/HIDE BUTTON (bottom-right corner)
  // ============================================================
  function createToggleButton() {
    var btn = document.createElement('button');
    btn.id = 'witch-toggle-v11';
    btn.textContent = '🔮';
    btn.title = 'Witch Analyzer';
    btn.style.cssText = [
      'position:fixed', 'bottom:20px', 'right:20px', 'width:44px', 'height:44px',
      'border-radius:50%', 'background:#4f46e5', 'color:white', 'border:none',
      'cursor:pointer', 'font-size:20px', 'z-index:2147483646',
      'box-shadow:0 4px 12px rgba(0,0,0,0.4)', 'display:flex',
      'align-items:center', 'justify-content:center'
    ].join('!important;') + '!important';
    btn.addEventListener('click', function() {
      if (!overlay) {
        createOverlay();
      } else {
        overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
      }
    });
    document.body.appendChild(btn);
  }

  // ============================================================
  // LISTEN FOR MESSAGES FROM BACKGROUND/POPUP
  // ============================================================
  chrome.runtime.onMessage.addListener(function(msg) {
    if (!msg) return;
    if (msg.type === 'get_state') {
      requestState();
    } else if (msg.type === 'probe') {
      sendToInjected('probe', { config: msg.config });
    } else if (msg.type === 'clear_history') {
      sendToInjected('clear_history');
    } else if (msg.type === 'show_overlay') {
      if (!overlay) createOverlay();
      overlay.style.display = 'block';
    }
  });

  // ============================================================
  // INIT — wait for DOM, then inject overlay
  // ============================================================
  function init() {
    // Detect if we're on a Witch game page
    var url = window.location.href;
    var isGamePage = url.includes('witch') || url.includes('1xbet') || url.includes('1x-bet');
    if (!isGamePage) return;

    // Wait a moment for DOM to settle
    setTimeout(function() {
      createToggleButton();
      createOverlay();
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }

  // Also try after full load
  window.addEventListener('load', function() {
    if (!overlay && document.body) {
      setTimeout(function() {
        createToggleButton();
        createOverlay();
      }, 1000);
    }
  });

  // Periodic state refresh
  setInterval(function() {
    requestState();
  }, 10000);

  console.log('[Witch v11] Content script loaded — passive mode, no auto-clicking');

})();
