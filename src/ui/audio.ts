// All audio is synthesized with WebAudio — no asset files.
import { save } from './save';

let AC: AudioContext | null = null;

function ac(): AudioContext {
  if (!AC) AC = new AudioContext();
  if (AC.state === 'suspended') void AC.resume();
  return AC;
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, gain = 0.15): void {
  if (!save.settings.sound) return;
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, c.currentTime);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), c.currentTime + dur);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  } catch {
    // audio unavailable
  }
}

function noiseBoom(): void {
  if (!save.settings.sound) return;
  try {
    const c = ac();
    const n = c.createBufferSource();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    const buf = c.createBuffer(1, c.sampleRate * 0.35, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = buf;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1000, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.3);
    g.gain.setValueAtTime(0.5, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.32);
    n.connect(f).connect(g).connect(c.destination);
    n.start();
    tone('sine', 55, 40, 0.15, 0.5);
  } catch {
    // audio unavailable
  }
}

export const snd = {
  move: () => tone('square', 440, 465, 0.04, 0.05),
  slide: () => tone('triangle', 330, 660, 0.09, 0.12),
  bomb: () => tone('sine', 220, 180, 0.07, 0.2),
  boom: noiseBoom,
  error: () => tone('square', 110, 100, 0.11, 0.16),
  item: () => tone('sine', 660, 990, 0.12, 0.15),
  solved: () => {
    tone('triangle', 523, 523, 0.08, 0.2);
    setTimeout(() => tone('triangle', 784, 784, 0.1, 0.2), 90);
  },
  clear: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone('triangle', f, f, 0.1, 0.2), i * 95)),
  star: () => tone('sine', 1319, 1319, 0.22, 0.18),
  death: () => tone('sawtooth', 220, 55, 0.4, 0.22),
  rescue: () => tone('triangle', 200, 800, 0.18, 0.18),
  port: () => tone('sine', 900, 300, 0.12, 0.1),
};
