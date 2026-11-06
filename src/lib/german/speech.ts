import { pronounceGerman } from "@/lib/german/pronounce-fn";

export type SpeakPhase = "loading" | "playing" | "idle";

const CLIP_CACHE = "klarheft-de-v1";
const memory = new Map<string, string>();

let audio: HTMLAudioElement | null = null;
let token = 0;
let phaseSink: ((phase: SpeakPhase) => void) | null = null;

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && ("speechSynthesis" in window || typeof Audio !== "undefined");
}

export function recognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

function germanVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith("de-de")) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("de"))
  );
}

function setPhase(phase: SpeakPhase, sink: ((phase: SpeakPhase) => void) | null) {
  if (phaseSink && phaseSink !== sink) phaseSink("idle");
  phaseSink = sink;
  sink?.(phase);
}

export function stopSpeaking(): void {
  token += 1;
  audio?.pause();
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  if (phaseSink) {
    const sink = phaseSink;
    phaseSink = null;
    sink("idle");
  }
}

function cacheUrl(text: string): string {
  return `https://klarheft.local/de/${encodeURIComponent(text)}`;
}

async function readCached(text: string): Promise<Blob | null> {
  const known = memory.get(text);
  if (known) {
    const res = await fetch(known);
    return res.blob();
  }
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(CLIP_CACHE);
  const hit = await cache.match(cacheUrl(text));
  return hit ? hit.blob() : null;
}

async function writeCached(text: string, blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob);
  memory.set(text, url);
  if (typeof caches !== "undefined") {
    const cache = await caches.open(CLIP_CACHE);
    await cache.put(cacheUrl(text), new Response(blob, { headers: { "Content-Type": "audio/mpeg" } }));
  }
  return url;
}

function playUrl(url: string, rate: number, my: number, sink: ((phase: SpeakPhase) => void) | null): Promise<boolean> {
  if (!audio) audio = new Audio();
  const el = audio;
  el.onended = null;
  el.onerror = null;
  el.pause();
  el.src = url;
  el.playbackRate = Math.min(1.15, Math.max(0.7, rate));
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      el.onended = null;
      el.onerror = null;
      if (my === token && phaseSink === sink) setPhase("idle", sink);
      resolve(ok);
    };
    el.onended = () => finish(true);
    el.onerror = () => finish(false);
    setPhase("playing", sink);
    void el.play().catch(() => finish(false));
  });
}

function speakWithBrowser(text: string, rate: number, my: number, sink: ((phase: SpeakPhase) => void) | null): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return false;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.rate = rate;
    const voice = germanVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (my === token) setPhase("idle", sink);
    };
    utterance.onerror = () => {
      if (my === token) setPhase("idle", sink);
    };
    window.speechSynthesis.cancel();
    setPhase("playing", sink);
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export async function speakGerman(
  text: string,
  rate = 0.96,
  onPhase?: (phase: SpeakPhase) => void,
): Promise<boolean> {
  const line = text.trim();
  if (!line || typeof window === "undefined") return false;
  const my = ++token;
  audio?.pause();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  const sink = onPhase ?? null;
  setPhase("loading", sink);
  try {
    let blob = await readCached(line);
    if (my !== token) return false;
    if (!blob) {
      const result = await pronounceGerman({ data: { text: line } });
      if (my !== token) return false;
      if (result.ok) {
        const binary = atob(result.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        blob = new Blob([bytes], { type: "audio/mpeg" });
        await writeCached(line, blob);
      }
    }
    if (my !== token) return false;
    if (blob) {
      const url = memory.get(line) ?? URL.createObjectURL(blob);
      memory.set(line, url);
      const played = await playUrl(url, rate, my, sink);
      if (played) return true;
    }
  } catch {
    /* fall through to the browser voice */
  }
  if (my !== token) return false;
  const spoken = speakWithBrowser(line, rate, my, sink);
  if (!spoken) setPhase("idle", sink);
  return spoken;
}

export type SpeechListener = {
  stop: () => void;
};

export function startRecognition(handlers: {
  onText: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): SpeechListener | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  stopSpeaking();
  const rec = new Ctor();
  rec.lang = "de-DE";
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (event) => {
    let text = "";
    for (let i = 0; i < event.results.length; i++) {
      text += event.results[i]?.[0]?.transcript ?? "";
    }
    handlers.onText(text.trim());
  };
  rec.onerror = (event) => {
    if (event.error === "aborted") return;
    if (event.error === "no-speech") handlers.onError("No speech heard. Try again, or type it.");
    else if (event.error === "not-allowed") handlers.onError("Microphone blocked. Type what you said.");
    else handlers.onError("Couldn’t use the microphone. Type what you said.");
  };
  rec.onend = () => handlers.onEnd();
  try {
    rec.start();
  } catch {
    handlers.onError("Couldn’t start listening. Type what you said.");
    return null;
  }
  return { stop: () => rec.stop() };
}

type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};