let ws = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 2000;
let heartbeatInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const connectBtn = document.getElementById('connectBtn');
  const reconnectBtn = document.getElementById('reconnectBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  
  function updateUI(connected, connecting) {
    if (connecting) {
      statusDot.className = 'status-dot connecting';
      statusText.textContent = 'Connecting...';
    } else if (connected) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = 'Connected';
      connectBtn.textContent = 'Update Connection';
    } else {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = serverUrlInput.value ? 'Disconnected' : 'Not configured';
      connectBtn.textContent = 'Connect';
    }
  }
  
  function buildWebSocketUrl(httpUrl) {
    try {
      const url = new URL(httpUrl);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${url.host}/ws/witch?source=extension`;
      console.log('[Witch Popup] Built WS URL:', wsUrl);
      return wsUrl;
    } catch (error) {
      console.error('[Witch Popup] Invalid URL:', httpUrl, error);
      return null;
    }
  }
  
  function startHeartbeat() {
    stopHeartbeat();
    heartbeatInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
        console.log('[Witch Popup] Heartbeat sent');
      }
    }, 20000);
  }
  
  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }
  
  function notifyBackground(connected) {
    chrome.runtime.sendMessage({ 
      type: 'popup_status_update', 
      connected: connected 
    }).catch(() => {});
  }
  
  function forwardToContentScripts(data) {
    chrome.tabs.query({ url: ['*://*.1xbet.com/*', '*://so.1xbet.com/*', '*://*.1x-bet.mobi/*', '*://1x-bet.mobi/*'] }, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'server_command', data }).catch(() => {});
        }
      });
    });
  }
  
  function connectWebSocket(url) {
    if (!url) {
      console.log('[Witch Popup] No URL provided');
      updateUI(false, false);
      return;
    }
    
    if (ws?.readyState === WebSocket.OPEN) {
      console.log('[Witch Popup] Already connected');
      updateUI(true, false);
      return;
    }
    
    if (ws?.readyState === WebSocket.CONNECTING) {
      console.log('[Witch Popup] Already connecting...');
      return;
    }
    
    // Close any existing connection
    if (ws) {
      ws.close();
      ws = null;
    }
    
    const wsUrl = buildWebSocketUrl(url);
    if (!wsUrl) {
      statusText.textContent = 'Invalid URL';
      updateUI(false, false);
      return;
    }
    
    console.log('[Witch Popup] Connecting to:', wsUrl);
    updateUI(false, true);
    
    try {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        isConnected = true;
        reconnectAttempts = 0;
        console.log('[Witch Popup] Connected successfully!');
        updateUI(true, false);
        notifyBackground(true);
        startHeartbeat();
        
        // Store connection state
        chrome.storage.local.set({ wsConnected: true });
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[Witch Popup] Received:', data);
          
          if (data.type !== 'pong') {
            forwardToContentScripts(data);
          }
        } catch (error) {
          console.error('[Witch Popup] Failed to parse message:', error);
        }
      };
      
      ws.onclose = (event) => {
        isConnected = false;
        stopHeartbeat();
        console.log('[Witch Popup] Disconnected. Code:', event.code, 'Reason:', event.reason || 'none');
        updateUI(false, false);
        notifyBackground(false);
        
        chrome.storage.local.set({ wsConnected: false });
        
        // Auto-reconnect
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          console.log('[Witch Popup] Reconnecting in', RECONNECT_DELAY, 'ms (attempt', reconnectAttempts, ')');
          setTimeout(() => {
            if (serverUrlInput.value) {
              connectWebSocket(serverUrlInput.value);
            }
          }, RECONNECT_DELAY);
        } else {
          statusText.textContent = 'Connection failed - tap Reconnect';
        }
      };
      
      ws.onerror = (error) => {
        console.error('[Witch Popup] WebSocket error:', error);
        isConnected = false;
        updateUI(false, false);
        statusText.textContent = 'Connection error';
      };
    } catch (error) {
      console.error('[Witch Popup] Failed to create WebSocket:', error);
      statusText.textContent = 'Failed to connect: ' + error.message;
      updateUI(false, false);
    }
  }
  
  // Load saved URL and try to connect
  chrome.storage.local.get(['serverUrl'], (result) => {
    if (result.serverUrl) {
      serverUrlInput.value = result.serverUrl;
      // Auto-connect on popup open
      setTimeout(() => connectWebSocket(result.serverUrl), 100);
    }
  });
  
  // Also check background status
  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    if (chrome.runtime.lastError) {
      console.log('[Witch Popup] Error getting status:', chrome.runtime.lastError.message);
      return;
    }
    if (response?.connected && !isConnected) {
      updateUI(true, false);
    }
  });
  
  connectBtn.addEventListener('click', () => {
    let url = serverUrlInput.value.trim();
    
    if (!url) {
      alert('Please enter a server URL');
      return;
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
      serverUrlInput.value = url;
    }
    
    url = url.replace(/\/$/, '');
    serverUrlInput.value = url;
    
    // Save URL
    chrome.storage.local.set({ serverUrl: url });
    
    // Also notify background (for content script coordination)
    chrome.runtime.sendMessage({ type: 'set_server_url', url }).catch(() => {});
    
    // Reset reconnect attempts and connect
    reconnectAttempts = 0;
    connectWebSocket(url);
  });
  
  reconnectBtn.addEventListener('click', () => {
    const url = serverUrlInput.value.trim();
    if (!url) {
      alert('Please enter a server URL first');
      return;
    }
    
    // Close existing connection
    if (ws) {
      ws.close();
      ws = null;
    }
    
    reconnectAttempts = 0;
    connectWebSocket(url);
  });
  
  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'send_to_server' && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message.data));
    }
  });
  
  // Keep alive - prevent popup from being garbage collected
  setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      console.log('[Witch Popup] Connection alive');
    }
  }, 10000);
});
