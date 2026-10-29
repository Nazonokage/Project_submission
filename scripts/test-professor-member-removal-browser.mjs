// Isolated fixtures: no API request reaches the database.
// Start Next with JWT_SECRET=phase14-16-local-test-only on port 3101 first.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { SignJWT } from 'jose';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3101';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const context = await browser.newContext();
  const token = await new SignJWT({ profId: 'prof-test' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode('phase14-16-local-test-only'));
  await context.addCookies([{ name: 'prof_token', value: token, url: base }]);
  const group = { groupId: '55555555-5555-4555-8555-555555555555', slotId: 'slot', slotLabel: 'Project One', status: 'locked', maxSize: 2, members: [{ id: 'student', name: 'Alice', idNumber: '001' }, { id: 'peer', name: 'Bob', idNumber: '002' }] };
  let memberships = [group];
  let removals = 0;
  let fail = true;
  const unexpected = [];
  await context.route('**/api/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    let status = 200;
    let data;
    if (req.method() === 'DELETE' && path.endsWith('/group')) {
      removals++;
      assert.equal(req.postDataJSON().groupId, group.groupId);
      if (fail) { status = 500; data = { error: 'Removal failed; try again' }; fail = false; }
      else {
        const id = path.split('/').at(-2);
        group.members = group.members.filter(member => member.id !== id);
        if (id === 'student') memberships = [];
        data = { ok: true };
      }
    } else if (path === '/api/classes/class/students/student') {
      data = { student: { id: 'student', name: 'Alice', idNumber: '001', password: 'test', isActive: true }, memberships, titles: [], leaveRequests: [] };
    } else { unexpected.push(path); status = 501; data = {}; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => unexpected.push(error.message));
  await page.goto(`${base}/dashboard/class/students/student`);
  const search = page.getByRole('searchbox', { name: 'Search group members', exact: true });
  await search.waitFor();
  assert.equal(await page.getByRole('button', { name: 'Add groupmates', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Set up group', exact: true }).count(), 0);
  await search.fill(' bOB ');
  assert.equal(await page.getByRole('button', { name: 'Remove Alice from Project One', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Remove Bob from Project One', exact: true }).waitFor();
  await search.fill('001');
  await page.getByRole('button', { name: 'Remove Alice from Project One', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Remove Bob from Project One', exact: true }).count(), 0);
  await search.fill('missing');
  await page.getByRole('status').filter({ hasText: 'No members match your search.' }).waitFor();
  await search.fill('');
  await page.getByRole('button', { name: 'Remove Bob from Project One', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByText('The remaining members keep the group and its projects.', { exact: false }).waitFor();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(removals, 0);
  await page.getByRole('button', { name: 'Remove Bob from Project One', exact: true }).click();
  await dialog.getByRole('button', { name: 'Remove member', exact: true }).click();
  await page.getByText('Removal failed; try again', { exact: true }).waitFor();
  assert.equal(await dialog.isVisible(), true);
  await dialog.getByRole('button', { name: 'Remove member', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Remove Alice from Project One', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Add groupmates', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Remove Bob from Project One', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Remove Alice from Project One', exact: true }).click();
  await dialog.getByText('This is the last member.', { exact: false }).waitFor();
  await dialog.getByRole('button', { name: 'Remove member', exact: true }).click();
  await page.getByText('Not in a group yet.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Set up group', exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Alice', exact: true }).count(), 1);
  assert.equal(removals, 3);
  assert.deepEqual(unexpected, []);
  console.log('PASS member search by name/ID, empty search results, full-group controls hidden, add restored after removal, confirmation/cancel/retry, last-member warning, student remains enrolled; zero database writes');
} finally { await browser.close(); }
