// UI fixtures only. No login emails are sent and no database records are changed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { SignJWT } from 'jose';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3101';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const context = await browser.newContext();
  const token = await new SignJWT({ credentialVersion: 'synthetic-browser-version',  profId: 'prof', email: 'prof@example.com' }).setAudience(['professor-session', 'student-session']).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode('phase14-16-local-test-only'));
  let remembered = null;
  let emailedCodes = 0;
  let verified = 0;
  const errors = [];
  await context.route('**/api/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    let data = { ok: true };
    const session = async () => context.addCookies([{ name: 'prof_token', value: token, url: base }]);
    if (path === '/api/auth/remember-device') {
      if (req.method() === 'DELETE') { remembered = null; await context.clearCookies({ name: 'prof_token' }); }
      else data = { email: remembered };
    } else if (path === '/api/auth/request-otp') {
      const email = req.postDataJSON().email.trim().toLowerCase();
      if (remembered === email) { await session(); data.authenticated = true; }
      else emailedCodes++;
    } else if (path === '/api/auth/verify-otp') {
      const body = req.postDataJSON();
      assert.equal(body.otp, '123456');
      assert.equal(body.rememberMe, true);
      remembered = body.email;
      verified++;
      await session();
    } else if (path === '/api/auth/logout') await context.clearCookies({ name: 'prof_token' });
    else if (path === '/api/classes') data = { classes: [] };
    else errors.push(path);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/login`);
  await page.getByLabel('Email', { exact: true }).fill('prof@example.com');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Enter your code' }).waitFor();
  assert.equal(emailedCodes, 1);
  await page.getByRole('checkbox', { name: 'Remember me for 7 days', exact: true }).check();
  await page.getByLabel('6-digit code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify & continue', exact: true }).click();
  await page.waitForURL(`${base}/dashboard`);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('button', { name: 'Forget this browser', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Email', { exact: true }).inputValue(), 'prof@example.com');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(`${base}/dashboard`);
  assert.equal(emailedCodes, 1, 'Returning browser must not send another OTP');
  assert.equal(verified, 1, 'Returning browser must not verify another OTP');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('button', { name: 'Forget this browser', exact: true }).waitFor();
  await page.getByLabel('Email', { exact: true }).fill('someone-else@example.com');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Enter your code' }).waitFor();
  assert.equal(emailedCodes, 2);
  await page.goto(`${base}/login`);
  await page.getByRole('button', { name: 'Forget this browser', exact: true }).click();
  await page.getByRole('button', { name: 'Forget this browser', exact: true }).waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Enter your code' }).waitFor();
  assert.equal(emailedCodes, 3, 'Forgetting the browser restores OTP');
  assert.deepEqual(errors, []);
  console.log('PASS first login with OTP/Remember me, logout, returning email-only login, other-email OTP, Forget this browser; no emails or database writes');
} finally { await browser.close(); }
