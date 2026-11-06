import {
  gloss,
  sentenceById,
  sentences,
  sentencesInUnit,
  wordById,
  words,
  wordsInUnit,
  type Sentence,
  type Word,
} from "@/lib/german/curriculum";
import { normalizeAnswer } from "@/lib/german/normalize";
import { dueWords, recommendedUnit, unitProgress } from "@/lib/german/selectors";
import type { Mistake, MistakeKind, Persisted } from "@/lib/german/store";

export type Activity =
  | { kind: "introduce"; wordId: string }
  | { kind: "meaning"; wordId: string; options: string[] }
  | { kind: "produce"; wordId: string }
  | { kind: "article"; wordId: string }
  | { kind: "order"; sentenceId: string }
  | { kind: "translate"; sentenceId: string }
  | { kind: "listen"; sentenceId: string; options: string[] }
  | { kind: "dictation"; sentenceId: string }
  | { kind: "speak"; sentenceId: string; mode: "repeat" | "produce" };

export type StudyMode = "mix" | "words" | "sentences" | "listen" | "speak" | "review" | "fix";

const PATTERN = [
  "review",
  "introduce",
  "recall",
  "order",
  "listen",
  "order",
  "speak",
  "translate",
  "introduce",
  "order",
  "dictation",
  "speak",
  "order",
  "listen",
  "translate",
  "order",
] as const;

type Slot = (typeof PATTERN)[number];

function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = a;
  }
  return copy;
}

function uniqueEnglish(items: string[], answer: string, limit: number): string[] {
  const options = [answer];
  for (const item of items) {
    if (options.length >= limit) break;
    if (options.some((option) => normalizeAnswer(option) === normalizeAnswer(item))) continue;
    options.push(item);
  }
  return shuffle(options);
}

export function meaningActivity(word: Word): Activity {
  const pool = shuffle(words.filter((other) => other.id !== word.id));
  const ordered = [...pool.filter((other) => other.unit === word.unit), ...pool];
  return { kind: "meaning", wordId: word.id, options: uniqueEnglish(ordered.map((other) => other.en), word.en, 4) };
}

function listenActivity(sentence: Sentence): Activity {
  const pool = shuffle(sentences.filter((other) => other.id !== sentence.id));
  const ordered = [...pool.filter((other) => other.unit === sentence.unit), ...pool];
  return {
    kind: "listen",
    sentenceId: sentence.id,
    options: uniqueEnglish(ordered.map((other) => other.en), sentence.en, 4),
  };
}

function activityFromMistake(mistake: Mistake): Activity | null {
  if (mistake.kind === "meaning" || mistake.kind === "produce" || mistake.kind === "article") {
    const word = wordById.get(mistake.refId);
    if (!word) return null;
    if (mistake.kind === "meaning") return meaningActivity(word);
    if (mistake.kind === "article" && word.article) return { kind: "article", wordId: word.id };
    return { kind: "produce", wordId: word.id };
  }
  const sentence = sentenceById.get(mistake.refId);
  if (!sentence) return null;
  if (mistake.kind === "listen") return listenActivity(sentence);
  if (mistake.kind === "speak") return { kind: "speak", sentenceId: sentence.id, mode: "produce" };
  if (mistake.kind === "order" || mistake.kind === "translate" || mistake.kind === "dictation") {
    return { kind: mistake.kind, sentenceId: sentence.id };
  }
  return null;
}

function wordDrill(word: Word): Activity {
  const roll = Math.random();
  if (word.article && roll < 0.34) return { kind: "article", wordId: word.id };
  if (roll < 0.67) return { kind: "produce", wordId: word.id };
  return meaningActivity(word);
}

