import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { AudioButton } from "@/components/audio-button";
import { insertAtCursor, UmlautKeys } from "@/components/umlaut-keys";
import { cn } from "@/lib/cn";
import {
  genderLabel,
  gloss,
  sentenceById,
  wordById,
  type Sentence,
  type Word,
} from "@/lib/german/curriculum";
import { feedbackNote, normalizeAnswer, speechMatch, strictMatch } from "@/lib/german/normalize";
import { playAnswerCue } from "@/lib/german/cues";
import { promptFor, type Activity } from "@/lib/german/session";
import { recognitionSupported, speakGerman, startRecognition, stopSpeaking, ttsSupported, type SpeechListener } from "@/lib/german/speech";
import type { MistakeInput, MistakeKind } from "@/lib/german/store";

export type StepOutcome = {
  counted: boolean;
  correct: boolean;
  firstTry: boolean;
  introducedId?: string;
  wordId?: string;
  sentenceId?: string;
  mistake?: MistakeInput;
  resolve?: { kind: MistakeKind; refId: string };
};

type Phase = "ask" | "correct" | "wrong";
type Chip = { id: string; text: string };

const LABELS: Record<Activity["kind"], string> = {
  introduce: "New word",
  meaning: "Word",
  produce: "Write the word",
  article: "Article",
  order: "Sentence",
  translate: "Sentence",
  listen: "Listening",
  dictation: "Dictation",
  speak: "Speaking",
};

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

