import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AudioButton } from "@/components/audio-button";
import { Shell } from "@/components/shell";
import { gloss, sentencesInUnit, unitById, wordsInUnit } from "@/lib/german/curriculum";
import { unitProgress } from "@/lib/german/selectors";
import { useProgress } from "@/lib/german/store";

export const Route = createFileRoute("/unit/$unitId")({
  head: ({ params }) => ({
    meta: [{ title: `${unitById.get(params.unitId)?.de ?? "Unit"} · Klarheft` }],
  }),
  component: UnitPage,
});

function UnitPage() {
  const { unitId } = Route.useParams();
  const unit = unitById.get(unitId);
  const data = useProgress((state) => state.data);
  const hydrated = useProgress((state) => state.hydrated);
  const markWords = useProgress((state) => state.markWords);
  const [cover, setCover] = useState(false);
  const [arm, setArm] = useState(false);

  if (!unit) {
    return (
      <Shell>
        <div className="mx-auto max-w-2xl px-5 py-10">
          <h1 className="font-display text-4xl tracking-tight">That unit isn’t in the course.</h1>
          <Link to="/" className="mt-6 inline-flex min-h-11 items-center font-medium text-pine">
            Back to the desk
          </Link>
        </div>
      </Shell>
    );
  }

  const list = wordsInUnit(unit.id);
  const progress = unitProgress(data, unit.id);
  const sentenceCount = sentencesInUnit(unit.id).length;

  return (
    <Shell>
      <div className="mx-auto w-full max-w-2xl px-5 py-6 md:py-10">
        <Link to="/" className="text-sm text-muted hover:text-ink">
          Desk
        </Link>
        <p className="mt-4 text-sm text-faint">
          {unit.stage === "Continuing" ? "Continuing" : "Beginner"} · Unit {unit.n}
        </p>
        <h1 lang="de" className="font-display text-4xl tracking-tight md:text-5xl">
          {unit.de}
        </h1>
        <p className="mt-2 text-lg text-muted">{unit.en}</p>
        <p className="mt-1 text-sm text-muted">{unit.blurb}</p>
        {hydrated ? (
          <p className="mt-3 text-sm tabular-nums text-muted">
            {progress.known} known · {progress.learning} learning · {list.length} in the unit · {sentenceCount} sentences
          </p>
        ) : null}

        <div className="mt-6 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-2xl tracking-tight">How this unit works</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{unit.grammar}</p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ModeLink unit={unit.id} mode="mix" len={8} label="Mixed session" />
          <ModeLink unit={unit.id} mode="words" len={8} label="Words" />
          <ModeLink unit={unit.id} mode="sentences" len={8} label="Sentences" />
          <ModeLink unit={unit.id} mode="listen" len={8} label="Listening" />
          <ModeLink unit={unit.id} mode="speak" len={8} label="Speaking" />
          <ModeLink unit={unit.id} mode="mix" len={16} label="Longer mix" />
        </div>

        <div className="mt-6">
          {!arm ? (
            <button type="button" className="text-sm text-muted underline-offset-2 hover:underline" onClick={() => setArm(true)}>
              I already know these words
            </button>
          ) : (
            <div className="rounded-lg border border-line p-3">
              <p className="text-sm text-muted">Marks every word in this unit as known. You can still study it.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-pine px-4 text-sm font-medium text-pine-ink"
                  onClick={() => {
                    markWords(
                      list.map((word) => word.id),
                      "known",
                    );
                    setArm(false);
                  }}
                >
                  Mark the unit known
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 text-sm"
                  onClick={() => setArm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl tracking-tight">Words</h2>
            <button
              type="button"
              aria-pressed={cover}
              onClick={() => setCover((value) => !value)}
              className="min-h-11 text-sm font-medium text-pine"
            >
              {cover ? "Show English" : "Cover English"}
            </button>
          </div>
          <ul className="mt-2 border-t border-line">
            {list.map((word) => (
              <li key={word.id} className="flex items-center gap-3 border-b border-line py-2">
                <AudioButton text={gloss(word)} iconOnly label={`Play ${gloss(word)}`} />
                <div className="min-w-0">
                  <p lang="de">{gloss(word)}</p>
                  {cover ? null : <p className="text-sm text-muted">{word.en}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}

function ModeLink({
  unit,
  mode,
  len,
  label,
}: {
  unit: string;
  mode: "mix" | "words" | "sentences" | "listen" | "speak";
  len: 8 | 16;
  label: string;
}) {
  const primary = mode === "mix" && len === 8;
  return (
    <Link
      to="/practice"
      search={{ mode, len, unit }}
      className={
        primary
          ? "inline-flex min-h-12 items-center justify-center rounded-lg bg-pine px-4 font-medium text-pine-ink"
          : "inline-flex min-h-12 items-center justify-center rounded-lg border border-line bg-surface px-4 font-medium hover:bg-soft"
      }
    >
      {label}
    </Link>
  );
}
