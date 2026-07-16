// audio-game.js — Audio dictation mode
// A short audio clip is played and the target transcript is kept hidden from
// the user, who types what they hear. The clip is a real recording supplied via
// `config.audio.src` (an audio/video URL), played through the browser's native
// audio player (play/pause, seek, elapsed / total time, volume, and playback
// speed via its menu). If no clip URL is configured it falls back to the
// browser's speech synthesis. On submit, the transcription is compared against
// the target to produce accuracy/speed/error statistics.

import { state } from '../state.js';
import { updateRealtimeStats, calculateCompletionStats, saveStatistics } from '../stats.js';
import { showCompletionScreen } from '../completion.js';

export class AudioGame {
  constructor() {
    this.container = document.getElementById('audio-container');
    this.input = document.getElementById('audio-transcription-input');
    this.playButton = document.getElementById('btn-audio-play');
    this.replayButton = document.getElementById('btn-audio-replay');
    this.submitButton = document.getElementById('btn-audio-submit');
    this.statusEl = document.getElementById('audio-status');
    this.audioEl = document.getElementById('audio-player');
    this.fallbackEl = document.getElementById('audio-fallback');

    this.typedText = '';
    this.hasSubmitted = false;
    this.hasPlayed = false;

    // Bind handlers once so they can be detached on destroy.
    this._onInput = this._onInput.bind(this);
    this._onPlay = this.play.bind(this);
    this._onSubmit = this.submit.bind(this);
  }

  initialize() {
    if (this.container) this.container.style.display = 'flex';

    const classicContainer = document.getElementById('classic-typing-container');
    if (classicContainer) classicContainer.style.display = 'none';

    if (this.hasAudioFile()) {
      // Clip configured: use the native <audio controls> player.
      this.audioEl.src = this._audioSrc();
      const rate = state.config.audio && state.config.audio.rate;
      if (typeof rate === 'number' && rate > 0) this.audioEl.playbackRate = rate;
      this.audioEl.onerror = () => this._updateStatus('Could not load the audio clip.');
      this.audioEl.style.display = '';
      if (this.fallbackEl) this.fallbackEl.style.display = 'none';
    } else {
      // No clip: hide the native player and use the speech-synthesis fallback.
      if (this.audioEl) this.audioEl.style.display = 'none';
      if (this.fallbackEl) this.fallbackEl.style.display = '';
    }

    if (this.input) {
      this.input.value = '';
      this.input.addEventListener('input', this._onInput);
    }
    // The custom Play/Replay buttons only drive the speech-synthesis fallback.
    if (this.playButton) this.playButton.addEventListener('click', this._onPlay);
    if (this.replayButton) this.replayButton.addEventListener('click', this._onPlay);
    if (this.submitButton) this.submitButton.addEventListener('click', this._onSubmit);

    this._resetStatus();
  }

  _audioSrc() {
    return (state.config.audio && state.config.audio.src) || '';
  }

  hasAudioFile() {
    return !!(this.audioEl && this._audioSrc());
  }

  isSpeechSupported() {
    return typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined';
  }

  // Speech-synthesis fallback, used only when no clip URL is configured.
  play() {
    if (!state.originalText) return;
    if (!this.isSpeechSupported()) {
      this._updateStatus('Audio playback is not available in this browser.');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(state.originalText);
      const rate = state.config.audio && state.config.audio.rate;
      if (typeof rate === 'number' && rate > 0) {
        utterance.rate = rate;
      }
      utterance.onstart = () => this._updateStatus('Playing audio…');
      utterance.onend = () => this._updateStatus('Audio finished. Use Replay to hear it again.');
      window.speechSynthesis.speak(utterance);
      this.hasPlayed = true;
      if (this.input) this.input.focus();
    } catch (error) {
      console.error('Error playing audio:', error);
      this._updateStatus('Could not play audio.');
    }
  }

  _onInput(e) {
    if (this.hasSubmitted) return;

    this.typedText = e.target.value;
    // Mirror into shared state so stats.js stays the single source of truth.
    state.typedText = this.typedText;

    if (state.startTime === null && this.typedText.length > 0) {
      state.startTime = Date.now();
    }

    updateRealtimeStats();
  }

  async submit() {
    if (this.hasSubmitted) return;
    this.hasSubmitted = true;

    this._stopPlayback();

    this.typedText = this.input ? this.input.value : this.typedText;
    state.typedText = this.typedText;

    // Ensure a start time exists even if the user submits without typing.
    if (state.startTime === null) state.startTime = Date.now();

    // When the task opts in via `includeTranscript`, save the stats together with
    // both transcripts so the grader can compare them (as the original grader
    // did); otherwise use the normal save flow in completion.js.
    if (state.config.includeTranscript) {
      await this._saveStatsWithTranscript();
    }
    showCompletionScreen();
  }

  // Persist the numeric stats plus both transcripts to stats.txt. Reuses the
  // shared saveStatistics for the numbers (so stats.js stays untouched), then
  // appends the expected/submitted transcriptions so a grader can evaluate the
  // actual transcription — not just the stats. completion.js skips its own save
  // when this ran so it isn't overwritten. Gated by the `includeTranscript` flag.
  async _saveStatsWithTranscript() {
    const stats = calculateCompletionStats();
    if (!stats) return;
    try {
      await saveStatistics(stats);
      const base = await (await fetch('./stats.txt', { cache: 'no-store' })).text();
      const transcripts =
        `Expected Transcription:\n${state.originalText}\n\n` +
        `Submitted Transcription:\n${this.typedText}\n\n`;
      const marker = 'Generated:';
      const idx = base.indexOf(marker);
      const body = idx >= 0
        ? base.slice(0, idx) + transcripts + base.slice(idx)
        : base.replace(/\s*$/, '\n') + '\n' + transcripts;
      await fetch('/save-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body
      });
    } catch (error) {
      console.error('Could not save transcript:', error);
    }
  }

  reset() {
    this.hasSubmitted = false;
    this.hasPlayed = false;
    this.typedText = '';
    if (this.input) this.input.value = '';
    this._stopPlayback();
    this._resetStatus();
  }

  // Audio mode manages its own view; text.js renderText delegates here as a no-op.
  renderText() {}

  _stopPlayback() {
    if (this.audioEl) {
      try { this.audioEl.pause(); this.audioEl.currentTime = 0; } catch (e) { /* ignore */ }
    }
    if (this.isSpeechSupported()) window.speechSynthesis.cancel();
  }

  _resetStatus() {
    let message;
    if (this.hasAudioFile()) {
      // The native player conveys playback state, so no status line is needed.
      message = '';
    } else if (this.isSpeechSupported()) {
      message = 'Press "Play audio" to hear the text, then type what you hear.';
    } else {
      message = 'Audio playback is not available in this browser.';
    }
    this._updateStatus(message);
  }

  _updateStatus(message) {
    if (this.statusEl) this.statusEl.textContent = message;
  }

  destroy() {
    if (this.input) this.input.removeEventListener('input', this._onInput);
    if (this.playButton) this.playButton.removeEventListener('click', this._onPlay);
    if (this.replayButton) this.replayButton.removeEventListener('click', this._onPlay);
    if (this.submitButton) this.submitButton.removeEventListener('click', this._onSubmit);
    this._stopPlayback();
  }
}
