document.addEventListener('DOMContentLoaded', () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const connectBtn = document.getElementById('connectBtn');
  const reconnectBtn = document.getElementById('reconnectBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  
  let currentMode = 'offscreen';
  
  function updateStatus(connected, url, mode) {
    if (mode) {
      currentMode = mode;
    }
    
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
    if (chrome.runtime.lastError) {
      console.log('Error getting status:', chrome.runtime.lastError.message);
      statusText.textContent = 'Service loading...';
      return;
    }
    if (response) {
      updateStatus(response.connected, response.serverUrl, response.mode);
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
    
    statusText.textContent = 'Connecting...';
    statusDot.className = 'status-dot connecting';
    
    chrome.runtime.sendMessage({ type: 'set_server_url', url }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Error setting URL:', chrome.runtime.lastError.message);
        statusText.textContent = 'Connection error, retrying...';
        return;
      }
      if (response?.success) {
        statusText.textContent = 'Connecting...';
      }
    });
  });
  
  reconnectBtn.addEventListener('click', () => {
    statusText.textContent = 'Reconnecting...';
    statusDot.className = 'status-dot connecting';
    
    chrome.runtime.sendMessage({ type: 'reconnect' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Error reconnecting:', chrome.runtime.lastError.message);
        statusText.textContent = 'Retry failed, try again...';
        return;
      }
      if (response?.success) {
        statusText.textContent = 'Reconnecting...';
      }
    });
  });
});
