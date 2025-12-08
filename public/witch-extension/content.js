let isPlaying = false;
let autoPlay = false;
let currentRow = 1;
let observer = null;
let lastCellCount = 0;
let pollInterval = null;
let networkLogs = [];
let eventLogs = [];
let autoClickInterval = null;
let lastClickedRow = 0;

const MIMICK_SPY_DATA = {
  capturedRequests: [],
  capturedResponses: [],
  capturedWebSockets: [],
  capturedTokens: {},
  gameFlows: [],
  currentGameSession: null,
  isRecording: false,
  replayQueue: [],
  isReplaying: false
};

function getTimestamp() {
  return new Date().toISOString().split('T')[1].slice(0, 12);
}

function log(message, data) {
  const timestamp = getTimestamp();
  const logEntry = { timestamp, message, data };
  eventLogs.push(logEntry);
  
  if (data !== undefined) {
    console.log(`[Witch ${timestamp}]`, message, data);
  } else {
    console.log(`[Witch ${timestamp}]`, message);
  }
}

function logDetailed(category, message, data) {
  const timestamp = getTimestamp();
  const prefix = `[Witch ${timestamp}] [${category}]`;
  
  if (data !== undefined) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
  
  sendGameEvent({
    type: 'detailed_log',
    category,
    message,
    data,
    timestamp
  });
}

function injectMimickSpy() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
      this.remove();
      log('Mimick Spy injected successfully');
    };
    script.onerror = function() {
      log('Failed to inject Mimick Spy script, using fallback');
      injectMimickSpyInline();
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (e) {
    log('Error injecting Mimick Spy:', e.message);
    injectMimickSpyInline();
  }
}

function injectMimickSpyInline() {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      const MIMICK_SPY = { capturedRequests: [], capturedResponses: [], sessionTokens: {} };
      
      const originalFetch = window.fetch;
      window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : input?.url || 'unknown';
        const method = init?.method || 'GET';
        
        window.postMessage({
          source: 'mimick-spy-injected',
          type: 'network_request',
          data: { url, method, timestamp: new Date().toISOString() }
        }, '*');
        
        const response = await originalFetch.apply(this, arguments);
        return response;
      };
      
      window.MIMICK_SPY = MIMICK_SPY;
      console.log('[Mimick Spy] Fallback injected');
    })();
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== 'mimick-spy-injected') return;
  
  const { type, data, timestamp } = event.data;
  
  switch (type) {
    case 'network_request':
      MIMICK_SPY_DATA.capturedRequests.push({ ...data, timestamp });
      if (data.isGameRelated) {
        logDetailed('NETWORK', `Game request: ${data.method} ${data.url}`, data);
        sendGameEvent({
          type: 'mimick_request',
          data: data
        });
      }
      break;
      
    case 'network_response':
      MIMICK_SPY_DATA.capturedResponses.push({ ...data, timestamp });
      if (data.isGameRelated) {
        logDetailed('NETWORK', `Game response: ${data.status} ${data.url}`, data);
        sendGameEvent({
          type: 'mimick_response',
          data: data
        });
      }
      break;
      
    case 'websocket_message':
      MIMICK_SPY_DATA.capturedWebSockets.push({ ...data, timestamp });
      if (data.isGameRelated) {
        logDetailed('WEBSOCKET', `WS ${data.direction}: ${typeof data.data === 'object' ? JSON.stringify(data.data) : data.data}`, data);
        sendGameEvent({
          type: 'mimick_websocket',
          data: data
        });
      }
      break;
      
    case 'token_captured':
      MIMICK_SPY_DATA.capturedTokens[data.key] = data.value;
      logDetailed('TOKEN', `Captured: ${data.key}`, data.value);
      sendGameEvent({
        type: 'mimick_token',
        data: data
      });
      break;
      
    case 'dom_tokens':
      Object.assign(MIMICK_SPY_DATA.capturedTokens, data);
      logDetailed('TOKEN', 'DOM tokens captured', data);
      sendGameEvent({
        type: 'mimick_dom_tokens',
        data: data
      });
      break;
      
    case 'recording_started':
      MIMICK_SPY_DATA.isRecording = true;
      MIMICK_SPY_DATA.currentGameSession = {
        id: data.flowId,
        startTime: timestamp,
        events: [],
        requests: [],
        results: []
      };
      logDetailed('RECORD', 'Recording started', data);
      sendGameEvent({
        type: 'recording_started',
        data: data
      });
      break;
      
    case 'recording_stopped':
      MIMICK_SPY_DATA.isRecording = false;
      MIMICK_SPY_DATA.gameFlows.push(data);
      logDetailed('RECORD', 'Recording stopped', data);
      sendGameEvent({
        type: 'recording_stopped',
        data: data
      });
      break;
      
    case 'injected_ready':
      logDetailed('INIT', 'Mimick Spy injected and ready', data);
      break;
  }
});

