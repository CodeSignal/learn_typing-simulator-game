import Modal from './design-system/components/modal/modal.js';

let helpModal = null;

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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
