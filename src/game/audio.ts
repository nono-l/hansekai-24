let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  return ctx;
}

export function unlockAudio() {
  const c = ac();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
}

function beep(freq: number, t: number, dur: number, vol: number, type: OscillatorType = "sine") {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur);
}

export function playChime() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  beep(880, t, 0.07, 0.045);
  beep(1320, t + 0.08, 0.1, 0.04);
}

export function playCoin() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  beep(1240, t, 0.05, 0.03, "triangle");
  beep(1640, t + 0.05, 0.07, 0.025, "triangle");
}

export function playWarn() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  beep(180, t, 0.18, 0.05, "square");
  beep(140, t + 0.12, 0.22, 0.04, "square");
}
