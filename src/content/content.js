/**
 * Read Aloud - Content Script
 * Main entry point that runs on Twitter/X pages
 *
 * @author groverception (https://github.com/groverception)
 * @license MIT
 * @repository https://github.com/groverception/read-aloud
 */

(function() {
  'use strict';

  const PLAYER_ID = 'read-aloud-player';
  const POSITION_KEY = 'readAloud_playerPosition';
  const TRANSCRIPT_KEY = 'readAloud_transcriptVisible';

  let playerElement = null;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  // TODO: Re-enable when scroll/highlight feature is fixed
  // let paragraphElements = [];
  // let currentHighlightedElement = null;
  let checkInterval = null;
  let lastUrl = '';
  let transcriptVisible = true;
  let currentChunks = [];
  let manuallyClosed = false; // Track if user manually closed the player

  /**
   * Create the floating player UI
   */
  function createPlayer() {
    if (document.getElementById(PLAYER_ID)) {
      return document.getElementById(PLAYER_ID);
    }

    // Restore transcript visibility preference
    try {
      const saved = localStorage.getItem(TRANSCRIPT_KEY);
      if (saved !== null) {
        transcriptVisible = saved === 'true';
      }
    } catch (e) {}

    const player = document.createElement('div');
    player.id = PLAYER_ID;
    player.innerHTML = `
      <div id="read-aloud-header">
        <div class="title">
          <span class="drag-icon">&#9776;</span>
          <span>Read Aloud</span>
        </div>
        <div class="read-aloud-header-btns">
          <button id="read-aloud-close" title="Close">&times;</button>
        </div>
      </div>
      <div id="read-aloud-content">
        <div id="read-aloud-voice-container">
          <label for="read-aloud-voice-select">Voice</label>
          <select id="read-aloud-voice-select">
            <option value="">Loading voices...</option>
          </select>
        </div>
        <div id="read-aloud-speed-container">
          <label for="read-aloud-speed-slider">Speed: <span id="read-aloud-speed-value">0.85x</span></label>
          <input type="range" id="read-aloud-speed-slider" min="0.5" max="1.5" step="0.05" value="0.85">
        </div>
        <div id="read-aloud-controls">
          <button id="read-aloud-play-btn" class="read-aloud-btn">
            <span class="icon">&#9658;</span>
            <span class="text">Play</span>
          </button>
          <button id="read-aloud-skip-btn" class="read-aloud-btn" title="Skip to next paragraph" disabled>
            <span class="icon">&#9197;</span>
            <span class="text">Skip</span>
          </button>
          <button id="read-aloud-stop-btn" class="read-aloud-btn">
            <span class="icon">&#9632;</span>
            <span class="text">Stop</span>
          </button>
        </div>
        <div id="read-aloud-progress">Ready to read</div>
        <button id="read-aloud-transcript-toggle" title="Toggle Transcript">
          <span class="toggle-icon">${transcriptVisible ? '▼' : '▶'}</span>
          <span class="toggle-text">${transcriptVisible ? 'Hide' : 'Show'} Transcript</span>
        </button>
      </div>
      <div id="read-aloud-transcript" class="${transcriptVisible ? '' : 'hidden'}">
        <div id="read-aloud-transcript-header">
          <span>Transcript</span>
        </div>
        <div id="read-aloud-transcript-content">
          <div class="transcript-placeholder" style="padding: 12px; color: #8b98a5; text-align: center; font-size: 12px;">
            Press Play to load transcript
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(player);

    // Restore saved position
    restorePosition(player);

    // Setup event listeners
    setupEventListeners(player);

    // Load voices
    loadVoices();

    playerElement = player;
    return player;
  }

  /**
   * Load available voices into the dropdown
   */
  async function loadVoices() {
    const select = document.getElementById('read-aloud-voice-select');
    if (!select) return;

    const voices = await window.TTS.getVoices();

    select.innerHTML = '';

    if (voices.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No voices available';
      select.appendChild(option);
      return;
    }

    // Add voices directly (already filtered to top quality)
    for (const voice of voices) {
      const option = document.createElement('option');
      option.value = voice.name;
      // Format: "Name (Region)"
      const langLabel = voice.lang.replace('en-', '').toUpperCase();
      option.textContent = `${voice.name} (${langLabel})`;
      select.appendChild(option);
    }

    // Restore saved voice preference
    await window.TTS.initVoice();
    const state = window.TTS.getState();
    if (state.currentVoice) {
      select.value = state.currentVoice;
    } else if (voices.length > 0) {
      select.value = voices[0].name;
    }

    // Also update speed slider with saved rate
    const speedSlider = document.getElementById('read-aloud-speed-slider');
    const speedValue = document.getElementById('read-aloud-speed-value');
    if (speedSlider && speedValue) {
      const savedRate = window.TTS.getRate();
      speedSlider.value = savedRate;
      speedValue.textContent = `${savedRate.toFixed(2)}x`;
    }
  }

  /**
   * Setup event listeners for the player
   */
  function setupEventListeners(player) {
    const header = player.querySelector('#read-aloud-header');
    const closeBtn = player.querySelector('#read-aloud-close');
    const playBtn = player.querySelector('#read-aloud-play-btn');
    const stopBtn = player.querySelector('#read-aloud-stop-btn');
    const skipBtn = player.querySelector('#read-aloud-skip-btn');
    const voiceSelect = player.querySelector('#read-aloud-voice-select');
    const speedSlider = player.querySelector('#read-aloud-speed-slider');
    const speedValue = player.querySelector('#read-aloud-speed-value');
    const transcriptToggle = player.querySelector('#read-aloud-transcript-toggle');

    // Drag functionality
    header.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);

    // Touch support for mobile
    header.addEventListener('touchstart', startDragTouch, { passive: false });
    document.addEventListener('touchmove', onDragTouch, { passive: false });
    document.addEventListener('touchend', endDrag);

    // Close button - mark as manual close
    closeBtn.addEventListener('click', () => hidePlayer(true));

    // Play/Pause button
    playBtn.addEventListener('click', togglePlay);

    // Stop button
    stopBtn.addEventListener('click', stopReading);

    // Skip button - prevent any event bubbling
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      skipParagraph();
    });

    // Transcript toggle
    transcriptToggle.addEventListener('click', toggleTranscript);

    // Speed slider
    speedSlider.addEventListener('input', (e) => {
      const rate = parseFloat(e.target.value);
      window.TTS.setRate(rate);
      speedValue.textContent = `${rate.toFixed(2)}x`;
    });

    // Initialize speed slider with saved value
    const savedRate = window.TTS.getRate();
    speedSlider.value = savedRate;
    speedValue.textContent = `${savedRate.toFixed(2)}x`;

    // Voice selection - restart with new voice if playing
    voiceSelect.addEventListener('change', async (e) => {
      const state = window.TTS.getState();
      const wasPlaying = state.isPlaying;
      const currentChunk = state.currentChunk;

      await window.TTS.setVoice(e.target.value);

      // If was playing, restart from current position with new voice
      if (wasPlaying) {
        const text = window.ArticleParser.getReadableText();
        if (text) {
          await window.TTS.speak(text);
          // Skip to the chunk we were at
          if (currentChunk > 0) {
            window.TTS.skipToChunk(currentChunk);
          }
        }
      }
    });

    // TTS callbacks
    window.TTS.setCallbacks({
      onStart: () => {
        updateUI('playing');
        updateTranscript();
      },
      onEnd: () => {
        updateUI('stopped');
        // TODO: Re-enable article highlighting when scroll/highlight feature is fixed
        // clearHighlight();
        updateTranscriptHighlight(-1);
      },
      onPause: () => updateUI('paused'),
      onResume: () => updateUI('playing'),
      onChunkChange: (current, total, text) => {
        updateProgress(current + 1, total);
        // TODO: Re-enable article scroll/highlight when feature is fixed
        // scrollToCurrentParagraph(current);
        updateTranscriptHighlight(current);
      }
    });
  }

  /**
   * Toggle transcript visibility
   */
  function toggleTranscript() {
    transcriptVisible = !transcriptVisible;
    const transcript = document.getElementById('read-aloud-transcript');
    const toggleBtn = document.getElementById('read-aloud-transcript-toggle');

    if (transcript) {
      transcript.classList.toggle('hidden', !transcriptVisible);
    }

    // Update toggle button text and icon
    if (toggleBtn) {
      const iconSpan = toggleBtn.querySelector('.toggle-icon');
      const textSpan = toggleBtn.querySelector('.toggle-text');
      if (iconSpan) iconSpan.textContent = transcriptVisible ? '▼' : '▶';
      if (textSpan) textSpan.textContent = (transcriptVisible ? 'Hide' : 'Show') + ' Transcript';
    }

    // Save preference
    try {
      localStorage.setItem(TRANSCRIPT_KEY, transcriptVisible.toString());
    } catch (e) {}
  }

  /**
   * Update transcript content
   */
  function updateTranscript() {
    const container = document.getElementById('read-aloud-transcript-content');
    if (!container) return;

    currentChunks = window.TTS.getChunks();

    if (currentChunks.length === 0) {
      container.innerHTML = `
        <div class="transcript-placeholder" style="padding: 12px; color: #8b98a5; text-align: center; font-size: 12px;">
          No content to display
        </div>
      `;
      return;
    }

    container.innerHTML = currentChunks.map((chunk, index) => {
      // Truncate long paragraphs for display
      const displayText = chunk.length > 200 ? chunk.substring(0, 200) + '...' : chunk;
      return `
        <div class="transcript-paragraph" data-index="${index}" title="Click to jump to this paragraph">
          <span class="transcript-paragraph-number">${index + 1}.</span>
          ${escapeHtml(displayText)}
        </div>
      `;
    }).join('');

    // Add click handlers for transcript paragraphs
    container.querySelectorAll('.transcript-paragraph').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt(el.dataset.index, 10);
        jumpToParagraph(index);
      });
    });
  }

  /**
   * Update transcript highlight to show current paragraph
   */
  function updateTranscriptHighlight(currentIndex) {
    const container = document.getElementById('read-aloud-transcript-content');
    if (!container) return;

    // Remove previous highlight
    container.querySelectorAll('.transcript-paragraph.current').forEach(el => {
      el.classList.remove('current');
    });

    // Add highlight to current
    if (currentIndex >= 0) {
      const currentEl = container.querySelector(`.transcript-paragraph[data-index="${currentIndex}"]`);
      if (currentEl) {
        currentEl.classList.add('current');
        // Scroll into view within transcript
        currentEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  /**
   * Jump to a specific paragraph
   */
  function jumpToParagraph(index) {
    const state = window.TTS.getState();

    if (!state.isPlaying) {
      // Start playing first, then skip
      const text = window.ArticleParser.getReadableText();
      if (text) {
        // TODO: Re-enable when scroll/highlight feature is fixed
        // paragraphElements = window.ArticleParser.getParagraphElements();
        window.TTS.speak(text).then(() => {
          // Wait a moment for chunks to be ready, then skip
          setTimeout(() => {
            window.TTS.skipToChunk(index);
          }, 100);
        });
      }
    } else {
      window.TTS.skipToChunk(index);
    }
  }

  /**
   * Skip to next paragraph
   */
  function skipParagraph() {
    window.TTS.skipNext();
  }

  /**
   * Escape HTML for safe display
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Drag functionality
   */
  function startDrag(e) {
    if (e.target.closest('button')) return;

    isDragging = true;
    const rect = playerElement.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    playerElement.style.transition = 'none';
  }

  function startDragTouch(e) {
    if (e.target.closest('button')) return;

    e.preventDefault();
    isDragging = true;
    const touch = e.touches[0];
    const rect = playerElement.getBoundingClientRect();
    dragOffset.x = touch.clientX - rect.left;
    dragOffset.y = touch.clientY - rect.top;
    playerElement.style.transition = 'none';
  }

  function onDrag(e) {
    if (!isDragging) return;

    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;

    // Keep within viewport
    const maxX = window.innerWidth - playerElement.offsetWidth;
    const maxY = window.innerHeight - playerElement.offsetHeight;

    playerElement.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    playerElement.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
    playerElement.style.right = 'auto';
    playerElement.style.bottom = 'auto';
  }

  function onDragTouch(e) {
    if (!isDragging) return;

    e.preventDefault();
    const touch = e.touches[0];
    const x = touch.clientX - dragOffset.x;
    const y = touch.clientY - dragOffset.y;

    const maxX = window.innerWidth - playerElement.offsetWidth;
    const maxY = window.innerHeight - playerElement.offsetHeight;

    playerElement.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    playerElement.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
    playerElement.style.right = 'auto';
    playerElement.style.bottom = 'auto';
  }

  function endDrag() {
    if (isDragging) {
      isDragging = false;
      playerElement.style.transition = '';
      savePosition();
    }
  }

  /**
   * Save player position to localStorage
   */
  function savePosition() {
    try {
      const rect = playerElement.getBoundingClientRect();
      localStorage.setItem(POSITION_KEY, JSON.stringify({
        left: rect.left,
        top: rect.top
      }));
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Restore player position from localStorage
   */
  function restorePosition(player) {
    try {
      const saved = localStorage.getItem(POSITION_KEY);
      if (saved) {
        const pos = JSON.parse(saved);
        player.style.left = pos.left + 'px';
        player.style.top = pos.top + 'px';
        player.style.right = 'auto';
        player.style.bottom = 'auto';
      }
    } catch (e) {
      // Use default position
    }
  }

  /**
   * Toggle play/pause
   */
  function togglePlay() {
    const state = window.TTS.getState();

    if (state.isPlaying) {
      window.TTS.togglePause();
    } else {
      // Start new reading
      const text = window.ArticleParser.getReadableText();
      if (text) {
        // TODO: Re-enable when scroll/highlight feature is fixed
        // paragraphElements = window.ArticleParser.getParagraphElements();
        window.TTS.speak(text);
      } else {
        updateProgress(0, 0, 'No article content found');
      }
    }
  }

  /**
   * Stop reading
   */
  function stopReading() {
    window.TTS.stop();
    updateUI('stopped');
  }

  /**
   * Update UI based on state
   */
  function updateUI(state) {
    const playBtn = document.getElementById('read-aloud-play-btn');
    const skipBtn = document.getElementById('read-aloud-skip-btn');
    if (!playBtn) return;

    const icon = playBtn.querySelector('.icon');
    const text = playBtn.querySelector('.text');

    switch (state) {
      case 'playing':
        playBtn.classList.add('playing');
        icon.innerHTML = '&#10074;&#10074;'; // Pause icon
        text.textContent = 'Pause';
        skipBtn.disabled = false;
        break;
      case 'paused':
        playBtn.classList.add('playing');
        icon.innerHTML = '&#9658;'; // Play icon
        text.textContent = 'Resume';
        skipBtn.disabled = false;
        break;
      case 'stopped':
      default:
        playBtn.classList.remove('playing');
        icon.innerHTML = '&#9658;'; // Play icon
        text.textContent = 'Play';
        skipBtn.disabled = true;
        updateProgress(0, 0, 'Ready to read');
        break;
    }
  }

  /**
   * Update progress indicator
   */
  function updateProgress(current, total, customMessage = null) {
    const progress = document.getElementById('read-aloud-progress');
    if (!progress) return;

    if (customMessage) {
      progress.textContent = customMessage;
      progress.classList.remove('active');
    } else if (total > 0) {
      progress.textContent = `Reading: ${current} of ${total} paragraphs`;
      progress.classList.add('active');
    } else {
      progress.textContent = 'Ready to read';
      progress.classList.remove('active');
    }
  }

  // TODO: Re-enable scroll and highlight feature for article paragraphs
  // Currently disabled - needs proper element mapping with extracted content
  /*
  function scrollToCurrentParagraph(index) {
    clearHighlight();

    if (index < paragraphElements.length) {
      const element = paragraphElements[index];
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        element.classList.add('read-aloud-highlight');
        currentHighlightedElement = element;
      }
    }
  }

  function clearHighlight() {
    if (currentHighlightedElement) {
      currentHighlightedElement.classList.remove('read-aloud-highlight');
      currentHighlightedElement = null;
    }

    // Also clear any other highlights
    document.querySelectorAll('.read-aloud-highlight').forEach(el => {
      el.classList.remove('read-aloud-highlight');
    });
  }
  */

  /**
   * Show the player
   */
  function showPlayer() {
    if (!document.getElementById(PLAYER_ID)) {
      createPlayer();
    }
    const player = document.getElementById(PLAYER_ID);
    if (player) {
      player.style.display = 'flex';
    }
  }

  /**
   * Hide the player
   */
  function hidePlayer(isManualClose = false) {
    stopReading();
    const player = document.getElementById(PLAYER_ID);
    if (player) {
      player.style.display = 'none';
    }
    if (isManualClose) {
      manuallyClosed = true;
    }
  }

  /**
   * Remove the player from DOM
   */
  function removePlayer() {
    stopReading();
    const player = document.getElementById(PLAYER_ID);
    if (player) {
      player.remove();
    }
    playerElement = null;
  }

  /**
   * Check if we're on an article page and show/hide player accordingly
   */
  function checkAndUpdatePlayer() {
    const currentUrl = window.location.href;

    // Only check if URL changed or on initial load
    if (currentUrl === lastUrl && document.getElementById(PLAYER_ID)) {
      return;
    }

    // Reset manual close flag when navigating to a new page
    if (currentUrl !== lastUrl) {
      manuallyClosed = false;
    }
    lastUrl = currentUrl;

    // Wait a bit for Twitter's SPA to render content
    setTimeout(() => {
      const isArticle = window.ArticleParser.isArticlePage();

      if (isArticle && !manuallyClosed) {
        showPlayer();
      } else if (!isArticle) {
        hidePlayer();
      }
    }, 500);
  }

  /**
   * Initialize the extension
   */
  function init() {
    // Initial check
    checkAndUpdatePlayer();

    // Watch for URL changes (Twitter is a SPA)
    checkInterval = setInterval(checkAndUpdatePlayer, 1000);

    // Also watch for popstate events
    window.addEventListener('popstate', checkAndUpdatePlayer);

    // Listen for messages from background script
    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'toggle-reading') {
          if (window.ArticleParser.isArticlePage()) {
            showPlayer();
            manuallyClosed = false; // Reset manual close flag
            togglePlay();
          }
          sendResponse({ success: true });
        } else if (message.action === 'icon-clicked') {
          const isArticle = window.ArticleParser.isArticlePage();
          const player = document.getElementById(PLAYER_ID);
          const playerVisible = player && player.style.display !== 'none';

          if (!isArticle) {
            // Not on an article page
            sendResponse({
              success: false,
              message: 'Open an X Article for the Read Aloud player to appear.'
            });
          } else if (playerVisible) {
            // Player is already visible
            sendResponse({
              success: true,
              message: 'Player is already open.'
            });
          } else {
            // On article page, player is hidden - reopen it
            manuallyClosed = false;
            showPlayer();
            sendResponse({
              success: true,
              message: 'Player opened!'
            });
          }
        }
        return true;
      });
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (checkInterval) {
      clearInterval(checkInterval);
    }
    window.TTS.stop();
  });
})();
