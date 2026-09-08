// standard-result.js — the default stats.txt payload used by every mode that
// does not provide its own. Modes opt out by implementing `serializeStats()`.

import { state } from '../state.js';
import { serializeStandardStats } from '../stats.js';

// The base task's extract_solution.py matches this exact shape to surface the
// transcripts:
//   Expected Transcription:\n<expected>\n\nSubmitted Transcription:\n<submitted>\n\nGenerated:
// Keep the labels and the blank lines intact or the grader sees nothing.
export function buildStandardPayload(stats) {
  const body = serializeStandardStats(stats);
  if (!state.config.includeTranscript) return body;

  const transcripts =
    `Expected Transcription:\n${state.originalText}\n\n` +
    `Submitted Transcription:\n${state.typedText}\n\n`;
  const marker = 'Generated:';
  const idx = body.indexOf(marker);
  return idx >= 0
    ? body.slice(0, idx) + transcripts + body.slice(idx)
    : body.replace(/\s*$/, '\n') + '\n' + transcripts;
}
