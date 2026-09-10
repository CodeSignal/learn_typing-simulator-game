// text-metrics.js — how typed text is compared against the reference.
//
// Two independent decisions live here, both driven by config:
//
//   markingMode  what the typist sees   (positional | character | word)
//   errorMetric  what the stats report  (positional | character | word)
//
// They are deliberately separate. Positional comparison is cheap and is what
// the simulator has always done, but it cannot express a skipped or an added
// character: dropping one character shifts every position after it, so a single
// slip marks the rest of the passage wrong and inflates both error counts by
// hundreds. Aligning the two strings instead costs one error for one slip,
// which is what the text-entry literature's error rates assume — but as a live
// display it can also reinterpret text behind the cursor, which word alignment
// avoids by resynchronising at every space.
//
// Everything in this module is pure: no state, no DOM.

export const MARKING_MODES = ['positional', 'character', 'word'];
export const ERROR_METRICS = ['positional', 'character', 'word'];

// Op kinds produced by every marking mode:
//   match     typed correctly
//   substitute wrong character in the right place
//   missing   a reference character the typist never typed
//   extra     a typed character with no counterpart in the reference
//   pending   not reached yet
// `missing` and `extra` only ever appear in the alignment modes.
const COUNTS_AS_ERROR = { substitute: true, missing: true, extra: true };

// How far the typed text may drift out of step with the reference before the
// alignment gives up and behaves positionally. Bounding it keeps the cost
// linear in the passage length instead of quadratic, which matters because
// alignment runs on every keystroke; real typing never drifts this far.
const MAX_DRIFT = 64;

export function normalizeMarkingMode(value) {
  return MARKING_MODES.includes(value) ? value : 'positional';
}

export function normalizeErrorMetric(value) {
  return ERROR_METRICS.includes(value) ? value : 'positional';
}

// Levenshtein distance between two strings or two arrays of strings; the only
// requirements are indexing, `length` and strict equality.
export function editDistance(a, b) {
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }

  return prev[b.length];
}

// Align `typed` against the best-matching PREFIX of `reference`, so the part
// not reached yet stays pending instead of counting as skipped. Only cells
// within MAX_DRIFT of the diagonal are considered.
function alignToPrefix(typed, reference) {
  const n = typed.length;
  const m = reference.length;

  // Only cells within MAX_DRIFT of the diagonal are reachable, so each row
  // stores just that window. Storing full rows would allocate the whole n×m
  // matrix on every keystroke, which on a passage of any length is megabytes.
  const width = 2 * MAX_DRIFT + 1;
  const INF = 0x3fffffff;
  const cells = new Int32Array((n + 1) * width).fill(INF);

  const lo = (i) => Math.max(0, i - MAX_DRIFT);
  const hi = (i) => Math.min(m, i + MAX_DRIFT);
  const at = (i, j) => (j < lo(i) || j > hi(i) ? INF : cells[i * width + (j - lo(i))]);
  const put = (i, j, v) => { cells[i * width + (j - lo(i))] = v; };

  for (let j = lo(0); j <= hi(0); j++) put(0, j, j);

  for (let i = 1; i <= n; i++) {
    for (let j = lo(i); j <= hi(i); j++) {
      if (j === 0) {
        put(i, 0, i);
        continue;
      }
      const sub = at(i - 1, j - 1) + (typed[i - 1] === reference[j - 1] ? 0 : 1);
      const del = at(i - 1, j) + 1;      // typed character absent from the reference
      const ins = at(i, j - 1) + 1;      // reference character never typed
      put(i, j, Math.min(sub, del, ins));
    }
  }

  // Where in the reference did this typing get to? Prefer consuming more of it
  // when two stopping points cost the same.
  let best = lo(n);
  for (let j = lo(n); j <= hi(n); j++) {
    if (at(n, j) <= at(n, best)) best = j;
  }

  const ops = [];
  let i = n;
  let j = best;
  while (i > 0 || j > 0) {
    const here = at(i, j);
    if (i > 0 && j > 0 && here === at(i - 1, j - 1) + (typed[i - 1] === reference[j - 1] ? 0 : 1)) {
      ops.push({ op: typed[i - 1] === reference[j - 1] ? 'match' : 'substitute', char: reference[j - 1] });
      i--;
      j--;
    } else if (i > 0 && here === at(i - 1, j) + 1) {
      ops.push({ op: 'extra', char: typed[i - 1] });
      i--;
    } else if (j > 0) {
      ops.push({ op: 'missing', char: reference[j - 1] });
      j--;
    } else {
      ops.push({ op: 'extra', char: typed[i - 1] });
      i--;
    }
  }
  ops.reverse();

  return { ops, consumed: best };
}

