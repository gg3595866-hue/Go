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

  // Track Play button clicks to tag the immediately-following API response
  let playButtonClickedAt = 0;
  let lastCellClickedAt = 0;
  let lastCellClickedElement = null;
  let cellTimings = []; // { row, cell, clickTime, resolveTime, elapsedMs, result }

  // Track cell click timing via document-level listener (capture phase = fires first)
  document.addEventListener('click', function(e) {
    const target = e.target;
    if (!target) return;
    const el = target.closest ? target.closest('[class*="witch-game__box"], [class*="box"], [class*="cell"]') : null;
    if (el) {
      lastCellClickedAt = Date.now();
      lastCellClickedElement = el;
      console.log('%c[WITCH TIMING] Cell clicked at:', 'color: #ff00ff;', Date.now());
    }
    // Detect Play/Start button
    const playEl = target.closest ? target.closest('[class*="play"], [class*="start"], [class*="btn"]') : null;
    if (playEl) {
      const classList = (playEl.className || '').toLowerCase();
      const txt = (playEl.textContent || '').trim().toLowerCase();
      if (classList.includes('play') || classList.includes('start') || txt.includes('play')) {
        playButtonClickedAt = Date.now();
        console.log('%c[WITCH TIMING] PLAY BUTTON CLICKED — tagging next response', 'color: #ff00ff; font-weight: bold;');
        sendToContentScript('play_button_clicked', { timestamp: getTimestamp() });
      }
    }
  }, true);

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
        
        // Check if this response came within 3 seconds of Play button click
        const msSincePlayClick = Date.now() - playButtonClickedAt;
        const isPlayResponse = playButtonClickedAt > 0 && msSincePlayClick < 3000;
        if (isPlayResponse) {
          playButtonClickedAt = 0; // reset so only first response is tagged
          console.log('%c[WITCH TIMING] *** PLAY RESPONSE CAPTURED ***', 'color: #ff00ff; font-weight: bold; font-size: 14px;');
          console.log('[WITCH TIMING] URL:', url);
          console.log('[WITCH TIMING] Body:', JSON.stringify(parsedBody).substring(0, 500));
        }

        const capturedResponse = {
          id: requestId,
          type: 'fetch_response',
          url: url,
          status: response.status,
          statusText: response.statusText,
          headers: extractHeaders(response.headers),
          body: parsedBody,
          rawText: text,
          bodyLength: text.length,
          timestamp: getTimestamp(),
          isGameRelated: capturedRequest.isGameRelated,
          isPlayResponse: isPlayResponse,
          msSincePlayClick: msSincePlayClick < 30000 ? msSincePlayClick : null
        };

        MIMICK_SPY.capturedResponses.push(capturedResponse);
        sendToContentScript('network_response', capturedResponse);

        if (isPlayResponse) {
          // Send special event for Play response so webapp can highlight it
          sendToContentScript('play_response_captured', {
            url: url,
            status: response.status,
            body: parsedBody,
            rawText: text.substring(0, 2000),
            timestamp: getTimestamp()
          });
        }

        // Always try to capture solution grid from ANY response — the Play response
        // may not have a "game related" URL but contains RS[0].F grid data
        processResponseForSolutionGrid(capturedResponse);
        if (capturedRequest.isGameRelated || isPlayResponse) {
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

        // Always scan ALL responses for the RS[0].F grid — not just game-related
        processResponseForSolutionGrid(capturedResponse);
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

  // ========== ADVANCED BINARY DECODING UTILITIES ==========
  
  // Decode ArrayBuffer to various formats
  function decodeArrayBuffer(buffer) {
    const results = [];
    const uint8 = new Uint8Array(buffer);
    
    // Try as UTF-8 string
    try {
      const decoder = new TextDecoder('utf-8');
      const str = decoder.decode(buffer);
      if (str && str.length > 0) {
        results.push({ type: 'utf8', data: str });
        // Try parsing as JSON
        try {
          const json = JSON.parse(str);
          results.push({ type: 'json', data: json });
        } catch (e) {}
      }
    } catch (e) {}
    
    // Check for gzip magic bytes (1f 8b)
    if (uint8.length > 2 && uint8[0] === 0x1f && uint8[1] === 0x8b) {
      try {
        const decompressed = decompressGzip(uint8);
        if (decompressed) {
          results.push({ type: 'gzip', data: decompressed });
        }
      } catch (e) {}
    }
    
    // Check for zlib magic bytes (78 9c, 78 da, 78 01)
    if (uint8.length > 2 && uint8[0] === 0x78 && (uint8[1] === 0x9c || uint8[1] === 0xda || uint8[1] === 0x01)) {
      try {
        const decompressed = decompressZlib(uint8);
        if (decompressed) {
          results.push({ type: 'zlib', data: decompressed });
        }
      } catch (e) {}
    }
    
    // Try msgpack-like decoding (look for array markers)
    if (uint8.length > 10) {
      try {
        const msgpackResult = tryDecodeMsgpack(uint8);
        if (msgpackResult) {
          results.push({ type: 'msgpack', data: msgpackResult });
        }
      } catch (e) {}
    }
    
    // Try to find boolean arrays in raw bytes
    const boolArrays = extractBooleanArraysFromBytes(uint8);
    if (boolArrays.length > 0) {
      results.push({ type: 'bool_arrays', data: boolArrays });
    }
    
    return results;
  }
  
  // Simple gzip decompression using pako-like approach
  function decompressGzip(data) {
    // This is a simplified approach - real gzip needs pako library
    // For now, try to extract readable content after header
    try {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      // Skip gzip header and try to decode
      const content = decoder.decode(data.slice(10));
      if (content.includes('[') || content.includes('{')) {
        return content;
      }
    } catch (e) {}
    return null;
  }
  
  function decompressZlib(data) {
    try {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const content = decoder.decode(data.slice(2));
      if (content.includes('[') || content.includes('{')) {
        return content;
      }
    } catch (e) {}
    return null;
  }
  
  // Try to decode msgpack-like binary format
  function tryDecodeMsgpack(uint8) {
    const results = [];
    
    // Look for fixarray markers (0x90 - 0x9f = array of 0-15 elements)
    for (let i = 0; i < uint8.length - 10; i++) {
      const byte = uint8[i];
      
      // fixarray of 5 elements (0x95) - could be a row
      if (byte === 0x95) {
        const row = [];
        let valid = true;
        for (let j = 0; j < 5 && valid; j++) {
          const val = uint8[i + 1 + j];
          if (val === 0xc3) row.push(true);      // msgpack true
          else if (val === 0xc2) row.push(false); // msgpack false
          else valid = false;
        }
        if (valid && row.length === 5) {
          results.push(row);
        }
      }
      
      // array16 marker (0xdc) followed by size
      if (byte === 0xdc && i + 2 < uint8.length) {
        const size = (uint8[i + 1] << 8) | uint8[i + 2];
        if (size >= 5 && size <= 10) {
          console.log(`%c[WITCH BINARY] Found array16 marker, size: ${size}`, 'color: #ff00ff;');
        }
      }
    }
    
    return results.length >= 5 ? results : null;
  }
  
  // Extract boolean arrays from raw bytes
  function extractBooleanArraysFromBytes(uint8) {
    const rows = [];
    
    // Pattern 1: Sequential 0x00/0x01 bytes (raw booleans)
    for (let i = 0; i <= uint8.length - 5; i++) {
      let valid = true;
      const row = [];
      for (let j = 0; j < 5; j++) {
        const val = uint8[i + j];
        if (val === 0 || val === 1) {
          row.push(val === 1);
        } else {
          valid = false;
          break;
        }
      }
      if (valid) {
        rows.push({ offset: i, row });
      }
    }
    
    // Pattern 2: msgpack-style booleans (0xc2=false, 0xc3=true)
    for (let i = 0; i <= uint8.length - 5; i++) {
      let valid = true;
      const row = [];
      for (let j = 0; j < 5; j++) {
        const val = uint8[i + j];
        if (val === 0xc2) row.push(false);
        else if (val === 0xc3) row.push(true);
        else { valid = false; break; }
      }
      if (valid) {
        rows.push({ offset: i, row, type: 'msgpack' });
      }
    }
    
    // Look for 10 consecutive rows of 5 booleans
    if (rows.length >= 10) {
      // Check for consecutive offsets
      for (let i = 0; i <= rows.length - 10; i++) {
        const group = rows.slice(i, i + 10);
        const offsets = group.map(r => r.offset);
        const isConsecutive = offsets.every((off, idx) => idx === 0 || off === offsets[idx - 1] + 5);
        if (isConsecutive) {
          return group.map(r => r.row);
        }
      }
    }
    
    return [];
  }

  const originalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    const wsId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const isGameRelated = url.includes('witch') || url.includes('game') || url.includes('bet') || url.includes('1x');
    
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
      let decodedFormats = [];
      
      try {
        if (typeof data === 'string') {
          parsedData = JSON.parse(data);
        } else if (data instanceof ArrayBuffer) {
          decodedFormats = decodeArrayBuffer(data);
          parsedData = decodedFormats.length > 0 ? decodedFormats : '[Binary ArrayBuffer]';
        } else if (data instanceof Blob) {
          parsedData = '[Binary Blob]';
        }
      } catch (e) {}
      
      const wsMessage = {
        id: wsId,
        direction: 'outgoing',
        data: parsedData,
        raw: typeof data === 'string' ? data : `[Binary ${data.byteLength || data.size || 0} bytes]`,
        decodedFormats: decodedFormats,
        timestamp: getTimestamp(),
        isGameRelated: isGameRelated
      };
      
      MIMICK_SPY.capturedWebSockets.push(wsMessage);
      sendToContentScript('websocket_message', wsMessage);
      
      return originalSend(data);
    };

    ws.addEventListener('message', function(event) {
      let parsedData = event.data;
      let decodedFormats = [];
      let rawDescription = '';
      
      try {
        if (typeof event.data === 'string') {
          rawDescription = event.data.substring(0, 500);
          try {
            parsedData = JSON.parse(event.data);
            // Scan JSON WebSocket text messages for RS[0].F grid
            processResponseForSolutionGrid({ body: parsedData, url: url, rawText: event.data });
          } catch (e) {
            parsedData = event.data;
          }
        } else if (event.data instanceof ArrayBuffer) {
          rawDescription = `[ArrayBuffer ${event.data.byteLength} bytes]`;
          decodedFormats = decodeArrayBuffer(event.data);
          console.log(`%c[WITCH WS] Binary message received: ${event.data.byteLength} bytes, decoded ${decodedFormats.length} formats`, 'color: #ff00ff;');
          
          // Check decoded formats for solution grid
          for (const format of decodedFormats) {
            if (format.type === 'json' && format.data) {
              processResponseForSolutionGrid({ body: format.data, url: url });
            }
            if (format.type === 'bool_arrays' && format.data.length >= 5) {
              console.log('%c[WITCH WS] Found boolean arrays in binary data!', 'color: #00ff00; font-weight: bold;');
              processBinaryBooleanGrid(format.data);
            }
            if (format.type === 'msgpack' && format.data) {
              console.log('%c[WITCH WS] Found msgpack data!', 'color: #00ff00; font-weight: bold;');
              processBinaryBooleanGrid(format.data);
            }
          }
          
          parsedData = decodedFormats.length > 0 ? decodedFormats : '[Binary]';
        } else if (event.data instanceof Blob) {
          rawDescription = `[Blob ${event.data.size} bytes]`;
          // Read blob as ArrayBuffer
          event.data.arrayBuffer().then(buffer => {
            const formats = decodeArrayBuffer(buffer);
            console.log(`%c[WITCH WS] Blob decoded: ${formats.length} formats`, 'color: #ff00ff;');
            for (const format of formats) {
              if (format.type === 'json' && format.data) {
                processResponseForSolutionGrid({ body: format.data, url: url });
              }
              if (format.type === 'bool_arrays' && format.data.length >= 5) {
                processBinaryBooleanGrid(format.data);
              }
            }
          }).catch(() => {});
          parsedData = '[Blob - async decode]';
        }
      } catch (e) {
        console.log('%c[WITCH WS] Decode error:', 'color: #ff0000;', e);
      }
      
      const wsMessage = {
        id: wsId,
        direction: 'incoming',
        data: parsedData,
        raw: rawDescription || (typeof event.data === 'string' ? event.data : '[Binary]'),
        decodedFormats: decodedFormats,
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
  
  // Process binary boolean grid
  function processBinaryBooleanGrid(grid) {
    if (!grid || !Array.isArray(grid) || grid.length < 5) return;
    
    capturedSolutionGrid = grid;
    lastGridCaptureTime = Date.now();
    
    console.log('%c[WITCH BINARY] ========== BINARY SOLUTION GRID CAPTURED! ==========', 'color: #00ff00; font-weight: bold; font-size: 16px;');
    console.log('%c[WITCH BINARY] Grid:', 'color: #00ff00;', capturedSolutionGrid);
    
    capturedSolutionGrid.forEach((row, rowIdx) => {
      const safeCells = row.map((v, i) => v ? i + 1 : null).filter(v => v !== null);
      console.log(`%c[WITCH BINARY] Row ${rowIdx + 1}: Safe cells = [${safeCells.join(', ')}]`, 'color: #00ffff;');
    });
    
    sendToContentScript('solution_grid_captured', {
      grid: capturedSolutionGrid,
      source: 'binary',
      timestamp: getTimestamp(),
      rowCount: capturedSolutionGrid.length
    });
  }
  
  // ========== HOOK JSON.parse TO CAPTURE DECODED DATA ==========
  const originalJSONParse = JSON.parse;
  JSON.parse = function(text, reviver) {
    const result = originalJSONParse.call(this, text, reviver);
    
    // Check if this looks like game data
    if (result && typeof result === 'object') {
      // Delayed processing to avoid blocking
      setTimeout(() => {
        try {
          processResponseForSolutionGrid({ body: result, url: 'json.parse' });
        } catch (e) {}
      }, 0);
    }
    
    return result;
  };
  
  // ========== HOOK atob TO CAPTURE BASE64 DECODED DATA ==========
  const originalAtob = window.atob;
  window.atob = function(encodedData) {
    const result = originalAtob.call(this, encodedData);
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(result);
      if (parsed && typeof parsed === 'object') {
        setTimeout(() => {
          processResponseForSolutionGrid({ body: parsed, url: 'atob' });
        }, 0);
      }
    } catch (e) {}
    
    return result;
  };

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
  console.log('[Mimick Spy] Injected script initialized - v8.0');

  // ========== CELL TIMING MEASUREMENT ==========
  // MutationObserver to measure time from cell click → DOM result update
  // This is the timing attack: safe cells may respond faster or slower than poison cells
  (function setupTimingObserver() {
    let pendingCellTiming = null; // { el, clickTime }
    
    // Override cell click tracking with more precise data
    document.addEventListener('click', function(e) {
      const cell = e.target.closest ? e.target.closest('[class*="witch-game__box"]') : null;
      if (cell) {
        pendingCellTiming = { el: cell, clickTime: Date.now(), classAtClick: cell.className };
        console.log('%c[TIMING PROBE] Cell click recorded:', 'color: #ff88ff;', {
          class: cell.className.substring(0, 60),
          time: Date.now()
        });
      }
    }, true);

    const timingObserver = new MutationObserver(function(mutations) {
      if (!pendingCellTiming) return;
      
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes' && mutation.type !== 'childList') continue;
        
        const target = mutation.target;
        const classList = target.className || '';
        
        // Check if a cell just received a result (poison or win class added)
        const hasResult = classList.includes('poison') || classList.includes('w-lose') || 
                          classList.includes('wine') || classList.includes('w-win') ||
                          classList.includes('is-open') || classList.includes('open');
        const wasResultAttr = mutation.type === 'attributes' && 
                              mutation.attributeName === 'data-result' && 
                              target.getAttribute('data-result');
        
        if (hasResult || wasResultAttr) {
          const elapsedMs = Date.now() - pendingCellTiming.clickTime;
          const result = classList.includes('poison') || classList.includes('w-lose') ? 'LOSE' : 'WIN';
          const dataResult = target.getAttribute ? target.getAttribute('data-result') : null;
          
          const timing = {
            clickTime: pendingCellTiming.clickTime,
            resolveTime: Date.now(),
            elapsedMs: elapsedMs,
            result: dataResult || result,
            cellClass: classList.substring(0, 80)
          };
          
          cellTimings.push(timing);
          
          console.log(`%c[TIMING PROBE] Cell resolved in ${elapsedMs}ms — Result: ${timing.result}`,
            timing.result === 'WIN' || timing.result === 'win' ? 'color: #00ff00; font-weight: bold;' : 'color: #ff4444; font-weight: bold;');
          
          sendToContentScript('cell_timing', timing);
          pendingCellTiming = null; // reset for next click
        }
      }
    });

    if (document.body) {
      timingObserver.observe(document.body, { 
        subtree: true, 
        attributes: true, 
        attributeFilter: ['class', 'data-result'],
        childList: true
      });
    }
    
    console.log('%c[TIMING PROBE] Cell timing observer ready', 'color: #ff88ff;');
  })();

  // Expose timing data
  window.WITCH_TIMINGS = {
    getTimings: () => [...cellTimings],
    clearTimings: () => { cellTimings = []; },
    getStats: () => {
      if (cellTimings.length === 0) return { count: 0 };
      const wins = cellTimings.filter(t => t.result === 'WIN' || t.result === 'win');
      const losses = cellTimings.filter(t => t.result === 'LOSE' || t.result === 'lose');
      const avgWin = wins.length ? wins.reduce((a, b) => a + b.elapsedMs, 0) / wins.length : 0;
      const avgLoss = losses.length ? losses.reduce((a, b) => a + b.elapsedMs, 0) / losses.length : 0;
      return {
        count: cellTimings.length,
        wins: wins.length,
        losses: losses.length,
        avgWinMs: Math.round(avgWin),
        avgLossMs: Math.round(avgLoss),
        timingDeltaMs: Math.round(avgLoss - avgWin),
        allTimings: cellTimings
      };
    }
  };

  // ========== SOLUTION GRID CAPTURE SYSTEM ==========
  // Confirmed format from 1xbet Witch game:
  //   response.body.RS[0].F  →  array of 10 rows × 5 booleans
  //   true  = SAFE cell (click this)
  //   false = LOSING cell (avoid this)
  let capturedSolutionGrid = null;
  let lastGridCaptureTime = 0;

  function parseSolutionGrid(body) {
    if (!body) return null;

    // ===== STEP 1: Known 1xbet format: body.RS[0].F =====
    try {
      // Uppercase keys (confirmed format from screenshot)
      if (body.RS && Array.isArray(body.RS) && body.RS.length > 0) {
        const rs0 = body.RS[0];
        if (rs0 && rs0.F && Array.isArray(rs0.F) && rs0.F.length >= 5) {
          const grid = rs0.F;
          if (grid.every(function(row) {
            return Array.isArray(row) && row.length === 5 &&
                   row.every(function(v) { return typeof v === 'boolean'; });
          })) {
            console.log('%c[WITCH GRID] ★★★ FOUND RS[0].F — 1xbet Witch grid! ★★★',
              'color: #00ff00; font-weight: bold; font-size: 18px; background: #003300;');
            return grid;
          }
        }
      }
      // Lowercase keys variant
      if (body.rs && Array.isArray(body.rs) && body.rs.length > 0) {
        const rs0 = body.rs[0];
        if (rs0) {
          const fField = rs0.F || rs0.f;
          if (fField && Array.isArray(fField) && fField.length >= 5) {
            const isGrid = fField.every(function(row) {
              return Array.isArray(row) && row.length === 5 &&
                     row.every(function(v) { return typeof v === 'boolean'; });
            });
            if (isGrid) return fField;
          }
        }
      }
    } catch(e) {}

    // ===== STEP 2: Generic deep search (fixed — uses for loops not forEach) =====
    function deepSearch(obj, depth) {
      if (depth > 10 || !obj || typeof obj !== 'object') return null;

      if (Array.isArray(obj)) {
        // Check if this array IS a 5–15 row boolean grid
        if (obj.length >= 5 && obj.length <= 15) {
          var boolRows = [];
          for (var i = 0; i < obj.length; i++) {
            var row = obj[i];
            if (Array.isArray(row) && row.length === 5) {
              var allBool = true;
              for (var j = 0; j < row.length; j++) {
                if (typeof row[j] !== 'boolean') { allBool = false; break; }
              }
              if (allBool) boolRows.push(row);
            }
          }
          if (boolRows.length >= 5) {
            console.log('%c[WITCH GRID] Deep search found ' + boolRows.length + ' boolean rows!',
              'color: #00ff00; font-weight: bold;');
            return boolRows;
          }
        }
        // Recurse into array items (for loop — propagates return correctly)
        for (var i = 0; i < obj.length; i++) {
          var result = deepSearch(obj[i], depth + 1);
          if (result) return result;
        }
      } else {
        // Recurse into object properties (for loop — propagates return correctly)
        var keys = Object.keys(obj);
        for (var k = 0; k < keys.length; k++) {
          var result = deepSearch(obj[keys[k]], depth + 1);
          if (result) return result;
        }
      }
      return null;
    }

    var grid = deepSearch(body, 0);
    if (grid) return grid;

    // ===== STEP 3: Try base64 decode on any string values =====
    if (typeof body === 'object' && !Array.isArray(body)) {
      var vals = Object.values(body);
      for (var vi = 0; vi < vals.length; vi++) {
        var val = vals[vi];
        if (typeof val === 'string' && val.length > 20 && val.length < 5000) {
          try {
            var decoded = atob(val);
            var parsed = JSON.parse(decoded);
            var g = parseSolutionGrid(parsed);
            if (g) return g;
          } catch(e) {}
        }
      }
    }

    return null;
  }

  // Process any response body to extract solution grid.
  // Runs on ALL responses (not just game-related) to ensure we don't miss the Play response.
  function processResponseForSolutionGrid(response) {
    // Try parsed body first
    var bodyToCheck = response.body;
    var rawToCheck = response.rawText;

    // Also try parsing rawText if body is a plain string
    if (bodyToCheck && typeof bodyToCheck === 'string') {
      try { bodyToCheck = JSON.parse(bodyToCheck); } catch(e) {}
    }
    if (!bodyToCheck && rawToCheck) {
      try { bodyToCheck = JSON.parse(rawToCheck); } catch(e) {}
    }
    if (!bodyToCheck) return;

    var grid = parseSolutionGrid(bodyToCheck);
    if (grid && grid.length >= 5) {
      capturedSolutionGrid = grid;
      lastGridCaptureTime = Date.now();

      console.log('%c[WITCH GRID] ========== SOLUTION GRID CAPTURED! ==========',
        'color: #00ff00; font-weight: bold; font-size: 18px; background: #002200;');
      console.log('%c[WITCH GRID] Source URL:', 'color: #ffff00;', response.url || 'unknown');

      // Log each row's safe cells clearly
      for (var rowIdx = 0; rowIdx < capturedSolutionGrid.length; rowIdx++) {
        var row = capturedSolutionGrid[rowIdx];
        var safeCells = [];
        for (var ci = 0; ci < row.length; ci++) {
          if (row[ci]) safeCells.push(ci + 1);
        }
        console.log(
          '%c[WITCH GRID] Row ' + (rowIdx + 1) + ': CLICK any of cells [' + safeCells.join(', ') + ']',
          'color: #00ffff; font-weight: bold;'
        );
      }

      // Send to webapp via WebSocket
      sendToContentScript('solution_grid_captured', {
        grid: capturedSolutionGrid,
        source: response.url || 'unknown',
        timestamp: getTimestamp(),
        rowCount: capturedSolutionGrid.length
      });
    }
  }

  // ========== RETROACTIVE SCAN ==========
  // If the Play response was already captured before this system initialized,
  // scan all stored responses now to find the grid.
  function scanAllCapturedForGrid() {
    if (capturedSolutionGrid) return; // already have it
    console.log('%c[WITCH GRID] Retroactive scan — checking all captured responses for RS[0].F...',
      'color: #ffff00; font-weight: bold;');
    var all = MIMICK_SPY.capturedResponses || [];
    for (var i = 0; i < all.length; i++) {
      processResponseForSolutionGrid(all[i]);
      if (capturedSolutionGrid) break;
    }
    if (!capturedSolutionGrid) {
      console.log('%c[WITCH GRID] Retroactive scan: no grid found in ' + all.length + ' responses (need to click Play)',
        'color: #ffaa00;');
    }
  }
  // Run retroactive scan after a short delay
  setTimeout(scanAllCapturedForGrid, 500);

  // Expose manual grid access on window for debugging
  window.WITCH_GRID = {
    getGrid: function() { return capturedSolutionGrid; },
    clearGrid: function() { capturedSolutionGrid = null; },
    scan: scanAllCapturedForGrid,
    parse: parseSolutionGrid,
    getSafeCell: function(rowIndex) {
      if (!capturedSolutionGrid || rowIndex >= capturedSolutionGrid.length) return null;
      var row = capturedSolutionGrid[rowIndex];
      for (var i = 0; i < row.length; i++) {
        if (row[i] === true) return i; // first safe cell index (0-based)
      }
      return null;
    }
  };
  console.log('%c[WITCH GRID] Grid capture system ready. window.WITCH_GRID exposed for debugging.',
    'color: #00ff88; font-weight: bold;');

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

  // Find the active row on the real 1xbet game (has yellow/gold border or highlighted)
  function findActiveRowElement() {
    // Look for rows with active indicator (yellow border, active class, etc.)
    const selectors = [
      '.witch-game__row--is-active',
      '[class*="witch-game__row"][class*="active"]',
      '[class*="row"][class*="active"]',
      '[class*="row"][style*="border"]',
      '[class*="row"][style*="yellow"]',
      '[class*="row"][style*="gold"]'
    ];
    
    for (const selector of selectors) {
      const row = document.querySelector(selector);
      if (row) return row;
    }
    
    // Fallback: find row that contains clickable/unrevealed cells
    // On 1xbet, only the active row's cells are interactable
    const allRows = document.querySelectorAll('[class*="witch-game__row"], [class*="row"]');
    for (const row of allRows) {
      const cells = row.querySelectorAll('[class*="witch-game__box"]');
      if (cells.length > 0) {
        const hasUnrevealed = Array.from(cells).some(cell => isUnrevealedCell(cell));
        if (hasUnrevealed) return row;
      }
    }
    
    return null;
  }

  function findActiveRowCells() {
    const activeRow = findActiveRowElement();
    if (activeRow) {
      const cells = activeRow.querySelectorAll('[class*="witch-game__box"]');
      return Array.from(cells);
    }
    // Fallback to all cells (for real 1xbet where only active row cells are shown)
    return findAllGameCells();
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
      
      // Re-scan for cells each time - only from ACTIVE ROW
      const freshCells = findActiveRowCells();
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
          
          // ===== SMART CLICK vs RANDOM ATTACK =====
          const rowIndex = totalRowsClicked - 1; // 0-indexed for grid
          let safeCellIndices = [];
          let usingSolutionGrid = false;

          if (capturedSolutionGrid && rowIndex < capturedSolutionGrid.length) {
            const rowSolution = capturedSolutionGrid[rowIndex];
            if (rowSolution && Array.isArray(rowSolution)) {
              for (let si = 0; si < rowSolution.length; si++) {
                if (rowSolution[si] === true) safeCellIndices.push(si);
              }
              if (safeCellIndices.length > 0) usingSolutionGrid = true;
            }
          }

          if (usingSolutionGrid) {
            // ===== SMART MODE: Click EXACTLY ONE safe cell =====
            console.log(`%c[WITCH AUTO] ★ SMART MODE ★ Row ${totalRowsClicked}: Safe cell indices [${safeCellIndices.join(', ')}] → clicking cell ${safeCellIndices[0] + 1}`,
              'color: #00ff00; font-weight: bold; font-size: 14px; background: #002200;');

            const timeoutId = setTimeout(() => {
              if (gameEndedMaster) return;
              const allRowCells = findActiveRowCells();
              // Pick the first safe cell index
              const safeIdx = safeCellIndices[0];
              let targetCell = null;
              if (safeIdx < allRowCells.length) {
                targetCell = allRowCells[safeIdx];
                console.log(`%c[WITCH AUTO] SMART CLICK → Cell ${safeIdx + 1} (confirmed SAFE by RS[0].F grid)`,
                  'color: #00ff00; font-weight: bold;');
              } else {
                // Index mismatch fallback
                targetCell = unrevealed[0];
                console.log('%c[WITCH AUTO] Index mismatch — clicking first unrevealed', 'color: #ffff00;');
              }
              if (targetCell) {
                targetCell.click();
                sendToContentScript('auto_cell_clicked', {
                  row: totalRowsClicked,
                  clickNum: 1,
                  usedSolutionGrid: true,
                  safeIdx: safeIdx,
                  timestamp: getTimestamp()
                });
              }
            }, 100);
            pendingClickTimeouts.push(timeoutId);

          } else {
            // ===== RANDOM MODE: Racing attack (no grid available yet) =====
            const clickCount = Math.min(4, unrevealed.length);
            console.log(`%c[WITCH AUTO] RANDOM MODE Row ${totalRowsClicked}: clicking ${clickCount} random cells (no grid yet)`,
              'color: #ffaa00; font-weight: bold;');

            for (let i = 0; i < clickCount; i++) {
              const timeoutId = setTimeout(() => {
                if (gameEndedMaster) return;
                const targetCell = unrevealed[Math.floor(Math.random() * unrevealed.length)];
                if (targetCell) {
                  targetCell.click();
                  sendToContentScript('auto_cell_clicked', {
                    row: totalRowsClicked,
                    clickNum: i + 1,
                    usedSolutionGrid: false,
                    timestamp: getTimestamp()
                  });
                }
              }, i * 50);
              pendingClickTimeouts.push(timeoutId);
            }
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
    
    const activeRowCells = findActiveRowCells();
    const pageText = document.body.innerText || '';
    
    // Game is active when: cells exist AND page shows "Choose a cell"
    const isGameRunning = activeRowCells.length > 0 && pageText.includes('Choose a cell');
    
    if (isGameRunning) {
      racingAutoStarted = true;
      autoPlayEnabled = true;
      console.log('%c[WITCH AUTO] GAME RUNNING DETECTED!', 'color: #ffff00; font-weight: bold; font-size: 14px;');
      console.log(`%c[WITCH AUTO] Found ${activeRowCells.length} cells in active row`, 'color: #00ffff;');
      performRacingAttack();
      clearInterval(detectGameActiveInterval);
    }
  }, 500);
  
  // ========== END RACING ATTACK SYSTEM ==========
})();
