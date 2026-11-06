import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Shell } from "@/components/shell";
import { StudyStep, type StepOutcome } from "@/components/study-step";
import { unitById } from "@/lib/german/curriculum";
import { activityKey, buildSession, type Activity, type StudyMode } from "@/lib/german/session";
import { useProgress } from "@/lib/german/store";

const MODES: StudyMode[] = ["mix", "words", "sentences", "listen", "speak", "review", "fix"];

type PracticeSearch = {
  mode: StudyMode;
  len: 8 | 16;
  unit?: string;
  mistake?: string;
};

export const Route = createFileRoute("/practice")({
  validateSearch: (search: Record<string, unknown>): PracticeSearch => {
    const mode = MODES.includes(search.mode as StudyMode) ? (search.mode as StudyMode) : "mix";
    const len: 8 | 16 = search.len === 16 || search.len === "16" ? 16 : 8;
    const result: PracticeSearch = { mode, len };
    if (typeof search.unit === "string") result.unit = search.unit;
    if (typeof search.mistake === "string") result.mistake = search.mistake;
    return result;
  },
  head: () => ({ meta: [{ title: "Study · Klarheft" }] }),
  component: PracticePage,
});

function PracticePage() {
  const search = Route.useSearch();
  const hydrated = useProgress((state) => state.hydrated);
  const introduceWord = useProgress((state) => state.introduceWord);
  const gradeWord = useProgress((state) => state.gradeWord);
  const gradeSentence = useProgress((state) => state.gradeSentence);
  const addMistake = useProgress((state) => state.addMistake);
  const resolveMistake = useProgress((state) => state.resolveMistake);
  const touchSession = useProgress((state) => state.touchSession);
  const [nonce, setNonce] = useState(0);
  const [session, setSession] = useState<Activity[] | null>(null);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [tally, setTally] = useState({ asked: 0, firstCorrect: 0, introduced: 0, missed: 0 });
  const touched = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    touched.current = false;
    const data = useProgress.getState().data;
    setSession(
      buildSession(data, {
        mode: search.mode,
        unitId: search.unit,
        len: search.len,
        mistakeId: search.mistake,
      }),
    );
    setIndex(0);
    setDone(false);
    setTally({ asked: 0, firstCorrect: 0, introduced: 0, missed: 0 });
  }, [hydrated, nonce, search.len, search.mistake, search.mode, search.unit]);

  function onDone(outcome: StepOutcome) {
    if (!touched.current) {
      touched.current = true;
      touchSession();
    }
    if (outcome.introducedId) introduceWord(outcome.introducedId);
    if (outcome.wordId) gradeWord(outcome.wordId, outcome.correct);
    if (outcome.sentenceId) gradeSentence(outcome.sentenceId, outcome.correct);
    if (outcome.correct && outcome.resolve) resolveMistake(outcome.resolve.kind, outcome.resolve.refId);
    if (!outcome.correct && outcome.mistake) addMistake(outcome.mistake);
    setTally((current) => ({
      asked: current.asked + (outcome.counted ? 1 : 0),
      firstCorrect: current.firstCorrect + (outcome.counted && outcome.correct && outcome.firstTry ? 1 : 0),
      introduced: current.introduced + (outcome.introducedId ? 1 : 0),
      missed: current.missed + (outcome.counted && !outcome.correct ? 1 : 0),
    }));
    if (!session || index + 1 >= session.length) setDone(true);
    else setIndex((value) => value + 1);
  }

  const unit = search.unit ? unitById.get(search.unit) : undefined;
  const inStep = Boolean(session && session.length > 0 && !done);
  const activity = session?.[index];

  return (
    <Shell bare={inStep}>
      {!hydrated || !session ? (
        <div className="mx-auto max-w-2xl px-5 py-10">
          <h1 className="font-display text-4xl tracking-tight">Preparing your session</h1>
          <p className="mt-2 text-muted">A few words and sentences, nothing else.</p>
        </div>
      ) : null}

      {hydrated && session && session.length === 0 ? (
        <div className="mx-auto max-w-2xl px-5 py-10">
          <h1 className="font-display text-4xl tracking-tight">Nothing is waiting</h1>
          <p className="mt-3 max-w-md text-muted">
            {search.mode === "fix"
              ? "That correction is already cleared."
              : search.mode === "review"
                ? "No words are due, and nothing is still marked as learning. Open a unit when you want new material."
                : "This part of the course has no exercises yet."}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link to="/" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-pine px-4 font-medium text-pine-ink">
              Back to the desk
            </Link>
            <Link
              to="/corrections"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-line px-4 font-medium"
            >
              Corrections
            </Link>
          </div>
        </div>
      ) : null}

      {inStep && activity ? (
        <div className="pad-safe mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="font-display text-lg tracking-tight">{unit?.de ?? "Klarheft"}</p>
            <Link to="/" className="inline-flex min-h-11 items-center text-sm font-medium text-muted hover:text-ink">
              Leave
            </Link>
          </div>
          <StudyStep key={activityKey(activity, index)} activity={activity} index={index} total={session.length} onDone={onDone} />
        </div>
      ) : null}

      {done && session ? (
        <div className="mx-auto max-w-2xl px-5 py-10">
          <h1 className="font-display text-4xl tracking-tight">Session done</h1>
          <p className="mt-3 text-muted">
            {tally.asked > 0
              ? `${tally.firstCorrect} of ${tally.asked} right on the first try.`
              : "You met the new words. They’ll come back in a later session."}
          </p>
          {tally.introduced > 0 ? (
            <p className="mt-2 text-muted">
              {tally.introduced} new {tally.introduced === 1 ? "word" : "words"}.
            </p>
          ) : null}
          {tally.missed > 0 ? (
            <p className="mt-2 text-muted">
              {tally.missed} saved under Corrections. Nothing expires if you leave them.
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {search.mode === "fix" ? (
              <Link
                to="/corrections"
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg bg-pine px-4 font-medium text-pine-ink"
              >
                Back to corrections
              </Link>
            ) : (
              <button
                type="button"
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg bg-pine px-4 font-medium text-pine-ink"
                onClick={() => setNonce((value) => value + 1)}
              >
                Another session
              </button>
            )}
            <Link
              to="/"
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg border border-line px-4 font-medium"
            >
              Desk
            </Link>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