function sendGameEvent(eventData) {
  try {
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'game_event', data: eventData });
    }
  } catch (e) {
    log('Failed to send message:', e.message);
  }
}

function findGameCells() {
  return Array.from(document.querySelectorAll('.witch-game__box'));
}

function findGameRows() {
  return Array.from(document.querySelectorAll('.witch-game__row'));
}

function findActiveRow() {
  let activeRow = document.querySelector('.witch-game__row--is-active');
  if (activeRow) return activeRow;
  
  activeRow = document.querySelector('.witch-game__row.active');
  if (activeRow) return activeRow;
  
  activeRow = document.querySelector('[class*="witch-game"][class*="row"][class*="active"]');
  if (activeRow) return activeRow;
  
  activeRow = document.querySelector('[class*="row"][class*="is-active"]');
  if (activeRow) return activeRow;
  
  const rows = findGameRows();
  for (const row of rows) {
    const style = window.getComputedStyle(row);
    const boxShadow = style.boxShadow;
    const outline = style.outline;
    const border = style.border;
    
    if (boxShadow && boxShadow !== 'none' && boxShadow.includes('rgb')) {
      logDetailed('DETECT', 'Found active row via boxShadow', { boxShadow });
      return row;
    }
    if (outline && outline !== 'none' && !outline.includes('0px')) {
      logDetailed('DETECT', 'Found active row via outline', { outline });
      return row;
    }
    if (border && border.includes('rgb(255') || border.includes('yellow')) {
      logDetailed('DETECT', 'Found active row via border color', { border });
      return row;
    }
  }
  
  for (const row of rows) {
    const cells = row.querySelectorAll('.witch-game__box, [class*="box"], [class*="cell"]');
    const hasUnrevealed = Array.from(cells).some(cell => getCellState(cell) === 'unrevealed');
    if (hasUnrevealed) {
      const rowIndex = rows.indexOf(row);
      const prevRows = rows.slice(0, rowIndex);
      const allPrevRevealed = prevRows.every(prevRow => {
        const prevCells = prevRow.querySelectorAll('.witch-game__box, [class*="box"], [class*="cell"]');
        return Array.from(prevCells).some(cell => getCellState(cell) !== 'unrevealed');
      });
      if (allPrevRevealed || rowIndex === 0) {
        logDetailed('DETECT', 'Found active row via unrevealed cells logic', { rowIndex: rowIndex + 1 });
        return row;
      }
    }
  }
  
  return null;
}

function isGameActive() {
  const pageText = document.body.innerText || '';
  const cells = findGameCells();
  const activeRow = findActiveRow();
  return cells.length > 0 && (pageText.includes('Choose a cell') || activeRow !== null);
}

function isGameEnded() {
  const pageText = document.body.innerText || '';
  return pageText.includes('Better luck next time') || 
         pageText.includes('GAME LOSS') || 
         pageText.includes('game is over');
}

function getCellState(cell) {
  const dataResult = cell.getAttribute('data-result');
  if (dataResult === 'lose') return 'lose';
  if (dataResult === 'win') return 'win';
  const classList = cell.classList.toString();
  if (classList.includes('--is-open')) return 'revealed';
  return 'unrevealed';
}

