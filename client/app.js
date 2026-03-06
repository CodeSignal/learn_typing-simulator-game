// app.js
(function() {
  let websocket = null;

  // Initialize WebSocket connection
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

        // Attempt to reconnect after 3 seconds
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

  // Load help content and initialize modal
  async function initializeHelpModal() {
    try {
      const response = await fetch('./help-content.html');
      const helpContent = await response.text();

      // Initialize help modal with actual content
      HelpModal.init({
        triggerSelector: '#btn-help',
        content: helpContent,
        theme: 'auto'
      });
    } catch (error) {
      console.error('Failed to load help content:', error);
      // Fallback to placeholder content
      HelpModal.init({
        triggerSelector: '#btn-help',
        content: '<p>Help content could not be loaded. Please check that help-content.html exists.</p>',
        theme: 'auto'
      });
    }
  }

  // Initialize both help modal and WebSocket when DOM is ready
  function initialize() {
    initializeHelpModal();
    initializeWebSocket();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
