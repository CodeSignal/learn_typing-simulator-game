import Modal from './design-system/components/modal/modal.js';

let websocket = null;
let helpModal = null;

function initializeWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/ws`;

  try {
    websocket = new WebSocket(wsUrl);

    websocket.onopen = function(event) {
      console.log('WebSocket connected');
    };

    websocket.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message' && data.message) {
          alert(data.message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onclose = function(event) {
      console.log('WebSocket disconnected');

      setTimeout(() => {
        console.log('Attempting to reconnect WebSocket...');
        initializeWebSocket();
      }, 3000);
    };

    websocket.onerror = function(error) {
      console.error('WebSocket error:', error);
    };
  } catch (error) {
    console.error('Failed to create WebSocket connection:', error);
  }
}

function createHelpModal(content) {
  if (helpModal) {
    helpModal.destroy();
  }

  helpModal = Modal.createHelpModal({
    title: 'Help / User Guide',
    content
  });
}

async function initializeHelpModal() {
  const helpTrigger = document.querySelector('#btn-help');
  if (!helpTrigger) {
    console.warn("Help modal trigger '#btn-help' not found");
    return;
  }

  helpTrigger.addEventListener('click', () => {
    if (helpModal) {
      helpModal.open();
    }
  });

  try {
    const response = await fetch('./help-content.html');
    if (!response.ok) {
      throw new Error(`Failed to load help-content.html: ${response.status}`);
    }
    const helpContent = await response.text();
    createHelpModal(helpContent);
  } catch (error) {
    console.error('Failed to load help content:', error);
    createHelpModal('<p>Help content could not be loaded. Please check that help-content.html exists.</p>');
  }
}

function initialize() {
  initializeHelpModal();
  initializeWebSocket();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
