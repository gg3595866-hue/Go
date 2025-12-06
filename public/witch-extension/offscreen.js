let ws = null;
let serverUrl = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;
const RECONNECT_DELAY = 3000;
let heartbeatInterval = null;

console.log('[Witch Offscreen] Document loaded');

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
    console.log('[Witch Offscreen] No server URL configured');
    notifyBackground({ type: 'status_update', connected: false, reason: 'no_url' });
    return;
  }
  
  if (ws?.readyState === WebSocket.OPEN) {
    console.log('[Witch Offscreen] Already connected');
    return;
  }
  
  if (ws?.readyState === WebSocket.CONNECTING) {
    console.log('[Witch Offscreen] Already connecting...');
    return;
  }
  
  try {
    const wsUrl = buildWebSocketUrl(serverUrl);
    console.log('[Witch Offscreen] Connecting to:', wsUrl);
    notifyBackground({ type: 'status_update', connected: false, reason: 'connecting' });
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      isConnected = true;
      reconnectAttempts = 0;
      console.log('[Witch Offscreen] Connected successfully!');
      notifyBackground({ type: 'status_update', connected: true });
      
      startHeartbeat();
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[Witch Offscreen] Received:', data);
        
        if (data.type !== 'pong') {
          notifyBackground({ type: 'server_message', data });
        }
      } catch (error) {
        console.error('[Witch Offscreen] Failed to parse message:', error);
      }
    };
    
    ws.onclose = (event) => {
      isConnected = false;
      stopHeartbeat();
      console.log('[Witch Offscreen] Disconnected. Code:', event.code, 'Reason:', event.reason || 'none');
      notifyBackground({ type: 'status_update', connected: false, reason: 'closed' });
      
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log('[Witch Offscreen] Reconnecting in', RECONNECT_DELAY, 'ms (attempt', reconnectAttempts, ')');
        setTimeout(connectWebSocket, RECONNECT_DELAY);
      } else {
        console.log('[Witch Offscreen] Max reconnect attempts reached');
        notifyBackground({ type: 'status_update', connected: false, reason: 'max_attempts' });
      }
    };
    
    ws.onerror = (error) => {
      console.error('[Witch Offscreen] WebSocket error:', error);
      isConnected = false;
      notifyBackground({ type: 'status_update', connected: false, reason: 'error' });
    };
  } catch (error) {
    console.error('[Witch Offscreen] Failed to create WebSocket:', error);
    notifyBackground({ type: 'status_update', connected: false, reason: 'exception' });
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
      console.log('[Witch Offscreen] Heartbeat sent');
    }
  }, 20000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function sendToServer(message) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    console.log('[Witch Offscreen] Sent:', message);
    return true;
  } else {
    console.warn('[Witch Offscreen] Not connected, message not sent');
    return false;
  }
}

function notifyBackground(message) {
  try {
    chrome.runtime.sendMessage(message).catch(() => {});
  } catch (e) {
    console.log('[Witch Offscreen] Could not notify background:', e.message);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Witch Offscreen] Received from background:', message.type);
  
  switch (message.type) {
    case 'connect':
      serverUrl = message.url;
      reconnectAttempts = 0;
      if (ws) {
        ws.close();
        ws = null;
      }
      setTimeout(connectWebSocket, 100);
      sendResponse({ success: true });
      break;
      
    case 'disconnect':
      if (ws) {
        ws.close();
        ws = null;
      }
      stopHeartbeat();
      sendResponse({ success: true });
      break;
      
    case 'send':
      const sent = sendToServer(message.data);
      sendResponse({ success: sent });
      break;
      
    case 'get_status':
      sendResponse({ connected: isConnected, serverUrl });
      break;
      
    case 'reconnect':
      reconnectAttempts = 0;
      if (ws) {
        ws.close();
        ws = null;
      }
      setTimeout(connectWebSocket, 100);
      sendResponse({ success: true });
      break;
      
    case 'ping':
      sendResponse({ alive: true, connected: isConnected });
      break;
  }
  
  return true;
});

console.log('[Witch Offscreen] Ready and listening for messages');
