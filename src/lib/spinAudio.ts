type Sound = 'start' | 'tick' | 'win';

const SOUNDS: Sound[] = ['start', 'tick', 'win'];
let context: AudioContext | null = null;
let output: GainNode | null = null;
let buffers: Partial<Record<Sound, AudioBuffer>> = {};
let loading: Promise<void> | null = null;
let enabled = false;
let lastTickAt = -Infinity;
const activeSources = new Set<AudioBufferSourceNode>();

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (context && context.state !== 'closed') return context;
  const Constructor = window.AudioContext
    || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) return null;
  try {
    context = new Constructor();
    output = context.createGain();
    output.gain.value = 0.85;
    output.connect(context.destination);
    return context;
  } catch {
    context = null;
    output = null;
    return null;
  }
};

/** Call from a real pointer/key gesture, including guests watching a host's spin. */
export const unlockSpinAudio = async (): Promise<boolean> => {
  const audio = getAudioContext();
  if (!audio) return false;
  try {
    if (audio.state === 'suspended') await audio.resume();
    if (audio.state !== 'running') return false;
    if (!SOUNDS.every(sound => buffers[sound])) {
      if (!loading) {
        loading = (async () => {
          const decoded = await Promise.all(SOUNDS.map(async sound => {
            const response = await fetch(`${import.meta.env.BASE_URL}audio/arcade-click-${sound}.wav`);
            if (!response.ok) throw new Error('Spin sound unavailable');
            return await audio.decodeAudioData(await response.arrayBuffer());
          }));
          buffers = Object.fromEntries(SOUNDS.map((sound, index) => [sound, decoded[index]]));
        })();
      }
      await loading;
    }
    // Loading never queues a late sound: the next actual wheel event decides playback.
    return true;
  } catch {
    return false;
  } finally {
    loading = null;
  }
};

/** Stops both currently playing samples and the complete scheduled win chime. */
export const stopSpinAudio = () => {
  for (const source of activeSources) {
    try { source.stop(); } catch { /* A sample can have ended between frames. */ }
    source.disconnect();
  }
  activeSources.clear();
  lastTickAt = -Infinity;
};

export const setSpinSoundEnabled = (value: boolean) => {
  enabled = value;
  if (!enabled) stopSpinAudio();
};

const play = (sound: Sound): boolean => {
  const audio = context;
  if (!enabled || !audio || audio.state !== 'running' || !output || !buffers[sound]) return false;
  if (typeof document !== 'undefined' && document.hidden) return false;
  // Dense wheels should sound like individual clicks rather than a harsh buzz.
  if (sound === 'tick' && audio.currentTime - lastTickAt < 0.025) return false;
  let source: AudioBufferSourceNode | null = null;
  try {
    source = audio.createBufferSource();
    source.buffer = buffers[sound] ?? null;
    source.connect(output);
    const sample = source;
    source.onended = () => { activeSources.delete(sample); sample.disconnect(); };
    activeSources.add(source);
    source.start();
    if (sound === 'tick') lastTickAt = audio.currentTime;
    return true;
  } catch {
    if (source) { activeSources.delete(source); source.disconnect(); }
    // Audio support/network failures must never prevent a spin or result reveal.
    return false;
  }
};

export const playSpinStart = () => play('start');
/** Called by segment crossings, so the sound slows with the actual wheel. */
export const playSpinTick = () => play('tick');
/** One sample contains all three notes, with no uncancellable delayed timers. */
export const playSpinWin = () => play('win');

export const triggerSpinHaptic = () => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate([40, 30, 55]);
};
