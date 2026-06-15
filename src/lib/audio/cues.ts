// Tiny WebAudio helper for recording UX cues (countdown ticks, start/end beeps).
// No assets, no deps — synthesized oscillator beeps with a short envelope so
// they sound clean instead of clicky. Safe no-op on SSR / when WebAudio is
// unavailable. Always call `resumeAudio()` inside a user gesture handler the
// first time, so browsers will allow playback.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function resumeAudio(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") {
    void c.resume().catch(() => {});
  }
}

interface BeepOpts {
  freq: number;
  duration: number; // seconds
  type?: OscillatorType;
  gain?: number;
}

function beep({ freq, duration, type = "sine", gain = 0.18 }: BeepOpts): void {
  const c = getCtx();
  if (!c) return;
  try {
    const now = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    // Short attack/decay envelope to avoid clicks.
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.01);
    g.gain.linearRampToValueAtTime(gain, now + duration - 0.04);
    g.gain.linearRampToValueAtTime(0, now + duration);
    osc.connect(g).connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    /* noop */
  }
}

/** Short high "tick" used for 3-2-1 countdown beats. */
export function playTick(): void {
  beep({ freq: 880, duration: 0.12, type: "sine", gain: 0.2 });
}

/** Confirm beep when recording actually starts. */
export function playStart(): void {
  beep({ freq: 1200, duration: 0.25, type: "sine", gain: 0.22 });
}

/** Lower beep when recording stops. */
export function playEnd(): void {
  beep({ freq: 500, duration: 0.35, type: "sine", gain: 0.22 });
}
