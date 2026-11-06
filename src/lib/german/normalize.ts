/** Fold German spelling so "Käse", "Kaese", and "kase" can be compared fairly. */

export function normalizeAnswer(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"""„“‚‘’']/g, "")
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/\s+/g, " ")
    .trim();
}

function keepCase(input: string): string {
  return input
    .trim()
    .replace(/[.,!?;:"""„“]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length]!;
}

export function strictMatch(expected: string, given: string, alts: string[] = []): boolean {
  const forms = [expected, ...alts].map(normalizeAnswer).filter(Boolean);
  const g = normalizeAnswer(given);
  if (!g) return false;
  return forms.some((f) => {
    if (f === g) return true;
    if (f.length >= 6 && levenshtein(f, g) <= 1) return true;
    return false;
  });
}

/** Spoken answers may include extra words around the target sentence. */
export function speechMatch(expected: string, given: string, alts: string[] = []): boolean {
  const forms = [expected, ...alts].map(normalizeAnswer).filter(Boolean);
  const g = normalizeAnswer(given);
  if (!g) return false;
  return forms.some((f) => {
    if (f === g) return true;
    const words = f.split(" ").length;
    if (words >= 2 && g.includes(f)) return true;
    const dist = levenshtein(f, g);
    const max = Math.max(f.length, g.length);
    return max > 0 && dist / max <= 0.22;
  });
}

export function feedbackNote(expected: string, given: string): string | null {
  const foldedExpected = normalizeAnswer(expected);
  const foldedGiven = normalizeAnswer(given);
  if (!foldedGiven || foldedExpected !== foldedGiven) return null;
  const mild = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[.,!?;:"""„“']/g, "")
      .replace(/\s+/g, " ")
      .trim();
  if (mild(expected) !== mild(given)) {
    return `Accepted. The usual spelling is “${expected}”.`;
  }
  const shown = keepCase(expected);
  const typed = keepCase(given);
  if (shown.toLowerCase() === typed.toLowerCase() && shown !== typed) {
    return `Right words. Write it as “${expected}” — nouns and the first word stay capital.`;
  }
  return null;
}
