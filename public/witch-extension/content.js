let isPlaying = false;
let autoPlay = false;
let currentRow = 1;
let observer = null;
let lastCellCount = 0;
let pollInterval = null;
let networkLogs = [];
let eventLogs = [];

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

function interceptNetworkRequests() {
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || 'unknown';
    const method = args[1]?.method || 'GET';
    const body = args[1]?.body;
    
    const requestTime = getTimestamp();
    logDetailed('NETWORK', `Fetch request: ${method} ${url}`, { body: body ? JSON.parse(body) : null });
    
    try {
      const response = await originalFetch.apply(this, args);
      const responseClone = response.clone();
      
      responseClone.text().then(text => {
        let parsedBody = text;
        try {
          parsedBody = JSON.parse(text);
        } catch (e) {}
        
        logDetailed('NETWORK', `Fetch response: ${response.status} ${url}`, { 
          status: response.status,
          body: parsedBody 
        });
      }).catch(() => {});
      
      return response;
    } catch (error) {
      logDetailed('NETWORK', `Fetch error: ${url}`, { error: error.message });
      throw error;
    }
  };
  
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._witchMethod = method;
    this._witchUrl = url;
    return originalXHROpen.apply(this, [method, url, ...args]);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    const method = this._witchMethod;
    const url = this._witchUrl;
    
    logDetailed('NETWORK', `XHR request: ${method} ${url}`, { body });
    
    this.addEventListener('load', () => {
      let responseBody = this.responseText;
      try {
        responseBody = JSON.parse(this.responseText);
      } catch (e) {}
      
      logDetailed('NETWORK', `XHR response: ${this.status} ${url}`, {
        status: this.status,
        body: responseBody
      });
    });
    
    this.addEventListener('error', () => {
      logDetailed('NETWORK', `XHR error: ${url}`, { status: this.status });
    });
    
    return originalXHRSend.apply(this, [body]);
  };
  
  log('Network request interception enabled');
}

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
  return document.querySelector('.witch-game__row--is-active');
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
  if (dataResult === 'lose') {
    return 'lose';
  }
  if (dataResult === 'win') {
    return 'win';
  }
  const classList = cell.classList.toString();
  if (classList.includes('--is-open')) {
    return 'revealed';
  }
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
  
  return {
    rows: rows.length,
    cells: cells.length,
    unrevealedCells: unrevealedCells.length,
    revealedCells: revealedCells.length,
    activeRow: activeRowIndex,
    isGameActive: gameActive,
    isGameEnded: gameEnded,
    hasGameContainer: cells.length > 0
  };
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
      buttons.push({
        type: 'potential_play',
        ...info
      });
    }
  });
  
  return buttons;
}

function clickCell(row, cell) {
  logDetailed('ACTION', `Attempting to click cell ${cell} in row ${row}`);
  
  const rows = findGameRows();
  if (row > 0 && row <= rows.length) {
    const rowElement = rows[row - 1];
    const rowCells = Array.from(rowElement.querySelectorAll('.witch-game__box'));
    if (cell > 0 && cell <= rowCells.length) {
      const targetCell = rowCells[cell - 1];
      if (targetCell && getCellState(targetCell) === 'unrevealed') {
        logDetailed('ACTION', `Clicking cell element`, getElementInfo(targetCell));
        targetCell.click();
        log(`Clicked cell ${cell} in row ${row}`);
        return true;
      } else {
        logDetailed('ACTION', `Cell not clickable - state: ${getCellState(targetCell)}`);
      }
    }
  }
  
  log(`Failed to find cell ${cell} in row ${row}`);
  return false;
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
      logDetailed('GAME', 'Game ended - detected loss');
      sendGameEvent({ type: 'game_state', state: { status: 'lose', isGameEnded: true } });
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
                         parentClasses.includes('play') || parentClasses.includes('start');
    
    if (isPlayButton) {
      logDetailed('PLAY', '=== PLAY BUTTON CLICKED ===', {
        element: getElementInfo(target),
        parentElement: getElementInfo(target.parentElement),
        targetText,
        targetClasses,
        wasPlaying: isPlaying,
        currentGameState: detectGameElements()
      });
      
      const allButtons = findAllButtons();
      logDetailed('PLAY', 'All buttons on page at click time', allButtons);
      
      if (!isPlaying) {
        isPlaying = true;
        currentRow = 1;
        sendGameEvent({ type: 'play_started' });
        logDetailed('GAME', 'Game started - isPlaying set to true');
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
      sendGameEvent({ type: 'play_stopped' });
      logDetailed('GAME', 'Player took winnings - isPlaying set to false');
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
              sendGameEvent({ type: 'game_state', state: { status: 'lose', isGameEnded: true } });
            }
            
            if (text.includes('You won') || text.includes('Congratulations')) {
              logDetailed('GAME', '=== WIN MESSAGE DETECTED ===', {
                text: text.slice(0, 200),
                className
              });
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
        logDetailed('CMD', 'Received command from server', data);
        
        switch (data.action) {
          case 'click_cell':
            logDetailed('CMD', `Executing click_cell command: row ${data.row}, cell ${data.cell}`);
            const clicked = clickCell(data.row, data.cell);
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
            }
            break;
            
          case 'stop_play':
            logDetailed('CMD', 'Executing stop_play command');
            const takeBtn = document.querySelector('[class*="take"], [class*="collect"], [class*="cashout"]');
            logDetailed('CMD', 'Found take button', getElementInfo(takeBtn));
            if (takeBtn && isPlaying) {
              takeBtn.click();
              isPlaying = false;
              sendGameEvent({ type: 'play_stopped' });
              logDetailed('CMD', 'Take button clicked programmatically');
            }
            break;
            
          case 'set_auto_play':
            autoPlay = data.enabled;
            logDetailed('CMD', `Auto-play ${autoPlay ? 'enabled' : 'disabled'}`);
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
  logDetailed('INIT', '=== Witch Extension Starting ===', {
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  });
  
  interceptNetworkRequests();
  
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
  }, 2000);
  
  logDetailed('INIT', '=== Witch Extension Ready ===');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
