// Small assertion helpers shared by the conformance runner and its self-test.
export function subsetMatch(actual, expected) {
  if (expected === null || typeof expected !== "object") return Object.is(actual, expected);
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false;
    return expected.every((v, i) => subsetMatch(actual[i], v));
  }
  if (!actual || typeof actual !== "object") return false;
  return Object.entries(expected).every(([k, v]) => subsetMatch(actual[k], v));
}

/**
 * Ordered subset match: each expected event must appear, in order, somewhere in actual.
 * Extra actual events are allowed unless strict.
 */
export function matchSequence(actual, expected, { strict = false } = {}) {
  let cursor = 0;
  for (const want of expected) {
    let found = false;
    while (cursor < actual.length) {
      if (subsetMatch(actual[cursor], want)) {
        found = true;
        cursor++;
        break;
      }
      cursor++;
    }
    if (!found) return { ok: false, missing: want };
  }
  return { ok: true, consumed: cursor, extras: strict ? actual.length - cursor : 0 };
}

export function describe(value) {
  return JSON.stringify(value, null, 2).slice(0, 600);
}