function detectGameElements() {
  const cells = findGameCells();
  const rows = findGameRows();
  const activeRow = findActiveRow();
  const gameActive = isGameActive();
  const gameEnded = isGameEnded();
  
  const revealedCells = cells.filter(c => getCellState(c) !== 'unrevealed');
  const unrevealedCells = cells.filter(c => getCellState(c) === 'unrevealed');
  
  let activeRowIndex = -1;
  if (activeRow) {
    activeRowIndex = rows.indexOf(activeRow) + 1;
  }
  
  const gameState = {
    rows: rows.length,
    cells: cells.length,
    unrevealedCells: unrevealedCells.length,
    revealedCells: revealedCells.length,
    activeRow: activeRowIndex,
    isGameActive: gameActive,
    isGameEnded: gameEnded,
    hasGameContainer: cells.length > 0,
    rowResults: []
  };

  rows.forEach((row, rowIdx) => {
    const rowCells = Array.from(row.querySelectorAll('.witch-game__box'));
    const rowResult = {
      row: rowIdx + 1,
      cells: rowCells.map((cell, cellIdx) => ({
        cell: cellIdx + 1,
        state: getCellState(cell),
        dataResult: cell.getAttribute('data-result')
      }))
    };
    gameState.rowResults.push(rowResult);
  });

  return gameState;
}

function getRowAndCellFromElement(element) {
  const rows = findGameRows();
  
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const rowElement = rows[rowIdx];
    const rowCells = Array.from(rowElement.querySelectorAll('.witch-game__box'));
    const cellIdx = rowCells.indexOf(element);
    if (cellIdx !== -1) {
      return { row: rowIdx + 1, cell: cellIdx + 1 };
    }
  }
  
  const allCells = findGameCells();
  const cellIndex = allCells.indexOf(element);
  if (cellIndex !== -1) {
    const row = Math.floor(cellIndex / 5) + 1;
    const cell = (cellIndex % 5) + 1;
    return { row, cell };
  }
  
  return null;
}

function getElementInfo(element) {
  if (!element) return null;
  
  return {
    tagName: element.tagName,
    id: element.id || null,
    className: element.className || null,
    textContent: (element.textContent || '').slice(0, 100),
    attributes: Array.from(element.attributes || []).reduce((acc, attr) => {
      acc[attr.name] = attr.value;
      return acc;
    }, {}),
    rect: element.getBoundingClientRect ? {
      x: Math.round(element.getBoundingClientRect().x),
      y: Math.round(element.getBoundingClientRect().y),
      width: Math.round(element.getBoundingClientRect().width),
      height: Math.round(element.getBoundingClientRect().height)
    } : null
  };
}

function findAllButtons() {
  const buttons = [];
  const playButtons = document.querySelectorAll('[class*="play"], [class*="start"], [class*="bet"], button');
  playButtons.forEach(btn => {
    const info = getElementInfo(btn);
    if (info) {
      buttons.push({ type: 'potential_play', ...info });
    }
  });
  return buttons;
}

function clickCell(row, cell) {
  logDetailed('ACTION', `=== CLICK CELL COMMAND: row ${row}, cell ${cell} ===`);
  
  const rows = findGameRows();
  logDetailed('ACTION', `Found ${rows.length} game rows`);
  
  if (row > 0 && row <= rows.length) {
    const rowElement = rows[row - 1];
    const rowCells = Array.from(rowElement.querySelectorAll('.witch-game__box'));
    logDetailed('ACTION', `Row ${row} has ${rowCells.length} cells`);
    
    if (cell > 0 && cell <= rowCells.length) {
      const targetCell = rowCells[cell - 1];
      const cellState = getCellState(targetCell);
      logDetailed('ACTION', `Target cell state: ${cellState}`, getElementInfo(targetCell));
      
      if (targetCell) {
        logDetailed('ACTION', `Clicking cell element now!`);
        
        try {
          targetCell.click();
          logDetailed('ACTION', `Method 1 (click) executed`);
        } catch (e) {
          logDetailed('ACTION', `Method 1 failed: ${e.message}`);
        }
        
        try {
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          targetCell.dispatchEvent(clickEvent);
          logDetailed('ACTION', `Method 2 (dispatchEvent) executed`);
        } catch (e) {
          logDetailed('ACTION', `Method 2 failed: ${e.message}`);
        }
        
        log(`Clicked cell ${cell} in row ${row}`);
        
        sendGameEvent({
          type: 'cell_clicked_from_webapp',
          row,
          cell,
          success: true
        });
        
        return true;
      }
    } else {
      logDetailed('ACTION', `Cell ${cell} out of range (max: ${rowCells.length})`);
    }
  } else {
    logDetailed('ACTION', `Row ${row} out of range (max: ${rows.length})`);
  }
  
  log(`Failed to find/click cell ${cell} in row ${row}`);
  sendGameEvent({
    type: 'cell_clicked_from_webapp',
    row,
    cell,
    success: false,
    error: 'Cell not found'
  });
  return false;
}

