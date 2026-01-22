/**
 * Read Aloud - Background Service Worker
 * Handles keyboard shortcuts and extension state
 *
 * @author groverception (https://github.com/groverception)
 * @license MIT
 * @repository https://github.com/groverception/read-aloud
 */

// Debug flag - set to true to enable console logging
const DEBUG = false;

// Handle keyboard shortcut commands
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-reading') {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && (tab.url.includes('x.com') || tab.url.includes('twitter.com'))) {
      // Send message to content script to toggle reading
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggle-reading' });
      } catch (error) {
        // Content script might not be loaded yet
        DEBUG && console.log('Could not send message to content script:', error);
      }
    }
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url.includes('x.com') || tab.url.includes('twitter.com')) {
    // Send message to check page status and open player
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'icon-clicked' });

      // Show notification based on response
      if (response && response.message) {
        // Use scripting API to show alert on the page
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (msg) => {
            // Create a toast notification
            const existingToast = document.getElementById('read-aloud-toast');
            if (existingToast) existingToast.remove();

            const toast = document.createElement('div');
            toast.id = 'read-aloud-toast';
            toast.textContent = msg;
            toast.style.cssText = `
              position: fixed;
              top: 20px;
              left: 50%;
              transform: translateX(-50%);
              background: #1d9bf0;
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              font-size: 14px;
              font-weight: 500;
              z-index: 9999999;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              animation: toastFadeIn 0.3s ease;
            `;

            // Add animation keyframes
            if (!document.getElementById('read-aloud-toast-style')) {
              const style = document.createElement('style');
              style.id = 'read-aloud-toast-style';
              style.textContent = `
                @keyframes toastFadeIn {
                  from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                  to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                @keyframes toastFadeOut {
                  from { opacity: 1; transform: translateX(-50%) translateY(0); }
                  to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                }
              `;
              document.head.appendChild(style);
            }

            document.body.appendChild(toast);

            // Auto-remove after 3 seconds
            setTimeout(() => {
              toast.style.animation = 'toastFadeOut 0.3s ease forwards';
              setTimeout(() => toast.remove(), 300);
            }, 3000);
          },
          args: [response.message]
        });
      }
    } catch (error) {
      // Content script not loaded - show message to open X article
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          alert('Open an X Article for the Read Aloud player to appear.');
        }
      });
    }
  } else {
    // Not on X/Twitter at all
    // Can't use scripting on non-permitted URLs, so we'll just log
    DEBUG && console.log('Read Aloud: Please navigate to X.com to use this extension');
  }
});

// Log when service worker starts
DEBUG && console.log('Read Aloud service worker started');
