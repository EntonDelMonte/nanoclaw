---
name: web-self-testing
description: End-to-end self-testing of web applications with Playwright (headless Chromium) — page load, navigation, form submission, visual regression snapshots, and CI integration. Container-safe with --no-sandbox --disable-gpu flags.
allowed-tools: Bash(web-self-testing:*), Read, Write
---

# Web App Self-Testing — Playwright (Headless)

## Overview

End-to-end testing of web applications using Playwright with headless Chromium. This skill covers the full lifecycle: installing Playwright in a project, structuring tests with the Page Object pattern, writing assertions for navigation and form flows, capturing visual regression snapshots, and running tests in CI. All browser launches use `--no-sandbox --disable-gpu` to work correctly inside containers and Linux VMs without a display server.

## Prerequisites

Node.js project. Install Playwright with Chromium only (smaller footprint):

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

For container environments where `npx playwright install` cannot download binaries, set the system Chromium path:

```bash
# Use system Chromium if available
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install-deps chromium
```

Create `playwright.config.ts` at project root:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Container-safe launch options — required for Linux/Docker/VM environments
    launchOptions: {
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Auto-start dev server when running locally
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 30000,
      },
});
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:debug": "playwright test --debug",
    "e2e:report": "playwright show-report"
  }
}
```

## Usage

### Run tests

```bash
# All tests (uses config baseURL)
npm run e2e

# Single file
npx playwright test e2e/login.spec.ts

# With visible browser (headed mode for debugging)
npx playwright test --headed

# Debug a failing test step-by-step
npx playwright test --debug e2e/login.spec.ts

# Open HTML report after a run
npm run e2e:report
```

### Directory structure

```
e2e/
  pages/             ← Page Object classes
    BasePage.ts
    HomePage.ts
    LoginPage.ts
  fixtures/          ← Shared test fixtures
    auth.ts
  specs/             ← Test files (or place .spec.ts at e2e/ root)
    home.spec.ts
    login.spec.ts
    visual.spec.ts
playwright.config.ts
```

## Page Object Pattern

Page Objects encapsulate selectors and actions for a single page or section. Tests stay readable and selectors are maintained in one place.

### BasePage

```ts
// e2e/pages/BasePage.ts
import { Page, Locator } from '@playwright/test';

export class BasePage {
  constructor(protected page: Page) {}

  async goto(path: string = '/') {
    await this.page.goto(path);
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async waitForNetworkIdle() {
    await this.page.waitForLoadState('networkidle');
  }
}
```

### Page Object example

```ts
// e2e/pages/LoginPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: /sign in/i });
    this.errorMessage = page.getByRole('alert');
  }

  async login(email: string, password: string) {
    await this.goto('/login');
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectRedirectedToDashboard() {
    await expect(this.page).toHaveURL(/\/dashboard/);
  }

  async expectErrorVisible() {
    await expect(this.errorMessage).toBeVisible();
  }
}
```

## Writing Tests

### Page load and navigation

```ts
// e2e/home.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage';

test.describe('Home page', () => {
  test('loads and shows hero heading', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await expect(page).toHaveTitle(/my app/i);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('navigates to about page via nav link', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL('/about');
    await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  });

  test('page has no accessibility violations on load', async ({ page }) => {
    await page.goto('/');
    // Basic a11y: all images have alt text
    const images = page.getByRole('img');
    for (const img of await images.all()) {
      await expect(img).toHaveAttribute('alt');
    }
  });
});
```

### Form submission

```ts
// e2e/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Login flow', () => {
  test('successful login redirects to dashboard', async ({ page }) => {
    const login = new LoginPage(page);
    await login.login('user@example.com', 'correct-password');
    await login.expectRedirectedToDashboard();
  });

  test('wrong credentials shows error message', async ({ page }) => {
    const login = new LoginPage(page);
    await login.login('user@example.com', 'wrong-password');
    await login.expectErrorVisible();
    await expect(page).toHaveURL('/login'); // stays on login page
  });

  test('empty form shows validation errors', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto('/login');
    await login.submitButton.click();
    await expect(page.getByText(/email is required/i)).toBeVisible();
  });
});
```

### API mocking (intercept network requests)

```ts
test('shows products from mocked API', async ({ page }) => {
  await page.route('**/api/products', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, name: 'Widget A', price: 9.99 },
        { id: 2, name: 'Widget B', price: 19.99 },
      ]),
    });
  });

  await page.goto('/products');
  await expect(page.getByText('Widget A')).toBeVisible();
  await expect(page.getByText('Widget B')).toBeVisible();
});
```

### Visual regression snapshots

```ts
// e2e/visual.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual regression', () => {
  test('home page matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // First run creates the baseline; subsequent runs compare against it
    await expect(page).toHaveScreenshot('home.png', {
      maxDiffPixelRatio: 0.02, // allow 2% pixel variance
    });
  });

  test('button component matches snapshot', async ({ page }) => {
    await page.goto('/storybook/button');
    await expect(page.getByRole('button', { name: 'Primary' })).toHaveScreenshot(
      'button-primary.png',
    );
  });
});
```

Update snapshots when the UI intentionally changes:

```bash
npx playwright test --update-snapshots
```

### Authenticated sessions with shared state

```ts
// e2e/fixtures/auth.ts
import { test as base, Page } from '@playwright/test';

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Log in once per test that needs auth
    await page.goto('/login');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/dashboard');
    await use(page);
  },
});

// Usage in tests:
// import { test } from './fixtures/auth';
// test('dashboard shows user name', async ({ authenticatedPage }) => { ... });
```

## CI Integration

### GitHub Actions example

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - name: Run Playwright tests
        env:
          BASE_URL: http://localhost:4173
          CI: true
        run: |
          npx serve -s dist -l 4173 &
          sleep 2
          npm run e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

### Container / Docker run

When running inside a Docker container or Linux VM with no display server, pass these flags explicitly. The `playwright.config.ts` above handles this automatically via `launchOptions`, but for ad-hoc scripts:

```ts
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
  ],
});
```

Or set via environment variable:

```bash
PLAYWRIGHT_LAUNCH_OPTIONS='{"args":["--no-sandbox","--disable-gpu"]}' npx playwright test
```

## Notes

- Always use `getByRole`, `getByLabel`, `getByText` over CSS selectors — they are more resilient to markup changes and test real accessibility.
- Visual snapshot baseline files (`*.png`) must be committed to the repository so CI has a reference to compare against.
- On first run, `toHaveScreenshot` always passes and writes the baseline; on subsequent runs it compares.
- Set `retries: 2` in CI to handle flaky network-dependent tests without masking real failures.
- Use `page.route` to mock external APIs rather than hitting live services in tests.
- For SPAs, wait for `networkidle` or a specific element before taking screenshots to avoid capturing loading states.
- The `webServer` config in `playwright.config.ts` auto-starts the dev server for local runs; in CI, start the server manually with a pre-built `dist` for deterministic results.
- Playwright traces (set `trace: 'on-first-retry'`) record a full timeline with screenshots, network, console, and DOM snapshots — open with `npx playwright show-trace trace.zip` to debug failures.