function autoClickActiveRow() {
  if (!autoPlay || !isPlaying) {
    logDetailed('AUTO', 'Auto-click skipped - autoPlay or isPlaying is false', { autoPlay, isPlaying });
    return;
  }
  
  const activeRow = findActiveRow();
  if (!activeRow) {
    logDetailed('AUTO', 'No active row found for auto-click');
    return;
  }
  
  const rows = findGameRows();
  const activeRowIndex = rows.indexOf(activeRow) + 1;
  
  if (activeRowIndex <= lastClickedRow) {
    logDetailed('AUTO', `Row ${activeRowIndex} already clicked (lastClickedRow: ${lastClickedRow})`);
    return;
  }
  
  if (isGameEnded()) {
    logDetailed('AUTO', 'Game ended - stopping auto-click');
    stopAutoClick();
    return;
  }
  
  const unrevealedCells = Array.from(activeRow.querySelectorAll('.witch-game__box'))
    .filter(cell => getCellState(cell) === 'unrevealed');
  
  if (unrevealedCells.length === 0) {
    logDetailed('AUTO', 'No unrevealed cells in active row');
    return;
  }
  
  const randomIndex = Math.floor(Math.random() * unrevealedCells.length);
  const targetCell = unrevealedCells[randomIndex];
  const position = getRowAndCellFromElement(targetCell);
  
  if (position) {
    logDetailed('AUTO', `=== AUTO-CLICKING: row ${position.row}, cell ${position.cell} ===`);
    lastClickedRow = position.row;
    
    try {
      targetCell.click();
      logDetailed('AUTO', 'Auto-click executed');
      
      sendGameEvent({
        type: 'cell_selected',
        row: position.row,
        cell: position.cell,
        autoClicked: true
      });
    } catch (e) {
      logDetailed('AUTO', `Auto-click failed: ${e.message}`);
    }
  }
}

function startAutoClick() {
  if (autoClickInterval) {
    clearInterval(autoClickInterval);
  }
  
  logDetailed('AUTO', '=== STARTING AUTO-CLICK MODE ===');
  lastClickedRow = 0;
  
  setTimeout(() => {
    autoClickActiveRow();
  }, 500);
  
  autoClickInterval = setInterval(() => {
    if (!autoPlay || !isPlaying) {
      stopAutoClick();
      return;
    }
    autoClickActiveRow();
  }, 300);
}

function stopAutoClick() {
  if (autoClickInterval) {
    clearInterval(autoClickInterval);
    autoClickInterval = null;
    logDetailed('AUTO', '=== STOPPED AUTO-CLICK MODE ===');
  }
  lastClickedRow = 0;
}

function startMimickRecording() {
  logDetailed('MIMICK', 'Starting mimick recording');
  MIMICK_SPY_DATA.isRecording = true;
  MIMICK_SPY_DATA.currentGameSession = {
    id: `session_${Date.now()}`,
    startTime: getTimestamp(),
    requests: [],
    responses: [],
    websockets: [],
    tokens: { ...MIMICK_SPY_DATA.capturedTokens },
    cellClicks: [],
    rowResults: []
  };
  
  try {
    const script = document.createElement('script');
    script.textContent = `if(window.MIMICK_SPY) window.MIMICK_SPY.startRecording();`;
    document.documentElement.appendChild(script);
    script.remove();
  } catch (e) {}
  
  sendGameEvent({
    type: 'mimick_recording_started',
    sessionId: MIMICK_SPY_DATA.currentGameSession.id
  });
}

