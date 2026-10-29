import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { SignJWT } from 'jose';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3467';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const group = { groupId: 'group-one', slotId: 'slot-one', slotLabel: 'Project One', status: 'locked', maxSize: 2, members: [{ id: 'student', name: 'Test Student' }] };
const memberships = [];
const rosterMemberships = [];
const peerMemberships = [];
const titles = [{ id: 'title-one', groupId: 'group-one', slotId: 'slot-one', text: 'Existing project', description: 'Original description', status: 'pending', techStack: [], progressStatus: 'planning', repoUrl: null, targetUsers: null }];
const errors = [];
const feedback = [];
let failCreate = true;
let createdBody;
try {
  const context = await browser.newContext();
  const token = await new SignJWT({ profId: 'prof-test' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode('phase14-16-local-test-only'));
  await context.addCookies([{ name: 'prof_token', value: token, url: base }]);
  await context.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    let data = {}; let status = 200;
    if (path === '/api/classes/class-test/students/student') data = { student: { id: 'student', name: 'Test Student', idNumber: '001', password: 'example' }, memberships, titles, leaveRequests: [], unassignedSlotIds: ['slot-one', 'slot-two'].filter(id => !memberships.some(m => m.slotId === id)) };
    else if (path === '/api/classes/class-test/slots') data = { slots: [{ id: 'slot-one', label: 'Project One', groupSize: 2 }, { id: 'slot-two', label: 'Project Two', groupSize: 2 }] };
    else if (path === '/api/classes/class-test/students') data = { students: [{ id: 'student', name: 'Test Student', idNumber: '001', memberships: rosterMemberships }, { id: 'peer', name: 'Chosen Classmate', idNumber: '002', memberships: peerMemberships }] };
    else if (path === '/api/classes/class-test/students/student/group') {
      const body = request.postDataJSON();
      let target = memberships.find(item => item.slotId === body.slotId);
      if (!target) {
        target = { ...group, groupId: body.slotId === 'slot-one' ? 'group-one' : 'group-two', slotId: body.slotId, slotLabel: body.slotId === 'slot-one' ? 'Project One' : 'Project Two', members: [...group.members] };
        memberships.push(target); rosterMemberships.push({ groupId: target.groupId, slotId: target.slotId });
      }
      if (body.memberIds.includes('peer')) { target.members.push({ id: 'peer', name: 'Chosen Classmate' }); peerMemberships.push({ groupId: target.groupId, slotId: target.slotId }); }
      data = { groupId: target.groupId, slotId: target.slotId };
    }
    else if (path === '/api/dashboard/feedback') {
      if (request.method() === 'POST') { feedback.push({ ...request.postDataJSON(), id: 'feedback-one', status: 'open', createdAt: new Date().toISOString(), professorName: 'Professor' }); data = { feedback: feedback.at(-1) }; }
      else data = { feedback };
    }
    else if (path.endsWith('/tech-tags')) data = { tags: [] };
    else if (path === '/api/dashboard/titles' && request.method() === 'POST') {
      createdBody = request.postDataJSON();
      if (failCreate) { failCreate = false; status = 500; data = { error: 'Please retry this save' }; }
      else {
        const membership = memberships.find(item => item.groupId === createdBody.groupId);
        const title = { ...createdBody, id: `title-${titles.length + 1}`, slotId: membership.slotId, status: createdBody.autoVerify ? 'verified' : 'pending', progressStatus: 'planning' };
        titles.push(title); data = { title }; status = 201;
      }
    } else if (path.startsWith('/api/dashboard/titles/')) {
      const title = titles.find(item => path.endsWith(item.id));
      if (request.method() === 'PATCH') Object.assign(title, request.postDataJSON());
      data = { title };
    } else { errors.push(`Unexpected request ${path}`); status = 501; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/dashboard/class-test/students/student`);
  await page.getByText('Not in a group yet.', { exact: true }).waitFor();
  const dialog = page.getByRole('dialog');
  const setup = page.getByRole('region', { name: 'Set up project group' });
  await page.getByRole('button', { name: 'Set up group', exact: true }).click();
  await setup.waitFor({ state: 'visible' });
  assert.equal(await dialog.count(), 0, 'Group setup expands inline, without a modal');
  await setup.getByRole('button', { name: 'Create solo group' }).click();
  await setup.waitFor({ state: 'hidden' });
  assert.equal(memberships[0].members.length, 1);
  await page.getByRole('button', { name: 'Add groupmates', exact: true }).click();
  assert.equal(await setup.getByRole('button', { name: 'Save groupmates' }).isDisabled(), true);
  await setup.getByRole('searchbox', { name: 'Search available classmates' }).fill('002');
  await setup.getByRole('checkbox', { name: /Chosen Classmate/ }).check();
  await setup.getByRole('searchbox', { name: 'Search available classmates' }).fill('missing');
  await setup.getByText('No classmates match your search.', { exact: true }).waitFor();
  await setup.getByRole('searchbox', { name: 'Search available classmates' }).fill('chosen');
  assert.equal(await setup.getByRole('checkbox', { name: /Chosen Classmate/ }).isChecked(), true);
  await setup.getByRole('button', { name: 'Save groupmates' }).click();
  await setup.waitFor({ state: 'hidden' });
  assert.equal(memberships[0].members.length, 2);
  assert.equal(await page.getByRole('button', { name: 'Add groupmates', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Set up another slot', exact: true }).click();
  await setup.getByLabel('Project slot', { exact: true }).selectOption('slot-two');
  await setup.getByRole('button', { name: 'Create solo group' }).click();
  await setup.waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('button', { name: 'Set up another slot', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Add title for Project Two', exact: true }).click();
  assert.equal(await dialog.getByLabel('Project slot and group').inputValue(), 'group-two');
  assert.equal(await dialog.getByLabel('Approve this title immediately').isChecked(), false);
  assert.equal(await dialog.getByRole('button', { name: 'Add title', exact: true }).isDisabled(), true);
  await dialog.getByLabel('Title', { exact: true }).fill('Professor assigned project');
  await dialog.getByLabel('Description', { exact: true }).fill('Build a classroom scheduling app.');
  await dialog.getByRole('button', { name: 'Add title', exact: true }).click();
  await dialog.getByRole('alert').waitFor();
  assert.equal(await dialog.getByLabel('Title', { exact: true }).inputValue(), 'Professor assigned project');
  await dialog.getByRole('button', { name: 'Add title', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByText('Professor assigned project', { exact: true }).waitFor();
  assert.equal(createdBody.groupId, 'group-two'); assert.equal(createdBody.classId, 'class-test'); assert.equal(createdBody.autoVerify, false);
  await page.getByRole('button', { name: 'Edit title: Professor assigned project', exact: true }).click();
  await dialog.getByLabel('Title', { exact: true }).fill('Updated group project');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByText('Updated group project', { exact: true }).waitFor();
  assert.equal(titles.at(-1).groupId, 'group-two');
  await page.getByRole('button', { name: 'Add title for Project One', exact: true }).click();
  await dialog.getByLabel('Title', { exact: true }).fill('Approved group project');
  await dialog.getByLabel('Description', { exact: true }).fill('Approved classroom project');
  await dialog.getByLabel('Approve this title immediately').check();
  await dialog.getByRole('button', { name: 'Add title', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByText('Approved group project', { exact: true }).waitFor();
  assert.equal(titles.at(-1).status, 'verified');
  await page.getByRole('button', { name: 'Feedback for Approved group project', exact: true }).click();
  await dialog.getByPlaceholder('Visible to the student group').fill('Please add the testing results.');
  assert.equal(await dialog.getByRole('button', { name: 'Comment', exact: true }).getAttribute('aria-pressed'), 'true');
  await dialog.screenshot({ path: join(tmpdir(), 'feedback-selection-check.png') });
  await dialog.getByRole('button', { name: 'Leave feedback', exact: true }).click();
  await dialog.getByText('Please add the testing results.', { exact: true }).waitFor();
  assert.equal(feedback[0].titleId, titles.at(-1).id);
  assert.equal(feedback[0].type, 'comment');
  assert.deepEqual(errors, []);
  console.log('PASS professor solo group creation, adding chosen groupmates, profile group preselection, validation, failed-save retry, pending/approved creation, edit, refreshed title list and sending profile feedback; no live database writes');
} finally { await browser.close(); }
