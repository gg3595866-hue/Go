// Witch Analyzer v4.2 PRO - Background Service Worker
// Fixed Selectors Edition - Burp Suite-style network monitoring

const networkLog = {
  requests: [],
  maxEntries: 500
};

const gameDataLog = {
  rounds: [],
  currentRound: null
};

// Listen for web requests (Burp Suite-like monitoring)
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const entry = {
      id: details.requestId,
      timestamp: Date.now(),
      type: 'request',
      method: details.method,
      url: details.url,
      tabId: details.tabId,
      frameId: details.frameId,
      initiator: details.initiator,
      requestBody: details.requestBody
    };
    
    // Check for game-related URLs
    if (isGameRelatedUrl(details.url)) {
      entry.isGameRequest = true;
      console.log('[WITCH-BG] Game Request:', details.method, details.url);
    }
    
    addToNetworkLog(entry);
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    const entry = {
      id: details.requestId,
      timestamp: Date.now(),
      type: 'response',
      statusCode: details.statusCode,
      url: details.url,
      tabId: details.tabId,
      responseHeaders: details.responseHeaders
    };
    
    if (isGameRelatedUrl(details.url)) {
      entry.isGameResponse = true;
      console.log('[WITCH-BG] Game Response:', details.statusCode, details.url);
    }
    
    addToNetworkLog(entry);
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    const entry = {
      id: details.requestId,
      timestamp: Date.now(),
      type: 'error',
      error: details.error,
      url: details.url,
      tabId: details.tabId
    };
    
    addToNetworkLog(entry);
  },
  { urls: ["<all_urls>"] }
);

function isGameRelatedUrl(url) {
  const gamePatterns = [
    'games-frame',
    'witch',
    'game-api',
    'round',
    'bet',
    'play',
    'result',
    'event',
    '/api/',
    'analytics',
    'service-api'
  ];
  
  return gamePatterns.some(pattern => url.toLowerCase().includes(pattern));
}

function addToNetworkLog(entry) {
  networkLog.requests.unshift(entry);
  
  if (networkLog.requests.length > networkLog.maxEntries) {
    networkLog.requests.pop();
  }
  
  // Store in chrome.storage for popup access
  chrome.storage.local.set({
    networkLog: networkLog.requests.slice(0, 100)
  });
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ROUND_DATA') {
    console.log('[WITCH-BG] Round data received:', message.data);
    gameDataLog.rounds.unshift({
      ...message.data,
      tabId: sender.tab?.id,
      frameUrl: sender.url,
      timestamp: Date.now()
    });
    gameDataLog.currentRound = message.data;
    
    // Store for popup
    chrome.storage.local.set({
      gameRounds: gameDataLog.rounds.slice(0, 50),
      currentRound: gameDataLog.currentRound
    });
    
    sendResponse({ success: true });
  }
  
  if (message.type === 'GET_NETWORK_LOG') {
    const filtered = message.filter 
      ? networkLog.requests.filter(r => {
          if (message.filter === 'game') return r.isGameRequest || r.isGameResponse;
          if (message.filter === 'api') return r.url.includes('/api/');
          return true;
        })
      : networkLog.requests;
    
    sendResponse({ 
      requests: filtered.slice(0, 100),
      total: networkLog.requests.length
    });
  }
  
  if (message.type === 'GET_GAME_DATA') {
    sendResponse({
      rounds: gameDataLog.rounds.slice(0, 20),
      currentRound: gameDataLog.currentRound
    });
  }
  
  if (message.type === 'CLEAR_LOGS') {
    networkLog.requests = [];
    gameDataLog.rounds = [];
    gameDataLog.currentRound = null;
    chrome.storage.local.set({
      networkLog: [],
      gameRounds: [],
      currentRound: null
    });
    sendResponse({ success: true });
  }
  
  if (message.type === 'RS_DATA_CAPTURED') {
    console.log('[WITCH-BG] RS.F Data captured!', message.data);
    
    // Notify all tabs about the capture
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'RS_DATA_BROADCAST',
          data: message.data
        }).catch(() => {});
      });
    });
    
    sendResponse({ success: true });
  }
  
  return true; // Keep channel open for async response
});

// Log startup
console.log('[WITCH-BG] v4.2 PRO Background Service Worker started (FIXED SELECTORS)');
console.log('[WITCH-BG] Network monitoring: ACTIVE');
console.log('[WITCH-BG] Game data capture: ACTIVE');
console.log('[WITCH-BG] Selectors: witch-game__box, witch-game__row, w-game-box, w-game-row');