function stopMimickRecording() {
  logDetailed('MIMICK', 'Stopping mimick recording');
  MIMICK_SPY_DATA.isRecording = false;
  
  if (MIMICK_SPY_DATA.currentGameSession) {
    MIMICK_SPY_DATA.currentGameSession.endTime = getTimestamp();
    MIMICK_SPY_DATA.currentGameSession.requests = [...MIMICK_SPY_DATA.capturedRequests];
    MIMICK_SPY_DATA.currentGameSession.responses = [...MIMICK_SPY_DATA.capturedResponses];
    MIMICK_SPY_DATA.currentGameSession.websockets = [...MIMICK_SPY_DATA.capturedWebSockets];
    MIMICK_SPY_DATA.currentGameSession.tokens = { ...MIMICK_SPY_DATA.capturedTokens };
    MIMICK_SPY_DATA.currentGameSession.gameState = detectGameElements();
    
    MIMICK_SPY_DATA.gameFlows.push(MIMICK_SPY_DATA.currentGameSession);
    
    sendGameEvent({
      type: 'mimick_recording_stopped',
      session: MIMICK_SPY_DATA.currentGameSession
    });
    
    MIMICK_SPY_DATA.currentGameSession = null;
  }
  
  try {
    const script = document.createElement('script');
    script.textContent = `if(window.MIMICK_SPY) window.MIMICK_SPY.stopRecording();`;
    document.documentElement.appendChild(script);
    script.remove();
  } catch (e) {}
}

function getMimickData() {
  return {
    requests: MIMICK_SPY_DATA.capturedRequests,
    responses: MIMICK_SPY_DATA.capturedResponses,
    websockets: MIMICK_SPY_DATA.capturedWebSockets,
    tokens: MIMICK_SPY_DATA.capturedTokens,
    gameFlows: MIMICK_SPY_DATA.gameFlows,
    isRecording: MIMICK_SPY_DATA.isRecording,
    currentSession: MIMICK_SPY_DATA.currentGameSession
  };
}

function clearMimickData() {
  MIMICK_SPY_DATA.capturedRequests = [];
  MIMICK_SPY_DATA.capturedResponses = [];
  MIMICK_SPY_DATA.capturedWebSockets = [];
  MIMICK_SPY_DATA.capturedTokens = {};
  MIMICK_SPY_DATA.gameFlows = [];
  
  try {
    const script = document.createElement('script');
    script.textContent = `if(window.MIMICK_SPY) window.MIMICK_SPY.clearData();`;
    document.documentElement.appendChild(script);
    script.remove();
  } catch (e) {}
  
  logDetailed('MIMICK', 'Mimick data cleared');
  sendGameEvent({ type: 'mimick_data_cleared' });
}

function startGamePolling() {
  if (pollInterval) return;
  
  log('Starting game polling...');
  
  pollInterval = setInterval(() => {
    const cells = findGameCells();
    const currentCellCount = cells.length;
    
    if (currentCellCount !== lastCellCount) {
      lastCellCount = currentCellCount;
      const gameState = detectGameElements();
      logDetailed('STATE', 'Game state changed', gameState);
      sendGameEvent({ type: 'game_state', state: gameState });
    }
    
    if (isGameEnded()) {
      isPlaying = false;
      stopAutoClick();
      logDetailed('GAME', 'Game ended - detected loss');
      sendGameEvent({ type: 'game_state', state: { status: 'lose', isGameEnded: true } });
      
      if (MIMICK_SPY_DATA.isRecording) {
        stopMimickRecording();
      }
    }
  }, 500);
}

