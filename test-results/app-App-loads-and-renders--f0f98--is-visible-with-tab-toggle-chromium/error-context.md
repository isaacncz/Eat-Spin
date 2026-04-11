# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> App loads and renders core UI >> AppNavbar is visible with tab toggle
- Location: e2e\app.spec.ts:16:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /spin for me/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: /spin for me/i })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation [ref=e4]:
    - generic [ref=e6]:
      - link "ES EatSpin" [ref=e7] [cursor=pointer]:
        - /url: "#"
        - generic [ref=e9]: ES
        - generic [ref=e10]: EatSpin
      - tablist "Mode selector" [ref=e11]:
        - tab "Spin for me" [selected] [ref=e13] [cursor=pointer]:
          - img [ref=e14]
          - generic [ref=e17]: Spin for me
        - tab "I know where" [ref=e18] [cursor=pointer]:
          - img [ref=e19]
          - generic [ref=e22]: I know where
      - generic [ref=e23]:
        - button "Group" [ref=e24] [cursor=pointer]:
          - img [ref=e25]
          - generic [ref=e30]: Group
        - button "About" [ref=e31] [cursor=pointer]:
          - img [ref=e32]
  - generic [ref=e35]:
    - generic:
      - generic: 🍕
      - generic: 🍜
      - generic: 🍔
      - generic: 🌮
      - generic: 🍣
      - generic: 🧁
    - generic [ref=e36]:
      - button "Start group spin" [ref=e37] [cursor=pointer]:
        - img [ref=e38]
        - generic [ref=e43]: Group
      - generic [ref=e44]:
        - heading "What's for eating? 🍽️" [level=1] [ref=e45]
        - paragraph [ref=e46]: Pick your mood, then spin to decide
      - generic [ref=e47]:
        - button "🎯 Quick Bite" [ref=e48] [cursor=pointer]:
          - generic [ref=e49]: 🎯
          - generic [ref=e50]: Quick Bite
        - button "✨ Treat Myself" [ref=e51] [cursor=pointer]:
          - generic [ref=e52]: ✨
          - generic [ref=e53]: Treat Myself
        - button "🥗 Healthy" [ref=e54] [cursor=pointer]:
          - generic [ref=e55]: 🥗
          - generic [ref=e56]: Healthy
        - button "🎲 Surprise Me!" [ref=e57] [cursor=pointer]:
          - generic [ref=e58]: 🎲
          - generic [ref=e59]: Surprise Me!
      - generic [ref=e61]:
        - img [ref=e62]
        - paragraph [ref=e65]: Enable location to find restaurants around you
        - button "Share My Location" [ref=e66] [cursor=pointer]:
          - generic [ref=e67]:
            - img
            - text: Share My Location
  - generic [ref=e71]:
    - img [ref=e73]
    - generic [ref=e76]:
      - heading "Enable Location Access" [level=3] [ref=e77]
      - paragraph [ref=e78]: We need your location to find restaurants within 1-2km from you. This helps us recommend nearby places you can easily reach.
    - button "Allow Location Access" [ref=e79] [cursor=pointer]
    - paragraph [ref=e80]: Your location is only used to find nearby restaurants and is never stored.
  - generic [ref=e82]:
    - generic [ref=e83]:
      - generic [ref=e84]: Flagship Feature
      - heading "Group Spin makes deciding effortless" [level=2] [ref=e85]
      - paragraph [ref=e86]: Firebase-powered rooms keep participants, shared lists, and spin outcomes synced across browsers and devices.
    - generic [ref=e87]:
      - generic [ref=e88]:
        - generic [ref=e89]:
          - generic [ref=e90]:
            - img [ref=e92]
            - text: Create a room
          - generic [ref=e97]: Create one room code and invite everyone with the same link.
        - generic [ref=e98]:
          - button "Create room link" [ref=e99] [cursor=pointer]
          - generic [ref=e100]: Room code will appear here once created.
      - generic [ref=e101]:
        - generic [ref=e102]:
          - generic [ref=e103]:
            - img [ref=e105]
            - text: Join the room
          - generic [ref=e108]: Set your display name, then join by code or room link.
        - generic [ref=e109]:
          - textbox "Your name" [ref=e110]
          - textbox "Paste room link or enter code" [ref=e111]
          - button "Join room" [ref=e112] [cursor=pointer]
    - generic [ref=e113]:
      - generic [ref=e114]:
        - generic [ref=e115]:
          - img [ref=e117]
          - paragraph [ref=e120]: Host spins once
        - paragraph [ref=e121]: Host writes one winner index, then every joined client animates to that result.
      - generic [ref=e122]:
        - generic [ref=e123]:
          - img [ref=e125]
          - paragraph [ref=e131]: Shared final result
        - paragraph [ref=e132]: No local-only randomness in room mode, so everyone sees the same winner.
      - generic [ref=e133]:
        - generic [ref=e134]:
          - img [ref=e136]
          - paragraph [ref=e139]: Fair for everyone
        - paragraph [ref=e140]: One committed result drives every client, so no one gets a different outcome.
  - button "Learn more about EatSpin" [ref=e143] [cursor=pointer]:
    - img [ref=e144]
    - text: Learn more about EatSpin
  - contentinfo [ref=e146]:
    - generic [ref=e147]:
      - generic [ref=e148]:
        - generic [ref=e149]:
          - generic [ref=e150]:
            - generic [ref=e152]: ES
            - generic [ref=e153]: EatSpin
          - paragraph [ref=e154]: The fun way to decide what to eat! Discover amazing restaurants with our roulette wheel and skip the "where to eat" debate.
        - generic [ref=e155]:
          - heading "Product" [level=4] [ref=e156]
          - list [ref=e157]:
            - listitem [ref=e158]:
              - button "How It Works" [ref=e159] [cursor=pointer]
            - listitem [ref=e160]:
              - button "Features" [ref=e161] [cursor=pointer]
            - listitem [ref=e162]:
              - button "Pricing" [ref=e163] [cursor=pointer]
            - listitem [ref=e164]:
              - button "Download App" [ref=e165] [cursor=pointer]
      - generic [ref=e167]:
        - paragraph [ref=e168]: © 2026 EatSpin. All rights reserved.
        - generic [ref=e169]:
          - link "Facebook" [ref=e170] [cursor=pointer]:
            - /url: "#"
            - img [ref=e171]
          - link "Instagram" [ref=e173] [cursor=pointer]:
            - /url: "#"
            - img [ref=e174]
          - link "Twitter" [ref=e177] [cursor=pointer]:
            - /url: "#"
            - img [ref=e178]
  - generic [ref=e181]:
    - paragraph [ref=e182]: First run guide
    - 'heading "Step 1: Allow location" [level=3] [ref=e183]'
    - paragraph [ref=e184]: Enable location so EatSpin can preload nearby restaurants immediately.
    - generic [ref=e185]:
      - generic [ref=e186]: Step 1 of 3
      - button "Skip" [ref=e187] [cursor=pointer]
    - button "Enable Location" [ref=e189] [cursor=pointer]
  - region "Notifications alt+T"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('App loads and renders core UI', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto('/');
  6   |   });
  7   | 
  8   |   test('page loads without console errors', async ({ page }) => {
  9   |     const errors: string[] = [];
  10  |     page.on('pageerror', (err) => errors.push(err.message));
  11  | 
  12  |     await page.waitForLoadState('networkidle');
  13  |     expect(errors).toEqual([]);
  14  |   });
  15  | 
  16  |   test('AppNavbar is visible with tab toggle', async ({ page }) => {
  17  |     const navbar = page.locator('nav');
  18  |     await expect(navbar).toBeVisible();
  19  | 
  20  |     // Tab toggle buttons should exist
  21  |     const spinTab = page.getByRole('button', { name: /spin for me/i });
  22  |     const manualTab = page.getByRole('button', { name: /i know where/i });
> 23  |     await expect(spinTab).toBeVisible();
      |                           ^ Error: expect(locator).toBeVisible() failed
  24  |     await expect(manualTab).toBeVisible();
  25  |   });
  26  | 
  27  |   test('QuickSpinHero displays meal-time heading', async ({ page }) => {
  28  |     // Should show a dynamic heading like "What's for lunch?"
  29  |     const heading = page.locator('h1');
  30  |     await expect(heading).toBeVisible();
  31  |     await expect(heading).toContainText(/what.s for/i);
  32  |   });
  33  | 
  34  |   test('SPIN NOW button is visible and clickable', async ({ page }) => {
  35  |     const spinButton = page.getByRole('button', { name: /spin now/i });
  36  |     // Might not be visible if location not granted — check for either spin or location button
  37  |     const locationButton = page.getByRole('button', { name: /share my location/i });
  38  | 
  39  |     const spinVisible = await spinButton.isVisible().catch(() => false);
  40  |     const locationVisible = await locationButton.isVisible().catch(() => false);
  41  | 
  42  |     expect(spinVisible || locationVisible).toBe(true);
  43  |   });
  44  | 
  45  |   test('food mood buttons are rendered', async ({ page }) => {
  46  |     // Check for mood selector buttons
  47  |     const moods = ['Quick Bite', 'Treat Myself', 'Healthy', 'Surprise Me'];
  48  |     for (const mood of moods) {
  49  |       const btn = page.getByRole('button', { name: new RegExp(mood, 'i') });
  50  |       // Mood buttons may be hidden if location not granted
  51  |       const exists = await btn.count();
  52  |       // Just verify they exist in DOM (may be behind location gate)
  53  |       expect(exists).toBeGreaterThanOrEqual(0);
  54  |     }
  55  |   });
  56  | 
  57  |   test('Learn more toggle works', async ({ page }) => {
  58  |     const toggle = page.getByRole('button', { name: /learn more about eatspin/i });
  59  |     await expect(toggle).toBeVisible();
  60  | 
  61  |     await toggle.click();
  62  |     // After clicking, marketing sections should appear
  63  |     const hideButton = page.getByRole('button', { name: /hide/i });
  64  |     await expect(hideButton).toBeVisible();
  65  |   });
  66  | 
  67  |   test('footer is visible', async ({ page }) => {
  68  |     const footer = page.locator('footer');
  69  |     await expect(footer).toBeVisible();
  70  |   });
  71  | });
  72  | 
  73  | test.describe('Tab switching', () => {
  74  |   test('switching to manual tab shows restaurant input', async ({ page }) => {
  75  |     await page.goto('/');
  76  |     const manualTab = page.getByRole('button', { name: /i know where/i });
  77  |     await manualTab.click();
  78  | 
  79  |     const input = page.getByPlaceholder(/type any restaurant/i);
  80  |     await expect(input).toBeVisible();
  81  |   });
  82  | 
  83  |   test('switching back to auto tab works', async ({ page }) => {
  84  |     await page.goto('/');
  85  |     const manualTab = page.getByRole('button', { name: /i know where/i });
  86  |     await manualTab.click();
  87  | 
  88  |     const autoTab = page.getByRole('button', { name: /spin for me/i });
  89  |     await autoTab.click();
  90  | 
  91  |     // QuickSpinHero heading should still be visible
  92  |     const heading = page.locator('h1');
  93  |     await expect(heading).toContainText(/what.s for/i);
  94  |   });
  95  | });
  96  | 
  97  | test.describe('Manual mode spin flow', () => {
  98  |   test('can add restaurants and see them in the list', async ({ page }) => {
  99  |     await page.goto('/');
  100 | 
  101 |     // Switch to manual tab
  102 |     const manualTab = page.getByRole('button', { name: /i know where/i });
  103 |     await manualTab.click();
  104 | 
  105 |     const input = page.getByPlaceholder(/type any restaurant/i);
  106 |     const addButton = page.getByRole('button', { name: /add/i }).last();
  107 | 
  108 |     // Add two restaurants
  109 |     await input.fill('Test Restaurant A');
  110 |     await addButton.click();
  111 |     await input.fill('Test Restaurant B');
  112 |     await addButton.click();
  113 | 
  114 |     // Both should appear in the list
  115 |     await expect(page.getByText('Test Restaurant A')).toBeVisible();
  116 |     await expect(page.getByText('Test Restaurant B')).toBeVisible();
  117 |   });
  118 | 
  119 |   test('spin button appears with enough restaurants', async ({ page }) => {
  120 |     await page.goto('/');
  121 | 
  122 |     const manualTab = page.getByRole('button', { name: /i know where/i });
  123 |     await manualTab.click();
```