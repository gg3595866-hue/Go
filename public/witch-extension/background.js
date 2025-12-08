let serverUrl = null;
let isConnected = false;
let offscreenCreated = false;
let popupTabId = null;

let directWs = null;
let useDirectMode = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;
const RECONNECT_DELAY = 3000;
let heartbeatInterval = null;

const MIMICK_SPY_STORAGE = {
  sessions: [],
  currentSession: null,
  capturedFlows: [],
  replayQueue: [],
  isReplaying: false,
  tokens: {}
};

console.log('[Witch BG v7.0] Service worker started with Mimick Spy');

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

function isOffscreenSupported() {
  return typeof chrome.offscreen !== 'undefined' && 
         typeof chrome.offscreen.createDocument === 'function';
}

async function hasOffscreenDocument() {
  if (!isOffscreenSupported()) {
    return false;
  }
  if ('getContexts' in chrome.runtime) {
    try {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
      });
      return contexts.length > 0;
    } catch (e) {
      console.log('[Witch BG] getContexts failed:', e.message);
      return offscreenCreated;
    }
  }
  return offscreenCreated;
}

async function createOffscreenDocument() {
  if (!isOffscreenSupported()) {
    console.log('[Witch BG] Offscreen API not supported, using direct mode');
    useDirectMode = true;
    return false;
  }
  
  if (await hasOffscreenDocument()) {
    console.log('[Witch BG] Offscreen document already exists');
    return true;
  }
  
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['BLOBS'],
      justification: 'Maintain persistent WebSocket connection to Witch Analyzer server'
    });
    offscreenCreated = true;
    useDirectMode = false;
    console.log('[Witch BG] Offscreen document created');
    return true;
  } catch (error) {
    console.error('[Witch BG] Failed to create offscreen document:', error);
    console.log('[Witch BG] Falling back to direct WebSocket mode');
    useDirectMode = true;
    return false;
  }
}

