let serverUrl = null;
let isConnected = false;
let offscreenCreated = false;
let popupTabId = null;

// Direct WebSocket fallback for browsers without offscreen support (like Kiwi on Android)
let directWs = null;
let useDirectMode = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;
const RECONNECT_DELAY = 3000;
let heartbeatInterval = null;

console.log('[Witch BG] Service worker started');

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// Check if offscreen API is available
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

// Direct WebSocket functions (fallback for mobile/Kiwi)
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
    };
    
    directWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[Witch BG Direct] Received:', data);
        
        if (data.type !== 'pong') {
          // Forward to content scripts
          chrome.tabs.query({ url: ['*://*.1xbet.com/*', '*://so.1xbet.com/*', '*://*.1x-bet.mobi/*', '*://1x-bet.mobi/*'] }, (tabs) => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'server_command', data }).catch(() => {});
              }
            });
          });
        }
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

function sendDirectToServer(message) {
  if (directWs?.readyState === WebSocket.OPEN) {
    directWs.send(JSON.stringify(message));
    console.log('[Witch BG Direct] Sent:', message);
    return true;
  } else {
    console.warn('[Witch BG Direct] Not connected, message not sent');
    return false;
  }
}

function updateConnectionStatus(connected, reason) {
  isConnected = connected;
  console.log('[Witch BG] Connection status:', isConnected, 'reason:', reason);
  
  // Notify all tabs about connection status change
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
  
  // Try to create offscreen document
  const created = await createOffscreenDocument();
  
  // If offscreen not supported or failed, use direct mode
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
  
  // Offscreen mode - send connect message to offscreen document
  await new Promise(resolve => setTimeout(resolve, 200));
  
  try {
    chrome.runtime.sendMessage({ type: 'connect', url: serverUrl }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('[Witch BG] Error sending to offscreen:', chrome.runtime.lastError.message);
        // Fall back to direct mode if offscreen communication fails
        console.log('[Witch BG] Falling back to direct mode due to communication error');
        useDirectMode = true;
        setTimeout(connectDirectWebSocket, 100);
      } else {
        console.log('[Witch BG] Connect message sent to offscreen');
      }
    });
  } catch (error) {
    console.error('[Witch BG] Failed to send connect message:', error);
    // Fall back to direct mode
    console.log('[Witch BG] Falling back to direct mode due to exception');
    useDirectMode = true;
    setTimeout(connectDirectWebSocket, 100);
  }
}

chrome.storage.local.get(['serverUrl'], (result) => {
  console.log('[Witch BG] Loaded stored URL:', result.serverUrl);
  if (result.serverUrl) {
    serverUrl = result.serverUrl;
    ensureOffscreenAndConnect();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Witch BG] Received message:', message.type, 'from:', sender.url ? 'offscreen/popup' : 'content');
  
  if (message.type === 'status_update') {
    isConnected = message.connected;
    console.log('[Witch BG] Connection status:', isConnected, 'reason:', message.reason);
    
    // Notify all tabs about connection status change
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
    
    // Reset direct mode flag to retry offscreen first
    useDirectMode = false;
    ensureOffscreenAndConnect();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'get_status') {
    console.log('[Witch BG] Status request - connected:', isConnected, 'url:', serverUrl, 'mode:', useDirectMode ? 'direct' : 'offscreen');
    sendResponse({ connected: isConnected, serverUrl, mode: useDirectMode ? 'direct' : 'offscreen' });
    return true;
  }
  
  if (message.type === 'game_event') {
    if (useDirectMode) {
      sendDirectToServer(message.data);
    } else {
      chrome.runtime.sendMessage({ type: 'send', data: message.data }).catch(() => {});
    }
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
  console.log('[Witch BG] Extension installed/updated');
});

setInterval(async () => {
  if (serverUrl && !isConnected) {
    console.log('[Witch BG] Periodic check - connected:', isConnected, 'mode:', useDirectMode ? 'direct' : 'offscreen');
    
    if (useDirectMode) {
      // Direct mode - just try to reconnect if not connected
      if (!directWs || directWs.readyState === WebSocket.CLOSED) {
        console.log('[Witch BG] Direct WS gone, reconnecting...');
        reconnectAttempts = 0;
        connectDirectWebSocket();
      }
    } else {
      // Offscreen mode - check if document exists
      const exists = await hasOffscreenDocument();
      if (!exists) {
        console.log('[Witch BG] Offscreen document gone, recreating...');
        ensureOffscreenAndConnect();
      }
    }
  }
}, 30000);
