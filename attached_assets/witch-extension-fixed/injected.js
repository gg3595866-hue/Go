(function() {
  'use strict';

  console.log("%c🎯 WITCH GAME - RACING ATTACK v4.3 (CLEAN)", "color: #00ff00; font-weight: bold; font-size: 18px;");

  if (window.__WITCH_INITIALIZED__) {
    console.log("%c[WITCH] Already running", "color: yellow;");
    return;
  }
  window.__WITCH_INITIALIZED__ = true;

  // RACING ATTACK: Automatic multi-click when game grid appears
  let racingAttackActive = false;
  let totalRoundsRacing = 0;
  let successfulRoundsRacing = 0;
  let lastCellCount = 0;
  let lastRowClicked = -1;
  let gameEnded = false; // MASTER KILL SWITCH
  let pendingTimeouts = []; // Track all setTimeout IDs
  
  const performRacingAttack = () => {
    if (racingAttackActive) return;
    racingAttackActive = true;
    
    console.log("%c🎯 RACING ATTACK STARTED - Syncing with game progression!", "color: #ff00ff; font-weight: bold; font-size: 16px;");
    
    // Keep attacking rows continuously as they appear
    const continuousAttack = setInterval(() => {
      // MASTER KILL SWITCH - if game ended, don't do anything
      if (gameEnded) return;
      
      // Re-scan for cells each time
      const freshCells = document.querySelectorAll('[class*="witch-game__box"]');
      const pageText = document.body.innerText;
      
      // GAME END DETECTION
      const isGameLost = pageText.includes('Better luck next time') || 
                         pageText.includes('GAME LOSS') || 
                         pageText.includes('game is over');
      
      if (isGameLost) {
        // SET MASTER KILL SWITCH
        gameEnded = true;
        
        console.log("%c🛑 GAME ENDED - Cancelling all pending clicks!", "color: #ff0000; font-weight: bold;");
        
        // Cancel ALL pending timeouts
        pendingTimeouts.forEach(id => clearTimeout(id));
        pendingTimeouts = [];
        
        // Stop the interval
        clearInterval(continuousAttack);
        console.log(`%c🛑 FINAL SCORE: ${successfulRoundsRacing}/${totalRoundsRacing} rows cleared`, "color: #ff6600; font-weight: bold; font-size: 14px;");
        racingAttackActive = false;
        return;
      }
      
      // Check if we have cells AND "Choose a cell" is visible (row is active)
      const isRowActive = pageText.includes('Choose a cell') && freshCells.length > 0;
      
      if (!isRowActive) {
        return; // Wait for next row
      }
      
      // Detect NEW row by checking if cell count changed (previous row was revealed)
      const currentCellCount = freshCells.length;
      
      // Check if cells have unrevealed status (not wine/poison yet)
      const unrevealed = Array.from(freshCells).filter(cell => {
        const hasPoison = cell.classList.toString().includes('poison') || 
                         cell.classList.toString().includes('w-lose');
        const hasWine = cell.classList.toString().includes('wine') || 
                       cell.classList.toString().includes('w-win');
        return !hasPoison && !hasWine; // Still unrevealed
      });
      
      // Only attack if we have unrevealed cells and this is a new row
      if (unrevealed.length > 0) {
        const isNewRow = currentCellCount !== lastCellCount || lastRowClicked === -1;
        
        if (isNewRow && pageText.includes('Choose a cell')) {
          totalRoundsRacing++;
          lastRowClicked = totalRoundsRacing;
          lastCellCount = currentCellCount;
          
          // GRADUATED ATTACK STRATEGY based on game difficulty
          let clickCount;
          let difficulty;
          
          const currentRow = totalRoundsRacing - 1;
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
          
          console.log(`%c🔥 Row ${totalRoundsRacing} [${difficulty}]: Clicking ${clickCount} cells (${unrevealed.length} unrevealed available)`, "color: #ff3333; font-weight: bold;");
          
          // Click cells ULTRA-RAPID (25ms apart)
          for (let i = 0; i < clickCount; i++) {
            const timeoutId = setTimeout(() => {
              // CHECK KILL SWITCH before clicking
              if (gameEnded) return;
              
              const randomCell = unrevealed[Math.floor(Math.random() * unrevealed.length)];
              if (randomCell) {
                console.log(`%c⚡ CLICK #${i + 1}`, "color: #00ff00;");
                randomCell.click();
              }
            }, i * 25);
            
            // Track this timeout so we can cancel it if game ends
            pendingTimeouts.push(timeoutId);
          }
          
          // Wait and check result
          const checkResultId = setTimeout(() => {
            // CHECK KILL SWITCH before checking result
            if (gameEnded) return;
            
            const resultPoison = document.querySelectorAll('[class*="poison"], [class*="w-lose"]');
            if (resultPoison.length === 0) {
              console.log(`%c✅ Row ${totalRoundsRacing}: SURVIVED!`, "color: #00ff00; font-weight: bold; font-size: 14px;");
              successfulRoundsRacing++;
            } else {
              console.log(`%c❌ Row ${totalRoundsRacing}: Poison hit`, "color: #ff0000;");
            }
            // Reset for next row detection
            lastCellCount = 0;
          }, 2000);
          
          pendingTimeouts.push(checkResultId);
        }
      }
    }, 500); // Check every 500ms for more responsive detection
    
    // Auto-stop after 120 seconds (safety timeout)
    setTimeout(() => {
      if (!gameEnded) {
        gameEnded = true;
        pendingTimeouts.forEach(id => clearTimeout(id));
        console.log(`%c🛑 SAFETY TIMEOUT - Racing attack stopped`, "color: #ff6600; font-weight: bold;");
      }
    }, 120000);
  };

  // AUTO-START racing attack when game is actually active
  let racingStarted = false;
  
  const detectGameActive = setInterval(() => {
    if (racingStarted) return;
    
    const cells = document.querySelectorAll('[class*="witch-game__box"]');
    const pageText = document.body.innerText;
    
    // Game is active when: cells exist AND page shows "Choose a cell"
    const isGameRunning = cells.length > 0 && pageText.includes('Choose a cell');
    
    if (isGameRunning && !racingAttackActive) {
      racingStarted = true;
      console.log("%c🎮 GAME RUNNING DETECTED - Starting racing attack NOW!", "color: #ffff00; font-weight: bold; font-size: 14px;");
      performRacingAttack();
      clearInterval(detectGameActive);
    }
  }, 500);
  
  console.log("%c✅ RACING ATTACK v4.3 - WITH MASTER KILL SWITCH", "color: lime; font-weight: bold;");

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log("%c✅ DOM loaded - Racing attack ready to trigger", "color: cyan;");
    });
  }
})();