function setupCellClickCapture() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    const timestamp = getTimestamp();
    
    logDetailed('CLICK', 'Click detected', {
      target: getElementInfo(target),
      clientX: event.clientX,
      clientY: event.clientY,
      button: event.button,
      isTrusted: event.isTrusted
    });
    
    const clickedBox = target.closest('.witch-game__box');
    if (clickedBox) {
      const position = getRowAndCellFromElement(clickedBox);
      if (position) {
        logDetailed('CELL', `Cell clicked: row ${position.row}, cell ${position.cell}`, {
          position,
          cellState: getCellState(clickedBox),
          cellInfo: getElementInfo(clickedBox)
        });
        
        if (!isPlaying && position.row === 1) {
          isPlaying = true;
          currentRow = 1;
          logDetailed('GAME', 'Game started via first cell click - isPlaying set to true');
          sendGameEvent({ type: 'play_started' });
          startMimickRecording();
          
          if (autoPlay) {
            logDetailed('AUTO', 'Auto-play is enabled, starting auto-click after first cell click');
            setTimeout(() => startAutoClick(), 500);
          }
        }
        
        if (MIMICK_SPY_DATA.currentGameSession) {
          MIMICK_SPY_DATA.currentGameSession.cellClicks.push({
            row: position.row,
            cell: position.cell,
            timestamp: timestamp,
            isTrusted: event.isTrusted
          });
        }
        
        sendGameEvent({
          type: 'cell_selected',
          row: position.row,
          cell: position.cell,
          autoClicked: false
        });
      }
    }
    
    const targetText = target.textContent?.toLowerCase() || '';
    const targetClasses = target.className?.toString()?.toLowerCase() || '';
    const parentClasses = target.parentElement?.className?.toString()?.toLowerCase() || '';
    
    const isPlayButton = targetText.includes('play') || targetText.includes('bet') || 
                         targetClasses.includes('play') || targetClasses.includes('start') ||
                         parentClasses.includes('play') || parentClasses.includes('start') ||
                         target.closest('.witch-game__controls') ||
                         target.closest('[class*="game-controls"]') ||
                         target.closest('[class*="bet-button"]') ||
                         target.closest('[class*="play-button"]') ||
                         target.closest('[class*="start-button"]');
    
    const isWitchGameControl = target.closest('.witch-game') && 
                               (target.tagName === 'BUTTON' || target.closest('button'));
    
    if (isPlayButton || isWitchGameControl) {
      logDetailed('PLAY', '=== PLAY/CONTROL BUTTON CLICKED ===', {
        element: getElementInfo(target),
        parentElement: getElementInfo(target.parentElement),
        targetText,
        targetClasses,
        wasPlaying: isPlaying,
        isWitchGameControl,
        currentGameState: detectGameElements()
      });
      
      const allButtons = findAllButtons();
      logDetailed('PLAY', 'All buttons on page at click time', allButtons);
      
      if (!isPlaying) {
        isPlaying = true;
        currentRow = 1;
        sendGameEvent({ type: 'play_started' });
        logDetailed('GAME', 'Game started - isPlaying set to true');
        
        startMimickRecording();
        
        if (autoPlay) {
          logDetailed('AUTO', 'Auto-play is enabled, starting auto-click');
          startAutoClick();
        }
      }
    }
    
    const isTakeButton = targetText.includes('take') || targetText.includes('collect') ||
                         targetClasses.includes('take') || targetClasses.includes('collect') ||
                         targetText.includes('cashout') || targetClasses.includes('cashout');
    
    if (isTakeButton) {
      logDetailed('PLAY', '=== TAKE/COLLECT BUTTON CLICKED ===', {
        element: getElementInfo(target),
        targetText,
        wasPlaying: isPlaying
      });
      
      isPlaying = false;
      stopAutoClick();
      sendGameEvent({ type: 'play_stopped' });
      logDetailed('GAME', 'Player took winnings - isPlaying set to false');
      
      if (MIMICK_SPY_DATA.isRecording) {
        stopMimickRecording();
      }
    }
  }, true);
  
  document.addEventListener('mousedown', (event) => {
    logDetailed('MOUSE', 'Mousedown', {
      target: getElementInfo(event.target),
      clientX: event.clientX,
      clientY: event.clientY
    });
  }, true);
  
  document.addEventListener('mouseup', (event) => {
    logDetailed('MOUSE', 'Mouseup', {
      target: getElementInfo(event.target),
      clientX: event.clientX,
      clientY: event.clientY
    });
  }, true);
  
  document.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    logDetailed('TOUCH', 'Touchstart', {
      target: getElementInfo(event.target),
      clientX: touch?.clientX,
      clientY: touch?.clientY
    });
  }, true);
  
  document.addEventListener('touchend', (event) => {
    logDetailed('TOUCH', 'Touchend', {
      target: getElementInfo(event.target)
    });
  }, true);
  
  log('Click capture with detailed logging enabled');
}