export function buildSession(
  data: Persisted,
  opts: { mode: StudyMode; unitId?: string; len: number; mistakeId?: string },
): Activity[] {
  const len = opts.len === 16 ? 16 : 8;
  if (opts.mode === "fix") {
    const mistake = data.mistakes.find((item) => item.id === opts.mistakeId);
    if (!mistake) return [];
    const activity = activityFromMistake(mistake);
    return activity ? [activity] : [];
  }

  if (opts.mode === "review") {
    const due = dueWords(data);
    const learning = words.filter((word) => data.words[word.id]?.status === "learning");
    const source = due.length ? due : learning;
    return shuffle(source).slice(0, len).map(wordDrill);
  }

  const unitId = opts.unitId && wordsInUnit(opts.unitId).length ? opts.unitId : recommendedUnit(data).id;
  const unitWords = wordsInUnit(unitId);
  const unitSentences = sentencesInUnit(unitId);
  const progress = unitProgress(data, unitId);
  const familiar = progress.total > 0 && progress.known / progress.total >= 0.3;

  if (opts.mode === "words") {
    const fresh = unitWords.filter((word) => !data.words[word.id]?.introduced);
    const seq: Activity[] = [];
    for (const word of fresh.slice(0, 5)) {
      seq.push({ kind: "introduce", wordId: word.id });
      seq.push(meaningActivity(word));
      if (word.article) seq.push({ kind: "article", wordId: word.id });
      seq.push({ kind: "produce", wordId: word.id });
      if (seq.length >= len) break;
    }
    const extra = shuffle(unitWords.filter((word) => data.words[word.id]?.introduced));
    for (const word of extra) {
      if (seq.length >= len) break;
      seq.push(wordDrill(word));
    }
    return seq.slice(0, len);
  }

  if (opts.mode === "sentences") {
    return shuffle(unitSentences)
      .slice(0, len)
      .map((sentence, index) =>
        index % 2 === 0
          ? { kind: "order" as const, sentenceId: sentence.id }
          : { kind: "translate" as const, sentenceId: sentence.id },
      );
  }

  if (opts.mode === "listen") {
    return shuffle(unitSentences)
      .slice(0, len)
      .map((sentence, index) =>
        index % 2 === 0 ? listenActivity(sentence) : { kind: "dictation" as const, sentenceId: sentence.id },
      );
  }

  if (opts.mode === "speak") {
    return shuffle(unitSentences)
      .slice(0, len)
      .map((sentence, index) => ({
        kind: "speak" as const,
        sentenceId: sentence.id,
        mode: familiar && index % 2 === 1 ? ("produce" as const) : ("repeat" as const),
      }));
  }

  const usedSentences = new Set<string>();
  const reviewQ = dueWords(data).slice(0, 8);
  const freshQ = unitWords.filter((word) => !data.words[word.id]?.introduced).slice(0, 4);
  const recallQ: Word[] = [];
  const orderQ = shuffle(unitSentences.filter((sentence) => sentence.tokens.length >= 3));
  const translateQ = shuffle(unitSentences);
  const listenQ = shuffle(unitSentences);
  const dictationQ = shuffle(unitSentences.filter((sentence) => sentence.tokens.length <= 6));
  const speakQ = shuffle(unitSentences);

  function takeSentence(queue: Sentence[]): Sentence | null {
    while (queue.length) {
      const sentence = queue.shift();
      if (!sentence || usedSentences.has(sentence.id)) continue;
      usedSentences.add(sentence.id);
      return sentence;
    }
    return null;
  }

  function make(slot: Slot): Activity | null {
    if (slot === "review") {
      const word = reviewQ.shift();
      return word ? wordDrill(word) : null;
    }
    if (slot === "introduce") {
      const word = freshQ.shift();
      if (!word) return null;
      recallQ.push(word);
      return { kind: "introduce", wordId: word.id };
    }
    if (slot === "recall") {
      const word = recallQ.shift() ?? reviewQ.shift();
      return word ? meaningActivity(word) : null;
    }
    if (slot === "order") {
      const sentence = takeSentence(orderQ);
      return sentence ? { kind: "order", sentenceId: sentence.id } : null;
    }
    if (slot === "translate") {
      const sentence = takeSentence(translateQ);
      return sentence ? { kind: "translate", sentenceId: sentence.id } : null;
    }
    if (slot === "listen") {
      const sentence = takeSentence(listenQ);
      return sentence ? listenActivity(sentence) : null;
    }
    if (slot === "dictation") {
      const sentence = takeSentence(dictationQ.length ? dictationQ : translateQ);
      return sentence ? { kind: "dictation", sentenceId: sentence.id } : null;
    }
    const sentence = takeSentence(speakQ);
    if (!sentence) return null;
    return { kind: "speak", sentenceId: sentence.id, mode: familiar ? "produce" : "repeat" };
  }

  const fillers: Slot[] = ["order", "translate", "listen", "speak", "dictation", "review", "recall", "introduce"];
  const out: Activity[] = [];
  for (const slot of PATTERN) {
    if (out.length >= len) break;
    let made = make(slot);
    if (!made) {
      for (const filler of fillers) {
        made = make(filler);
        if (made) break;
      }
    }
    if (made) out.push(made);
  }
  return out;
}

export function activityKey(activity: Activity, index: number): string {
  if (activity.kind === "introduce" || activity.kind === "meaning" || activity.kind === "produce" || activity.kind === "article") {
    return `${index}:${activity.kind}:${activity.wordId}`;
  }
  if (activity.kind === "speak") return `${index}:speak:${activity.mode}:${activity.sentenceId}`;
  return `${index}:${activity.kind}:${activity.sentenceId}`;
}

export function promptFor(activity: Activity): { prompt: string; expected: string; tip?: string; refId: string; kind: MistakeKind } | null {
  if (activity.kind === "introduce") return null;
  if (activity.kind === "meaning" || activity.kind === "produce" || activity.kind === "article") {
    const word = wordById.get(activity.wordId);
    if (!word) return null;
    if (activity.kind === "meaning") {
      return { prompt: gloss(word), expected: word.en, tip: word.tip, refId: word.id, kind: "meaning" };
    }
    if (activity.kind === "article") {
      return {
        prompt: word.de,
        expected: gloss(word),
        tip: word.tip ?? (word.article ? `${gloss(word)} is ${word.article}.` : undefined),
        refId: word.id,
        kind: "article",
      };
    }
    return {
      prompt: word.en,
      expected: gloss(word),
      tip: word.tip,
      refId: word.id,
      kind: "produce",
    };
  }
  const sentence = sentenceById.get(activity.sentenceId);
  if (!sentence) return null;
  if (activity.kind === "listen") {
    return { prompt: sentence.de, expected: sentence.en, tip: sentence.tip, refId: sentence.id, kind: "listen" };
  }
  if (activity.kind === "dictation") {
    return { prompt: sentence.en, expected: sentence.de, tip: sentence.tip, refId: sentence.id, kind: "dictation" };
  }
  if (activity.kind === "speak") {
    return {
      prompt: activity.mode === "repeat" ? sentence.de : sentence.en,
      expected: sentence.de,
      tip: sentence.tip,
      refId: sentence.id,
      kind: "speak",
    };
  }
  return {
    prompt: sentence.en,
    expected: sentence.de,
    tip: sentence.tip,
    refId: sentence.id,
    kind: activity.kind,
  };
}

export { gloss };
