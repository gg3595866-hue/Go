let isPlaying = false;
let autoPlay = false;
let currentRow = 1;
let observer = null;

function log(message) {
  console.log('[Witch Extension]', message);
}

function sendGameEvent(eventData) {
  chrome.runtime.sendMessage({ type: 'game_event', data: eventData });
}

function detectGameElements() {
  const gameContainer = document.querySelector('[class*="witch"], [class*="game"], .game-container, [class*="ladder"]');
  const cells = document.querySelectorAll('[class*="cell"], [class*="item"], [class*="card"], [class*="tile"]');
  const rows = document.querySelectorAll('[class*="row"], [class*="level"], [class*="step"]');
  const playButton = document.querySelector('[class*="play"], [class*="start"], [class*="bet"], button[class*="green"]');
  const takeWinningsBtn = document.querySelector('[class*="take"], [class*="collect"], [class*="cashout"]');
  
  log(`Detected: ${rows.length} rows, ${cells.length} cells, playBtn: ${!!playButton}, takeBtn: ${!!takeWinningsBtn}`);
  
  return {
    rows: rows.length,
    cells: cells.length,
    hasPlayButton: !!playButton,
    hasTakeWinnings: !!takeWinningsBtn,
    hasGameContainer: !!gameContainer
  };
}

function findGameCells() {
  const allCells = [];
  
  const possibleSelectors = [
    '[class*="cell"]:not([class*="header"])',
    '[class*="item"][class*="game"]',
    '[class*="card"]:not([class*="info"])',
    '[class*="tile"]',
    '.game-field [class*="btn"]',
    '[class*="choice"]',
    '[class*="option"]'
  ];
  
  for (const selector of possibleSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length >= 5) {
      return Array.from(elements);
    }
  }
  
  const clickableInGame = document.querySelectorAll('[class*="game"] [onclick], [class*="game"] [class*="click"]');
  if (clickableInGame.length >= 5) {
    return Array.from(clickableInGame);
  }
  
  return allCells;
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
    if (targetCell) {
      targetCell.click();
      log(`Clicked cell ${cell} in row ${row}`);
      return true;
    }
  }
  
  log(`Failed to find cell ${cell} in row ${row}`);
  return false;
}

function observeGameChanges() {
  const gameContainer = document.querySelector('[class*="game"], [class*="witch"], body');
  
  if (!gameContainer) {
    log('No game container found, observing body');
  }
  
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      const target = mutation.target;
      
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const classList = target.className || '';
        
        if (classList.includes('success') || classList.includes('win') || classList.includes('correct')) {
          const position = getRowAndCellFromElement(target);
          if (position) {
            sendGameEvent({
              type: 'row_result',
              row: position.row,
              success: true,
              cellClicked: position.cell
            });
          }
        }
        
        if (classList.includes('fail') || classList.includes('lose') || classList.includes('wrong') || classList.includes('bomb')) {
          const position = getRowAndCellFromElement(target);
          if (position) {
            sendGameEvent({
              type: 'row_result',
              row: position.row,
              success: false,
              cellClicked: position.cell
            });
          }
        }
        
        if (classList.includes('active') || classList.includes('selected') || classList.includes('current')) {
          const position = getRowAndCellFromElement(target);
          if (position && position.row !== currentRow) {
            currentRow = position.row;
            sendGameEvent({
              type: 'game_state',
              state: { currentRow }
            });
          }
        }
      }
      
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const text = node.textContent || '';
            if (text.includes('WIN') || text.includes('won')) {
              sendGameEvent({ type: 'game_state', state: { status: 'win' } });
            }
            if (text.includes('LOSE') || text.includes('lost') || text.includes('GAME OVER')) {
              sendGameEvent({ type: 'game_state', state: { status: 'lose' } });
            }
          }
        });
      }
    });
  });
  
  observer.observe(gameContainer || document.body, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['class', 'style', 'data-state']
  });
  
  log('Game observer started');
}

document.addEventListener('click', (event) => {
  const target = event.target;
  const cells = findGameCells();
  
  const clickedCell = cells.find(cell => cell === target || cell.contains(target));
  
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
  
  if (targetClasses.includes('play') || targetClasses.includes('start') || 
      parentClasses.includes('play') || parentClasses.includes('start') ||
      target.textContent?.toLowerCase().includes('play') ||
      target.textContent?.toLowerCase().includes('bet')) {
    if (!isPlaying) {
      isPlaying = true;
      currentRow = 1;
      sendGameEvent({ type: 'play_started' });
      log('Game started');
    }
  }
  
  if (targetClasses.includes('take') || targetClasses.includes('collect') ||
      parentClasses.includes('take') || parentClasses.includes('collect') ||
      target.textContent?.toLowerCase().includes('take') ||
      target.textContent?.toLowerCase().includes('collect')) {
    isPlaying = false;
    sendGameEvent({ type: 'play_stopped' });
    log('Player took winnings');
  }
}, true);

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
    }
    
    sendResponse({ success: true });
  }
  
  return true;
});

function init() {
  log('Witch Extension content script loaded on ' + window.location.href);
  
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
