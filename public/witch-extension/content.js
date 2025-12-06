let isPlaying = false;
let autoPlay = false;
let currentRow = 1;
let observer = null;
let lastCellCount = 0;
let pollInterval = null;

function log(message, data) {
  if (data !== undefined) {
    console.log('[Witch Extension]', message, data);
  } else {
    console.log('[Witch Extension]', message);
  }
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

function clickCell(row, cell) {
  const rows = findGameRows();
  if (row > 0 && row <= rows.length) {
    const rowElement = rows[row - 1];
    const rowCells = Array.from(rowElement.querySelectorAll('.witch-game__box'));
    if (cell > 0 && cell <= rowCells.length) {
      const targetCell = rowCells[cell - 1];
      if (targetCell && getCellState(targetCell) === 'unrevealed') {
        targetCell.click();
        log(`Clicked cell ${cell} in row ${row}`);
        return true;
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
      log('Game state changed:', JSON.stringify(gameState));
      sendGameEvent({ type: 'game_state', state: gameState });
    }
    
    if (isGameEnded()) {
      isPlaying = false;
      sendGameEvent({ type: 'game_state', state: { status: 'lose', isGameEnded: true } });
    }
  }, 500);
}

function setupCellClickCapture() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    
    const clickedBox = target.closest('.witch-game__box');
    if (clickedBox) {
      const position = getRowAndCellFromElement(clickedBox);
      if (position) {
        sendGameEvent({
          type: 'cell_selected',
          row: position.row,
          cell: position.cell,
          autoClicked: false
        });
        log(`User clicked cell ${position.cell} in row ${position.row}`);
      }
    }
    
    const targetText = target.textContent?.toLowerCase() || '';
    const targetClasses = target.className?.toString() || '';
    
    if (targetText.includes('play') || targetText.includes('bet') || 
        targetClasses.includes('play') || targetClasses.includes('start')) {
      if (!isPlaying) {
        isPlaying = true;
        currentRow = 1;
        sendGameEvent({ type: 'play_started' });
        log('Game started');
      }
    }
    
    if (targetText.includes('take') || targetText.includes('collect') ||
        targetClasses.includes('take') || targetClasses.includes('collect')) {
      isPlaying = false;
      sendGameEvent({ type: 'play_stopped' });
      log('Player took winnings');
    }
  }, true);
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
              sendGameEvent({
                type: 'row_result',
                row: position.row,
                success: state === 'win',
                cellClicked: position.cell,
                cellState: state
              });
              log(`Cell revealed: row ${position.row}, cell ${position.cell}, state: ${state}`);
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
                sendGameEvent({
                  type: 'row_result',
                  row: position.row,
                  success: state === 'win',
                  cellClicked: position.cell,
                  cellState: state
                });
                log(`Cell opened: row ${position.row}, cell ${position.cell}, state: ${state}`);
              }
            }
          }
        }
      }
      
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const text = node.textContent || '';
            if (text.includes('Better luck next time') || text.includes('GAME LOSS')) {
              isPlaying = false;
              sendGameEvent({ type: 'game_state', state: { status: 'lose', isGameEnded: true } });
              log('Game ended - LOSS');
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
    attributeFilter: ['class', 'data-result']
  });
  
  log('Game observer started on:', gameContainer.className || 'body');
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
        log('WebSocket connected to server');
        const gameState = detectGameElements();
        sendGameEvent({ type: 'game_state', state: gameState });
        sendResponse({ success: true });
        
      } else if (message.type === 'server_command') {
        const { data } = message;
        log('Received command from server:', data);
        
        switch (data.action) {
          case 'click_cell':
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
            const playBtn = document.querySelector('[class*="play"], [class*="start"], button[class*="green"]');
            if (playBtn && !isPlaying) {
              playBtn.click();
              isPlaying = true;
              currentRow = 1;
              sendGameEvent({ type: 'play_started' });
            }
            break;
            
          case 'stop_play':
            const takeBtn = document.querySelector('[class*="take"], [class*="collect"], [class*="cashout"]');
            if (takeBtn && isPlaying) {
              takeBtn.click();
              isPlaying = false;
              sendGameEvent({ type: 'play_stopped' });
            }
            break;
            
          case 'set_auto_play':
            autoPlay = data.enabled;
            log(`Auto-play ${autoPlay ? 'enabled' : 'disabled'}`);
            break;
            
          case 'get_state':
            const state = detectGameElements();
            sendGameEvent({ type: 'game_state', state });
            break;
        }
        
        sendResponse({ success: true });
      }
      
      return true;
    });
    
    log('Message listener setup complete');
  } catch (e) {
    log('Error setting up message listener:', e.message);
    setTimeout(setupMessageListener, 1000);
  }
}

function init() {
  log('Witch Extension content script loaded on ' + window.location.href);
  
  setupMessageListener();
  setupCellClickCapture();
  observeGameChanges();
  startGamePolling();
  
  setTimeout(() => {
    const gameState = detectGameElements();
    log('Initial game state:', JSON.stringify(gameState));
    sendGameEvent({ type: 'game_state', state: gameState });
  }, 2000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