export function StudyStep({
  activity,
  index,
  total,
  onDone,
}: {
  activity: Activity;
  index: number;
  total: number;
  onDone: (outcome: StepOutcome) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const attempts = useRef(0);
  const listener = useRef<SpeechListener | null>(null);
  const titleId = useId();
  const [phase, setPhase] = useState<Phase>("ask");
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [yours, setYours] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [micNote, setMicNote] = useState<string | null>(null);
  const [bank, setBank] = useState<Chip[]>(() => chipsFor(activity));
  const [built, setBuilt] = useState<Chip[]>([]);
  const [showLine, setShowLine] = useState(false);
  const [seed] = useState<Chip[]>(() => chipsFor(activity));

  useEffect(() => {
    headingRef.current?.focus();
    return () => {
      stopSpeaking();
      listener.current?.stop();
    };
  }, []);

  const word = "wordId" in activity ? wordById.get(activity.wordId) : undefined;
  const sentence = "sentenceId" in activity ? sentenceById.get(activity.sentenceId) : undefined;
  const meta = promptFor(activity);
  const audioOk = ttsSupported();

  function mark(correct: boolean, answer: string, expected: string) {
    attempts.current += 1;
    setYours(answer);
    stopSpeaking();
    playAnswerCue(correct);
    if (correct) {
      setPhase("correct");
      setNote(feedbackNote(expected, answer));
      setLive("Correct.");
    } else {
      setPhase("wrong");
      setNote(null);
      setLive("Not yet. The correction is shown.");
    }
  }

  function resetAttempt() {
    setPhase("ask");
    setPicked(null);
    setTyped("");
    setHeard("");
    setMicNote(null);
    setBuilt([]);
    setBank(seed.map((chip) => ({ ...chip })));
    setLive("");
  }

  function advance() {
    if (activity.kind === "introduce" && word) {
      onDone({ counted: false, correct: true, firstTry: true, introducedId: word.id });
      return;
    }
    if (!meta) return;
    const correct = phase === "correct";
    const wordKind = activity.kind === "meaning" || activity.kind === "produce" || activity.kind === "article";
    const sentenceKind = !wordKind && activity.kind !== "introduce";
    onDone({
      counted: true,
      correct,
      firstTry: correct && attempts.current <= 1,
      wordId: wordKind && "wordId" in activity ? activity.wordId : undefined,
      sentenceId: sentenceKind && "sentenceId" in activity ? activity.sentenceId : undefined,
      resolve: correct ? { kind: meta.kind, refId: meta.refId } : undefined,
      mistake: correct
        ? undefined
        : {
            kind: meta.kind,
            refId: meta.refId,
            prompt: meta.prompt,
            yours: yours || "—",
            expected: meta.expected,
            tip: meta.tip,
          },
    });
  }

  function checkChoice(expected: string) {
    if (!picked) return;
    mark(normalizeAnswer(picked) === normalizeAnswer(expected), picked, expected);
  }

  function checkTyped(expected: string, alts: string[] = []) {
    mark(strictMatch(expected, typed, alts), typed.trim(), expected);
  }

  function checkOrder() {
    if (!sentence) return;
    const answer = built.map((chip) => chip.text).join(" ");
    mark(normalizeAnswer(answer) === normalizeAnswer(sentence.de), answer, sentence.de);
  }

  function checkSpeech(self?: "said" | "stumbled") {
    if (!sentence) return;
    if (self === "said") {
      mark(true, "Said aloud", sentence.de);
      return;
    }
    if (self === "stumbled") {
      mark(false, "Still working on the pronunciation", sentence.de);
      return;
    }
    const given = typed.trim() || heard.trim();
    mark(speechMatch(sentence.de, given, sentence.alt ?? []), given, sentence.de);
  }

  function toggleMic() {
    if (listening) {
      listener.current?.stop();
      setListening(false);
      return;
    }
    setMicNote(null);
    setHeard("");
    const handle = startRecognition({
      onText: setHeard,
      onError: (message) => {
        setMicNote(message);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
    if (!handle) {
      setMicNote("This browser can’t hear German. Type what you said.");
      return;
    }
    listener.current = handle;
    setListening(true);
  }

  const showResult = phase !== "ask";

  return (
    <article className="step-in rounded-xl border border-line bg-surface p-4" aria-labelledby={titleId}>
      <p className="text-sm text-muted" ref={headingRef} tabIndex={-1}>
        <span id={titleId}>{LABELS[activity.kind]}</span>
        <span className="tabular-nums"> · {index + 1} of {total}</span>
      </p>
      <div className="sr-only" role="status" aria-live="polite">
        {live}
      </div>

      {activity.kind === "introduce" && word ? <Introduce word={word} /> : null}

      {activity.kind === "meaning" && word ? (
        <div className="mt-5">
          <p className="text-sm text-muted">What does this mean?</p>
          <p lang="de" className="mt-2 font-display text-4xl tracking-tight">
            {gloss(word)}
          </p>
          <div className="mt-3">
            <AudioButton text={gloss(word)} />
          </div>
          <ChoiceList
            options={activity.options}
            picked={picked}
            answer={word.en}
            phase={phase}
            onPick={setPicked}
          />
        </div>
      ) : null}

      {activity.kind === "article" && word ? (
        <div className="mt-5">
          <p className="text-sm text-muted">Which article?</p>
          <p lang="de" className="mt-2 font-display text-4xl tracking-tight">
            {word.de}
          </p>
          <ChoiceList
            options={["der", "die", "das"]}
            picked={picked}
            answer={word.article ?? ""}
            phase={phase}
            onPick={setPicked}
            lang="de"
          />
        </div>
      ) : null}

      {activity.kind === "produce" && word ? (
        <div className="mt-5">
          <p className="text-sm text-muted">Write this in German{word.article ? ", with the article" : ""}.</p>
          <p className="mt-2 font-display text-4xl tracking-tight">{word.en}</p>
          <TypeAnswer
            fieldRef={fieldRef}
            value={typed}
            onChange={setTyped}
            disabled={showResult}
            onSubmit={() => checkTyped(gloss(word))}
          />
        </div>
      ) : null}

      {activity.kind === "order" && sentence ? (
        <div className="mt-5">
          <p className="text-sm text-muted">Build the German sentence.</p>
          <p className="mt-2 font-display text-3xl tracking-tight">{sentence.en}</p>
          <div className="mt-4 min-h-16 rounded-lg border border-line bg-bg p-2" aria-label="Your sentence">
            {built.length === 0 ? <p className="px-2 py-2 text-sm text-faint">Tap the words in order.</p> : null}
            <div className="flex flex-wrap gap-2">
              {built.map((chip) => (
                <ChipButton key={chip.id} chip={chip} disabled={showResult} onClick={() => pull(chip, built, setBuilt, setBank)} />
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {bank.map((chip) => (
              <ChipButton
                key={chip.id}
                chip={chip}
                disabled={showResult}
                onClick={() => {
                  setBank((items) => items.filter((item) => item.id !== chip.id));
                  setBuilt((items) => [...items, chip]);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {activity.kind === "translate" && sentence ? (
        <div className="mt-5">
          <p className="text-sm text-muted">Write this in German.</p>
          <p className="mt-2 font-display text-3xl tracking-tight">{sentence.en}</p>
          <TypeAnswer
            fieldRef={fieldRef}
            value={typed}
            onChange={setTyped}
            disabled={showResult}
            onSubmit={() => checkTyped(sentence.de, sentence.alt ?? [])}
          />
        </div>
      ) : null}

      {activity.kind === "listen" && sentence ? (
        <div className="mt-5">
          <p className="text-sm text-muted">
            {audioOk ? "Listen, then choose the meaning." : "No German voice here. Read it, then choose the meaning."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <AudioButton text={sentence.de} label="Play" />
            <button type="button" onClick={() => speakGerman(sentence.de, 0.78)} className={quietButton}>
              Slower
            </button>
            {audioOk && !showLine ? (
              <button type="button" onClick={() => setShowLine(true)} className={quietButton}>
                Show the German
              </button>
            ) : null}
          </div>
          {!audioOk || showLine ? (
            <p lang="de" className="mt-4 font-display text-3xl tracking-tight">
              {sentence.de}
            </p>
          ) : null}
          <ChoiceList options={activity.options} picked={picked} answer={sentence.en} phase={phase} onPick={setPicked} />
        </div>
      ) : null}

      {activity.kind === "dictation" && sentence ? (
        <div className="mt-5">
          {audioOk ? (
            <>
              <p className="text-sm text-muted">Listen, then write what you heard.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <AudioButton text={sentence.de} label="Play" />
                <button type="button" onClick={() => speakGerman(sentence.de, 0.78)} className={quietButton}>
                  Slower
                </button>
                {!showLine ? (
                  <button type="button" onClick={() => setShowLine(true)} className={quietButton}>
                    I can’t hear this
                  </button>
                ) : null}
              </div>
              {showLine ? (
                <p lang="de" className="mt-4 font-display text-3xl tracking-tight">
                  {sentence.de}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm text-muted">Audio isn’t available. Write this in German.</p>
              <p className="mt-2 font-display text-3xl tracking-tight">{sentence.en}</p>
            </>
          )}
          <TypeAnswer
            fieldRef={fieldRef}
            value={typed}
            onChange={setTyped}
            disabled={showResult}
            onSubmit={() => checkTyped(sentence.de, sentence.alt ?? [])}
          />
        </div>
      ) : null}

      {activity.kind === "speak" && sentence ? (
        <SpeakBlock
          sentence={sentence}
          mode={activity.mode}
          phase={phase}
          listening={listening}
          heard={heard}
          micNote={micNote}
          typed={typed}
          fieldRef={fieldRef}
          onTyped={setTyped}
          onMic={toggleMic}
          onSubmit={() => checkSpeech()}
          showGerman={activity.mode === "repeat" || showResult}
        />
      ) : null}

      {showResult && meta ? (
        <Result
          correct={phase === "correct"}
          expected={meta.expected}
          yours={yours}
          note={note}
          tip={meta.tip}
          speakText={activity.kind === "meaning" || activity.kind === "listen" ? undefined : meta.expected}
          glossLine={activity.kind === "meaning" || activity.kind === "listen" ? meta.prompt : undefined}
        />
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {phase === "ask" && activity.kind !== "introduce" ? (
          <button
            type="button"
            className={cn(primaryButton, footerButton)}
            disabled={askDisabled(activity, picked, typed, built.length, heard)}
            onClick={() => {
              if (activity.kind === "meaning" && word) checkChoice(word.en);
              else if (activity.kind === "article" && word) checkChoice(word.article ?? "");
              else if (activity.kind === "produce" && word) checkTyped(gloss(word));
              else if (activity.kind === "order") checkOrder();
              else if ((activity.kind === "translate" || activity.kind === "dictation") && sentence) {
                checkTyped(sentence.de, sentence.alt ?? []);
              } else if (activity.kind === "listen" && sentence) checkChoice(sentence.en);
              else if (activity.kind === "speak") checkSpeech();
            }}
          >
            Check
          </button>
        ) : null}
        {activity.kind === "introduce" ? (
          <button type="button" className={cn(primaryButton, footerButton)} onClick={advance}>
            I’ll learn this
          </button>
        ) : null}
        {phase === "wrong" ? (
          <button type="button" className={cn(primaryButton, footerButton)} onClick={resetAttempt}>
            Try again
          </button>
        ) : null}
        {showResult ? (
          <button
            type="button"
            className={cn(phase === "wrong" ? quietButton : primaryButton, footerButton)}
            onClick={advance}
          >
            {phase === "wrong" ? "Keep it for later" : "Continue"}
          </button>
        ) : null}
        {activity.kind === "speak" && phase === "ask" ? (
          <>
            <button type="button" className={cn(quietButton, footerButton)} onClick={() => checkSpeech("said")}>
              I said it
            </button>
            <button type="button" className={cn(quietButton, footerButton)} onClick={() => checkSpeech("stumbled")}>
              I stumbled
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function pull(
  chip: Chip,
  built: Chip[],
  setBuilt: (value: Chip[]) => void,
  setBank: (value: Chip[] | ((items: Chip[]) => Chip[])) => void,
) {
  setBuilt(built.filter((item) => item.id !== chip.id));
  setBank((items) => [...items, chip]);
}

function askDisabled(activity: Activity, picked: string | null, typed: string, built: number, heard: string): boolean {
  if (activity.kind === "introduce") return false;
  if (activity.kind === "meaning" || activity.kind === "article" || activity.kind === "listen") return !picked;
  if (activity.kind === "order") return built === 0;
  if (activity.kind === "speak") return !typed.trim() && !heard.trim();
  return !typed.trim();
}

function chipsFor(activity: Activity): Chip[] {
  if (activity.kind !== "order") return [];
  const sentence = sentenceById.get(activity.sentenceId);
  if (!sentence) return [];
  return shuffle([...sentence.tokens, ...sentence.distractors].map((text, index) => ({ id: `${index}-${text}`, text })));
}

function Introduce({ word }: { word: Word }) {
  const gender = genderLabel(word);
  return (
    <div className="mt-5">
      {gender ? <p className="text-sm text-muted">{gender}</p> : null}
      <p lang="de" className="mt-1 font-display text-4xl tracking-tight">
        {gloss(word)}
      </p>
      <p className="mt-2 text-lg text-muted">{word.en}</p>
      {word.plural ? (
        <p className="mt-2 text-sm text-muted">
          Plural <span lang="de">{word.plural}</span>
        </p>
      ) : null}
      {word.forms ? <p className="mt-3 text-sm leading-relaxed text-muted">{word.forms}</p> : null}
      <figure className="mt-4 border-t border-line pt-4">
        <p lang="de">{word.exampleDe}</p>
        <p className="text-sm text-muted">{word.exampleEn}</p>
        <div className="mt-3">
          <AudioButton text={word.exampleDe} label="Hear the example" />
        </div>
      </figure>
      {word.tip ? <p className="mt-4 text-sm leading-relaxed text-muted">{word.tip}</p> : null}
    </div>
  );
}

function ChoiceList({
  options,
  picked,
  answer,
  phase,
  onPick,
  lang,
}: {
  options: string[];
  picked: string | null;
  answer: string;
  phase: Phase;
  onPick: (value: string) => void;
  lang?: "de";
}) {
  return (
    <div className="mt-4 flex flex-col gap-2" role="group">
      {options.map((option) => {
        const selected = picked === option;
        const revealed = phase !== "ask";
        const right = normalizeAnswer(option) === normalizeAnswer(answer);
        return (
          <button
            key={option}
            type="button"
            lang={lang}
            disabled={revealed}
            aria-pressed={selected}
            onClick={() => onPick(option)}
            className={cn(
              "min-h-12 w-full rounded-lg border border-line px-3 py-2 text-left",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
              !revealed && selected && "bg-soft ring-2 ring-pine",
              revealed && right && "bg-soft ring-2 ring-pine",
              revealed && selected && !right && "bg-wax-soft ring-2 ring-wax",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function TypeAnswer({
  value,
  onChange,
  onSubmit,
  disabled,
  fieldRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  fieldRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <label className="sr-only" htmlFor="german-answer">
        Your German
      </label>
      <textarea
        id="german-answer"
        ref={fieldRef}
        lang="de"
        rows={2}
        disabled={disabled}
        value={value}
        placeholder="Type in German"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (value.trim() && !disabled) onSubmit();
          }
        }}
        className="min-h-12 w-full resize-y rounded-lg border border-line bg-bg px-3 py-3 text-ink outline-none placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-70"
      />
      {!disabled ? <UmlautKeys onInsert={(char) => insertAtCursor(fieldRef.current, value, char, onChange)} /> : null}
    </div>
  );
}

function ChipButton({ chip, onClick, disabled }: { chip: Chip; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      lang="de"
      disabled={disabled}
      onClick={onClick}
      className="min-h-11 rounded-md border border-line bg-surface px-3 text-ink hover:bg-soft disabled:hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {chip.text}
    </button>
  );
}

function SpeakBlock({
  sentence,
  mode,
  phase,
  listening,
  heard,
  micNote,
  typed,
  fieldRef,
  onTyped,
  onMic,
  onSubmit,
  showGerman,
}: {
  sentence: Sentence;
  mode: "repeat" | "produce";
  phase: Phase;
  listening: boolean;
  heard: string;
  micNote: string | null;
  typed: string;
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  onTyped: (value: string) => void;
  onMic: () => void;
  onSubmit: () => void;
  showGerman: boolean;
}) {
  const canHear = recognitionSupported();
  return (
    <div className="mt-5">
      <p className="text-sm text-muted">
        {mode === "repeat" ? "Listen, then say it." : "Say this in German."} Mark it yourself if the microphone can’t check you.
      </p>
      <p className={cn("mt-2 font-display text-3xl tracking-tight", mode === "repeat" || showGerman ? "" : "")} lang={mode === "repeat" || phase !== "ask" ? "de" : undefined}>
        {mode === "repeat" || phase !== "ask" ? sentence.de : sentence.en}
      </p>
      {mode === "produce" && phase === "ask" ? null : (
        <p className="mt-2 text-muted">{mode === "repeat" ? sentence.en : phase !== "ask" ? sentence.en : null}</p>
      )}
      {showGerman || mode === "repeat" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <AudioButton text={sentence.de} label="Hear it" />
          <button type="button" className={quietButton} onClick={() => speakGerman(sentence.de, 0.78)}>
            Slower
          </button>
        </div>
      ) : null}
      {canHear && phase === "ask" ? (
        <button type="button" className={cn(primaryButton, "mt-4")} onClick={onMic} aria-pressed={listening}>
          {listening ? "Stop" : "Speak"}
        </button>
      ) : null}
      {heard ? (
        <p className="mt-3 text-sm text-muted">
          Heard: <span lang="de">{heard}</span>
        </p>
      ) : null}
      {micNote ? <p className="mt-3 text-sm text-muted">{micNote}</p> : null}
      {phase === "ask" ? (
        <div className="mt-4">
          <p className="text-sm text-muted">{canHear ? "If it heard you wrong, type what you said." : "Or type the German."}</p>
          <TypeAnswer fieldRef={fieldRef} value={typed} onChange={onTyped} disabled={false} onSubmit={onSubmit} />
        </div>
      ) : null}
    </div>
  );
}

function Result({
  correct,
  expected,
  yours,
  note,
  tip,
  speakText,
  glossLine,
}: {
  correct: boolean;
  expected: string;
  yours: string;
  note: string | null;
  tip?: string;
  speakText?: string;
  glossLine?: string;
}) {
  return (
    <div className={cn("mt-5 rounded-lg p-3", correct ? "bg-soft" : "bg-wax-soft")}>
      <p className="font-medium">{correct ? "Correct." : "Not yet."}</p>
      {!correct && yours ? (
        <p className="mt-2 text-sm">
          You had <span lang="de">{yours}</span>
        </p>
      ) : null}
      <p lang={speakText ? "de" : undefined} className="mt-2 font-display text-2xl tracking-tight">
        {expected}
      </p>
      {glossLine && !correct ? <p className="mt-1 text-sm text-muted">{glossLine}</p> : null}
      {speakText || glossLine ? (
        <div className="mt-3">
          <AudioButton text={speakText || glossLine || ""} label="Hear it" />
        </div>
      ) : null}
      {note ? <p className="mt-3 text-sm leading-relaxed">{note}</p> : null}
      {!correct && tip ? <p className="mt-3 text-sm leading-relaxed text-muted">{tip}</p> : null}
    </div>
  );
}

const primaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-lg bg-pine px-4 font-medium text-pine-ink transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const quietButton =
  "inline-flex min-h-12 items-center justify-center rounded-lg border border-line bg-surface px-4 font-medium text-ink hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const footerButton = "w-full sm:flex-1";