function buildWebSocketUrl(httpUrl) {
  try {
    const url = new URL(httpUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${url.host}/ws/witch?source=extension`;
    console.log('[Witch BG Direct] Built WS URL:', wsUrl, 'from:', httpUrl);
    return wsUrl;
  } catch (error) {
    console.error('[Witch BG Direct] Invalid URL:', httpUrl, error);
    return null;
  }
}

function startDirectHeartbeat() {
  stopDirectHeartbeat();
  heartbeatInterval = setInterval(() => {
    if (directWs?.readyState === WebSocket.OPEN) {
      directWs.send(JSON.stringify({ type: 'ping' }));
      console.log('[Witch BG Direct] Heartbeat sent');
    }
  }, 20000);
}

function stopDirectHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function connectDirectWebSocket() {
  if (!serverUrl) {
    console.log('[Witch BG Direct] No server URL configured');
    updateConnectionStatus(false, 'no_url');
    return;
  }
  
  if (directWs?.readyState === WebSocket.OPEN) {
    console.log('[Witch BG Direct] Already connected');
    updateConnectionStatus(true);
    return;
  }
  
  if (directWs?.readyState === WebSocket.CONNECTING) {
    console.log('[Witch BG Direct] Already connecting...');
    return;
  }
  
  try {
    const wsUrl = buildWebSocketUrl(serverUrl);
    if (!wsUrl) {
      updateConnectionStatus(false, 'invalid_url');
      return;
    }
    
    console.log('[Witch BG Direct] Connecting to:', wsUrl);
    updateConnectionStatus(false, 'connecting');
    
    directWs = new WebSocket(wsUrl);
    
    directWs.onopen = () => {
      isConnected = true;
      reconnectAttempts = 0;
      console.log('[Witch BG Direct] Connected successfully!');
      updateConnectionStatus(true);
      startDirectHeartbeat();
      
      sendToServer({
        type: 'extension_info',
        version: '7.0',
        mimickSpyEnabled: true
      });
    };
    
    directWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[Witch BG Direct] Received:', data);
        
        if (data.type === 'pong' || data.type === 'welcome') {
          return;
        }
        
        if (data.type === 'replay_command') {
          handleReplayCommand(data);
          return;
        }
        
        const messageToForward = data.action ? data : data;
        console.log('[Witch BG Direct] Forwarding to content scripts:', messageToForward);
        
        chrome.tabs.query({ url: ['*://*.1xbet.com/*', '*://so.1xbet.com/*', '*://*.1x-bet.mobi/*', '*://1x-bet.mobi/*'] }, (tabs) => {
          console.log('[Witch BG Direct] Found', tabs.length, '1xbet tabs');
          tabs.forEach(tab => {
            if (tab.id) {
              console.log('[Witch BG Direct] Sending to tab:', tab.id, tab.url);
              chrome.tabs.sendMessage(tab.id, { type: 'server_command', data: messageToForward })
                .then(() => console.log('[Witch BG Direct] Message sent successfully to tab', tab.id))
                .catch((err) => console.log('[Witch BG Direct] Failed to send to tab', tab.id, err.message));
            }
          });
        });
      } catch (error) {
        console.error('[Witch BG Direct] Failed to parse message:', error);
      }
    };
    
    directWs.onclose = (event) => {
      isConnected = false;
      stopDirectHeartbeat();
      console.log('[Witch BG Direct] Disconnected. Code:', event.code, 'Reason:', event.reason || 'none');
      updateConnectionStatus(false, 'closed');
      
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log('[Witch BG Direct] Reconnecting in', RECONNECT_DELAY, 'ms (attempt', reconnectAttempts, ')');
        setTimeout(connectDirectWebSocket, RECONNECT_DELAY);
      } else {
        console.log('[Witch BG Direct] Max reconnect attempts reached');
        updateConnectionStatus(false, 'max_attempts');
      }
    };
    
    directWs.onerror = (error) => {
      console.error('[Witch BG Direct] WebSocket error:', error);
      isConnected = false;
      updateConnectionStatus(false, 'ws_error');
    };
  } catch (error) {
    console.error('[Witch BG Direct] Failed to create WebSocket:', error);
    updateConnectionStatus(false, 'exception');
  }
}

function sendToServer(message) {
  if (useDirectMode) {
    if (directWs?.readyState === WebSocket.OPEN) {
      directWs.send(JSON.stringify(message));
      console.log('[Witch BG Direct] Sent:', message.type || message);
      return true;
    } else {
      console.warn('[Witch BG Direct] Not connected, message not sent');
      return false;
    }
  } else {
    try {
      chrome.runtime.sendMessage({ type: 'send', data: message }).catch((err) => {
        console.log('[Witch BG] Offscreen send failed, using direct fallback:', err.message);
        if (directWs?.readyState === WebSocket.OPEN) {
          directWs.send(JSON.stringify(message));
        }
      });
      return true;
    } catch (e) {
      console.warn('[Witch BG] sendToServer error:', e.message);
      return false;
    }
  }
}

async function postSessionToServer(session) {
  if (!serverUrl) {
    console.log('[Witch BG Mimick] No server URL, cannot post session');
    return false;
  }
  
  try {
    const apiUrl = new URL('/api/witch/mimick/session', serverUrl);
    const response = await fetch(apiUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
    
    if (response.ok) {
      console.log('[Witch BG Mimick] Session posted to server:', session.id);
      return true;
    } else {
      console.error('[Witch BG Mimick] Failed to post session:', response.status);
      return false;
    }
  } catch (error) {
    console.error('[Witch BG Mimick] Error posting session:', error.message);
    return false;
  }
}

function updateConnectionStatus(connected, reason) {
  isConnected = connected;
  console.log('[Witch BG] Connection status:', isConnected, 'reason:', reason);
  
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id || 0, { 
        type: 'connection_status', 
        connected: isConnected,
        serverUrl: serverUrl
      }).catch(() => {});
    });
  });
}

async function ensureOffscreenAndConnect() {
  if (!serverUrl) {
    console.log('[Witch BG] No server URL configured');
    return;
  }
  
  const created = await createOffscreenDocument();
  
  if (useDirectMode || !created) {
    console.log('[Witch BG] Using direct WebSocket mode');
    useDirectMode = true;
    reconnectAttempts = 0;
    if (directWs) {
      directWs.close();
      directWs = null;
    }
    setTimeout(connectDirectWebSocket, 100);
    return;
  }
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  try {
    chrome.runtime.sendMessage({ type: 'connect', url: serverUrl }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('[Witch BG] Error sending to offscreen:', chrome.runtime.lastError.message);
        console.log('[Witch BG] Falling back to direct mode due to communication error');
        useDirectMode = true;
        setTimeout(connectDirectWebSocket, 100);
      } else {
        console.log('[Witch BG] Connect message sent to offscreen');
      }
    });
  } catch (error) {
    console.error('[Witch BG] Failed to send connect message:', error);
    console.log('[Witch BG] Falling back to direct mode due to exception');
    useDirectMode = true;
    setTimeout(connectDirectWebSocket, 100);
  }
}

async function storeMimickSession(sessionData) {
  sessionData.storedAt = new Date().toISOString();
  
  if (!sessionData.id) {
    sessionData.id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
  
  MIMICK_SPY_STORAGE.sessions.push(sessionData);
  
  if (MIMICK_SPY_STORAGE.sessions.length > 50) {
    MIMICK_SPY_STORAGE.sessions = MIMICK_SPY_STORAGE.sessions.slice(-50);
  }
  
  chrome.storage.local.set({ 
    mimickSessions: MIMICK_SPY_STORAGE.sessions 
  });
  
  const httpPosted = await postSessionToServer(sessionData);
  console.log('[Witch BG Mimick] HTTP POST result:', httpPosted);
  
  sendToServer({
    type: 'mimick_session_stored',
    session: sessionData,
    httpPosted: httpPosted
  });
  
  sendToServer({
    type: 'mimick_recording_stopped',
    sessionId: sessionData.id,
    session: sessionData
  });
  
  console.log('[Witch BG Mimick] Session stored locally and to server:', sessionData.id);
}

function handleReplayCommand(data) {
  console.log('[Witch BG Mimick] Replay command received:', data);
  
  if (data.action === 'start_replay') {
    MIMICK_SPY_STORAGE.isReplaying = true;
    MIMICK_SPY_STORAGE.replayQueue = data.actions || [];
    executeReplayQueue();
  } else if (data.action === 'stop_replay') {
    MIMICK_SPY_STORAGE.isReplaying = false;
    MIMICK_SPY_STORAGE.replayQueue = [];
  }
}

async function executeReplayQueue() {
  if (!MIMICK_SPY_STORAGE.isReplaying || MIMICK_SPY_STORAGE.replayQueue.length === 0) {
    MIMICK_SPY_STORAGE.isReplaying = false;
    sendToServer({ type: 'replay_completed' });
    return;
  }
  
  const action = MIMICK_SPY_STORAGE.replayQueue.shift();
  console.log('[Witch BG Mimick] Executing replay action:', action);
  
  chrome.tabs.query({ url: ['*://*.1xbet.com/*', '*://so.1xbet.com/*', '*://*.1x-bet.mobi/*', '*://1x-bet.mobi/*'] }, async (tabs) => {
    if (tabs.length > 0 && tabs[0].id) {
      try {
        await chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'server_command', 
          data: action 
        });
        
        sendToServer({
          type: 'replay_action_executed',
          action: action,
          success: true
        });
      } catch (error) {
        sendToServer({
          type: 'replay_action_executed',
          action: action,
          success: false,
          error: error.message
        });
      }
    }
    
    const delay = action.delay || 1000;
    setTimeout(executeReplayQueue, delay);
  });
}

chrome.storage.local.get(['serverUrl', 'mimickSessions'], (result) => {
  console.log('[Witch BG] Loaded stored URL:', result.serverUrl);
  if (result.serverUrl) {
    serverUrl = result.serverUrl;
    ensureOffscreenAndConnect();
  }
  if (result.mimickSessions) {
    MIMICK_SPY_STORAGE.sessions = result.mimickSessions;
    console.log('[Witch BG Mimick] Loaded', MIMICK_SPY_STORAGE.sessions.length, 'stored sessions');
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Witch BG] Received message:', message.type, 'from:', sender.url ? 'offscreen/popup' : 'content');
  
  if (message.type === 'status_update' || message.type === 'popup_status_update') {
    isConnected = message.connected;
    console.log('[Witch BG] Connection status:', isConnected, 'from:', message.type);
    
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id || 0, { 
          type: 'connection_status', 
          connected: isConnected,
          serverUrl: serverUrl
        }).catch(() => {});
      });
    });
    
    return false;
  }
  
  if (message.type === 'server_message') {
    chrome.tabs.query({ url: ['*://*.1xbet.com/*', '*://so.1xbet.com/*', '*://*.1x-bet.mobi/*', '*://1x-bet.mobi/*'] }, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'server_command', data: message.data }).catch(() => {});
        }
      });
    });
    return false;
  }
  
  if (message.type === 'set_server_url') {
    serverUrl = message.url;
    chrome.storage.local.set({ serverUrl: message.url });
    console.log('[Witch BG] Server URL set to:', message.url);
    
    useDirectMode = false;
    ensureOffscreenAndConnect();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'get_status') {
    console.log('[Witch BG] Status request - connected:', isConnected, 'url:', serverUrl, 'mode:', useDirectMode ? 'direct' : 'offscreen');
    sendResponse({ 
      connected: isConnected, 
      serverUrl, 
      mode: useDirectMode ? 'direct' : 'offscreen',
      mimickSpyEnabled: true,
      storedSessions: MIMICK_SPY_STORAGE.sessions.length
    });
    return true;
  }
  
  if (message.type === 'game_event') {
    const eventData = message.data;
    
    if (eventData.type === 'mimick_recording_started') {
      MIMICK_SPY_STORAGE.currentSession = {
        id: eventData.sessionId,
        startTime: new Date().toISOString(),
        requests: [],
        responses: [],
        websockets: [],
        tokens: {},
        cellClicks: [],
        rowResults: []
      };
      console.log('[Witch BG Mimick] Recording started, currentSession:', MIMICK_SPY_STORAGE.currentSession.id);
    }
    
    if (eventData.type === 'mimick_recording_stopped' && eventData.session) {
      storeMimickSession(eventData.session);
      MIMICK_SPY_STORAGE.currentSession = null;
    }
    
    if (eventData.type === 'mimick_request' || eventData.type === 'mimick_response' || 
        eventData.type === 'mimick_websocket' || eventData.type === 'mimick_token') {
      if (MIMICK_SPY_STORAGE.currentSession) {
        if (eventData.type === 'mimick_request') {
          MIMICK_SPY_STORAGE.currentSession.requests.push(eventData.data);
        } else if (eventData.type === 'mimick_response') {
          MIMICK_SPY_STORAGE.currentSession.responses.push(eventData.data);
        } else if (eventData.type === 'mimick_websocket') {
          MIMICK_SPY_STORAGE.currentSession.websockets.push(eventData.data);
        } else if (eventData.type === 'mimick_token') {
          MIMICK_SPY_STORAGE.currentSession.tokens[eventData.data.key] = eventData.data.value;
        }
      }
      
      sendToServer({
        type: 'mimick_capture',
        captureType: eventData.type,
        data: eventData.data
      });
    }
    
    sendToServer(eventData);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'get_mimick_sessions') {
    sendResponse({ sessions: MIMICK_SPY_STORAGE.sessions });
    return true;
  }
  
  if (message.type === 'clear_mimick_sessions') {
    MIMICK_SPY_STORAGE.sessions = [];
    chrome.storage.local.set({ mimickSessions: [] });
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'start_replay') {
    handleReplayCommand({
      action: 'start_replay',
      actions: message.actions
    });
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'stop_replay') {
    handleReplayCommand({ action: 'stop_replay' });
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'reconnect') {
    console.log('[Witch BG] Manual reconnect requested');
    if (useDirectMode) {
      reconnectAttempts = 0;
      if (directWs) {
        directWs.close();
        directWs = null;
      }
      setTimeout(connectDirectWebSocket, 100);
    } else {
      ensureOffscreenAndConnect();
    }
    sendResponse({ success: true });
    return true;
  }
  
  return false;
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[Witch BG] Browser started');
  chrome.storage.local.get(['serverUrl'], (result) => {
    if (result.serverUrl) {
      serverUrl = result.serverUrl;
      ensureOffscreenAndConnect();
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Witch BG v7.0] Extension installed/updated with Mimick Spy');
});

setInterval(async () => {
  if (serverUrl && !isConnected) {
    console.log('[Witch BG] Periodic check - connected:', isConnected, 'mode:', useDirectMode ? 'direct' : 'offscreen');
    
    if (useDirectMode) {
      if (!directWs || directWs.readyState === WebSocket.CLOSED) {
        console.log('[Witch BG] Direct WS gone, reconnecting...');
        reconnectAttempts = 0;
        connectDirectWebSocket();
      }
    } else {
      const exists = await hasOffscreenDocument();
      if (!exists) {
        console.log('[Witch BG] Offscreen document gone, recreating...');
        ensureOffscreenAndConnect();
      }
    }
  }
}, 30000);
