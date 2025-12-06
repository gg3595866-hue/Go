let ws = null;
let serverUrl = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 3000;

chrome.storage.local.get(['serverUrl'], (result) => {
  if (result.serverUrl) {
    serverUrl = result.serverUrl;
    connectWebSocket();
  }
});

function connectWebSocket() {
  if (!serverUrl || ws?.readyState === WebSocket.OPEN) return;
  
  try {
    const wsUrl = serverUrl.replace('http', 'ws') + '/ws/witch?source=extension';
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      isConnected = true;
      reconnectAttempts = 0;
      console.log('Connected to Witch Analyzer server');
      
      chrome.runtime.sendMessage({ type: 'connection_status', connected: true });
      
      chrome.tabs.query({ active: true }, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'ws_connected' }).catch(() => {});
          }
        });
      });
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received from server:', data);
        
        chrome.tabs.query({ url: ['*://*.1xbet.com/*', '*://*.1x-bet.mobi/*'] }, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { type: 'server_command', data }).catch(() => {});
            }
          });
        });
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };
    
    ws.onclose = () => {
      isConnected = false;
      console.log('Disconnected from server');
      
      chrome.runtime.sendMessage({ type: 'connection_status', connected: false });
      
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(connectWebSocket, RECONNECT_DELAY);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      isConnected = false;
    };
  } catch (error) {
    console.error('Failed to connect:', error);
  }
}

function sendToServer(message) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    console.log('Sent to server:', message);
  } else {
    console.warn('WebSocket not connected, message not sent:', message);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'set_server_url') {
    serverUrl = message.url;
    chrome.storage.local.set({ serverUrl: message.url });
    
    if (ws) {
      ws.close();
    }
    reconnectAttempts = 0;
    connectWebSocket();
    sendResponse({ success: true });
    
  } else if (message.type === 'get_status') {
    sendResponse({ connected: isConnected, serverUrl });
    
  } else if (message.type === 'game_event') {
    sendToServer(message.data);
    sendResponse({ success: true });
    
  } else if (message.type === 'reconnect') {
    reconnectAttempts = 0;
    if (ws) ws.close();
    connectWebSocket();
    sendResponse({ success: true });
  }
  
  return true;
});
