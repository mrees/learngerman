import { gloss, sentences, units, words, wordsInUnit, type Sentence, type Unit, type Word } from "@/lib/german/curriculum";
import { dayKey, daysSince } from "@/lib/german/dates";
import type { Persisted } from "@/lib/german/store";

export function dueWords(data: Persisted, now = Date.now()): Word[] {
  return words
    .filter((word) => {
      const progress = data.words[word.id];
      return Boolean(progress?.introduced && progress.due <= now);
    })
    .sort((a, b) => (data.words[a.id]?.due ?? 0) - (data.words[b.id]?.due ?? 0));
}

export function recommendedUnit(data: Persisted): Unit {
  for (const unit of units) {
    const list = wordsInUnit(unit.id);
    const known = list.filter((word) => data.words[word.id]?.status === "known").length;
    const introduced = list.filter((word) => data.words[word.id]?.introduced).length;
    if (introduced < list.length || known < Math.ceil(list.length * 0.7)) return unit;
  }
  return units[units.length - 1]!;
}

export function unitProgress(data: Persisted, unitId: string) {
  const list = wordsInUnit(unitId);
  let known = 0;
  let learning = 0;
  for (const word of list) {
    const progress = data.words[word.id];
    if (progress?.status === "known") known += 1;
    else if (progress?.introduced) learning += 1;
  }
  return { total: list.length, known, learning };
}

export function courseCounts(data: Persisted) {
  let known = 0;
  let learning = 0;
  let phrases = 0;
  for (const word of words) {
    const progress = data.words[word.id];
    if (!progress?.introduced) continue;
    if (progress.status === "known") known += 1;
    else learning += 1;
    if (word.pos === "phrase") phrases += 1;
  }
  return { known, learning, phrases, mistakes: data.mistakes.length, total: words.length };
}

export function recentWords(data: Persisted, now = Date.now()): Word[] {
  const due = new Set(dueWords(data, now).map((word) => word.id));
  return words
    .filter((word) => data.words[word.id]?.introduced && !due.has(word.id))
    .sort((a, b) => (data.words[b.id]?.lastAt ?? 0) - (data.words[a.id]?.lastAt ?? 0))
    .slice(0, 8);
}

export function learnedPhrases(data: Persisted): Word[] {
  return words
    .filter((word) => word.pos === "phrase" && data.words[word.id]?.introduced)
    .sort((a, b) => (data.words[b.id]?.lastAt ?? 0) - (data.words[a.id]?.lastAt ?? 0))
    .slice(0, 6);
}

export function keptSentences(data: Persisted): Sentence[] {
  return sentences
    .filter((sentence) => (data.sentenceStats[sentence.id]?.correct ?? 0) > 0)
    .sort((a, b) => (data.sentenceStats[b.id]?.lastAt ?? 0) - (data.sentenceStats[a.id]?.lastAt ?? 0))
    .slice(0, 4);
}

export function reminderText(data: Persisted, now = Date.now()): string | null {
  if (!data.remindersOn) return null;
  if (data.dismissedReminderOn === dayKey(now)) return null;
  const due = dueWords(data, now).length;
  if (due > 0) {
    return due === 1
      ? "1 word is ready to review, whenever you want it."
      : `${due} words are ready to review, whenever you want them.`;
  }
  if (!data.lastSessionAt) return null;
  const days = daysSince(data.lastSessionAt, now);
  if (days >= 2) {
    const phrase = learnedPhrases(data)[0];
    const held = phrase ? ` One you already have: ${gloss(phrase)}.` : "";
    return `You last studied ${days} days ago. Nothing expires — come back when you like.${held}`;
  }
  return null;
}

export function studiedAnything(data: Persisted): boolean {
  return data.sessions > 0 || Object.keys(data.words).length > 0 || data.mistakes.length > 0;
}
