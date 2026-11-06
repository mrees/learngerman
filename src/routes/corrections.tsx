import { Link, createFileRoute } from "@tanstack/react-router";
import { AudioButton } from "@/components/audio-button";
import { Shell } from "@/components/shell";
import type { Mistake } from "@/lib/german/store";
import { useProgress } from "@/lib/german/store";

const KIND_LABEL: Record<Mistake["kind"], string> = {
  meaning: "Meaning",
  produce: "Writing",
  article: "Article",
  order: "Sentence",
  translate: "Sentence",
  listen: "Listening",
  dictation: "Dictation",
  speak: "Speaking",
};

export const Route = createFileRoute("/corrections")({
  head: () => ({ meta: [{ title: "Corrections · Klarheft" }] }),
  component: CorrectionsPage,
});

function CorrectionsPage() {
  const mistakes = useProgress((state) => state.data.mistakes);
  const hydrated = useProgress((state) => state.hydrated);
  const removeMistake = useProgress((state) => state.removeMistake);

  return (
    <Shell>
      <div className="mx-auto w-full max-w-2xl px-5 py-6 md:py-10">
        <p className="font-display text-xl tracking-tight md:hidden">Klarheft</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight md:mt-0">Corrections</h1>
        <p className="mt-2 max-w-md text-muted">
          Missed answers stay here until you try them again or clear them. They don’t pile up a penalty, and they don’t disappear on
          their own.
        </p>

        {hydrated && mistakes.length === 0 ? (
          <p className="mt-8 text-muted">Nothing to correct.</p>
        ) : null}

        <ul className="mt-6 flex flex-col gap-4">
          {mistakes.map((mistake) => {
            const german = mistake.kind === "meaning" || mistake.kind === "listen" ? mistake.prompt : mistake.expected;
            return (
              <li key={mistake.id} className="rounded-xl border border-line bg-surface p-4">
                <p className="text-sm text-muted">{KIND_LABEL[mistake.kind]}</p>
                <p className="mt-2 font-medium">{mistake.prompt}</p>
                <p className="mt-3 text-sm text-muted">
                  You had <span lang="de">{mistake.yours}</span>
                </p>
                <p lang="de" className="mt-2 font-display text-2xl tracking-tight">
                  {mistake.expected}
                </p>
                <div className="mt-3">
                  <AudioButton text={german} label="Hear it" />
                </div>
                {mistake.tip ? <p className="mt-3 text-sm leading-relaxed text-muted">{mistake.tip}</p> : null}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Link
                    to="/practice"
                    search={{ mode: "fix", len: 8, mistake: mistake.id }}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-pine px-4 text-sm font-medium text-pine-ink"
                  >
                    Try again
                  </Link>
                  <button
                    type="button"
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-line px-4 text-sm font-medium"
                    onClick={() => removeMistake(mistake.id)}
                  >
                    I understand this now
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Shell>
  );
}
