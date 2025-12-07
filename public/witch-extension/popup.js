let ws = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000;
let heartbeatInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const connectBtn = document.getElementById('connectBtn');
  const reconnectBtn = document.getElementById('reconnectBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  
  function updateUI(connected, connecting, message) {
    if (connecting) {
      statusDot.className = 'status-dot connecting';
      statusText.textContent = message || 'Connecting...';
    } else if (connected) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = 'Connected';
      connectBtn.textContent = 'Update Connection';
    } else {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = message || (serverUrlInput.value ? 'Disconnected' : 'Not configured');
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
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
          console.log('[Witch Popup] Heartbeat sent');
        } catch (e) {
          console.error('[Witch Popup] Heartbeat error:', e);
        }
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
    try {
      chrome.runtime.sendMessage({ 
        type: 'popup_status_update', 
        connected: connected 
      }).catch(() => {});
    } catch (e) {
      console.log('[Witch Popup] Could not notify background:', e);
    }
  }
  
  function forwardToContentScripts(data) {
    console.log('[Witch Popup] Forwarding to content scripts:', data);
    try {
      chrome.tabs.query({ url: ['*://*.1xbet.com/*', '*://so.1xbet.com/*', '*://*.1x-bet.mobi/*', '*://1x-bet.mobi/*'] }, (tabs) => {
        if (chrome.runtime.lastError) {
          console.log('[Witch Popup] Tab query error:', chrome.runtime.lastError);
          return;
        }
        console.log('[Witch Popup] Found', tabs.length, '1xbet tabs');
        tabs.forEach(tab => {
          if (tab.id) {
            console.log('[Witch Popup] Sending to tab:', tab.id, tab.url);
            chrome.tabs.sendMessage(tab.id, { type: 'server_command', data })
              .then(() => console.log('[Witch Popup] Sent to tab', tab.id))
              .catch((err) => console.log('[Witch Popup] Failed to send to tab', tab.id, err.message));
          }
        });
      });
    } catch (e) {
      console.log('[Witch Popup] Could not forward to content scripts:', e);
    }
  }
  
  async function testServerConnectivity(url) {
    try {
      updateUI(false, true, 'Testing server...');
      const response = await fetch(url + '/api/fixtures/2025-01-01', { 
        method: 'GET',
        mode: 'cors'
      });
      console.log('[Witch Popup] Server test response:', response.status);
      return response.ok || response.status === 304;
    } catch (error) {
      console.error('[Witch Popup] Server test failed:', error);
      return false;
    }
  }
  
  async function connectWebSocket(url) {
    if (!url) {
      console.log('[Witch Popup] No URL provided');
      updateUI(false, false, 'Enter URL');
      return;
    }
    
    // First test if we can reach the server at all
    const canReachServer = await testServerConnectivity(url);
    if (!canReachServer) {
      updateUI(false, false, 'Cannot reach server');
      return;
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('[Witch Popup] Already connected');
      updateUI(true, false);
      return;
    }
    
    if (ws && ws.readyState === WebSocket.CONNECTING) {
      console.log('[Witch Popup] Already connecting...');
      return;
    }
    
    // Close any existing connection
    if (ws) {
      try {
        ws.close();
      } catch (e) {}
      ws = null;
    }
    
    const wsUrl = buildWebSocketUrl(url);
    if (!wsUrl) {
      updateUI(false, false, 'Invalid URL format');
      return;
    }
    
    console.log('[Witch Popup] Connecting to:', wsUrl);
    updateUI(false, true, 'Opening WebSocket...');
    
    try {
      // Check if WebSocket is available
      if (typeof WebSocket === 'undefined') {
        updateUI(false, false, 'WebSocket not supported');
        return;
      }
      
      ws = new WebSocket(wsUrl);
      
      ws.onopen = function() {
        isConnected = true;
        reconnectAttempts = 0;
        console.log('[Witch Popup] Connected successfully!');
        updateUI(true, false);
        notifyBackground(true);
        startHeartbeat();
        
        chrome.storage.local.set({ wsConnected: true });
      };
      
      ws.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          console.log('[Witch Popup] Received:', data.type);
          
          if (data.type === 'welcome') {
            console.log('[Witch Popup] Server welcome received');
          } else if (data.type !== 'pong') {
            forwardToContentScripts(data);
          }
        } catch (error) {
          console.error('[Witch Popup] Message parse error:', error);
        }
      };
      
      ws.onclose = function(event) {
        isConnected = false;
        stopHeartbeat();
        console.log('[Witch Popup] Closed. Code:', event.code, 'Clean:', event.wasClean);
        
        let closeReason = 'Disconnected';
        if (event.code === 1006) {
          closeReason = 'Connection failed';
        } else if (event.code === 1015) {
          closeReason = 'TLS/SSL error';
        }
        
        updateUI(false, false, closeReason);
        notifyBackground(false);
        chrome.storage.local.set({ wsConnected: false });
        
        // Auto-reconnect with limit
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && serverUrlInput.value) {
          reconnectAttempts++;
          console.log('[Witch Popup] Retry', reconnectAttempts, 'in', RECONNECT_DELAY, 'ms');
          updateUI(false, true, 'Retry ' + reconnectAttempts + '...');
          setTimeout(() => {
            connectWebSocket(serverUrlInput.value);
          }, RECONNECT_DELAY);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          updateUI(false, false, 'Connection failed');
        }
      };
      
      ws.onerror = function(error) {
        console.error('[Witch Popup] WebSocket error:', error);
        isConnected = false;
        updateUI(false, false, 'WebSocket error');
      };
      
    } catch (error) {
      console.error('[Witch Popup] Failed to create WebSocket:', error);
      updateUI(false, false, 'Error: ' + (error.message || 'Unknown'));
    }
  }
  
  // Load saved URL
  chrome.storage.local.get(['serverUrl'], (result) => {
    if (chrome.runtime.lastError) {
      console.log('[Witch Popup] Storage error:', chrome.runtime.lastError);
      return;
    }
    if (result.serverUrl) {
      serverUrlInput.value = result.serverUrl;
      // Auto-connect on popup open with small delay
      setTimeout(() => connectWebSocket(result.serverUrl), 300);
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
    
    // Notify background
    try {
      chrome.runtime.sendMessage({ type: 'set_server_url', url }).catch(() => {});
    } catch (e) {}
    
    // Reset and connect
    reconnectAttempts = 0;
    if (ws) {
      try { ws.close(); } catch (e) {}
      ws = null;
    }
    connectWebSocket(url);
  });
  
  reconnectBtn.addEventListener('click', () => {
    const url = serverUrlInput.value.trim();
    if (!url) {
      alert('Please enter a server URL first');
      return;
    }
    
    if (ws) {
      try { ws.close(); } catch (e) {}
      ws = null;
    }
    
    reconnectAttempts = 0;
    connectWebSocket(url);
  });
  
  // Handle messages from background
  try {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'send_to_server' && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message.data));
      }
    });
  } catch (e) {
    console.log('[Witch Popup] Could not add message listener:', e);
  }
});
