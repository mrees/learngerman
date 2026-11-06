import { create } from "zustand";
import { dayKey } from "@/lib/german/dates";

export type WordStatus = "learning" | "known";

export type WordProgress = {
  introduced: boolean;
  correct: number;
  wrong: number;
  consecutive: number;
  ease: number;
  intervalDays: number;
  due: number;
  status: WordStatus;
  lastAt: number;
};

export type MistakeKind =
  | "meaning"
  | "produce"
  | "article"
  | "order"
  | "translate"
  | "listen"
  | "dictation"
  | "speak";

export type Mistake = {
  id: string;
  kind: MistakeKind;
  refId: string;
  prompt: string;
  yours: string;
  expected: string;
  tip?: string;
  at: number;
};

export type SentenceStat = {
  correct: number;
  wrong: number;
  lastAt: number;
};

export type Persisted = {
  words: Record<string, WordProgress>;
  mistakes: Mistake[];
  sentenceStats: Record<string, SentenceStat>;
  lastSessionAt: number | null;
  sessions: number;
  remindersOn: boolean;
  dismissedReminderOn: string | null;
  slowSpeech: boolean;
  notes: Record<string, string>;
};

export const initialData: Persisted = {
  words: {},
  mistakes: [],
  sentenceStats: {},
  lastSessionAt: null,
  sessions: 0,
  remindersOn: true,
  dismissedReminderOn: null,
  slowSpeech: false,
  notes: {},
};

const KEY = "klarheft-v1";

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function cleanWord(value: unknown): WordProgress | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<WordProgress>;
  if (v.introduced !== true) return null;
  const status: WordStatus = v.status === "known" ? "known" : "learning";
  return {
    introduced: true,
    correct: num(v.correct),
    wrong: num(v.wrong),
    consecutive: num(v.consecutive),
    ease: num(v.ease, 2.5) || 2.5,
    intervalDays: num(v.intervalDays),
    due: num(v.due),
    status,
    lastAt: num(v.lastAt),
  };
}

function cleanMistake(value: unknown): Mistake | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<Mistake>;
  const kinds: MistakeKind[] = [
    "meaning",
    "produce",
    "article",
    "order",
    "translate",
    "listen",
    "dictation",
    "speak",
  ];
  if (typeof v.id !== "string" || typeof v.refId !== "string") return null;
  if (!kinds.includes(v.kind as MistakeKind)) return null;
  if (typeof v.prompt !== "string" || typeof v.expected !== "string" || typeof v.yours !== "string") return null;
  return {
    id: v.id,
    kind: v.kind as MistakeKind,
    refId: v.refId,
    prompt: v.prompt,
    yours: v.yours,
    expected: v.expected,
    tip: typeof v.tip === "string" ? v.tip : undefined,
    at: num(v.at, Date.now()),
  };
}

function sanitize(value: unknown): Persisted {
  if (!value || typeof value !== "object") return initialData;
  const v = value as Partial<Persisted>;
  const words: Persisted["words"] = {};
  if (v.words && typeof v.words === "object") {
    for (const [id, entry] of Object.entries(v.words)) {
      const clean = cleanWord(entry);
      if (clean) words[id] = clean;
    }
  }
  const notes: Record<string, string> = {};
  if (v.notes && typeof v.notes === "object") {
    for (const [id, note] of Object.entries(v.notes)) {
      if (typeof note === "string" && note.trim()) notes[id] = note.slice(0, 500);
    }
  }
  const sentenceStats: Persisted["sentenceStats"] = {};
  if (v.sentenceStats && typeof v.sentenceStats === "object") {
    for (const [id, entry] of Object.entries(v.sentenceStats)) {
      if (!entry || typeof entry !== "object") continue;
      const s = entry as Partial<SentenceStat>;
      sentenceStats[id] = { correct: num(s.correct), wrong: num(s.wrong), lastAt: num(s.lastAt) };
    }
  }
  return {
    words,
    mistakes: Array.isArray(v.mistakes) ? v.mistakes.map(cleanMistake).filter((m): m is Mistake => Boolean(m)) : [],
    sentenceStats,
    lastSessionAt: typeof v.lastSessionAt === "number" ? v.lastSessionAt : null,
    sessions: num(v.sessions),
    remindersOn: v.remindersOn !== false,
    dismissedReminderOn: typeof v.dismissedReminderOn === "string" ? v.dismissedReminderOn : null,
    slowSpeech: v.slowSpeech === true,
    notes,
  };
}

function persist(data: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode or full storage — progress still works this session */
  }
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialData;
    return sanitize(JSON.parse(raw));
  } catch {
    return initialData;
  }
}

function freshWord(partial: Partial<WordProgress> = {}): WordProgress {
  return {
    introduced: true,
    correct: 0,
    wrong: 0,
    consecutive: 0,
    ease: 2.5,
    intervalDays: 1,
    due: Date.now() + 86_400_000,
    status: "learning",
    lastAt: Date.now(),
    ...partial,
  };
}

export type MistakeInput = Omit<Mistake, "id" | "at">;

