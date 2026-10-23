import { test, expect } from '@playwright/test';

const shareId = 'b'.repeat(32);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    const place = { id: 'manual-private', name: 'Private cafe', category: ['street food'],
      address: 'Your custom pick', coordinates: { lat: 0, lng: 0 }, hours: {}, rating: 0,
      priceRange: '$$', description: 'Added by you.' };
    localStorage.setItem('eatspin:manual-base:v2', JSON.stringify([
      { id: 'personal', name: 'Personal lunch', mealTime: null, restaurants: [place], createdAt: 1, updatedAt: 1 },
    ]));
    localStorage.setItem('eatspin:selected-manual-list-id', 'personal');
  });
  await page.route('**/src/hooks/useFirebaseGroupRoom.ts*', route => route.fulfill({
    contentType: 'application/javascript', body: "export * from '/src/test/group-app-hook-fixture.ts';",
  }));
  await page.route('**/src/lib/firebase.ts*', route => route.fulfill({
    contentType: 'application/javascript', body: 'export const firebaseDb=null; export const firebaseAuth=null; export const isFirebaseConfigured=false; export const firebaseConfigError=null; export async function ensureAnonymousAuthUser(){ throw new Error("No live Firebase in UI fixture"); }',
  }));
  await page.route('**/src/lib/sharedListsApi.ts*', route => route.fulfill({
    contentType: 'application/javascript', body: `export async function fetchSharedList(){
      return {version:1,name:'Friend picks',mealTime:'lunch',places:['Friend noodles','Friend rice'],
      createdAt:Date.now(),expiresAt:Date.now()+86400000};}
      export async function publishSharedList(){throw new Error('Not used in receiver test');}
      export async function revokeSharedList(){throw new Error('Not used in receiver test');}`,
  }));
});

for (const openWheel of [false, true]) {
  test(`an active-room participant imports a private snapshot copy${openWheel ? ' and opens its personal wheel' : ''}`, async ({ page }) => {
    await page.goto('/?room=ROOM42&list=' + shareId);
    const preview = page.getByRole('dialog', { name: 'A list from your friend', exact: true });
    await expect(preview).toContainText('Friend noodles');
    await preview.getByRole('button', { name: openWheel ? 'Save copy & open wheel' : 'Save a personal copy', exact: true }).click();
    await expect(preview).toHaveCount(0);
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('button', { name: /^My list/ })).toHaveAttribute('aria-current', 'page');
    if (openWheel) {
      await expect(page.getByRole('heading', { name: 'Spin your list', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Back to list', exact: true }).click();
    }
    await expect(page.getByRole('button', { name: 'Remove Friend noodles', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Friend rice', exact: true })).toBeVisible();
    const lists = await page.evaluate(() => JSON.parse(localStorage.getItem('eatspin:manual-lists')!));
    expect(lists).toHaveLength(2);
    expect(lists.find((list: {id:string}) => list.id === 'personal').restaurants[0].name).toBe('Private cafe');
    expect(lists.find((list: {id:string}) => list.id !== 'personal').restaurants.map((place: {name:string}) => place.name)).toEqual(['Friend noodles', 'Friend rice']);
    const room = await page.evaluate(() => (window as unknown as { groupAppHarness: {
      state: { roomId: string; roomListNames: string[]; syncCalls: string[][] };
    } }).groupAppHarness.state);
    expect(room.roomId).toBe('ROOM42');
    expect(room.roomListNames).toEqual(['Room noodles', 'Room rice']);
    expect(room.syncCalls).toHaveLength(0);
    expect(new URL(page.url()).searchParams.get('room')).toBe('ROOM42');
    expect(new URL(page.url()).searchParams.has('list')).toBe(false);
    await nav.getByRole('button', { name: /^Group/ }).click();
    await expect(page.getByRole('list', { name: 'Places in this room', exact: true })).toContainText('Room noodles');
    await expect(page.getByRole('list', { name: 'Places in this room', exact: true })).not.toContainText('Friend noodles');
  });
}
