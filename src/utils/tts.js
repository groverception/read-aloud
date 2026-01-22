/**
 * Text-to-Speech Module
 * Wrapper around Web Speech API (SpeechSynthesis)
 *
 * @author groverception (https://github.com/groverception)
 * @license MIT
 * @repository https://github.com/groverception/read-aloud
 */

const TTS = (() => {
  let utterance = null;
  let isPlaying = false;
  let isPaused = false;
  let currentVoice = null;
  let textChunks = [];
  let currentChunkIndex = 0;

  // Callbacks
  let onStartCallback = null;
  let onEndCallback = null;
  let onPauseCallback = null;
  let onResumeCallback = null;
  let onBoundaryCallback = null;
  let onChunkChangeCallback = null;

  const STORAGE_KEY = 'readAloud_voicePreference';
  const RATE_STORAGE_KEY = 'readAloud_ratePreference';
  const MAX_CHUNK_LENGTH = 4000;

  // Speech rate: 0.5 (slow) to 2.0 (fast), default 0.85 (slightly slower for clarity)
  let currentRate = 0.85;

  // High-quality voice names to prioritize (natural sounding)
  // These are curated for best pronunciation
  const RECOMMENDED_VOICES = [
    // macOS high-quality voices
    'Samantha',           // en-US - Very natural female
    'Alex',               // en-US - Natural male
    'Karen',              // en-AU - Australian female
    'Daniel',             // en-GB - British male
    'Moira',              // en-IE - Irish female
    'Tessa',              // en-ZA - South African female

    // Windows/Edge natural voices
    'Microsoft David',    // en-US male
    'Microsoft Zira',     // en-US female
    'Microsoft Mark',     // en-US male
    'Microsoft Eva',      // en-US female
    'Microsoft Jenny',    // en-US female (newer)
    'Microsoft Aria',     // en-US female (neural)
    'Microsoft Guy',      // en-US male (neural)

    // Google Chrome voices
    'Google US English',
    'Google UK English Female',
    'Google UK English Male',

    // Edge online natural voices (best quality)
    'Microsoft Ana Online (Natural)',
    'Microsoft Jenny Online (Natural)',
    'Microsoft Guy Online (Natural)',
    'Microsoft Aria Online (Natural)'
  ];

  /**
   * Get all available voices
   */
  function getAllVoices() {
    return new Promise((resolve) => {
      let voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }

      speechSynthesis.addEventListener('voiceschanged', () => {
        voices = speechSynthesis.getVoices();
        resolve(voices);
      }, { once: true });

      setTimeout(() => {
        resolve(speechSynthesis.getVoices());
      }, 1000);
    });
  }

  /**
   * Get filtered high-quality English voices only
   */
  async function getVoices() {
    const allVoices = await getAllVoices();

    // Filter to English voices only
    const englishVoices = allVoices.filter(v => v.lang.startsWith('en'));

    // Score and sort voices by quality
    const scoredVoices = englishVoices.map(voice => {
      let score = 0;

      // Check if it's a recommended voice
      for (const recommended of RECOMMENDED_VOICES) {
        if (voice.name.includes(recommended)) {
          score += 100;
          break;
        }
      }

      // Prefer "Natural" or "Neural" voices
      if (voice.name.includes('Natural') || voice.name.includes('Neural')) {
        score += 50;
      }

      // Prefer local voices (work offline)
      if (voice.localService) {
        score += 10;
      }

      // Prefer US/UK English
      if (voice.lang === 'en-US' || voice.lang === 'en-GB') {
        score += 5;
      }

      return { voice, score };
    });

    // Sort by score descending
    scoredVoices.sort((a, b) => b.score - a.score);

    // Return top 5 voices (or all if less than 5)
    const topVoices = scoredVoices.slice(0, 5).map(sv => sv.voice);

    // If no good voices found, return first 3 English voices
    if (topVoices.length === 0) {
      return englishVoices.slice(0, 3);
    }

    return topVoices;
  }

  /**
   * Get saved voice preference from localStorage
   */
  function getSavedVoice() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Save voice preference to localStorage
   */
  function saveVoicePreference(voiceName) {
    try {
      localStorage.setItem(STORAGE_KEY, voiceName);
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Get saved rate preference from localStorage
   */
  function getSavedRate() {
    try {
      const saved = localStorage.getItem(RATE_STORAGE_KEY);
      if (saved) {
        const rate = parseFloat(saved);
        if (!isNaN(rate) && rate >= 0.5 && rate <= 2.0) {
          return rate;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return 0.85; // Default rate
  }

  /**
   * Save rate preference to localStorage
   */
  function saveRatePreference(rate) {
    try {
      localStorage.setItem(RATE_STORAGE_KEY, rate.toString());
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Set the speech rate (0.5 to 2.0)
   * If currently playing, restarts current chunk with new rate
   */
  function setRate(rate) {
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    const oldRate = currentRate;
    currentRate = clampedRate;
    saveRatePreference(clampedRate);

    // If currently playing and rate actually changed, restart current chunk with new rate
    if (isPlaying && !isPaused && oldRate !== clampedRate && textChunks.length > 0) {
      speechSynthesis.cancel();
      speakChunk(currentChunkIndex);
    }

    return clampedRate;
  }

  /**
   * Get current speech rate
   */
  function getRate() {
    return currentRate;
  }

  /**
   * Initialize rate from saved preference
   */
  function initRate() {
    currentRate = getSavedRate();
  }

  /**
   * Set the voice to use for speech
   */
  async function setVoice(voiceName) {
    const allVoices = await getAllVoices();
    const voice = allVoices.find(v => v.name === voiceName);
    if (voice) {
      currentVoice = voice;
      saveVoicePreference(voiceName);
      return true;
    }
    return false;
  }

  /**
   * Initialize with saved voice preference or best available
   */
  async function initVoice() {
    // Also init rate
    initRate();

    const savedVoiceName = getSavedVoice();
    const allVoices = await getAllVoices();

    if (savedVoiceName) {
      const savedVoice = allVoices.find(v => v.name === savedVoiceName);
      if (savedVoice) {
        currentVoice = savedVoice;
        return;
      }
    }

    // Pick the best available voice
    const recommendedVoices = await getVoices();
    currentVoice = recommendedVoices[0] || allVoices.find(v => v.lang.startsWith('en')) || allVoices[0] || null;
  }

  /**
   * Split text into chunks (paragraphs)
   */
  function splitIntoChunks(text) {
    const chunks = [];
    const paragraphs = text.split(/\n\n+/);

    for (const para of paragraphs) {
      if (para.trim().length === 0) continue;

      if (para.length <= MAX_CHUNK_LENGTH) {
        chunks.push(para.trim());
      } else {
        // Split long paragraphs by sentences
        const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
        let currentChunk = '';

        for (const sentence of sentences) {
          if ((currentChunk + sentence).length > MAX_CHUNK_LENGTH) {
            if (currentChunk.trim()) chunks.push(currentChunk.trim());
            currentChunk = sentence;
          } else {
            currentChunk += sentence;
          }
        }
        if (currentChunk.trim()) chunks.push(currentChunk.trim());
      }
    }

    return chunks;
  }

  /**
   * Speak a chunk of text
   */
  function speakChunk(chunkIndex) {
    if (chunkIndex >= textChunks.length) {
      isPlaying = false;
      isPaused = false;
      if (onEndCallback) onEndCallback();
      return;
    }

    utterance = new SpeechSynthesisUtterance(textChunks[chunkIndex]);

    if (currentVoice) {
      utterance.voice = currentVoice;
    }

    // Use user-configured rate
    utterance.rate = currentRate;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      if (chunkIndex === 0 && onStartCallback) {
        onStartCallback();
      }
      if (onChunkChangeCallback) {
        onChunkChangeCallback(chunkIndex, textChunks.length, textChunks[chunkIndex]);
      }
    };

    utterance.onend = () => {
      currentChunkIndex++;
      if (!isPaused && isPlaying) {
        speakChunk(currentChunkIndex);
      }
    };

    utterance.onboundary = (event) => {
      if (onBoundaryCallback) {
        onBoundaryCallback(event, chunkIndex);
      }
    };

    utterance.onerror = (event) => {
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        console.error('TTS Error:', event.error);
        // Try to continue with next chunk on error
        currentChunkIndex++;
        if (isPlaying && currentChunkIndex < textChunks.length) {
          speakChunk(currentChunkIndex);
        }
      }
    };

    speechSynthesis.speak(utterance);
  }

  /**
   * Start speaking text
   */
  async function speak(text) {
    stop();
    await initVoice();

    textChunks = splitIntoChunks(text);
    currentChunkIndex = 0;

    if (textChunks.length === 0) return;

    isPlaying = true;
    isPaused = false;

    speakChunk(0);
  }

  /**
   * Pause speech
   */
  function pause() {
    if (isPlaying && !isPaused) {
      speechSynthesis.pause();
      isPaused = true;
      if (onPauseCallback) onPauseCallback();
    }
  }

  /**
   * Resume speech
   */
  function resume() {
    if (isPlaying && isPaused) {
      speechSynthesis.resume();
      isPaused = false;
      if (onResumeCallback) onResumeCallback();
    }
  }

  /**
   * Toggle pause/resume
   */
  function togglePause() {
    if (isPaused) {
      resume();
    } else {
      pause();
    }
  }

  /**
   * Stop speech completely
   */
  function stop() {
    speechSynthesis.cancel();
    isPlaying = false;
    isPaused = false;
    currentChunkIndex = 0;
    utterance = null;
  }

  /**
   * Skip to next paragraph/chunk
   */
  function skipNext() {
    if (!isPlaying || currentChunkIndex >= textChunks.length - 1) return false;

    speechSynthesis.cancel();
    currentChunkIndex++;
    speakChunk(currentChunkIndex);
    return true;
  }

  /**
   * Skip to previous paragraph/chunk
   */
  function skipPrevious() {
    if (!isPlaying || currentChunkIndex <= 0) return false;

    speechSynthesis.cancel();
    currentChunkIndex--;
    speakChunk(currentChunkIndex);
    return true;
  }

  /**
   * Skip to specific chunk
   */
  function skipToChunk(index) {
    if (index < 0 || index >= textChunks.length) return false;

    speechSynthesis.cancel();
    currentChunkIndex = index;

    if (isPlaying) {
      speakChunk(currentChunkIndex);
    }
    return true;
  }

  /**
   * Get current state
   */
  function getState() {
    return {
      isPlaying,
      isPaused,
      currentChunk: currentChunkIndex,
      totalChunks: textChunks.length,
      currentVoice: currentVoice ? currentVoice.name : null,
      rate: currentRate
    };
  }

  /**
   * Get all text chunks (for transcript display)
   */
  function getChunks() {
    return [...textChunks];
  }

  /**
   * Set event callbacks
   */
  function setCallbacks({ onStart, onEnd, onPause, onResume, onBoundary, onChunkChange }) {
    if (onStart) onStartCallback = onStart;
    if (onEnd) onEndCallback = onEnd;
    if (onPause) onPauseCallback = onPause;
    if (onResume) onResumeCallback = onResume;
    if (onBoundary) onBoundaryCallback = onBoundary;
    if (onChunkChange) onChunkChangeCallback = onChunkChange;
  }

  // Public API
  return {
    getVoices,
    getAllVoices,
    setVoice,
    setRate,
    getRate,
    speak,
    pause,
    resume,
    togglePause,
    stop,
    skipNext,
    skipPrevious,
    skipToChunk,
    getState,
    getChunks,
    setCallbacks,
    initVoice
  };
})();

// Export for content script
if (typeof window !== 'undefined') {
  window.TTS = TTS;
}
