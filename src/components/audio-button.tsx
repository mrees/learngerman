import { Volume2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { speakGerman, type SpeakPhase } from "@/lib/german/speech";
import { useProgress } from "@/lib/german/store";

export function AudioButton({
  text,
  label = "Play",
  iconOnly = false,
  rate,
  className,
}: {
  text: string;
  label?: string;
  iconOnly?: boolean;
  rate?: number;
  className?: string;
}) {
  const slow = useProgress((state) => state.data.slowSpeech);
  const spoken = rate ?? (slow ? 0.8 : 0.96);
  const [phase, setPhase] = useState<SpeakPhase>("idle");
  const busy = phase !== "idle";
  const shown = phase === "loading" ? "Loading" : phase === "playing" ? "Playing" : label;
  return (
    <button
      type="button"
      data-audio={phase}
      aria-busy={busy}
      onClick={() => {
        void speakGerman(text, spoken, setPhase);
      }}
      aria-label={iconOnly ? `${shown} ${text}` : undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 border border-line bg-surface text-sm font-medium text-ink",
        "transition-[background-color,transform] duration-150 hover:bg-soft active:scale-[0.98]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        iconOnly ? "size-11 shrink-0 rounded-lg" : "min-h-11 rounded-lg px-3",
        busy && "bg-soft",
        className,
      )}
    >
      <Volume2 className="size-4" aria-hidden />
      {iconOnly ? <span className="sr-only">{shown}</span> : shown}
    </button>
  );
}