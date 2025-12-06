document.addEventListener('DOMContentLoaded', () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const connectBtn = document.getElementById('connectBtn');
  const reconnectBtn = document.getElementById('reconnectBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  
  function updateStatus(connected, url) {
    if (connected) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = 'Connected';
      connectBtn.textContent = 'Update Connection';
    } else {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = url ? 'Disconnected' : 'Not configured';
      connectBtn.textContent = 'Connect';
    }
  }
  
  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    if (response) {
      updateStatus(response.connected, response.serverUrl);
      if (response.serverUrl) {
        serverUrlInput.value = response.serverUrl;
      }
    }
  });
  
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'connection_status') {
      updateStatus(message.connected, serverUrlInput.value);
    }
  });
  
  connectBtn.addEventListener('click', () => {
    let url = serverUrlInput.value.trim();
    
    if (!url) {
      alert('Please enter a server URL');
      return;
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
      serverUrlInput.value = url;
    }
    
    url = url.replace(/\/$/, '');
    serverUrlInput.value = url;
    
    chrome.runtime.sendMessage({ type: 'set_server_url', url }, (response) => {
      if (response?.success) {
        statusText.textContent = 'Connecting...';
      }
    });
  });
  
  reconnectBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'reconnect' }, (response) => {
      if (response?.success) {
        statusText.textContent = 'Reconnecting...';
      }
    });
  });
});