type Store = {
  data: Persisted;
  hydrated: boolean;
  hydrate: () => void;
  introduceWord: (id: string) => void;
  gradeWord: (id: string, correct: boolean) => void;
  gradeSentence: (id: string, correct: boolean) => void;
  addMistake: (input: MistakeInput) => void;
  resolveMistake: (kind: Mistake["kind"], refId: string) => void;
  removeMistake: (id: string) => void;
  markWords: (ids: string[], status: "known" | "learning" | "new") => void;
  setNote: (id: string, note: string) => void;
  setReminders: (on: boolean) => void;
  setSlowSpeech: (on: boolean) => void;
  dismissReminder: () => void;
  touchSession: () => void;
  reset: () => void;
};

export const useProgress = create<Store>((set, get) => ({
  data: initialData,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") return;
    set({ data: load(), hydrated: true });
  },
  introduceWord: (id) => {
    set((state) => {
      if (state.data.words[id]?.introduced) return state;
      const data = { ...state.data, words: { ...state.data.words, [id]: freshWord() } };
      persist(data);
      return { data };
    });
  },
  gradeWord: (id, correct) => {
    set((state) => {
      const prev = state.data.words[id] ?? freshWord({ due: Date.now() });
      const next: WordProgress = correct
        ? (() => {
            const consecutive = prev.consecutive + 1;
            const intervalDays =
              consecutive <= 1
                ? 1
                : consecutive === 2
                  ? 3
                  : Math.max(1, Math.round(Math.max(prev.intervalDays, 1) * prev.ease));
            return {
              ...prev,
              introduced: true,
              correct: prev.correct + 1,
              consecutive,
              ease: Math.min(2.8, prev.ease + 0.04),
              intervalDays,
              due: Date.now() + intervalDays * 86_400_000,
              status: consecutive >= 3 ? "known" : "learning",
              lastAt: Date.now(),
            } satisfies WordProgress;
          })()
        : {
            ...prev,
            introduced: true,
            wrong: prev.wrong + 1,
            consecutive: 0,
            ease: Math.max(1.4, prev.ease - 0.15),
            intervalDays: 0,
            due: Date.now() + 10 * 60 * 1000,
            status: "learning",
            lastAt: Date.now(),
          };
      const data = { ...state.data, words: { ...state.data.words, [id]: next } };
      persist(data);
      return { data };
    });
  },
  gradeSentence: (id, correct) => {
    set((state) => {
      const prev = state.data.sentenceStats[id] ?? { correct: 0, wrong: 0, lastAt: 0 };
      const sentenceStats = {
        ...state.data.sentenceStats,
        [id]: {
          correct: prev.correct + (correct ? 1 : 0),
          wrong: prev.wrong + (correct ? 0 : 1),
          lastAt: Date.now(),
        },
      };
      const data = { ...state.data, sentenceStats };
      persist(data);
      return { data };
    });
  },
  addMistake: (input) => {
    set((state) => {
      const without = state.data.mistakes.filter((m) => !(m.kind === input.kind && m.refId === input.refId));
      const next: Mistake = { ...input, id: crypto.randomUUID(), at: Date.now() };
      const mistakes = [next, ...without].slice(0, 80);
      const data = { ...state.data, mistakes };
      persist(data);
      return { data };
    });
  },
  resolveMistake: (kind, refId) => {
    set((state) => {
      const mistakes = state.data.mistakes.filter((m) => !(m.kind === kind && m.refId === refId));
      if (mistakes.length === state.data.mistakes.length) return state;
      const data = { ...state.data, mistakes };
      persist(data);
      return { data };
    });
  },
  removeMistake: (id) => {
    set((state) => {
      const data = { ...state.data, mistakes: state.data.mistakes.filter((m) => m.id !== id) };
      persist(data);
      return { data };
    });
  },
  markWords: (ids, status) => {
    set((state) => {
      const words = { ...state.data.words };
      for (const id of ids) {
        if (status === "new") {
          delete words[id];
          continue;
        }
        if (status === "known") {
          words[id] = freshWord({
            status: "known",
            consecutive: 3,
            correct: 3,
            intervalDays: 14,
            due: Date.now() + 14 * 86_400_000,
          });
        } else {
          words[id] = freshWord({ status: "learning", due: Date.now(), intervalDays: 0, consecutive: 0 });
        }
      }
      const data = { ...state.data, words };
      persist(data);
      return { data };
    });
  },
  setNote: (id, note) => {
    set((state) => {
      const notes = { ...state.data.notes };
      const trimmed = note.slice(0, 500);
      if (trimmed.trim()) notes[id] = trimmed;
      else delete notes[id];
      const data = { ...state.data, notes };
      persist(data);
      return { data };
    });
  },
  setReminders: (on) => {
    set((state) => {
      const data = { ...state.data, remindersOn: on };
      persist(data);
      return { data };
    });
  },
  setSlowSpeech: (on) => {
    set((state) => {
      const data = { ...state.data, slowSpeech: on };
      persist(data);
      return { data };
    });
  },
  dismissReminder: () => {
    set((state) => {
      const data = { ...state.data, dismissedReminderOn: dayKey() };
      persist(data);
      return { data };
    });
  },
  touchSession: () => {
    set((state) => {
      const data = {
        ...state.data,
        lastSessionAt: Date.now(),
        sessions: state.data.sessions + 1,
      };
      persist(data);
      return { data };
    });
  },
  reset: () => {
    persist(initialData);
    set({ data: initialData });
  },
}));
