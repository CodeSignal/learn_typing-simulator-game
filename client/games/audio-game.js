// audio-game.js — Audio dictation mode
// A short audio clip is played and the target transcript is kept hidden from
// the user, who types what they hear. The clip is a real recording supplied via
// `config.audio.src` (an audio/video URL), played through the browser's native
// audio player (play/pause, seek, elapsed / total time, volume, and playback
// speed via its menu). If no clip URL is configured it falls back to the
// browser's speech synthesis. On submit, the transcription is compared against
// the target to produce accuracy/speed/error statistics.

import { state } from '../state.js';
import { updateRealtimeStats } from '../stats.js';
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

    // The clip is downloaded from a remote URL, which can take a moment; surface
    // that in the status line so the user isn't staring at a silent player.
    this._onLoadStart = () => this._updateStatus('Loading audio…');
    this._onCanPlay = () => this._resetStatus();
    this._onWaiting = () => this._updateStatus('Buffering audio…');
    this._onPlaying = () => this._resetStatus();
    this._onAudioError = () => this._updateStatus('Could not load the audio clip.');

    // Optional listen limit (config.audio.maxPlays). For the gist / meeting-notes
    // task the clip may be played only a couple of times, so the candidate has to
    // capture the gist under realistic pressure. A "listen" is counted when
    // playback starts from the beginning; resuming after a mid-clip pause does not.
    this.playsUsed = 0;
    this.listenInProgress = false;
    this._onAudioPlay = () => this._handlePlay();
    this._onAudioEnded = () => { this.listenInProgress = false; this._resetStatus(); };

    // A <audio> with preload other than "none" delays the document 'load' event
    // until the clip buffers, and the task view only reveals the simulation once
    // it loads — so an eagerly-preloaded remote clip makes the whole page wait on
    // the download. We keep preload="none" (markup) so the page appears at once,
    // then start the download ourselves after the page has loaded.
    this._beginDownload = () => {
      if (!this.audioEl) return;
      try {
        this.audioEl.preload = 'auto';
        this.audioEl.load();
      } catch (e) { /* ignore */ }
    };
  }

  initialize() {
    if (this.container) this.container.style.display = 'flex';

    const classicContainer = document.getElementById('classic-typing-container');
    if (classicContainer) classicContainer.style.display = 'none';

    if (this.hasAudioFile()) {
      // Clip configured: use the native <audio controls> player. Wire the load
      // listeners before setting src so the initial "Loading audio…" is caught.
      this.audioEl.addEventListener('loadstart', this._onLoadStart);
      this.audioEl.addEventListener('canplay', this._onCanPlay);
      this.audioEl.addEventListener('canplaythrough', this._onCanPlay);
      this.audioEl.addEventListener('waiting', this._onWaiting);
      this.audioEl.addEventListener('playing', this._onPlaying);
      this.audioEl.addEventListener('error', this._onAudioError);
      if (this._maxPlays()) {
        this.audioEl.addEventListener('play', this._onAudioPlay);
        this.audioEl.addEventListener('ended', this._onAudioEnded);
      }
      this.audioEl.src = this._audioSrc();       // preload="none": no fetch yet
      const rate = state.config.audio && state.config.audio.rate;
      if (typeof rate === 'number' && rate > 0) this.audioEl.playbackRate = rate;
      this.audioEl.style.display = '';
      if (this.fallbackEl) this.fallbackEl.style.display = 'none';

      // Start the download only after the page has loaded, so the clip never
      // holds up the document 'load' event (and thus the sim appearing). The
      // "Loading audio…" status then covers the background download.
      if (document.readyState === 'complete') {
        this._beginDownload();
      } else {
        window.addEventListener('load', this._beginDownload, { once: true });
      }
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

  _maxPlays() {
    const n = state.config.audio && state.config.audio.maxPlays;
    return (typeof n === 'number' && n > 0) ? n : 0;
  }

  // Enforce the listen limit. A fresh listen (playback starting from the
  // beginning) consumes one play; resuming after a mid-clip pause does not. Once
  // the limit is reached, further plays are blocked.
  _handlePlay() {
    const max = this._maxPlays();
    if (!max) return;
    const atStart = this.audioEl.currentTime < 0.3;
    if (atStart && !this.listenInProgress) {
      if (this.playsUsed >= max) {
        this.audioEl.pause();
        try { this.audioEl.currentTime = 0; } catch (e) { /* ignore */ }
        this._resetStatus();
        return;
      }
      this.playsUsed++;
      this.listenInProgress = true;
    }
    this._resetStatus();
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

  submit() {
    if (this.hasSubmitted) return;
    this.hasSubmitted = true;

    this._stopPlayback();

    this.typedText = this.input ? this.input.value : this.typedText;
    state.typedText = this.typedText;

    // Ensure a start time exists even if the user submits without typing.
    if (state.startTime === null) state.startTime = Date.now();

    // completion.js handles saving the stats (and, when the task opts into
    // `includeTranscript`, the expected/submitted transcripts) for every mode.
    showCompletionScreen();
  }

  reset() {
    this.hasSubmitted = false;
    this.hasPlayed = false;
    this.typedText = '';
    this.playsUsed = 0;
    this.listenInProgress = false;
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
      // The native player conveys playback state once loaded; until the clip has
      // buffered enough to play, show a loading hint (the download can be slow).
      const ready = this.audioEl && this.audioEl.readyState >= 3; // HAVE_FUTURE_DATA
      const max = this._maxPlays();
      if (!ready) {
        message = 'Loading audio…';
      } else if (max) {
        message = this.playsUsed >= max
          ? `You have used all ${max} plays.`
          : `Plays used: ${this.playsUsed} of ${max}.`;
      } else {
        message = '';
      }
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
    if (this.audioEl) {
      this.audioEl.removeEventListener('loadstart', this._onLoadStart);
      this.audioEl.removeEventListener('canplay', this._onCanPlay);
      this.audioEl.removeEventListener('canplaythrough', this._onCanPlay);
      this.audioEl.removeEventListener('waiting', this._onWaiting);
      this.audioEl.removeEventListener('playing', this._onPlaying);
      this.audioEl.removeEventListener('error', this._onAudioError);
      this.audioEl.removeEventListener('play', this._onAudioPlay);
      this.audioEl.removeEventListener('ended', this._onAudioEnded);
    }
    window.removeEventListener('load', this._beginDownload);
    this._stopPlayback();
  }
}
