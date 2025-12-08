(function() {
  'use strict';
  
  const MIMICK_SPY = {
    capturedRequests: [],
    capturedResponses: [],
    capturedWebSockets: [],
    sessionTokens: {},
    gameFlows: [],
    currentFlow: null,
    isRecording: false
  };

  function getTimestamp() {
    return new Date().toISOString();
  }

  function sendToContentScript(type, data) {
    window.postMessage({
      source: 'mimick-spy-injected',
      type: type,
      data: data,
      timestamp: getTimestamp()
    }, '*');
  }

  function extractHeaders(headers) {
    if (!headers) return {};
    if (headers instanceof Headers) {
      const obj = {};
      headers.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }
    return headers;
  }

  function cloneRequestInit(init) {
    if (!init) return {};
    const cloned = {};
    if (init.method) cloned.method = init.method;
    if (init.headers) cloned.headers = extractHeaders(init.headers);
    if (init.body) {
      try {
        if (typeof init.body === 'string') {
          cloned.body = init.body;
          try { cloned.bodyParsed = JSON.parse(init.body); } catch(e) {}
        } else if (init.body instanceof FormData) {
          cloned.body = '[FormData]';
          cloned.bodyEntries = {};
          init.body.forEach((value, key) => {
            cloned.bodyEntries[key] = value instanceof File ? `[File: ${value.name}]` : value;
          });
        } else if (init.body instanceof Blob) {
          cloned.body = '[Blob]';
        } else if (init.body instanceof ArrayBuffer) {
          cloned.body = '[ArrayBuffer]';
        } else {
          cloned.body = String(init.body);
        }
      } catch (e) {
        cloned.body = '[Unable to clone body]';
      }
    }
    if (init.credentials) cloned.credentials = init.credentials;
    if (init.mode) cloned.mode = init.mode;
    if (init.cache) cloned.cache = init.cache;
    return cloned;
  }

  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const url = typeof input === 'string' ? input : input?.url || 'unknown';
    const method = init?.method || (input instanceof Request ? input.method : 'GET');
    
    const capturedRequest = {
      id: requestId,
      type: 'fetch',
      url: url,
      method: method,
      timestamp: getTimestamp(),
      init: cloneRequestInit(init),
      isGameRelated: url.includes('witch') || url.includes('game') || url.includes('bet') || url.includes('play')
    };

    MIMICK_SPY.capturedRequests.push(capturedRequest);
    sendToContentScript('network_request', capturedRequest);

    try {
      const response = await originalFetch.apply(this, arguments);
      const responseClone = response.clone();
      
      responseClone.text().then(text => {
        let parsedBody = text;
        try {
          parsedBody = JSON.parse(text);
        } catch (e) {}
        
        const capturedResponse = {
          id: requestId,
          type: 'fetch_response',
          url: url,
          status: response.status,
          statusText: response.statusText,
          headers: extractHeaders(response.headers),
          body: parsedBody,
          timestamp: getTimestamp(),
          isGameRelated: capturedRequest.isGameRelated
        };

        MIMICK_SPY.capturedResponses.push(capturedResponse);
        sendToContentScript('network_response', capturedResponse);

        if (capturedRequest.isGameRelated) {
          extractTokensFromResponse(capturedResponse);
        }
      }).catch(() => {});
      
      return response;
    } catch (error) {
      sendToContentScript('network_error', {
        id: requestId,
        url: url,
        error: error.message,
        timestamp: getTimestamp()
      });
      throw error;
    }
  };

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._mimickSpy = {
      id: `xhr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      method: method,
      url: url,
      headers: {},
      timestamp: getTimestamp(),
      isGameRelated: url.includes('witch') || url.includes('game') || url.includes('bet') || url.includes('play')
    };
    return originalXHROpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (this._mimickSpy) {
      this._mimickSpy.headers[name] = value;
    }
    return originalXHRSetRequestHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const xhr = this;
    const spyData = this._mimickSpy;
    
    if (spyData) {
      spyData.body = body;
      try {
        if (typeof body === 'string') {
          spyData.bodyParsed = JSON.parse(body);
        }
      } catch (e) {}
      
      MIMICK_SPY.capturedRequests.push(spyData);
      sendToContentScript('network_request', { ...spyData, type: 'xhr' });

      xhr.addEventListener('load', function() {
        let responseBody = xhr.responseText;
        try {
          responseBody = JSON.parse(xhr.responseText);
        } catch (e) {}
        
        const capturedResponse = {
          id: spyData.id,
          type: 'xhr_response',
          url: spyData.url,
          status: xhr.status,
          statusText: xhr.statusText,
          headers: xhr.getAllResponseHeaders(),
          body: responseBody,
          timestamp: getTimestamp(),
          isGameRelated: spyData.isGameRelated
        };

        MIMICK_SPY.capturedResponses.push(capturedResponse);
        sendToContentScript('network_response', capturedResponse);

        if (spyData.isGameRelated) {
          extractTokensFromResponse(capturedResponse);
        }
      });

      xhr.addEventListener('error', function() {
        sendToContentScript('network_error', {
          id: spyData.id,
          url: spyData.url,
          error: 'XHR Error',
          timestamp: getTimestamp()
        });
      });
    }
    
    return originalXHRSend.apply(this, arguments);
  };

  const originalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    const wsId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const isGameRelated = url.includes('witch') || url.includes('game') || url.includes('bet');
    
    sendToContentScript('websocket_created', {
      id: wsId,
      url: url,
      protocols: protocols,
      timestamp: getTimestamp(),
      isGameRelated: isGameRelated
    });

    const ws = protocols ? new originalWebSocket(url, protocols) : new originalWebSocket(url);
    
    const originalSend = ws.send.bind(ws);
    ws.send = function(data) {
      let parsedData = data;
      try {
        if (typeof data === 'string') {
          parsedData = JSON.parse(data);
        }
      } catch (e) {}
      
      const wsMessage = {
        id: wsId,
        direction: 'outgoing',
        data: parsedData,
        raw: typeof data === 'string' ? data : '[Binary]',
        timestamp: getTimestamp(),
        isGameRelated: isGameRelated
      };
      
      MIMICK_SPY.capturedWebSockets.push(wsMessage);
      sendToContentScript('websocket_message', wsMessage);
      
      return originalSend(data);
    };

    ws.addEventListener('message', function(event) {
      let parsedData = event.data;
      try {
        if (typeof event.data === 'string') {
          parsedData = JSON.parse(event.data);
        }
      } catch (e) {}
      
      const wsMessage = {
        id: wsId,
        direction: 'incoming',
        data: parsedData,
        raw: typeof event.data === 'string' ? event.data : '[Binary]',
        timestamp: getTimestamp(),
        isGameRelated: isGameRelated
      };
      
      MIMICK_SPY.capturedWebSockets.push(wsMessage);
      sendToContentScript('websocket_message', wsMessage);
    });

    ws.addEventListener('open', function() {
      sendToContentScript('websocket_open', { id: wsId, timestamp: getTimestamp() });
    });

    ws.addEventListener('close', function(event) {
      sendToContentScript('websocket_close', { 
        id: wsId, 
        code: event.code, 
        reason: event.reason,
        timestamp: getTimestamp() 
      });
    });

    ws.addEventListener('error', function() {
      sendToContentScript('websocket_error', { id: wsId, timestamp: getTimestamp() });
    });

    return ws;
  };
  window.WebSocket.prototype = originalWebSocket.prototype;
  window.WebSocket.CONNECTING = originalWebSocket.CONNECTING;
  window.WebSocket.OPEN = originalWebSocket.OPEN;
  window.WebSocket.CLOSING = originalWebSocket.CLOSING;
  window.WebSocket.CLOSED = originalWebSocket.CLOSED;

  function extractTokensFromResponse(response) {
    if (!response.body || typeof response.body !== 'object') return;
    
    const tokenKeys = ['token', 'csrf', 'session', 'auth', 'key', 'signature', 'hash', 'nonce'];
    
    function extractFromObject(obj, prefix = '') {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (tokenKeys.some(tk => key.toLowerCase().includes(tk))) {
          MIMICK_SPY.sessionTokens[fullKey] = value;
          sendToContentScript('token_captured', { key: fullKey, value: value });
        }
        
        if (typeof value === 'object' && value !== null) {
          extractFromObject(value, fullKey);
        }
      }
    }
    
    extractFromObject(response.body);
  }

  function scanDOMForTokens() {
    const tokens = {};
    
    document.querySelectorAll('input[type="hidden"]').forEach(input => {
      const name = input.name || input.id;
      if (name && input.value) {
        tokens[`hidden_${name}`] = input.value;
      }
    });

    document.querySelectorAll('meta[name*="csrf"], meta[name*="token"]').forEach(meta => {
      const name = meta.getAttribute('name');
      const content = meta.getAttribute('content');
      if (name && content) {
        tokens[`meta_${name}`] = content;
      }
    });

    document.querySelectorAll('script').forEach(script => {
      const text = script.textContent || '';
      const csrfMatch = text.match(/csrf[_-]?token['":\s]+['"]([^'"]+)['"]/i);
      if (csrfMatch) {
        tokens['script_csrf'] = csrfMatch[1];
      }
      const sessionMatch = text.match(/session[_-]?id['":\s]+['"]([^'"]+)['"]/i);
      if (sessionMatch) {
        tokens['script_session'] = sessionMatch[1];
      }
    });

    if (Object.keys(tokens).length > 0) {
      Object.assign(MIMICK_SPY.sessionTokens, tokens);
      sendToContentScript('dom_tokens', tokens);
    }
  }

  function captureGameState() {
    const gameRows = document.querySelectorAll('.witch-game__row');
    const gameState = {
      rows: [],
      isActive: false,
      currentActiveRow: -1,
      timestamp: getTimestamp()
    };

    gameRows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('.witch-game__box');
      const rowData = {
        index: rowIndex + 1,
        isActive: row.classList.contains('witch-game__row--is-active'),
        cells: []
      };

      if (rowData.isActive) {
        gameState.currentActiveRow = rowIndex + 1;
        gameState.isActive = true;
      }

      cells.forEach((cell, cellIndex) => {
        const result = cell.getAttribute('data-result');
        const isOpen = cell.classList.contains('witch-game__box--is-open');
        rowData.cells.push({
          index: cellIndex + 1,
          result: result || null,
          isOpen: isOpen,
          isWin: result === 'win',
          isLose: result === 'lose'
        });
      });

      gameState.rows.push(rowData);
    });

    return gameState;
  }

  window.MIMICK_SPY = {
    getData: () => ({
      requests: MIMICK_SPY.capturedRequests,
      responses: MIMICK_SPY.capturedResponses,
      websockets: MIMICK_SPY.capturedWebSockets,
      tokens: MIMICK_SPY.sessionTokens,
      gameFlows: MIMICK_SPY.gameFlows
    }),
    
    getTokens: () => ({ ...MIMICK_SPY.sessionTokens }),
    
    getGameState: captureGameState,
    
    startRecording: () => {
      MIMICK_SPY.isRecording = true;
      MIMICK_SPY.currentFlow = {
        id: `flow_${Date.now()}`,
        startTime: getTimestamp(),
        events: [],
        requests: [],
        results: []
      };
      sendToContentScript('recording_started', { flowId: MIMICK_SPY.currentFlow.id });
    },
    
    stopRecording: () => {
      MIMICK_SPY.isRecording = false;
      if (MIMICK_SPY.currentFlow) {
        MIMICK_SPY.currentFlow.endTime = getTimestamp();
        MIMICK_SPY.gameFlows.push(MIMICK_SPY.currentFlow);
        sendToContentScript('recording_stopped', MIMICK_SPY.currentFlow);
        MIMICK_SPY.currentFlow = null;
      }
    },
    
    clearData: () => {
      MIMICK_SPY.capturedRequests = [];
      MIMICK_SPY.capturedResponses = [];
      MIMICK_SPY.capturedWebSockets = [];
      MIMICK_SPY.gameFlows = [];
      sendToContentScript('data_cleared', {});
    },

    scanDOM: scanDOMForTokens
  };

  setTimeout(scanDOMForTokens, 1000);

  const domObserver = new MutationObserver(() => {
    scanDOMForTokens();
  });
  
  if (document.body) {
    domObserver.observe(document.body, { 
      childList: true, 
      subtree: true, 
      attributes: true,
      attributeFilter: ['value', 'content']
    });
  }

  sendToContentScript('injected_ready', { timestamp: getTimestamp() });
  console.log('[Mimick Spy] Injected script initialized - v7.0');

  // ========== RACING ATTACK AUTO-CLICK SYSTEM ==========
  // Based on working witch-extension-v4.3-FIXED logic
  let racingAttackActive = false;
  let racingAttackInterval = null;
  let autoPlayEnabled = false;
  let totalRowsClicked = 0;
  let successfulRows = 0;
  let lastCellCount = 0;
  let lastRowClicked = -1;
  let gameEndedMaster = false;
  let pendingClickTimeouts = [];

  function isUnrevealedCell(cell) {
    const classList = cell.classList.toString().toLowerCase();
    // Check for revealed cell states (poison/lose or wine/win)
    const hasPoison = classList.includes('poison') || classList.includes('w-lose');
    const hasWine = classList.includes('wine') || classList.includes('w-win');
    return !hasPoison && !hasWine; // Still unrevealed if neither
  }

  function isGameLost() {
    const pageText = document.body.innerText || '';
    return pageText.includes('Better luck next time') || 
           pageText.includes('GAME LOSS') || 
           pageText.includes('game is over') ||
           pageText.includes('You lost');
  }

  function isRowActive() {
    const pageText = document.body.innerText || '';
    return pageText.includes('Choose a cell');
  }

  function findAllGameCells() {
    // Use the same selector as the working extension
    const cells = document.querySelectorAll('[class*="witch-game__box"]');
    return Array.from(cells);
  }

  function stopRacingAttack() {
    gameEndedMaster = true;
    
    // Cancel ALL pending timeouts
    pendingClickTimeouts.forEach(id => clearTimeout(id));
    pendingClickTimeouts = [];
    
    if (racingAttackInterval) {
      clearInterval(racingAttackInterval);
      racingAttackInterval = null;
    }
    racingAttackActive = false;
    console.log(`%c[WITCH AUTO] Racing attack STOPPED - Final: ${successfulRows}/${totalRowsClicked} rows`, 'color: #ff6600; font-weight: bold;');
    sendToContentScript('auto_click_stopped', { totalRows: totalRowsClicked, successful: successfulRows });
  }

  function performRacingAttack() {
    if (racingAttackActive) return;
    racingAttackActive = true;
    gameEndedMaster = false;
    totalRowsClicked = 0;
    successfulRows = 0;
    lastCellCount = 0;
    lastRowClicked = -1;
    pendingClickTimeouts = [];
    
    console.log('%c[WITCH AUTO] RACING ATTACK STARTED - Syncing with game progression!', 'color: #00ff00; font-weight: bold; font-size: 16px;');
    sendToContentScript('auto_click_started', {});
    
    // Keep attacking rows continuously as they appear (same as working extension)
    racingAttackInterval = setInterval(() => {
      // MASTER KILL SWITCH - if game ended, don't do anything
      if (gameEndedMaster) return;
      
      // Re-scan for cells each time
      const freshCells = findAllGameCells();
      const pageText = document.body.innerText || '';
      
      // GAME END DETECTION
      if (isGameLost()) {
        gameEndedMaster = true;
        console.log('%c[WITCH AUTO] GAME ENDED - Cancelling all pending clicks!', 'color: #ff0000; font-weight: bold;');
        
        // Cancel ALL pending timeouts
        pendingClickTimeouts.forEach(id => clearTimeout(id));
        pendingClickTimeouts = [];
        
        // Stop the interval
        clearInterval(racingAttackInterval);
        racingAttackInterval = null;
        console.log(`%c[WITCH AUTO] FINAL SCORE: ${successfulRows}/${totalRowsClicked} rows cleared`, 'color: #ff6600; font-weight: bold; font-size: 14px;');
        racingAttackActive = false;
        sendToContentScript('auto_click_stopped', { totalRows: totalRowsClicked, successful: successfulRows });
        return;
      }
      
      // Check if we have cells AND "Choose a cell" is visible (row is active)
      const rowActive = pageText.includes('Choose a cell') && freshCells.length > 0;
      
      if (!rowActive) {
        return; // Wait for next row
      }
      
      // Detect NEW row by checking if cell count changed (previous row was revealed)
      const currentCellCount = freshCells.length;
      
      // Check if cells have unrevealed status (not wine/poison yet)
      const unrevealed = freshCells.filter(cell => isUnrevealedCell(cell));
      
      // Only attack if we have unrevealed cells and this is a new row
      if (unrevealed.length > 0) {
        const isNewRow = currentCellCount !== lastCellCount || lastRowClicked === -1;
        
        if (isNewRow && pageText.includes('Choose a cell')) {
          totalRowsClicked++;
          lastRowClicked = totalRowsClicked;
          lastCellCount = currentCellCount;
          
          // GRADUATED ATTACK STRATEGY based on game difficulty (same as working extension)
          let clickCount;
          let difficulty;
          
          const currentRow = totalRowsClicked - 1;
          if (currentRow <= 3) {
            clickCount = Math.min(4, unrevealed.length);
            difficulty = "EASY";
          } else if (currentRow <= 6) {
            clickCount = Math.min(5, unrevealed.length);
            difficulty = "MEDIUM";
          } else if (currentRow <= 8) {
            clickCount = Math.min(5, unrevealed.length);
            difficulty = "HARD";
          } else {
            clickCount = Math.min(5, unrevealed.length);
            difficulty = "EXTREME";
          }
          
          console.log(`%c[WITCH AUTO] Row ${totalRowsClicked} [${difficulty}]: Clicking ${clickCount} cells (${unrevealed.length} unrevealed)`, 'color: #ff3333; font-weight: bold;');
          
          // Click cells ULTRA-RAPID (25ms apart) - same as working extension
          for (let i = 0; i < clickCount; i++) {
            const timeoutId = setTimeout(() => {
              // CHECK KILL SWITCH before clicking
              if (gameEndedMaster) return;
              
              const randomCell = unrevealed[Math.floor(Math.random() * unrevealed.length)];
              if (randomCell) {
                console.log(`%c[WITCH AUTO] CLICK #${i + 1}`, 'color: #00ff00;');
                randomCell.click();
                
                sendToContentScript('auto_cell_clicked', {
                  row: totalRowsClicked,
                  clickNum: i + 1,
                  timestamp: getTimestamp()
                });
              }
            }, i * 25);
            
            // Track this timeout so we can cancel it if game ends
            pendingClickTimeouts.push(timeoutId);
          }
          
          // Wait and check result
          const checkResultId = setTimeout(() => {
            // CHECK KILL SWITCH before checking result
            if (gameEndedMaster) return;
            
            const resultPoison = document.querySelectorAll('[class*="poison"], [class*="w-lose"]');
            if (resultPoison.length === 0) {
              console.log(`%c[WITCH AUTO] Row ${totalRowsClicked}: SURVIVED!`, 'color: #00ff00; font-weight: bold;');
              successfulRows++;
            } else {
              console.log(`%c[WITCH AUTO] Row ${totalRowsClicked}: Poison hit`, 'color: #ff0000;');
            }
            // Reset for next row detection
            lastCellCount = 0;
          }, 2000);
          
          pendingClickTimeouts.push(checkResultId);
        }
      }
    }, 500); // Check every 500ms for more responsive detection (same as working extension)
    
    // Auto-stop after 120 seconds (safety timeout)
    setTimeout(() => {
      if (!gameEndedMaster) {
        gameEndedMaster = true;
        pendingClickTimeouts.forEach(id => clearTimeout(id));
        console.log('%c[WITCH AUTO] Safety timeout - stopping after 2 minutes', 'color: #ff6600; font-weight: bold;');
        stopRacingAttack();
      }
    }, 120000);
  }

  function startAutoClickIfGameActive() {
    if (!autoPlayEnabled) return;
    if (racingAttackActive) return;
    
    const cells = findAllGameCells();
    const pageText = document.body.innerText || '';
    
    // Game is active when: cells exist AND page shows "Choose a cell"
    const isGameRunning = cells.length > 0 && pageText.includes('Choose a cell');
    
    if (isGameRunning) {
      console.log('%c[WITCH AUTO] Game active detected - starting racing attack!', 'color: #ffff00; font-weight: bold;');
      performRacingAttack();
    }
  }

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'witch-content-script') return;
    
    const { command, data } = event.data;
    
    switch (command) {
      case 'set_auto_play':
        autoPlayEnabled = data.enabled;
        console.log(`%c[WITCH AUTO] Auto-play ${autoPlayEnabled ? 'ENABLED' : 'DISABLED'}`, 
                    `color: ${autoPlayEnabled ? '#00ff00' : '#ff0000'}; font-weight: bold;`);
        
        if (autoPlayEnabled) {
          gameEndedMaster = false;
          startAutoClickIfGameActive();
        } else {
          stopRacingAttack();
        }
        break;
        
      case 'start_play':
        if (autoPlayEnabled) {
          gameEndedMaster = false;
          console.log('%c[WITCH AUTO] Start play command received - initiating racing attack', 'color: #00ffff;');
          setTimeout(() => performRacingAttack(), 500);
        }
        break;
        
      case 'stop_play':
        stopRacingAttack();
        break;
    }
  });

  let autoStartCheckInterval = setInterval(() => {
    if (autoPlayEnabled && !racingAttackActive) {
      startAutoClickIfGameActive();
    }
  }, 1000);

  window.WITCH_AUTO = {
    startAttack: performRacingAttack,
    stopAttack: stopRacingAttack,
    setAutoPlay: (enabled) => { 
      autoPlayEnabled = enabled; 
      if (enabled) startAutoClickIfGameActive();
      else stopRacingAttack();
    },
    isActive: () => racingAttackActive,
    isAutoPlayEnabled: () => autoPlayEnabled
  };

  console.log('%c[WITCH AUTO] Racing Attack System Ready', 'color: lime; font-weight: bold;');
  
  // AUTO-START racing attack when game is actually active (same as working extension)
  let racingAutoStarted = false;
  
  const detectGameActiveInterval = setInterval(() => {
    if (racingAutoStarted) return;
    if (racingAttackActive) return;
    
    const cells = document.querySelectorAll('[class*="witch-game__box"]');
    const pageText = document.body.innerText || '';
    
    // Game is active when: cells exist AND page shows "Choose a cell"
    const isGameRunning = cells.length > 0 && pageText.includes('Choose a cell');
    
    if (isGameRunning) {
      racingAutoStarted = true;
      autoPlayEnabled = true;
      console.log('%c[WITCH AUTO] GAME RUNNING DETECTED - Starting racing attack NOW!', 'color: #ffff00; font-weight: bold; font-size: 14px;');
      performRacingAttack();
      clearInterval(detectGameActiveInterval);
    }
  }, 500);
  
  // ========== END RACING ATTACK SYSTEM ==========
})();
