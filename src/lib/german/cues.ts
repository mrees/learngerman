let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

function tone(
  ac: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  peak: number,
  type: OscillatorType = "sine",
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playAnswerCue(correct: boolean) {
  const ac = audioContext();
  if (!ac) return;
  void ac.resume();
  const t = ac.currentTime + 0.01;
  if (correct) {
    tone(ac, 523.25, t, 0.11, 0.07);
    tone(ac, 659.25, t + 0.08, 0.16, 0.055);
    return;
  }
  tone(ac, 311.13, t, 0.14, 0.045, "triangle");
  tone(ac, 233.08, t + 0.07, 0.18, 0.04, "triangle");
}