function observeGameChanges() {
  const gameContainer = document.querySelector('.witch-game') || 
                        document.querySelector('[class*="witch"]') || 
                        document.body;
  
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      const target = mutation.target;
      
      if (mutation.type === 'attributes') {
        if (mutation.attributeName === 'data-result') {
          const state = getCellState(target);
          if (state === 'win' || state === 'lose') {
            const position = getRowAndCellFromElement(target);
            if (position) {
              logDetailed('RESULT', `Cell result revealed: ${state}`, {
                position,
                state,
                elementInfo: getElementInfo(target),
                oldValue: mutation.oldValue
              });
              
              if (MIMICK_SPY_DATA.currentGameSession) {
                MIMICK_SPY_DATA.currentGameSession.rowResults.push({
                  row: position.row,
                  cell: position.cell,
                  result: state,
                  timestamp: getTimestamp()
                });
              }
              
              sendGameEvent({
                type: 'row_result',
                row: position.row,
                success: state === 'win',
                cellClicked: position.cell,
                cellState: state
              });
            }
          }
        }
        
        if (mutation.attributeName === 'class') {
          const classList = target.classList?.toString() || '';
          if (classList.includes('witch-game__box') && classList.includes('--is-open')) {
            const state = getCellState(target);
            if (state !== 'unrevealed') {
              const position = getRowAndCellFromElement(target);
              if (position) {
                logDetailed('RESULT', `Cell opened via class change`, {
                  position,
                  state,
                  newClass: classList
                });
                
                sendGameEvent({
                  type: 'row_result',
                  row: position.row,
                  success: state === 'win',
                  cellClicked: position.cell,
                  cellState: state
                });
              }
            }
          }
          
          if (classList.includes('witch-game__row') && classList.includes('--is-active')) {
            const rows = findGameRows();
            const rowIndex = rows.indexOf(target) + 1;
            logDetailed('ROW', `Row ${rowIndex} is now active`, { classList });
          }
        }
      }
      
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const text = node.textContent || '';
            const className = node.className || '';
            
            if (text.includes('Better luck next time') || text.includes('GAME LOSS')) {
              logDetailed('GAME', '=== GAME OVER - LOSS DETECTED ===', {
                text: text.slice(0, 200),
                className
              });
              isPlaying = false;
              stopAutoClick();
              sendGameEvent({ type: 'game_state', state: { status: 'lose', isGameEnded: true } });
              
              if (MIMICK_SPY_DATA.isRecording) {
                stopMimickRecording();
              }
            }
            
            if (text.includes('You won') || text.includes('Congratulations')) {
              logDetailed('GAME', '=== WIN MESSAGE DETECTED ===', {
                text: text.slice(0, 200),
                className
              });
              
              if (MIMICK_SPY_DATA.isRecording) {
                stopMimickRecording();
              }
            }
            
            if (className.includes && (className.includes('play') || className.includes('bet'))) {
              logDetailed('DOM', 'Play/Bet element added to DOM', {
                className,
                text: text.slice(0, 100)
              });
            }
          }
        });
        
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const className = node.className || '';
            if (className.includes && className.includes('witch-game')) {
              logDetailed('DOM', 'Game element removed from DOM', { className });
            }
          }
        });
      }
    });
  });
  
  observer.observe(gameContainer, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['class', 'data-result'],
    attributeOldValue: true
  });
  
  logDetailed('INIT', 'Game observer started', { 
    container: gameContainer.className || 'body',
    containerInfo: getElementInfo(gameContainer)
  });
}

