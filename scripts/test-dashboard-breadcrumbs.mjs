// Browser fixtures only; every API request is intercepted and no database is changed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { SignJWT } from 'jose';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3101';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const context = await browser.newContext();
  const token = await new SignJWT({ profId: 'prof' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode('phase14-16-local-test-only'));
  await context.addCookies([{ name: 'prof_token', value: token, url: base }]);
  const classes = { one: { name: 'Software Engineering Class A', term: '2026' }, two: { name: 'Database Systems Class B', term: '2026' } };
  const slot = { id: 'slot', label: 'Capstone Project', groupSize: 2, titlesRequiredMin: 1, titlesAllowedMax: 3, duplicateCheck: 'warn', locked: false };
  const errors = [];
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data;
    if (path === '/api/classes') data = { classes: Object.entries(classes).map(([id, cls]) => ({ id, ...cls, archivedAt: null })) };
    else if (/^\/api\/classes\/(one|two)$/.test(path)) data = { class: classes[path.split('/').at(-1)] };
    else if (/^\/api\/classes\/(one|two)\/students\/student$/.test(path)) data = { class: classes[path.split('/')[3]], student: { id: 'student', name: 'Alice Example', idNumber: '001', password: 'test' }, memberships: [], titles: [], leaveRequests: [] };
    else if (path.endsWith('/slots')) data = { slots: [slot] };
    else if (path.endsWith('/students')) data = { students: [] };
    else if (path.endsWith('/leave-requests')) data = { requests: [] };
    else if (path.endsWith('/titles')) data = { titles: [] };
    else if (path.endsWith('/tasks/stalled')) data = { stalledTasks: [] };
    else { errors.push(path); data = {}; }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/dashboard/one`);
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
  await crumbs.getByRole('link', { name: classes.one.name, exact: true }).waitFor();
  await crumbs.locator('[aria-current="page"]').filter({ hasText: slot.label }).waitFor();
  for (const [button, label] of [['Roster / Students (0)', 'Roster / Students'], ['Settings / Rules', 'Settings / Rules'], ['Leave Requests', 'Leave Requests'], ['Verified Titles', slot.label]]) {
    await page.getByRole('button', { name: button, exact: true }).click();
    await crumbs.locator('[aria-current="page"]').filter({ hasText: label }).waitFor();
    assert.equal(await crumbs.getByRole('link', { name: classes.one.name, exact: true }).count(), 1);
  }
  await crumbs.getByRole('link', { name: classes.one.name, exact: true }).click();
  await crumbs.getByRole('link', { name: 'Board', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Settings / Rules', exact: true }).click();
  await crumbs.locator('[aria-current="page"]').filter({ hasText: 'Settings / Rules' }).waitFor();
  await crumbs.getByRole('link', { name: classes.one.name, exact: true }).click();
  await crumbs.getByRole('link', { name: 'Board', exact: true }).waitFor();
  await page.goto(`${base}/dashboard/one/students/student`);
  await crumbs.getByRole('link', { name: classes.one.name, exact: true }).waitFor();
  assert.equal(await crumbs.locator('[aria-current="page"]').textContent(), 'Alice Example');
  await page.reload();
  await crumbs.getByRole('link', { name: classes.one.name, exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await crumbs.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Breadcrumbs fit a phone viewport');
  await crumbs.getByRole('link', { name: 'Roster / Students', exact: true }).click();
  await crumbs.locator('[aria-current="page"]').filter({ hasText: 'Roster / Students' }).waitFor();
  await page.goto(`${base}/dashboard/two/students/student`);
  await crumbs.getByRole('link', { name: classes.two.name, exact: true }).waitFor();
  assert.equal(await crumbs.getByText(classes.one.name, { exact: true }).count(), 0);
  await crumbs.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.waitForURL(`${base}/dashboard`);
  assert.deepEqual(errors, []);
  console.log('PASS breadcrumbs: class name across all management tabs, slot context, class/roster/dashboard links, direct profile entry/reload, switching classes, phone wrapping; zero database writes');
} finally { await browser.close(); }
