import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AudioButton } from "@/components/audio-button";
import { Shell } from "@/components/shell";
import { cn } from "@/lib/cn";
import { genderLabel, gloss, unitById, units, wordBlob, words, type Pos, type Word } from "@/lib/german/curriculum";
import { normalizeAnswer } from "@/lib/german/normalize";
import { useProgress } from "@/lib/german/store";

const POS_FILTERS = [
  { id: "all", label: "All" },
  { id: "noun", label: "Nouns" },
  { id: "verb", label: "Verbs" },
  { id: "phrase", label: "Phrases" },
  { id: "adjective", label: "Adjectives" },
] as const;

export const Route = createFileRoute("/dictionary")({
  validateSearch: (search: Record<string, unknown>) => ({
    pos: typeof search.pos === "string" ? search.pos : "all",
  }),
  head: () => ({ meta: [{ title: "Dictionary · Klarheft" }] }),
  component: DictionaryPage,
});

function DictionaryPage() {
  const search = Route.useSearch();
  const data = useProgress((state) => state.data);
  const hydrated = useProgress((state) => state.hydrated);
  const markWords = useProgress((state) => state.markWords);
  const setNote = useProgress((state) => state.setNote);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState(search.pos);
  const [status, setStatus] = useState<"all" | "learning" | "known" | "new">("all");
  const [unit, setUnit] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = normalizeAnswer(query);
    return words.filter((word) => {
      if (pos === "noun" || pos === "verb" || pos === "phrase" || pos === "adjective") {
        if (word.pos !== pos) return false;
      }
      if (unit !== "all" && word.unit !== unit) return false;
      const progress = data.words[word.id];
      if (status === "known" && progress?.status !== "known") return false;
      if (status === "learning" && !(progress?.introduced && progress.status !== "known")) return false;
      if (status === "new" && progress?.introduced) return false;
      if (q && !wordBlob(word).includes(q)) return false;
      return true;
    });
  }, [data.words, pos, query, status, unit]);

  return (
    <Shell>
      <div className="mx-auto w-full max-w-2xl px-5 py-6 md:py-10">
        <p className="font-display text-xl tracking-tight md:hidden">Klarheft</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight md:mt-0">Dictionary</h1>
        <p className="mt-2 max-w-md text-muted">
          Every word and phrase in the course — {words.length} entries — whether you’ve studied them or not.
        </p>

        <div className="sticky top-0 z-10 -mx-5 bg-bg px-5 py-3">
          <label className="sr-only" htmlFor="dict-search">
            Search German or English
          </label>
          <input
            id="dict-search"
            type="search"
            value={query}
            placeholder="Search German or English"
            onChange={(event) => setQuery(event.target.value)}
            className="h-12 w-full rounded-lg border border-line bg-surface px-3 outline-none placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {POS_FILTERS.map((filter) => (
            <FilterChip key={filter.id} on={pos === filter.id} label={filter.label} onClick={() => setPos(filter.id)} />
          ))}
          <FilterChip on={status === "learning"} label="Learning" onClick={() => setStatus(status === "learning" ? "all" : "learning")} />
          <FilterChip on={status === "known"} label="Known" onClick={() => setStatus(status === "known" ? "all" : "known")} />
          <FilterChip on={status === "new"} label="Not yet" onClick={() => setStatus(status === "new" ? "all" : "new")} />
        </div>

        <label className="mt-4 flex flex-col gap-2 text-sm text-muted">
          Unit
          <select
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            className="h-12 rounded-lg border border-line bg-surface px-3 text-base text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <option value="all">All units</option>
            {units.map((item) => (
              <option key={item.id} value={item.id}>
                {item.n}. {item.de}
              </option>
            ))}
          </select>
        </label>

        <p className="mt-4 text-sm tabular-nums text-muted">
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        </p>

        {filtered.length === 0 ? <p className="mt-6 text-muted">Nothing matches that.</p> : null}

        <ul className="mt-2 border-t border-line">
          {filtered.map((word) => {
            const open = openId === word.id;
            const progress = data.words[word.id];
            const state = !hydrated || !progress?.introduced ? "New" : progress.status === "known" ? "Known" : "Learning";
            const unitName = unitById.get(word.unit)?.de ?? "";
            return (
              <li key={word.id} className="border-b border-line">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : word.id)}
                  className="flex min-h-14 w-full items-baseline gap-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <span className="min-w-0 flex-1">
                    <span lang="de" className="font-medium">
                      {gloss(word)}
                    </span>
                    <span className="text-muted"> — {word.en}</span>
                    <span className="mt-1 block text-sm text-faint">
                      {state} · <span lang="de">{unitName}</span>
                    </span>
                  </span>
                </button>
                {open ? (
                  <Entry word={word} note={data.notes[word.id] ?? ""} onNote={(value) => setNote(word.id, value)} onMark={markWords} />
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </Shell>
  );
}

function FilterChip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-3 text-sm font-medium",
        on ? "border-pine bg-pine text-pine-ink" : "border-line bg-surface text-ink hover:bg-soft",
      )}
    >
      {label}
    </button>
  );
}

function Entry({
  word,
  note,
  onNote,
  onMark,
}: {
  word: Word;
  note: string;
  onNote: (value: string) => void;
  onMark: (ids: string[], status: "known" | "learning" | "new") => void;
}) {
  const gender = genderLabel(word);
  return (
    <div className="pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <AudioButton text={gloss(word)} label="Hear" />
        <AudioButton text={word.exampleDe} label="Example" />
      </div>
      <dl className="mt-4 grid grid-cols-[6rem_minmax(0,1fr)] gap-y-2 text-sm">
        <dt className="text-muted">English</dt>
        <dd>{word.en}</dd>
        {gender ? (
          <>
            <dt className="text-muted">Gender</dt>
            <dd>{gender}</dd>
          </>
        ) : null}
        {word.plural ? (
          <>
            <dt className="text-muted">Plural</dt>
            <dd lang="de">{word.plural}</dd>
          </>
        ) : null}
        <dt className="text-muted">Kind</dt>
        <dd>{labelPos(word.pos)}</dd>
      </dl>
      {word.forms ? <p className="mt-3 text-sm leading-relaxed text-muted">{word.forms}</p> : null}
      <p lang="de" className="mt-3">
        {word.exampleDe}
      </p>
      <p className="text-sm text-muted">{word.exampleEn}</p>
      {word.tip ? <p className="mt-3 text-sm leading-relaxed text-muted">{word.tip}</p> : null}
      <label className="mt-4 block text-sm text-muted">
        Your note
        <textarea
          value={note}
          rows={2}
          onChange={(event) => onNote(event.target.value)}
          className="mt-1 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-base text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
      </label>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button type="button" className="min-h-11 rounded-lg border border-line px-3 text-sm" onClick={() => onMark([word.id], "known")}>
          I know this
        </button>
        <button type="button" className="min-h-11 rounded-lg border border-line px-3 text-sm" onClick={() => onMark([word.id], "learning")}>
          Still learning
        </button>
        <button type="button" className="min-h-11 rounded-lg border border-line px-3 text-sm" onClick={() => onMark([word.id], "new")}>
          Mark as new
        </button>
      </div>
    </div>
  );
}

function labelPos(pos: Pos): string {
  if (pos === "noun") return "Noun";
  if (pos === "verb") return "Verb";
  if (pos === "adjective") return "Adjective";
  if (pos === "adverb") return "Adverb";
  if (pos === "phrase") return "Phrase";
  if (pos === "pronoun") return "Pronoun";
  if (pos === "preposition") return "Preposition";
  if (pos === "number") return "Number";
  return "Word";
}
