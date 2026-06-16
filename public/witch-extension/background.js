(function() {
  'use strict';

  // ============================================================
  // WITCH ANALYZER PRO v11.0 — BACKGROUND SERVICE WORKER
  // Relay, storage, WebSocket connection to Witch Analyzer server
  // ============================================================

  var serverUrl = null;
  var ws = null;
  var isConnected = false;
  var reconnectTimer = null;
  var reconnectAttempts = 0;
  var MAX_RECONNECT = 5;

  // Shared state cache (updated from content script events)
  var cachedState = {
    grid: null,
    gridSource: null,
    frequency: null,
    stats: { totalGames: 0, requestsCaptured: 0, hasLiveGrid: false },
    recentRequests: [],
    recentResponses: [],
    seedHistory: [],
    rngAnalysis: null
  };

  console.log('[Witch BG v12] Service worker started — passive mode + Decode/Diff engines');

  // ============================================================
  // HANDLE MESSAGES FROM POPUP + CONTENT SCRIPTS
  // ============================================================
  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (!msg) return false;

    switch (msg.type) {

      // Popup asks for current cached state
      case 'get_state':
        sendResponse({ state: cachedState });
        return false;

      // Server connection management
      case 'connect':
        if (msg.data && msg.data.url) {
          serverUrl = msg.data.url;
          chrome.storage.local.set({ serverUrl: serverUrl });
          connectToServer();
          setTimeout(function() {
            sendResponse({ success: isConnected });
          }, 1500);
          return true; // async
        }
        sendResponse({ success: false });
        return false;

      case 'disconnect':
        disconnectFromServer();
        sendResponse({ success: true });
        return false;

      // Relay events from content script → server + popup
      case 'grid_captured':
        handleGridCaptured(msg.data);
        broadcastToPopup(msg);
        sendResponse({ ok: true });
        return false;

      case 'seeds_extracted':
        handleSeedsExtracted(msg.data);
        broadcastToPopup(msg);
        sendResponse({ ok: true });
        return false;

      case 'rng_analysis':
        cachedState.rngAnalysis = msg.data;
        broadcastToPopup(msg);
        sendResponse({ ok: true });
        return false;

      case 'probe_result':
        broadcastToPopup(msg);
        sendResponse({ ok: true });
        return false;

      case 'ws_message':
        // WebSocket data from game — relay to server if connected
        sendToServer({ type: 'ws_message', data: msg.data });
        sendResponse({ ok: true });
        return false;

      case 'request':
        updateRequestCache(msg.data);
        sendResponse({ ok: true });
        return false;

      case 'response':
        updateResponseCache(msg.data);
        sendResponse({ ok: true });
        return false;

      case 'game_event':
        // Generic game event from content
        sendToServer({ type: 'game_event', data: msg.data });
        sendResponse({ ok: true });
        return false;

      default:
        sendResponse({ ok: false, reason: 'unknown_type' });
        return false;
    }
  });

  // ============================================================
  // STATE UPDATERS
  // ============================================================
  function handleGridCaptured(data) {
    if (!data) return;
    cachedState.grid = data.grid;
    cachedState.gridSource = data.source;
    cachedState.frequency = data.frequency;
    cachedState.stats.hasLiveGrid = true;
    if (data.totalGames) cachedState.stats.totalGames = data.totalGames;
    saveState();
    sendToServer({ type: 'grid_captured', data: data });
  }

  function handleSeedsExtracted(data) {
    if (!data) return;
    cachedState.seedHistory.unshift(data);
    if (cachedState.seedHistory.length > 50) cachedState.seedHistory.pop();
    saveState();
    sendToServer({ type: 'seeds_extracted', data: data });
  }

  function updateRequestCache(data) {
    if (!data) return;
    cachedState.recentRequests.unshift(data);
    if (cachedState.recentRequests.length > 50) cachedState.recentRequests.pop();
    cachedState.stats.requestsCaptured = (cachedState.stats.requestsCaptured || 0) + 1;
  }

  function updateResponseCache(data) {
    if (!data) return;
    cachedState.recentResponses.unshift(data);
    if (cachedState.recentResponses.length > 50) cachedState.recentResponses.pop();
  }

  function saveState() {
    try {
      chrome.storage.local.set({ lastState: cachedState });
    } catch(e) {}
  }

  // ============================================================
  // BROADCAST TO POPUP (if open)
  // ============================================================
  function broadcastToPopup(msg) {
    try {
      chrome.runtime.sendMessage(msg).catch(function() {});
    } catch(e) {}
  }

  // ============================================================
  // WEBSOCKET CONNECTION TO WITCH ANALYZER SERVER
  // ============================================================
  function connectToServer() {
    if (ws) {
      try { ws.close(); } catch(e) {}
      ws = null;
    }
    if (!serverUrl) return;

    var wsUrl = serverUrl
      .replace(/^https?:\/\//, function(m) { return m === 'https://' ? 'wss://' : 'ws://'; })
      .replace(/\/$/, '') + '/ws/witch?source=extension';

    console.log('[Witch BG v11] Connecting to:', wsUrl);

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = function() {
        isConnected = true;
        reconnectAttempts = 0;
        console.log('[Witch BG v11] Connected to server');
        chrome.storage.local.set({ isConnected: true });
        broadcastToPopup({ type: 'state_update', data: { connected: true } });

        // Send cached state on connect
        sendToServer({ type: 'hello', version: '11.0', hasGrid: !!cachedState.grid,
                       totalGames: cachedState.stats.totalGames });
      };

      ws.onmessage = function(evt) {
        var data = null;
        try { data = JSON.parse(evt.data); } catch(e) { return; }
        if (!data) return;
        handleServerMessage(data);
      };

      ws.onerror = function(err) {
        console.log('[Witch BG v11] WS error');
      };

      ws.onclose = function() {
        isConnected = false;
        ws = null;
        chrome.storage.local.set({ isConnected: false });
        console.log('[Witch BG v11] WS closed');
        scheduleReconnect();
      };

    } catch(e) {
      console.error('[Witch BG v11] Failed to create WebSocket:', e.message);
      isConnected = false;
      scheduleReconnect();
    }
  }

  function disconnectFromServer() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    reconnectAttempts = MAX_RECONNECT; // prevent auto-reconnect
    if (ws) { try { ws.close(); } catch(e) {} ws = null; }
    isConnected = false;
    chrome.storage.local.set({ isConnected: false });
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT) return;
    reconnectAttempts++;
    var delay = Math.min(30000, 3000 * reconnectAttempts);
    console.log('[Witch BG v11] Reconnecting in', delay + 'ms (attempt', reconnectAttempts + ')');
    reconnectTimer = setTimeout(connectToServer, delay);
  }

  function sendToServer(data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try { ws.send(JSON.stringify(data)); } catch(e) {}
  }

  // ============================================================
  // HANDLE COMMANDS FROM SERVER
  // ============================================================
  function handleServerMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'ping':
        sendToServer({ type: 'pong' });
        break;

      case 'get_state':
        sendToServer({ type: 'state', data: cachedState });
        break;

      case 'probe':
        // Server wants to probe a URL — forward to active content script
        forwardToActiveTab({ type: 'probe', config: msg.config });
        break;

      case 'clear_history':
        forwardToActiveTab({ type: 'clear_history' });
        break;

      case 'show_overlay':
        forwardToActiveTab({ type: 'show_overlay' });
        break;
    }
  }

  function forwardToActiveTab(msg) {
    chrome.tabs.query({ active: true }, function(tabs) {
      if (!tabs || !tabs.length) return;
      for (var i = 0; i < tabs.length; i++) {
        try { chrome.tabs.sendMessage(tabs[i].id, msg); } catch(e) {}
      }
    });
  }

  // ============================================================
  // RESTORE CONNECTION ON SERVICE WORKER RESTART
  // ============================================================
  chrome.storage.local.get(['serverUrl', 'isConnected', 'lastState'], function(result) {
    if (result.lastState) {
      Object.assign(cachedState, result.lastState);
    }
    if (result.serverUrl && result.isConnected) {
      serverUrl = result.serverUrl;
      reconnectAttempts = 0;
      connectToServer();
    }
  });

  // ============================================================
  // KEEP SERVICE WORKER ALIVE VIA ALARM
  // ============================================================
  chrome.alarms.create('witch-keepalive', { periodInMinutes: 0.4 });
  chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name !== 'witch-keepalive') return;
    if (serverUrl && !isConnected && reconnectAttempts < MAX_RECONNECT) {
      connectToServer();
    }
  });

})();
