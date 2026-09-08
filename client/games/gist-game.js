// gist-game.js — Meeting-notes (gist) mode
// A variant of audio dictation where the candidate is NOT transcribing: they
// listen (a limited number of times) and write notes capturing the main points.
// Playback, the listen limit and the input box are inherited from AudioGame;
// only the results differ, so this class overrides just those hooks.

import { state } from '../state.js';
import { AudioGame } from './audio-game.js';

export class GistGame extends AudioGame {
  // Restarting would clear the notes and invite another attempt at a one-shot
  // listening task, so the restart / Start Over controls are hidden entirely.
  allowsRestart() {
    return false;
  }

  // Notes are graded on meaning, so the verbatim-derived numbers (Accuracy,
  // Total Errors, Errors Left, Speed) are meaningless here — and a low
  // "Accuracy: 18%" would bias the grader no matter what the rubric says. They
  // are simply not emitted: the base task's extract_solution.py only prints the
  // fields it finds, so omitting a line removes it from STDOUT.
  //
  // The transcript labels below are fixed by that same parser, which matches
  // "Expected Transcription:" / "Submitted Transcription:" literally. We keep the
  // labels so the content reaches the grader at all, and reframe inside the
  // blocks so the model does not read this as a transcription exercise.
  serializeStats(stats) {
    const keyPoints = Array.isArray(state.config.keyPoints) ? state.config.keyPoints : [];
    const points = keyPoints.length
      ? keyPoints.map(point => `- ${point}`).join('\n')
      : '(none configured)';

    const reference = [
      '[REFERENCE FOR GRADING. The candidate was asked to take NOTES, not to',
      'transcribe. Do not compare their wording against the recording.]',
      '',
      'KEY POINTS THE NOTES SHOULD CAPTURE:',
      points,
      '',
      'RECORDING TRANSCRIPT (for fact-checking only):',
      state.originalText
    ].join('\n');

    const notes = [
      '[CANDIDATE NOTES. Free-form notes, not a transcription attempt.]',
      '',
      state.typedText
    ].join('\n');

    return `Typing Statistics
==================

Total Time: ${stats.totalTime.toFixed(2)} seconds

Expected Transcription:
${reference}

Submitted Transcription:
${notes}

Generated: ${new Date().toLocaleString()}
`;
  }

  // No stats dashboard: speed and accuracy are not what this task measures, and
  // showing them would push the candidate toward the wrong behaviour.
  renderResult() {
    if (!state.completionScreen) return;
    const heading = state.completionScreen.querySelector('h2');
    const message = state.completionScreen.querySelector('p');
    if (heading) heading.textContent = 'Notes submitted';
    if (message) message.textContent = 'Your notes have been recorded. You can now submit the task.';
    const startOver = document.getElementById('btn-start-over');
    if (startOver) startOver.style.display = 'none';
    if (state.statsDashboard) state.statsDashboard.style.display = 'none';
    state.completionScreen.style.display = 'flex';
  }
}