function setupMessageListener() {
  try {
    if (!chrome || !chrome.runtime || !chrome.runtime.onMessage) {
      log('Chrome runtime not available, retrying in 1s...');
      setTimeout(setupMessageListener, 1000);
      return;
    }
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'ws_connected') {
        logDetailed('WS', 'WebSocket connected to server');
        const gameState = detectGameElements();
        sendGameEvent({ type: 'game_state', state: gameState });
        sendResponse({ success: true });
        
      } else if (message.type === 'server_command') {
        const { data } = message;
        logDetailed('CMD', '=== SERVER COMMAND RECEIVED ===', data);
        logDetailed('CMD', 'Data action:', data.action);
        logDetailed('CMD', 'Data row:', data.row);
        logDetailed('CMD', 'Data cell:', data.cell);
        
        switch (data.action) {
          case 'click_cell':
            logDetailed('CMD', `=== EXECUTING CLICK_CELL: row ${data.row}, cell ${data.cell} ===`);
            const clicked = clickCell(data.row, data.cell);
            logDetailed('CMD', `Click result: ${clicked}`);
            if (clicked) {
              sendGameEvent({
                type: 'cell_selected',
                row: data.row,
                cell: data.cell,
                autoClicked: true
              });
            }
            break;
            
          case 'start_play':
            logDetailed('CMD', 'Executing start_play command');
            const playBtn = document.querySelector('[class*="play"], [class*="start"], button[class*="green"]');
            logDetailed('CMD', 'Found play button', getElementInfo(playBtn));
            if (playBtn && !isPlaying) {
              playBtn.click();
              isPlaying = true;
              currentRow = 1;
              sendGameEvent({ type: 'play_started' });
              logDetailed('CMD', 'Play button clicked programmatically');
              startMimickRecording();
              
              if (autoPlay) {
                logDetailed('CMD', 'Auto-play is enabled, starting auto-click');
                startAutoClick();
              }
            }
            break;
            
          case 'stop_play':
            logDetailed('CMD', 'Executing stop_play command');
            const takeBtn = document.querySelector('[class*="take"], [class*="collect"], [class*="cashout"]');
            logDetailed('CMD', 'Found take button', getElementInfo(takeBtn));
            if (takeBtn && isPlaying) {
              takeBtn.click();
              isPlaying = false;
              stopAutoClick();
              sendGameEvent({ type: 'play_stopped' });
              logDetailed('CMD', 'Take button clicked programmatically');
              stopMimickRecording();
            }
            break;
            
          case 'set_auto_play':
            autoPlay = data.enabled;
            logDetailed('CMD', `Auto-play ${autoPlay ? 'enabled' : 'disabled'}`);
            if (autoPlay && isPlaying) {
              logDetailed('CMD', 'Auto-play enabled while playing - starting auto-click');
              startAutoClick();
            } else if (!autoPlay) {
              stopAutoClick();
            }
            break;
            
          case 'get_state':
            const state = detectGameElements();
            logDetailed('CMD', 'Sending game state', state);
            sendGameEvent({ type: 'game_state', state });
            break;
            
          case 'get_buttons':
            const buttons = findAllButtons();
            logDetailed('CMD', 'Sending all buttons', buttons);
            sendGameEvent({ type: 'buttons_info', buttons });
            break;
            
          case 'start_mimick_recording':
            startMimickRecording();
            break;
            
          case 'stop_mimick_recording':
            stopMimickRecording();
            break;
            
          case 'get_mimick_data':
            const mimickData = getMimickData();
            logDetailed('CMD', 'Sending mimick data', mimickData);
            sendGameEvent({ type: 'mimick_data', data: mimickData });
            break;
            
          case 'clear_mimick_data':
            clearMimickData();
            break;
        }
        
        sendResponse({ success: true });
      }
      
      return true;
    });
    
    logDetailed('INIT', 'Message listener setup complete');
  } catch (e) {
    log('Error setting up message listener:', e.message);
    setTimeout(setupMessageListener, 1000);
  }
}

function init() {
  logDetailed('INIT', '=== Witch Extension Starting (v7.0 with Mimick Spy) ===', {
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  });
  
  injectMimickSpy();
  
  setupMessageListener();
  setupCellClickCapture();
  observeGameChanges();
  startGamePolling();
  
  setTimeout(() => {
    const gameState = detectGameElements();
    logDetailed('INIT', 'Initial game state', gameState);
    
    const buttons = findAllButtons();
    logDetailed('INIT', 'Initial buttons found', buttons);
    
    sendGameEvent({ type: 'game_state', state: gameState });
    sendGameEvent({ 
      type: 'mimick_spy_ready',
      capturedTokens: MIMICK_SPY_DATA.capturedTokens
    });
  }, 2000);
  
  logDetailed('INIT', '=== Witch Extension Ready (v7.0) ===');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
