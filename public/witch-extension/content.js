let isPlaying = false;
let autoPlay = false;
let currentRow = 1;
let observer = null;

function log(message, data) {
  if (data) {
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
    console.log('[Witch Extension] Failed to send message:', e.message);
  }
}

function findGameCells() {
  return Array.from(document.querySelectorAll('[class*="witch-game__box"]'));
}

function findGameRows() {
  return Array.from(document.querySelectorAll('[class*="witch-game__row"]'));
}

function isGameActive() {
  const pageText = document.body.innerText || '';
  const cells = findGameCells();
  return cells.length > 0 && pageText.includes('Choose a cell');
}

function isGameEnded() {
  const pageText = document.body.innerText || '';
  return pageText.includes('Better luck next time') || 
         pageText.includes('GAME LOSS') || 
         pageText.includes('game is over');
}

function getCellState(cell) {
  const classList = cell.classList.toString();
  if (classList.includes('poison') || classList.includes('w-lose')) {
    return 'lose';
  }
  if (classList.includes('wine') || classList.includes('w-win')) {
    return 'win';
  }
  return 'unrevealed';
}

function detectGameElements() {
  const cells = findGameCells();
  const rows = findGameRows();
  const gameActive = isGameActive();
  const gameEnded = isGameEnded();
  
  const revealedCells = cells.filter(c => getCellState(c) !== 'unrevealed');
  const unrevealedCells = cells.filter(c => getCellState(c) === 'unrevealed');
  
  log(`Detected: ${rows.length} rows, ${cells.length} cells (${unrevealedCells.length} unrevealed), active: ${gameActive}, ended: ${gameEnded}`);
  
  return {
    rows: rows.length,
    cells: cells.length,
    unrevealedCells: unrevealedCells.length,
    revealedCells: revealedCells.length,
    isGameActive: gameActive,
    isGameEnded: gameEnded,
    hasGameContainer: cells.length > 0
  };
}

function getRowAndCellFromElement(element) {
  const cells = findGameCells();
  const cellIndex = cells.indexOf(element);
  
  if (cellIndex === -1) return null;
  
  const row = Math.floor(cellIndex / 5) + 1;
  const cell = (cellIndex % 5) + 1;
  
  return { row, cell };
}

function clickCell(row, cell) {
  const cells = findGameCells();
  const targetIndex = (row - 1) * 5 + (cell - 1);
  
  if (targetIndex >= 0 && targetIndex < cells.length) {
    const targetCell = cells[targetIndex];
    if (targetCell && getCellState(targetCell) === 'unrevealed') {
      targetCell.click();
      log(`Clicked cell ${cell} in row ${row}`);
      return true;
    }
  }
  
  log(`Failed to find cell ${cell} in row ${row}`);
  return false;
}

function observeGameChanges() {
  const gameContainer = document.querySelector('[class*="witch-game"]') || document.body;
  
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      const target = mutation.target;
      
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const classList = target.classList?.toString() || '';
        
        if (classList.includes('witch-game__box')) {
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
              log(`Cell revealed: row ${position.row}, cell ${position.cell}, state: ${state}`);
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
            if (text.includes('WIN') || text.includes('Congratulations')) {
              sendGameEvent({ type: 'game_state', state: { status: 'win' } });
              log('Game win detected');
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
    attributeFilter: ['class', 'style']
  });
  
  log('Game observer started on', gameContainer.className || 'body');
}

document.addEventListener('click', (event) => {
  const target = event.target;
  const cells = findGameCells();
  
  const clickedCell = cells.find(cell => cell === target || cell.contains(target) || target.closest('[class*="witch-game__box"]') === cell);
  
  if (clickedCell) {
    const position = getRowAndCellFromElement(clickedCell);
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
  
  const targetClasses = target.className || '';
  const parentClasses = target.parentElement?.className || '';
  const buttonText = target.textContent?.toLowerCase() || '';
  
  if (targetClasses.includes('play') || targetClasses.includes('start') || 
      parentClasses.includes('play') || parentClasses.includes('start') ||
      buttonText.includes('play') || buttonText.includes('bet')) {
    if (!isPlaying) {
      isPlaying = true;
      currentRow = 1;
      sendGameEvent({ type: 'play_started' });
      log('Game started');
    }
  }
  
  if (targetClasses.includes('take') || targetClasses.includes('collect') ||
      parentClasses.includes('take') || parentClasses.includes('collect') ||
      buttonText.includes('take') || buttonText.includes('collect')) {
    isPlaying = false;
    sendGameEvent({ type: 'play_stopped' });
    log('Player took winnings');
  }
}, true);

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
  
  setTimeout(() => {
    observeGameChanges();
    const gameState = detectGameElements();
    log('Initial game state:', JSON.stringify(gameState));
    
    if (gameState.cells > 0 || gameState.hasGameContainer) {
      sendGameEvent({ type: 'game_state', state: gameState });
    }
  }, 2000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
