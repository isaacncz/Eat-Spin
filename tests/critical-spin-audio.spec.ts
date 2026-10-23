import { test, expect, type Page } from '@playwright/test';

type SoundEvent = { type: 'start' | 'stop'; duration: number; time: number };
const events = (page: Page): Promise<SoundEvent[]> => page.evaluate(() => (
  window as unknown as { audioEvents: SoundEvent[] }
).audioEvents);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const records: SoundEvent[] = [];
    Object.assign(window, { audioEvents: records });
    const start = AudioBufferSourceNode.prototype.start;
    const stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      records.push({ type: 'start', duration: this.buffer?.duration ?? 0, time: this.context.currentTime });
      return start.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (...args: Parameters<typeof stop>) {
      records.push({ type: 'stop', duration: this.buffer?.duration ?? 0, time: this.context.currentTime });
      return stop.apply(this, args);
    };
  });
  await page.route('http://localhost:5173/?audio-fixture=1', route => route.fulfill({
    contentType: 'text/html', body: '<div id="root"></div><script type="module">const {default:RefreshRuntime}=await import("/@react-refresh");RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;const {mountSpinAudioFixture}=await import("/src/test/spin-audio-mount.tsx");mountSpinAudioFixture();</script>',
  }));
  await page.goto('/?audio-fixture=1');
});

test('approved clicks follow a real spin and the complete chime plays once at reveal', async ({ page }) => {
  const fetched = new Set<string>();
  page.on('response', response => { if (response.url().includes('/audio/')) fetched.add(response.url()); });
  // A real gesture unlocks and decodes before starting the wheel.
  await page.getByRole('button', { name: 'Sound on', exact: true }).click();
  await page.getByRole('button', { name: 'Sound off', exact: true }).click();
  await expect.poll(() => fetched.size).toBe(3);
  await page.getByRole('button', { name: 'Spin the Wheel!', exact: false }).click();
  await expect(page.getByRole('dialog', { name: 'You got it!' })).toBeVisible({ timeout: 15_000 });
  const played = (await events(page)).filter(event => event.type === 'start');
  const ticks = played.filter(event => Math.abs(event.duration - 0.04) < 0.001);
  const wins = played.filter(event => Math.abs(event.duration - 1.1) < 0.001);
  expect(ticks.length).toBeGreaterThan(5);
  expect(wins).toHaveLength(1);
  expect(wins[0].time).toBeGreaterThan(ticks[ticks.length - 1].time);
  expect(ticks[ticks.length - 1].time - ticks[ticks.length - 2].time)
    .toBeGreaterThan(ticks[2].time - ticks[1].time);
});

test('muting during a spin cancels audio and suppresses its win chime', async ({ page }) => {
  await page.getByRole('button', { name: 'Spin the Wheel!', exact: false }).click();
  await expect.poll(async () => (await events(page)).filter(event => event.type === 'start').length).toBeGreaterThan(2);
  await page.getByRole('button', { name: 'Sound on', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sound off', exact: true })).toBeVisible();
  const atMute = (await events(page)).filter(event => event.type === 'start').length;
  await expect(page.getByRole('dialog', { name: 'You got it!' })).toBeVisible({ timeout: 15_000 });
  expect((await events(page)).filter(event => event.type === 'start')).toHaveLength(atMute);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sound off', exact: true })).toBeVisible();
});

test('leaving during a spin cancels playback and prevents a delayed win chime', async ({ page }) => {
  await page.getByRole('button', { name: 'Spin the Wheel!', exact: false }).click();
  await expect.poll(async () => (await events(page)).filter(event => event.type === 'start').length).toBeGreaterThan(2);
  await page.getByRole('button', { name: 'Leave wheel', exact: true }).click();
  await expect(page.getByText('Wheel closed', { exact: true })).toBeVisible();
  const startsAtExit = (await events(page)).filter(event => event.type === 'start').length;
  // Observe beyond the original reveal deadline to catch uncancelled callbacks.
  await page.waitForTimeout(7_000);
  const played = await events(page);
  expect(played.filter(event => event.type === 'start' && Math.abs(event.duration - 1.1) < 0.001)).toHaveLength(0);
  expect(played.filter(event => event.type === 'start')).toHaveLength(startsAtExit);
});