function markPositional(typed, reference) {
  const ops = [];

  for (let i = 0; i < reference.length; i++) {
    if (i >= typed.length) ops.push({ op: 'pending', char: reference[i] });
    else ops.push({ op: typed[i] === reference[i] ? 'match' : 'substitute', char: reference[i] });
  }
  // Anything typed past the end of the reference has nowhere to sit.
  for (let i = reference.length; i < typed.length; i++) {
    ops.push({ op: 'extra', char: typed[i] });
  }

  return ops;
}

function markCharacter(typed, reference) {
  const { ops, consumed } = alignToPrefix(typed, reference);

  for (let i = consumed; i < reference.length; i++) {
    ops.push({ op: 'pending', char: reference[i] });
  }

  return ops;
}

// Words and the whitespace between them, both kept, so the reference can be
// rebuilt from the tokens in order.
function tokenize(text) {
  return text.length ? text.match(/\s+|\S+/g) : [];
}

function markWord(typed, reference) {
  const refTokens = tokenize(reference);
  const typedTokens = tokenize(typed);
  const ops = [];

  for (let k = 0; k < refTokens.length; k++) {
    const refToken = refTokens[k];
    const typedToken = typedTokens[k];

    if (typedToken === undefined) {
      for (let i = 0; i < refToken.length; i++) ops.push({ op: 'pending', char: refToken[i] });
      continue;
    }

    // Comparison never escapes the token, so a slip cannot cascade past it.
    const shared = Math.min(refToken.length, typedToken.length);
    for (let i = 0; i < shared; i++) {
      ops.push({ op: refToken[i] === typedToken[i] ? 'match' : 'substitute', char: refToken[i] });
    }

    if (typedToken.length < refToken.length) {
      // The last token typed may simply be unfinished rather than wrong.
      const unfinished = k === typedTokens.length - 1;
      for (let i = shared; i < refToken.length; i++) {
        ops.push({ op: unfinished ? 'pending' : 'missing', char: refToken[i] });
      }
    } else {
      for (let i = shared; i < typedToken.length; i++) {
        ops.push({ op: 'extra', char: typedToken[i] });
      }
    }
  }

  return ops;
}

// Compare `typed` against `reference` and return the ops the renderer draws.
export function markText(mode, typed, reference) {
  if (!reference) return [];

  switch (normalizeMarkingMode(mode)) {
    case 'character': return markCharacter(typed, reference);
    case 'word': return markWord(typed, reference);
    default: return markPositional(typed, reference);
  }
}

export function countMarkedErrors(ops) {
  let errors = 0;
  for (let i = 0; i < ops.length; i++) {
    if (COUNTS_AS_ERROR[ops[i].op]) errors++;
  }
  return errors;
}

// Errors still present in `typed`, under the configured metric. Every metric
// counts in characters, so a task's thresholds keep their meaning when the
// metric changes. Characters not yet reached never count, matching the
// long-standing behaviour where untyped positions are pending, not wrong.
export function countUnfixedErrors(metric, typed, reference) {
  if (!reference || !typed) return 0;

  return countMarkedErrors(markText(normalizeErrorMetric(metric), typed, reference));
}

// How many of the characters just entered were mistakes, under the configured
// metric. `before` and `after` are the field's value either side of one input
// event, which is how the simulator accrues "Total Errors Made".
export function countNewErrors(metric, before, after, reference) {
  if (after.length <= before.length) return 0;

  if (normalizeErrorMetric(metric) === 'positional') {
    let errors = 0;
    for (let i = before.length; i < after.length && i < reference.length; i++) {
      if (after[i] !== reference[i]) errors++;
    }
    return errors;
  }

  // Under an alignment metric, typing on past an earlier slip adds no further
  // errors — only the slip itself counts, however late it is noticed.
  const grew = countUnfixedErrors(metric, after, reference) - countUnfixedErrors(metric, before, reference);
  return Math.max(0, grew);
}
