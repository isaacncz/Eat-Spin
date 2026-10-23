import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AudioModule = typeof import('./spinAudio');
let audio: AudioModule;
let visibility: { hidden: boolean };
const decoded = [{ duration: 0.35 }, { duration: 0.04 }, { duration: 1.1 }];
const sources: Array<{ buffer: unknown; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; onended: (() => void) | null }> = [];
let clock: { state: string; currentTime: number; resume: ReturnType<typeof vi.fn>; decodeAudioData: ReturnType<typeof vi.fn> };

beforeEach(async () => {
  vi.resetModules();
  sources.length = 0;
  let decodeIndex = 0;
  clock = { state: 'suspended', currentTime: 0, resume: vi.fn(async () => { clock.state = 'running'; }),
    decodeAudioData: vi.fn(async () => decoded[decodeIndex++ % decoded.length]) };
  const instance = { ...clock, destination: {}, createGain: () => ({ gain: { value: 1 }, connect: vi.fn() }),
    createBufferSource: () => {
      const source = { buffer: null, start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), onended: null };
      sources.push(source); return source;
    } };
  // Accessors let tests model context suspend/resume and the Web Audio clock.
  Object.defineProperties(instance, { state: { get: () => clock.state }, currentTime: { get: () => clock.currentTime } });
  vi.stubGlobal('window', { AudioContext: class { constructor() { return instance; } } });
  visibility = { hidden: false };
  vi.stubGlobal('document', visibility);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
  audio = await import('./spinAudio');
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Arcade click playback lifecycle', () => {
  it('does not construct/play audio or fetch assets before a user unlock', () => {
    audio.setSpinSoundEnabled(true);
    expect(audio.playSpinTick()).toBe(false);
    expect(audio.playSpinWin()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(sources).toHaveLength(0);
  });

  it('resumes from a gesture and shares one load for all approved samples', async () => {
    audio.setSpinSoundEnabled(true);
    expect(await Promise.all([audio.unlockSpinAudio(), audio.unlockSpinAudio()])).toEqual([true, true]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(audio.playSpinStart()).toBe(true);
    expect(sources[0].buffer).toBe(decoded[0]);
    expect(await audio.unlockSpinAudio()).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('limits dense crossings while allowing later individual ticks', async () => {
    audio.setSpinSoundEnabled(true); await audio.unlockSpinAudio();
    expect(audio.playSpinTick()).toBe(true);
    clock.currentTime = 0.01;
    expect(audio.playSpinTick()).toBe(false);
    clock.currentTime = 0.03;
    expect(audio.playSpinTick()).toBe(true);
    expect(sources).toHaveLength(2);
    expect(sources[0].buffer).toBe(decoded[1]);
  });

  it('mute cancels the complete chime and prevents further sounds until enabled', async () => {
    audio.setSpinSoundEnabled(true); await audio.unlockSpinAudio();
    expect(audio.playSpinWin()).toBe(true);
    expect(sources[0].buffer).toBe(decoded[2]);
    audio.setSpinSoundEnabled(false);
    expect(sources[0].stop).toHaveBeenCalledOnce();
    expect(sources[0].disconnect).toHaveBeenCalledOnce();
    expect(audio.playSpinTick()).toBe(false);
    expect(audio.playSpinWin()).toBe(false);
    audio.setSpinSoundEnabled(true);
    expect(sources).toHaveLength(1); // Re-enabling does not replay a pending sound.
    expect(audio.playSpinStart()).toBe(true);
  });

  it('finishing an asset load after mute never queues a delayed sound', async () => {
    let finish: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    vi.mocked(fetch).mockImplementation(async () => { await gate; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response; });
    audio.setSpinSoundEnabled(true);
    const pending = audio.unlockSpinAudio();
    audio.setSpinSoundEnabled(false);
    finish?.();
    expect(await pending).toBe(true);
    expect(sources).toHaveLength(0);
    expect(audio.playSpinWin()).toBe(false);
  });

  it('keeps failed or blocked audio nonfatal and retries a failed load on a later gesture', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    expect(await audio.unlockSpinAudio()).toBe(false);
    expect(await audio.unlockSpinAudio()).toBe(true);
    clock.state = 'suspended';
    clock.resume.mockRejectedValueOnce(new Error('gesture required'));
    expect(await audio.unlockSpinAudio()).toBe(false);
    expect(audio.playSpinStart()).toBe(false);
  });

  it('hidden pages stay silent and ended/stopped samples release their nodes', async () => {
    audio.setSpinSoundEnabled(true); await audio.unlockSpinAudio();
    visibility.hidden = true;
    expect(audio.playSpinWin()).toBe(false);
    visibility.hidden = false;
    expect(audio.playSpinTick()).toBe(true);
    sources[0].onended?.();
    audio.stopSpinAudio();
    expect(sources[0].disconnect).toHaveBeenCalledOnce();
    expect(sources[0].stop).not.toHaveBeenCalled();
  });
});
