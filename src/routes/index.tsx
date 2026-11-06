import { Link, createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { AudioButton } from "@/components/audio-button";
import { Shell } from "@/components/shell";
import { cn } from "@/lib/cn";
import { gloss, units, type Word } from "@/lib/german/curriculum";
import {
  courseCounts,
  dueWords,
  keptSentences,
  learnedPhrases,
  recentWords,
  recommendedUnit,
  reminderText,
  studiedAnything,
  unitProgress,
} from "@/lib/german/selectors";
import { useProgress, type Persisted } from "@/lib/german/store";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Klarheft" }] }),
  component: Desk,
});

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 5 || hour >= 18) return { de: "Guten Abend.", en: "Good evening." };
  if (hour < 11) return { de: "Guten Morgen.", en: "Good morning." };
  return { de: "Guten Tag.", en: "Good day." };
}

function Desk() {
  const data = useProgress((state) => state.data);
  const hydrated = useProgress((state) => state.hydrated);
  const dismissReminder = useProgress((state) => state.dismissReminder);
  const setReminders = useProgress((state) => state.setReminders);
  const setSlowSpeech = useProgress((state) => state.setSlowSpeech);
  const reset = useProgress((state) => state.reset);
  const [greet, setGreet] = useState<{ de: string; en: string } | null>(null);
  const [settings, setSettings] = useState(false);
  const [armReset, setArmReset] = useState(false);

  useEffect(() => {
    setGreet(greeting(new Date()));
  }, []);

  const unit = recommendedUnit(data);
  const counts = courseCounts(data);
  const due = hydrated ? dueWords(data) : [];
  const recent = hydrated ? recentWords(data) : [];
  const sentences = hydrated ? keptSentences(data) : [];
  const phrases = hydrated ? learnedPhrases(data) : [];
  const reminder = hydrated ? reminderText(data) : null;
  const started = hydrated && studiedAnything(data);

  return (
    <Shell>
      <div className="mx-auto w-full max-w-2xl px-5 py-6 md:py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xl tracking-tight md:hidden">Klarheft</p>
            <h1 className="mt-3 font-display text-4xl tracking-tight md:mt-0 md:text-5xl">{greet?.de ?? "Willkommen."}</h1>
            <p className="mt-2 max-w-md text-muted">
              {greet?.en ?? "A quiet course in German."} Words, sentences, listening, and speaking — kept here, without points or
              streaks.
            </p>
          </div>
          <button
            type="button"
            aria-expanded={settings}
            aria-label="Settings"
            onClick={() => setSettings((open) => !open)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Settings className="size-4" aria-hidden />
          </button>
        </div>

        {settings ? (
          <section className="mt-4 rounded-xl border border-line bg-surface p-4">
            <h2 className="font-display text-2xl tracking-tight">Settings</h2>
            <div className="mt-4 flex flex-col gap-3">
              <Toggle
                on={data.remindersOn}
                label="Reminders"
                detail="A note on this desk when words are ready, or when it has been a few days. Nothing resets if you skip."
                onToggle={() => setReminders(!data.remindersOn)}
              />
              <Toggle
                on={data.slowSpeech}
                label="Slower speech"
                detail="Play German a little slower by default. You can still ask for slower on any line."
                onToggle={() => setSlowSpeech(!data.slowSpeech)}
              />
            </div>
            <div className="mt-5 border-t border-line pt-4">
              {!armReset ? (
                <button type="button" className="text-sm text-muted underline-offset-2 hover:underline" onClick={() => setArmReset(true)}>
                  Reset progress on this device
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted">This clears words, corrections, and notes stored in this browser.</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-wax px-4 text-pine-ink"
                      onClick={() => {
                        reset();
                        setArmReset(false);
                      }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4"
                      onClick={() => setArmReset(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {reminder ? (
          <div className="mt-6 flex items-start justify-between gap-4 border-t border-line pt-4">
            <p className="text-sm leading-relaxed text-muted">{reminder}</p>
            <button type="button" className="shrink-0 text-sm text-ink underline-offset-2 hover:underline" onClick={dismissReminder}>
              Hide today
            </button>
          </div>
        ) : null}

        <div className="mt-8 rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Next</p>
          <h2 className="mt-1 font-display text-3xl tracking-tight">
            <span lang="de">{unit.de}</span>
          </h2>
          <p className="text-muted">{unit.en}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              to="/practice"
              search={{ mode: "mix", len: 8, unit: unit.id }}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg bg-pine px-4 font-medium text-pine-ink hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Short session
            </Link>
            <Link
              to="/practice"
              search={{ mode: "mix", len: 16, unit: unit.id }}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg border border-line bg-bg px-4 font-medium hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Longer session
            </Link>
          </div>
          {hydrated && due.length > 0 ? (
            <Link
              to="/practice"
              search={{ mode: "review", len: 8 }}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-pine underline-offset-2 hover:underline"
            >
              Review {due.length} ready {due.length === 1 ? "word" : "words"}
            </Link>
          ) : null}
        </div>

        {started ? (
          <p className="mt-4 text-sm tabular-nums text-muted">
            {counts.known} known · {counts.learning} learning
            {counts.phrases > 0 ? ` · ${counts.phrases} phrases` : ""} · {counts.mistakes} to correct
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">
            {units.length} units, from hello through yesterday and why. Open any of them — nothing is locked, and a missed day changes nothing.
          </p>
        )}

        <section className="mt-10">
          <h2 className="font-display text-2xl tracking-tight">Course</h2>
          <p className="text-sm text-muted">Beginner first, then the next step. Skip ahead if you already know a unit.</p>
          <CourseList data={data} hydrated={hydrated} />
        </section>

        {due.length > 0 ? (
          <WordList title="Ready to review" words={due.slice(0, 6)} extra={Math.max(0, due.length - 6)} />
        ) : null}
        {recent.length > 0 ? <WordList title="Recently studied" words={recent} /> : null}
        {phrases.length > 0 ? <WordList title="Phrases you know" words={phrases} /> : null}
        {sentences.length > 0 ? (
          <section className="mt-10">
            <h2 className="font-display text-2xl tracking-tight">Sentences you formed</h2>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {sentences.map((sentence) => (
                <li key={sentence.id} className="flex items-center gap-3 py-3">
                  <AudioButton text={sentence.de} iconOnly label="Play sentence" />
                  <div className="min-w-0">
                    <p lang="de">{sentence.de}</p>
                    <p className="text-sm text-muted">{sentence.en}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Shell>
  );
}

function CourseList({ data, hydrated }: { data: Persisted; hydrated: boolean }) {
  const groups = [
    { id: "beginner", label: "Beginner", items: units.filter((unit) => unit.stage !== "Continuing") },
    { id: "continuing", label: "Continuing", items: units.filter((unit) => unit.stage === "Continuing") },
  ];
  return (
    <div>
      {groups.map((group) => (
        <div key={group.id}>
          <h3 className="mt-6 text-sm font-medium text-muted">{group.label}</h3>
          <ol className="mt-1 border-t border-line">
            {group.items.map((item) => {
              const progress = unitProgress(data, item.id);
              const width = progress.total ? (progress.known / progress.total) * 100 : 0;
              return (
                <li key={item.id} className="border-b border-line">
                  <Link
                    to="/unit/$unitId"
                    params={{ unitId: item.id }}
                    className="block py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    <span className="flex items-baseline gap-4">
                      <span className="w-6 tabular-nums text-faint">{item.n}</span>
                      <span className="min-w-0 flex-1">
                        <span lang="de" className="block font-display text-xl tracking-tight">
                          {item.de}
                        </span>
                        <span className="text-sm text-muted">{item.en}</span>
                      </span>
                      {hydrated ? (
                        <span className="tabular-nums text-sm text-faint">
                          {progress.known}/{progress.total}
                        </span>
                      ) : null}
                    </span>
                    {hydrated && progress.known + progress.learning > 0 ? (
                      <span className="mt-3 block h-1 overflow-hidden rounded-full bg-line" aria-hidden>
                        <span className="block h-full bg-pine" style={{ width: `${width}%` }} />
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

function WordList({
  title,
  words,
  extra = 0,
}: {
  title: string;
  words: Word[];
  extra?: number;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl tracking-tight">{title}</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {words.map((word) => (
          <li key={word.id} className="flex items-center gap-3 py-3">
            <AudioButton text={gloss(word)} iconOnly label={`Play ${gloss(word)}`} />
            <div className="min-w-0">
              <p lang="de">{gloss(word)}</p>
              <p className="text-sm text-muted">{word.en}</p>
            </div>
          </li>
        ))}
      </ul>
      {extra > 0 ? <p className="mt-2 text-sm text-muted">{extra} more in a review session.</p> : null}
    </section>
  );
}

function Toggle({
  on,
  label,
  detail,
  onToggle,
}: {
  on: boolean;
  label: string;
  detail: string;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted">{detail}</p>
      </div>
      <button
        type="button"
        aria-pressed={on}
        onClick={onToggle}
        className={cn(
          "mt-1 inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-line px-1",
          on ? "bg-pine" : "bg-bg",
        )}
      >
        <span className={cn("size-6 rounded-full bg-surface transition-transform duration-150", on ? "translate-x-6" : "translate-x-0")} />
        <span className="sr-only">{on ? "On" : "Off"}</span>
      </button>
    </div>
  );
}
