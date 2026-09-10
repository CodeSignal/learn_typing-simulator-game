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
// avoids by resynchronising at every word and separator boundary.
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

// Runs of word characters, and runs of everything else — spaces and
// punctuation alike — kept in order so the reference can be rebuilt from them.
// Cutting only on whitespace would glue "check-first" into a single token and
// leave it to pair against "check"; splitting the separators out instead lets
// the dash pair with the space it was typed in place of, which costs one
// substitution rather than a word's worth of extras.
function tokenize(text) {
  return text.length ? text.match(/[\p{L}\p{N}_]+|[^\p{L}\p{N}_]+/gu) : [];
}

// A word never pairs with a separator, so the two cannot swap roles.
const isSeparator = (token) => !/[\p{L}\p{N}_]/u.test(token);

// Pair up two token streams. Pairing token k with token k would only work while
// both streams agree on where the spaces are: type "checkfirst;" instead of
// "check first;" and every later word is compared against the wrong one, which
// is the character-level cascade all over again, one level up. Aligning the
// streams keeps a separator slip local, like any other slip.
function alignTokens(typedTokens, refTokens) {
  const n = typedTokens.length;
  const m = refTokens.length;
  const INF = 0x3fffffff;
  const width = m + 1;
  const cost = new Int32Array((n + 1) * width);

  for (let i = 0; i <= n; i++) cost[i * width] = i;
  for (let j = 0; j <= m; j++) cost[j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const t = typedTokens[i - 1];
      const r = refTokens[j - 1];
      const substitute = isSeparator(t) === isSeparator(r)
        ? cost[(i - 1) * width + (j - 1)] + (t === r ? 0 : 1)
        : INF;
      cost[i * width + j] = Math.min(
        substitute,
        cost[(i - 1) * width + j] + 1,   // token typed that the reference lacks
        cost[i * width + (j - 1)] + 1    // reference token never typed
      );
    }
  }

  // Stop at the reference token the typing actually reached. Charging for the
  // untyped remainder would make it cheaper to pair the last typed token with
  // the last reference token and call everything in between skipped.
  let best = 0;
  for (let j = 0; j <= m; j++) {
    if (cost[n * width + j] <= cost[n * width + best]) best = j;
  }

  const pairs = [];
  let i = n;
  let j = best;
  while (i > 0 || j > 0) {
    const t = i > 0 ? typedTokens[i - 1] : null;
    const r = j > 0 ? refTokens[j - 1] : null;
    const pairable = t !== null && r !== null && isSeparator(t) === isSeparator(r);

    if (pairable && cost[i * width + j] === cost[(i - 1) * width + (j - 1)] + (t === r ? 0 : 1)) {
      pairs.push({ typed: t, ref: r });
      i--;
      j--;
    } else if (t !== null && cost[i * width + j] === cost[(i - 1) * width + j] + 1) {
      pairs.push({ typed: t, ref: null });
      i--;
    } else if (r !== null) {
      pairs.push({ typed: null, ref: r });
      j--;
    } else {
      pairs.push({ typed: t, ref: null });
      i--;
    }
  }
  pairs.reverse();

  return { pairs, consumed: best };
}

function markWord(typed, reference) {
  const refTokens = tokenize(reference);
  const { pairs, consumed } = alignTokens(tokenize(typed), refTokens);
  const ops = [];

  // The last pair holding a typed token is the one still being typed.
  let lastReached = -1;
  for (let p = 0; p < pairs.length; p++) {
    if (pairs[p].typed !== null) lastReached = p;
  }

  for (let p = 0; p < pairs.length; p++) {
    const { typed: typedToken, ref: refToken } = pairs[p];

    if (refToken === null) {
      for (let i = 0; i < typedToken.length; i++) ops.push({ op: 'extra', char: typedToken[i] });
      continue;
    }

    if (typedToken === null) {
      const op = p > lastReached ? 'pending' : 'missing';
      for (let i = 0; i < refToken.length; i++) ops.push({ op, char: refToken[i] });
      continue;
    }

    // Characters are aligned within the pair, not compared by position: a
    // letter dropped from the middle of a word should cost that one letter
    // rather than reddening everything after it. The alignment cannot escape
    // the token, which is what keeps a slip contained to its word.
    const inner = alignToPrefix(typedToken, refToken);
    for (let i = 0; i < inner.ops.length; i++) ops.push(inner.ops[i]);

    // The token being typed right now is unfinished, not wrong.
    const unfinished = p === lastReached;
    for (let i = inner.consumed; i < refToken.length; i++) {
      ops.push({ op: unfinished ? 'pending' : 'missing', char: refToken[i] });
    }
  }

  // Whatever the typing has not got to yet.
  for (let k = consumed; k < refTokens.length; k++) {
    for (let i = 0; i < refTokens[k].length; i++) {
      ops.push({ op: 'pending', char: refTokens[k][i] });
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
  if (normalizeErrorMetric(metric) === 'positional') {
    // The characters this event actually introduced are what is left of `after`
    // once the prefix and suffix it still shares with `before` are trimmed —
    // the same diff handleInput uses. Keying off the length instead would miss
    // a same-length edit: selecting a correct character and typing a wrong one
    // over it is a mistake, and one the typist is charged a keystroke for.
    let start = 0;
    const shared = Math.min(before.length, after.length);
    while (start < shared && before[start] === after[start]) start++;

    let endBefore = before.length;
    let endAfter = after.length;
    while (endAfter > start && endBefore > start && before[endBefore - 1] === after[endAfter - 1]) {
      endBefore--;
      endAfter--;
    }

    let errors = 0;
    for (let i = start; i < endAfter; i++) {
      // Past the end of the reference there is nothing to be right about, which
      // is how markPositional treats it too.
      if (i >= reference.length || after[i] !== reference[i]) errors++;
    }
    return errors;
  }

  if (after === before) return 0;

  // Under an alignment metric, typing on past an earlier slip adds no further
  // errors — only the slip itself counts, however late it is noticed.
  const grew = countUnfixedErrors(metric, after, reference) - countUnfixedErrors(metric, before, reference);
  return Math.max(0, grew);
}
