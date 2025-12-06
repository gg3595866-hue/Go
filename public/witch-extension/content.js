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
  const rows = document.querySelectorAll('.game-row, .row, [class*="row"]');
  const cells = document.querySelectorAll('.cell, .game-cell, [class*="cell"]');
  const playButton = document.querySelector('.play-button, .start-button, [class*="play"], button[class*="start"]');
  
  return {
    rows: rows.length,
    cells: cells.length,
    hasPlayButton: !!playButton
  };
}

function getCellFromClick(event) {
  const target = event.target;
  const cellElement = target.closest('.cell, .game-cell, [class*="cell"]');
  
  if (cellElement) {
    const rowElement = cellElement.closest('.game-row, .row, [class*="row"]');
    const allRows = document.querySelectorAll('.game-row, .row, [class*="row"]');
    const rowIndex = Array.from(allRows).indexOf(rowElement) + 1;
    
    const allCells = rowElement?.querySelectorAll('.cell, .game-cell, [class*="cell"]') || [];
    const cellIndex = Array.from(allCells).indexOf(cellElement) + 1;
    
    return { row: rowIndex, cell: cellIndex };
  }
  
  return null;
}

function clickCell(row, cell) {
  const rows = document.querySelectorAll('.game-row, .row, [class*="row"]');
  const targetRow = rows[row - 1];
  
  if (targetRow) {
    const cells = targetRow.querySelectorAll('.cell, .game-cell, [class*="cell"]');
    const targetCell = cells[cell - 1];
    
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
  const gameContainer = document.querySelector('.game-container, .game, [class*="game"]') || document.body;
  
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' || mutation.type === 'childList') {
        const target = mutation.target;
        
        if (target.classList?.contains('success') || target.getAttribute('data-result') === 'success') {
          const position = getCellFromClick({ target });
          if (position) {
            sendGameEvent({
              type: 'row_result',
              row: position.row,
              success: true,
              cellClicked: position.cell
            });
          }
        }
        
        if (target.classList?.contains('fail') || target.getAttribute('data-result') === 'fail') {
          const position = getCellFromClick({ target });
          if (position) {
            sendGameEvent({
              type: 'row_result',
              row: position.row,
              success: false,
              cellClicked: position.cell
            });
          }
        }
      }
    });
  });
  
  observer.observe(gameContainer, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['class', 'data-result', 'data-state']
  });
}

document.addEventListener('click', (event) => {
  const position = getCellFromClick(event);
  
  if (position) {
    sendGameEvent({
      type: 'cell_selected',
      row: position.row,
      cell: position.cell,
      autoClicked: false
    });
  }
  
  const target = event.target;
  if (target.matches('.play-button, .start-button, [class*="play"], button[class*="start"]')) {
    if (!isPlaying) {
      isPlaying = true;
      sendGameEvent({ type: 'play_started' });
    } else {
      isPlaying = false;
      sendGameEvent({ type: 'play_stopped' });
    }
  }
}, true);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ws_connected') {
    log('WebSocket connected');
    const gameState = detectGameElements();
    sendGameEvent({ type: 'game_state', state: gameState });
    sendResponse({ success: true });
    
  } else if (message.type === 'server_command') {
    const { data } = message;
    
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
        const playButton = document.querySelector('.play-button, .start-button, [class*="play"], button[class*="start"]');
        if (playButton && !isPlaying) {
          playButton.click();
          isPlaying = true;
          sendGameEvent({ type: 'play_started' });
        }
        break;
        
      case 'stop_play':
        const stopButton = document.querySelector('.stop-button, .pause-button, [class*="stop"], button[class*="pause"]');
        if (stopButton && isPlaying) {
          stopButton.click();
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

window.addEventListener('load', () => {
  log('Content script loaded');
  observeGameChanges();
  
  const gameState = detectGameElements();
  log(`Detected: ${gameState.rows} rows, ${gameState.cells} cells`);
});
