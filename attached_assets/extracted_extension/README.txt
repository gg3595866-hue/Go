Witch Analyzer v4.2 PRO - Fixed Selectors Edition
=================================================

WHAT'S FIXED IN v4.2:
- Fixed selectors to properly detect witch-game__box elements
- Fixed selectors to properly detect witch-game__row elements  
- Added fallback support for w-game-box and w-game-row
- Row-based cell detection instead of global position grouping
- Active row tracking for better click accuracy
- Debug functions exposed: window.__WITCH_FIND_ROWS__(), window.__WITCH_FIND_CELLS__()

INSTALLATION:
1. Open Chrome/Edge and go to chrome://extensions/
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select this folder (witch-extension-v4.2)
5. The extension icon will appear in your toolbar

USAGE:
1. Navigate to the Witch game on 1xbet
2. Look for the crystal ball button in the bottom-right corner
3. Click PLAY - auto-click starts automatically!
4. The extension clicks one cell per row
5. It waits for server confirmation before moving to next row
6. Results appear in real-time on the overlay

PREVIOUS ISSUE (v4.1):
The extension was using [class*="cell"] selector which matched 12 wrong elements
on the page, causing "No cells found for row X" errors.

v4.2 FIX:
Now uses proper selectors:
- .witch-game__box (primary)
- .w-game-box (fallback)
- .witch-game__row (for row detection)
- .w-game-row (fallback for rows)

DEBUGGING:
Open browser console and run:
- window.__WITCH_FIND_ROWS__() - shows detected rows
- window.__WITCH_FIND_CELLS__() - shows detected cells
- window.__WITCH_FIND_ACTIVE_ROW__() - shows active row index

Version: 4.2.0
Date: November 2024
