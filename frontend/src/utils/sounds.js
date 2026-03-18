const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', volume = 0.3) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio not supported
  }
}

export function playCorrect() {
  playTone(523.25, 0.15, 'sine', 0.25);
  setTimeout(() => playTone(659.25, 0.15, 'sine', 0.25), 100);
  setTimeout(() => playTone(783.99, 0.25, 'sine', 0.25), 200);
}

export function playWrong() {
  playTone(200, 0.3, 'sawtooth', 0.15);
  setTimeout(() => playTone(150, 0.4, 'sawtooth', 0.15), 150);
}

export function playWinner() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((note, i) => {
    setTimeout(() => playTone(note, 0.3, 'sine', 0.25), i * 150);
  });
  setTimeout(() => {
    playTone(1046.5, 0.6, 'triangle', 0.2);
  }, notes.length * 150);
}

export function playTick() {
  playTone(800, 0.05, 'square', 0.1);
}

export function playJoin() {
  playTone(440, 0.1, 'sine', 0.15);
  setTimeout(() => playTone(554.37, 0.15, 'sine', 0.15), 80);
}

export function playCountdown() {
  playTone(600, 0.12, 'triangle', 0.2);
}
