let serverUrl = null;
let isConnected = false;
let offscreenCreated = false;
let popupTabId = null;

console.log('[Witch BG] Service worker started');

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

async function hasOffscreenDocument() {
  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
    });
    return contexts.length > 0;
  }
  return offscreenCreated;
}

async function createOffscreenDocument() {
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
    console.log('[Witch BG] Offscreen document created');
    return true;
  } catch (error) {
    console.error('[Witch BG] Failed to create offscreen document:', error);
    return false;
  }
}

async function ensureOffscreenAndConnect() {
  if (!serverUrl) {
    console.log('[Witch BG] No server URL configured');
    return;
  }
  
  const created = await createOffscreenDocument();
  if (!created) {
    console.error('[Witch BG] Could not create offscreen document');
    return;
  }
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  try {
    chrome.runtime.sendMessage({ type: 'connect', url: serverUrl }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('[Witch BG] Error sending to offscreen:', chrome.runtime.lastError.message);
      } else {
        console.log('[Witch BG] Connect message sent to offscreen');
      }
    });
  } catch (error) {
    console.error('[Witch BG] Failed to send connect message:', error);
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
  console.log('[Witch BG] Received message:', message.type, 'from:', sender.url ? 'offscreen' : 'popup/content');
  
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
    
    ensureOffscreenAndConnect();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'get_status') {
    console.log('[Witch BG] Status request - connected:', isConnected, 'url:', serverUrl);
    sendResponse({ connected: isConnected, serverUrl });
    return true;
  }
  
  if (message.type === 'game_event') {
    chrome.runtime.sendMessage({ type: 'send', data: message.data }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'reconnect') {
    console.log('[Witch BG] Manual reconnect requested');
    ensureOffscreenAndConnect();
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
    console.log('[Witch BG] Checking offscreen document...');
    const exists = await hasOffscreenDocument();
    if (!exists) {
      console.log('[Witch BG] Offscreen document gone, recreating...');
      ensureOffscreenAndConnect();
    }
  }
}, 30000);
