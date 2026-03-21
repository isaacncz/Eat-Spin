let audioContext: AudioContext | null = null;
let drumrollTimeoutId: number | null = null;
let drumrollActive = false;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (audioContext) return audioContext;
  const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  audioContext = new Context();
  return audioContext;
};

const playTone = (
  frequency: number,
  durationMs: number,
  volume = 0.05,
  type: OscillatorType = 'sine',
  glideToFrequency?: number,
) => {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === 'suspended') {
    void context.resume();
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const now = context.currentTime;
  const endTime = now + durationMs / 1000;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (glideToFrequency) {
    oscillator.frequency.linearRampToValueAtTime(glideToFrequency, endTime);
  }

  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(now);
  oscillator.stop(endTime);
};

const scheduleDrumrollPulse = (startedAtMs: number, durationMs: number) => {
  if (!drumrollActive) return;
  const elapsedMs = Date.now() - startedAtMs;

  if (elapsedMs >= durationMs) {
    drumrollActive = false;
    drumrollTimeoutId = null;
    return;
  }

  const progress = Math.min(1, elapsedMs / durationMs);
  const intervalMs = Math.max(40, 170 - Math.floor(progress * 125));
  const frequency = 130 + Math.floor(progress * 70);
  playTone(frequency, 50, 0.04, 'triangle');

  drumrollTimeoutId = window.setTimeout(() => {
    scheduleDrumrollPulse(startedAtMs, durationMs);
  }, intervalMs);
};

export const playSpinTick = () => {
  playTone(980, 18, 0.03, 'square');
};

export const startSpinDrumroll = (durationMs: number) => {
  if (typeof window === 'undefined') return;
  drumrollActive = true;
  if (drumrollTimeoutId !== null) {
    window.clearTimeout(drumrollTimeoutId);
  }
  scheduleDrumrollPulse(Date.now(), Math.max(200, durationMs));
};

export const stopSpinDrumroll = () => {
  if (typeof window === 'undefined') return;
  drumrollActive = false;
  if (drumrollTimeoutId !== null) {
    window.clearTimeout(drumrollTimeoutId);
    drumrollTimeoutId = null;
  }
};

export const playSpinWin = () => {
  playTone(780, 130, 0.05, 'sine', 980);
  window.setTimeout(() => {
    playTone(980, 150, 0.055, 'sine', 1240);
  }, 90);
};

export const triggerSpinHaptic = () => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate([40, 30, 55]);
};
