let ws = null;
let serverUrl = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 3000;

console.log('[Witch BG] Service worker started');

chrome.storage.local.get(['serverUrl'], (result) => {
  console.log('[Witch BG] Loaded stored URL:', result.serverUrl);
  if (result.serverUrl) {
    serverUrl = result.serverUrl;
    connectWebSocket();
  }
});

function buildWebSocketUrl(httpUrl) {
  let wsUrl = httpUrl;
  
  if (wsUrl.startsWith('https://')) {
    wsUrl = 'wss://' + wsUrl.substring(8);
  } else if (wsUrl.startsWith('http://')) {
    wsUrl = 'ws://' + wsUrl.substring(7);
  } else {
    wsUrl = 'wss://' + wsUrl;
  }
  
  wsUrl = wsUrl.replace(/\/$/, '');
  
  return wsUrl + '/ws/witch?source=extension';
}

function connectWebSocket() {
  if (!serverUrl) {
    console.log('[Witch BG] No server URL configured');
    return;
  }
  
  if (ws?.readyState === WebSocket.OPEN) {
    console.log('[Witch BG] Already connected');
    return;
  }
  
  if (ws?.readyState === WebSocket.CONNECTING) {
    console.log('[Witch BG] Already connecting...');
    return;
  }
  
  try {
    const wsUrl = buildWebSocketUrl(serverUrl);
    console.log('[Witch BG] Connecting to:', wsUrl);
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      isConnected = true;
      reconnectAttempts = 0;
      console.log('[Witch BG] Connected successfully!');
      
      try {
        chrome.runtime.sendMessage({ type: 'connection_status', connected: true }).catch(() => {});
      } catch (e) {}
      
      chrome.tabs.query({ active: true }, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'ws_connected' }).catch(() => {});
          }
        });
      });
      
      chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[Witch BG] Received:', data);
        
        chrome.tabs.query({ url: ['*://*.1xbet.com/*', '*://so.1xbet.com/*', '*://*.1x-bet.mobi/*', '*://1x-bet.mobi/*'] }, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { type: 'server_command', data }).catch(() => {});
            }
          });
        });
      } catch (error) {
        console.error('[Witch BG] Failed to parse message:', error);
      }
    };
    
    ws.onclose = (event) => {
      isConnected = false;
      console.log('[Witch BG] Disconnected. Code:', event.code, 'Reason:', event.reason);
      
      try {
        chrome.runtime.sendMessage({ type: 'connection_status', connected: false }).catch(() => {});
      } catch (e) {}
      
      chrome.alarms.clear('keepAlive');
      
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log('[Witch BG] Reconnecting in', RECONNECT_DELAY, 'ms (attempt', reconnectAttempts, ')');
        setTimeout(connectWebSocket, RECONNECT_DELAY);
      } else {
        console.log('[Witch BG] Max reconnect attempts reached');
      }
    };
    
    ws.onerror = (error) => {
      console.error('[Witch BG] WebSocket error:', error);
      isConnected = false;
    };
  } catch (error) {
    console.error('[Witch BG] Failed to create WebSocket:', error);
  }
}

function sendToServer(message) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    console.log('[Witch BG] Sent:', message);
  } else {
    console.warn('[Witch BG] Not connected, message not sent:', message);
    connectWebSocket();
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    } else if (serverUrl && !isConnected) {
      connectWebSocket();
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Witch BG] Received message:', message.type);
  
  if (message.type === 'set_server_url') {
    serverUrl = message.url;
    chrome.storage.local.set({ serverUrl: message.url });
    console.log('[Witch BG] Server URL set to:', message.url);
    
    if (ws) {
      ws.close();
      ws = null;
    }
    reconnectAttempts = 0;
    
    setTimeout(() => {
      connectWebSocket();
    }, 100);
    
    sendResponse({ success: true });
    
  } else if (message.type === 'get_status') {
    console.log('[Witch BG] Status request - connected:', isConnected, 'url:', serverUrl);
    sendResponse({ connected: isConnected, serverUrl });
    
  } else if (message.type === 'game_event') {
    sendToServer(message.data);
    sendResponse({ success: true });
    
  } else if (message.type === 'reconnect') {
    console.log('[Witch BG] Manual reconnect requested');
    reconnectAttempts = 0;
    if (ws) {
      ws.close();
      ws = null;
    }
    setTimeout(() => {
      connectWebSocket();
    }, 100);
    sendResponse({ success: true });
  }
  
  return true;
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[Witch BG] Browser started');
  chrome.storage.local.get(['serverUrl'], (result) => {
    if (result.serverUrl) {
      serverUrl = result.serverUrl;
      connectWebSocket();
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Witch BG] Extension installed/updated');
});
