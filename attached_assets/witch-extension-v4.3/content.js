console.log("%c[WITCH] Content script loaded - Racing Attack v4.3", "color: #00ff00; font-weight: bold;");

(function() {
  'use strict';
  
  function injectMainScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('injected.js');
      script.type = 'text/javascript';
      script.onload = function() { this.remove(); };
      script.onerror = function() {
        console.error("[WITCH] Failed to load injected.js");
        this.remove();
      };
      (document.head || document.documentElement).appendChild(script);
      console.log("%c[WITCH] Racing attack script injected", "color: #00ff00;");
    } catch (e) {
      console.error("[WITCH] Script injection failed: " + e.message);
    }
  }
  
  // Inject immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMainScript);
  } else {
    injectMainScript();
  }
})();
