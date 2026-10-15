let audio: AudioContext | null = null;

function context(): AudioContext | null {
  const Context = window.AudioContext;
  if (!Context) return null;
  audio ??= new Context();
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

function tone(frequency: number, seconds: number, type: OscillatorType, volume: number, delay = 0): void {
  const ctx = context();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + seconds);
}

export function playBump(): void {
  tone(110, 0.09, "triangle", 0.05);
}

export function playLeave(): void {
  tone(520, 0.12, "sine", 0.04);
}

export function playClear(): void {
  tone(520, 0.12, "sine", 0.05);
  tone(780, 0.16, "sine", 0.04, 0.08);
}
