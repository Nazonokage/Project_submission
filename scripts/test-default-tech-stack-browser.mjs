// Isolated browser fixtures; all API requests are mocked, with no database writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { SignJWT } from 'jose';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3101';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const context = await browser.newContext();
  const token = await new SignJWT({ profId: 'prof', studentId: 'student', classId: 'class' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode('phase14-16-local-test-only'));
  await context.addCookies(['prof_token', 'student_token'].map(name => ({ name, value: token, url: base })));
  const slot = { id: 'slot', label: 'Project One', groupSize: 2, titlesRequiredMin: 1, titlesAllowedMax: 5, duplicateCheck: 'warn', requireTechStack: false, defaultTechStack: [], locked: false };
  const titles = [];
  const errors = [];
  await context.route('**/api/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    let data;
    if (path === '/api/classes/class/slots/slot' && req.method() === 'PATCH') { Object.assign(slot, req.postDataJSON()); data = { slot }; }
    else if (path === '/api/classes/class' || path === '/api/student/class-info') data = { class: { name: 'Test Class', term: '2026' } };
    else if (path.endsWith('/slots')) data = { slots: [slot] };
    else if (path.endsWith('/students') || path.endsWith('/without-group')) data = { students: [] };
    else if (path.endsWith('/leave-requests')) data = { requests: [] };
    else if (path === '/api/student/groups') data = { group: { id: 'group', status: 'forming', maxSize: 2 }, members: [{ id: 'student', name: 'Student', idNumber: '001' }], studentId: 'student' };
    else if (path.endsWith('/invites')) data = { invites: [] };
    else if (path.endsWith('/notifications')) data = { notifications: [] };
    else if (path.endsWith('/doc-fields')) data = { fields: [] };
    else if (path.endsWith('/tech-tags')) data = { tags: [] };
    else if (path.endsWith('/check')) data = { matches: [] };
    else if (path.endsWith('/verified')) data = { titles: [] };
    else if (path === '/api/student/titles' && req.method() === 'POST') { titles.push({ id: 'title', slotId: 'slot', groupId: 'group', status: 'pending', progressStatus: 'planning', ...req.postDataJSON() }); data = { title: titles[0] }; }
    else if (path === '/api/student/titles/title' && req.method() === 'PATCH') { Object.assign(titles[0], req.postDataJSON()); data = { title: titles[0] }; }
    else if (path.endsWith('/titles')) data = { titles };
    else { errors.push(path); data = {}; }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/dashboard/class?tab=settings`);
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  const defaults = page.getByRole('region', { name: 'Default tech stack', exact: true });
  for (const tag of ['React', 'Node.js']) {
    await defaults.getByRole('combobox', { name: 'Search tech stack' }).fill(tag);
    await defaults.getByRole('combobox', { name: 'Search tech stack' }).press('Enter');
  }
  await page.getByRole('button', { name: 'Save rules', exact: true }).click();
  await page.getByText('Slot rules saved', { exact: true }).waitFor();
  assert.deepEqual(slot.defaultTechStack, ['React', 'Node.js']);
  await page.reload();
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await defaults.getByRole('button', { name: 'Remove React', exact: true }).waitFor();
  await page.goto(`${base}/c/class/slot`);
  const form = page.locator('form').filter({ has: page.getByLabel('Title', { exact: true }) });
  await form.getByRole('button', { name: 'Remove React', exact: true }).waitFor();
  await form.getByRole('button', { name: 'Remove React', exact: true }).click();
  await form.getByLabel('Title', { exact: true }).fill('Student selected stack');
  await form.getByLabel('Description (required)', { exact: true }).fill('Original student abstract');
  await form.getByLabel('GitHub repository (required)', { exact: true }).fill('https://github.com/example/project');
  await form.getByRole('button', { name: 'Submit title', exact: true }).click();
  await page.locator('#title-title').waitFor();
  assert.deepEqual(titles[0].techStack, ['Node.js']);
  // A fresh proposal gets defaults; the saved project's edit form gets its own choices.
  await form.getByRole('button', { name: 'Remove React', exact: true }).waitFor();
  await page.locator('#title-title').getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  assert.equal(await dialog.getByRole('button', { name: 'Remove React', exact: true }).count(), 0);
  await dialog.getByRole('button', { name: 'Remove Node.js', exact: true }).click();
  await dialog.getByLabel('Description (required)', { exact: true }).fill('Updated student abstract');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.deepEqual(titles[0].techStack, []);
  assert.equal(titles[0].description, 'Updated student abstract');
  await page.reload();
  await page.locator('#title-title').getByRole('button', { name: 'Edit', exact: true }).click();
  assert.equal(await dialog.getByRole('button', { name: /^Remove (React|Node\.js)$/ }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS professor rules save/reload, student prefilled/removable defaults, new proposal reset, saved removals survive editing/reload, abstract stays editable; no database writes');
} finally { await browser.close(); }
