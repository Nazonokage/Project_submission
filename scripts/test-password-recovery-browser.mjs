// Professor password recovery and student login with synthetic fixtures only.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { SignJWT } from 'jose';
const base = process.env.TEST_BASE_URL || 'http://localhost:3101';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const context = await browser.newContext();
  const secret = new TextEncoder().encode('phase14-16-local-test-only');
  const profToken = await new SignJWT({ profId: 'prof', email: 'fixture@example.invalid' }).setAudience('professor-session').setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(secret);
  await context.addCookies([{ name: 'prof_token', value: profToken, url: base }]);
  await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async value => { window.__fixtureCopy = value; } } }));
  const student = { id: 'student', name: 'Fixture Student', idNumber: '0001', isActive: true, memberships: [], slotProgress: [] };
  let currentPassword = 'fixture-issued-password', canReveal = true, failReset = true;
  const errors = [];
  await context.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    let data = {}, status = 200;
    if (path === '/api/classes/class-test/students/student/password') {
      const { action } = req.postDataJSON();
      if (action === 'reveal') { if (canReveal) data = { password: currentPassword }; else { status = 409; data = { error: 'This password cannot be shown. Issue a new password for this student.' }; } }
      else if (failReset) { failReset = false; status = 503; data = { error: 'Temporary fixture failure. Try again.' }; }
      else { currentPassword = 'replacement-fixture-password'; canReveal = false; data = { password: currentPassword, replaced: true }; }
    } else if (path === '/api/classes/class-test/students/student') data = { class: { name: 'Fixture Class' }, student, memberships: [], titles: [], leaveRequests: [], hasEligibleSlots: false };
    else if (path === '/api/classes/class-test') data = { class: { name: 'Fixture Class', term: 'Fixture Term' } };
    else if (path === '/api/classes/class-test/slots') data = { slots: [] };
    else if (path === '/api/classes/class-test/students') data = { students: [student] };
    else if (path === '/api/classes/class-test/leave-requests') data = { requests: [] };
    else if (path === '/api/student/login') {
      const body = req.postDataJSON();
      assert.equal(body.idNumber, student.idNumber); assert.equal(body.password, currentPassword);
      const token = await new SignJWT({ studentId: student.id, classId: 'class-test', credentialVersion: 'fixture' }).setAudience('student-session').setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(secret);
      await context.addCookies([{ name: 'student_token', value: token, url: base }]); data = { ok: true };
    } else if (path === '/api/classes/class-test/directory') data = { students: [{ name: student.name, idNumber: student.idNumber }] };
    else if (path === '/api/student/slots') data = { slots: [] };
    else if (path === '/api/student/notifications') data = { notifications: [] };
    else if (path === '/api/student/class-info') data = { class: { name: 'Fixture Class' } };
    else { errors.push(path); await route.abort(); return; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/dashboard/class-test/students/student`);
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  const field = page.getByLabel('Student login password', { exact: true });
  assert.equal(await field.inputValue(), currentPassword);
  assert.equal(await field.getAttribute('type'), 'text');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  assert.equal(await field.getAttribute('type'), 'password');
  await page.getByRole('button', { name: 'Copy password', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__fixtureCopy), currentPassword);
  await page.getByRole('button', { name: 'Issue new password', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Temporary fixture failure' }).waitFor();
  await page.getByRole('button', { name: 'Issue new password', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'New password saved' }).waitFor();
  assert.equal(await field.inputValue(), currentPassword);
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('replacement-fixture-password')), false);
  await page.goto(`${base}/dashboard/class-test?tab=roster`);
  await page.getByRole('row', { name: 'View Fixture Student' }).click();
  const details = page.getByRole('dialog');
  await details.getByRole('button', { name: 'Show password', exact: true }).click();
  await details.getByRole('alert').filter({ hasText: 'cannot be shown' }).waitFor();
  await details.getByRole('button', { name: 'Issue new password', exact: true }).click();
  await details.getByRole('status').filter({ hasText: 'New password saved' }).waitFor();
  const issued = await details.getByLabel('Student login password', { exact: true }).inputValue();
  await page.goto(`${base}/c/class-test/login`);
  await page.getByRole('combobox', { name: 'Name or ID number' }).fill('0001');
  await page.getByLabel('Password', { exact: true }).fill(issued);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForURL(`${base}/c/class-test`);
  assert.deepEqual(errors, []);
  console.log('PASS profile/roster show-hide-copy, failed-reset retry, unavailable original recovery, issued replacement student login, no persistent password storage or browser errors');
} finally { await browser.close(); }
