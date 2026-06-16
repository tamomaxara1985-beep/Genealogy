import { chromium } from 'playwright';

const EMAIL = `playwrighttest_${Date.now()}@example.com`;
const PASS = 'TestPass123!';

const waitForDashboard = (page, timeout = 30000) =>
  page.waitForFunction(
    () => window.location.pathname.startsWith('/dashboard'),
    { timeout }
  );

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const page = await browser.newPage();

page.on('response', res => {
  if (res.url().includes('/api/')) {
    console.log(`  [api] ${res.status()} ${res.url().replace('http://localhost:3000', '')}`);
  }
});

// ── REGISTER ────────────────────────────────────────────
console.log('\n=== REGISTER ===');
await page.goto('http://localhost:3000/register');
await page.screenshot({ path: 'test-01-register-page.png' });

await page.fill('#name', 'Playwright User');
await page.fill('#email', EMAIL);
await page.fill('#password', PASS);
await page.click('button[type=submit]');

try {
  await waitForDashboard(page, 35000);
  await page.screenshot({ path: 'test-02-dashboard.png' });
  console.log('REGISTER: PASS — URL:', page.url());
} catch {
  const err = await page.locator('p.text-red-600').textContent().catch(() => null);
  await page.screenshot({ path: 'test-02-fail.png' });
  console.log('REGISTER: FAIL — URL:', page.url(), '| error:', err);
  await browser.close();
  process.exit(1);
}

// ── SIGNOUT ─────────────────────────────────────────────
console.log('\n=== SIGNOUT ===');
await page.goto('http://localhost:3000/api/auth/signout');
const signoutBtn = page.locator('button[type=submit]');
if (await signoutBtn.count() > 0) await signoutBtn.click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'test-03-signout.png' });
console.log('After signout URL:', page.url());

// ── LOGIN ────────────────────────────────────────────────
console.log('\n=== LOGIN ===');
await page.goto('http://localhost:3000/login');
await page.screenshot({ path: 'test-04-login-page.png' });

await page.fill('#email', EMAIL);
await page.fill('#password', PASS);
await page.click('button[type=submit]');

try {
  await waitForDashboard(page, 35000);
  await page.screenshot({ path: 'test-05-dashboard-after-login.png' });
  console.log('LOGIN: PASS — URL:', page.url());
} catch {
  const err = await page.locator('p.text-red-600, [role=alert]').textContent().catch(() => null);
  await page.screenshot({ path: 'test-05-fail.png' });
  console.log('LOGIN: FAIL — URL:', page.url(), '| error:', err);
  await browser.close();
  process.exit(1);
}

await browser.close();
console.log('\nAll tests PASS');
