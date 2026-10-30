// Browser fixtures only; all APIs are mocked and no database records are changed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { SignJWT } from 'jose';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3101';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const context = await browser.newContext();
  const regular = '11111111-1111-4111-8111-111111111111';
  const irregular = '22222222-2222-4222-8222-222222222222';
  const token = await new SignJWT({ credentialVersion: 'synthetic-browser-version',  profId: 'prof', studentId: irregular, classId: 'class' , email: 'synthetic@example.invalid'}).setAudience(['professor-session', 'student-session']).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode('phase14-16-local-test-only'));
  await context.addCookies(['prof_token', 'student_token'].map(name => ({ name, value: token, url: base })));
  const students = [{ id: regular, name: 'Regular Student', idNumber: '001', password: 'test', memberships: [] }, { id: irregular, name: 'Irregular Student', idNumber: '002', password: 'test', memberships: [] }];
  const slots = [{ id: 'base', label: 'Other Subject', groupSize: 1, titlesRequiredMin: 1, titlesAllowedMax: 5, duplicateCheck: 'warn', requireTechStack: false, defaultTechStack: [], excludedStudentIds: [], locked: false }];
  const errors = [];
  let groupWrites = 0;
  await context.route('**/api/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    let data; let status = 200;
    if (path === '/api/classes/class/slots' && req.method() === 'POST') { const slot = { id: 'subject', ...req.postDataJSON() }; slots.push(slot); data = { slot }; }
    else if (path === '/api/classes/class/slots/subject' && req.method() === 'PATCH') { Object.assign(slots[1], req.postDataJSON()); data = { slot: slots[1] }; }
    else if (path === '/api/classes/class' || path === '/api/student/class-info') data = { class: { name: 'Test Class', term: '2026' } };
    else if (path === '/api/classes/class/slots') data = { slots };
    else if (path === '/api/student/slots') data = { slots: slots.filter(slot => !slot.excludedStudentIds.includes(irregular)) };
    else if (path === '/api/classes/class/students') data = { students: students.map(student => ({ ...student, slotProgress: slots.map(slot => ({ slotId: slot.id, slotLabel: slot.label, enrolled: !slot.excludedStudentIds.includes(student.id), inGroup: false, pendingCount: 0, verifiedCount: 0, rejectedCount: 0, titles: [], members: [] })) })) };
    else if (path === '/api/student/groups') { if (req.method() !== 'GET') groupWrites++; status = 403; data = { error: 'You are not enrolled in this project slot' }; }
    else if (path.endsWith('/leave-requests')) data = { requests: [] };
    else if (path.endsWith('/notifications')) data = { notifications: [] };
    else if (path.endsWith('/doc-fields')) data = { fields: [] };
    else if (path.endsWith('/tasks/stalled')) data = { stalledTasks: [] };
    else if (path.endsWith('/titles')) data = { titles: [] };
    else { errors.push(path); data = {}; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/dashboard/class?tab=settings`);
  await page.getByRole('button', { name: 'New project slot', exact: true }).click();
  const picker = page.getByRole('region', { name: 'Students taking this slot', exact: true });
  await picker.getByText('2 of 2 students included', { exact: true }).waitFor();
  await picker.getByRole('searchbox', { name: 'Search students for this slot', exact: true }).fill('002');
  await picker.getByRole('checkbox', { name: /Irregular Student/ }).uncheck();
  await picker.getByRole('searchbox', { name: 'Search students for this slot', exact: true }).fill('');
  await picker.getByText('1 of 2 students included', { exact: true }).waitFor();
  await page.getByPlaceholder('Project 1 - Capstone Proposal', { exact: true }).fill('Subject A');
  await page.getByRole('button', { name: 'Save as class defaults', exact: true }).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ps-slot-defaults:class')).excludedStudentIds), undefined);
  await page.getByRole('button', { name: 'Create slot', exact: true }).click();
  await page.locator('p').filter({ hasText: /^Subject A$/ }).waitFor();
  assert.deepEqual(slots[1].excludedStudentIds, [irregular]);
  await page.getByRole('combobox', { name: 'Project slot', exact: true }).selectOption('subject');
  await page.getByRole('button', { name: 'Roster / Students (1)', exact: true }).click();
  await page.getByRole('row', { name: 'View Regular Student', exact: true }).waitFor();
  assert.equal(await page.getByRole('row', { name: 'View Irregular Student', exact: true }).count(), 0);
  await page.getByText('1 enrolled in Subject A · 1 not enrolled', { exact: true }).waitFor();
  await page.getByRole('checkbox', { name: 'Show students not enrolled in this slot', exact: true }).check();
  await page.getByRole('row', { name: 'View Irregular Student', exact: true }).getByText('Not required for this slot').waitFor();
  await page.getByRole('button', { name: 'No group', exact: true }).click();
  assert.equal(await page.getByRole('row', { name: 'View Irregular Student', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('combobox', { name: 'Project slot', exact: true }).selectOption('base');
  await page.getByRole('button', { name: 'Roster / Students (2)', exact: true }).waitFor();
  await page.getByRole('row', { name: 'View Irregular Student', exact: true }).waitFor();
  await page.goto(`${base}/c/class`);
  await page.getByRole('link').filter({ hasText: 'Other Subject' }).waitFor();
  assert.equal(await page.getByRole('link').filter({ hasText: 'Subject A' }).count(), 0);
  await page.goto(`${base}/c/class/subject`);
  await page.waitForURL(`${base}/c/class`);
  assert.equal(groupWrites, 0);
  await page.goto(`${base}/dashboard/class?tab=settings&slot=subject`);
  const subject = page.locator('div.card').filter({ has: page.getByText('Subject A', { exact: true }) });
  await subject.getByRole('button', { name: 'Rules', exact: true }).click();
  await picker.getByText('1 of 2 students included', { exact: true }).waitFor();
  await picker.getByRole('button', { name: 'Include all students', exact: true }).click();
  await subject.getByRole('button', { name: 'Save rules', exact: true }).click();
  await page.getByText('Slot rules saved', { exact: true }).waitFor();
  assert.deepEqual(slots[1].excludedStudentIds, []);
  await page.goto(`${base}/c/class`);
  await page.getByRole('link').filter({ hasText: 'Subject A' }).waitFor();
  assert.equal(students.length, 2);
  assert.deepEqual(errors, []);
  console.log('PASS create-slot enrollment/search, exclusions not copied to defaults, correct roster count/no-group filtering, other slot unaffected, student visibility/direct-link redirect, re-enrollment; zero database writes');
} finally { await browser.close(); }
