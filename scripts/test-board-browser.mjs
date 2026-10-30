import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Isolated UI fixtures: no API request reaches the database.
// Start Next with JWT_SECRET=phase14-16-local-test-only on port 3101 first.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { SignJWT } from 'jose';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3101';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const now = new Date().toISOString();
const titles = ['Alpha project', 'Beta project'].map((text, i) => ({ id: `title-${i}`, classId: 'class-test', slotId: 'slot-test', groupId: 'group-test', text, repoUrl: 'https://github.com/example/project', description: 'Project description', status: 'verified', progressStatus: 'planning', members: [{ id: 'student-test', name: 'Test Student', idNumber: '001' }], techStack: [], documentation: {} }));
titles.push(...['Gamma proposal', 'Delta proposal'].map((text, i) => ({ ...titles[0], id: `title-${i + 2}`, text, status: 'pending', addedBy: 'student', submittedBy: { id: 'former-student', name: 'Original Submitter', role: 'student' }, members: [{ id: 'member-a', name: 'Alice Groupmate', idNumber: '002' }, { id: 'member-b', name: 'Bob Groupmate', idNumber: '003' }] })));
let notificationReadAt = null;
let failRead = false;
let lastTitleBody;
let lastDecision;
let failDecision = true;
const slot = { id: 'slot-test', label: 'Project One', instructions: 'Submit a working demonstration.', groupSize: 1, titlesRequiredMin: 1, titlesAllowedMax: 5, duplicateCheck: 'warn', locked: false };
let archivedAt = null;
let deleted = false;
let failMove = false;
let tasks = titles.map((t, i) => ({ id: `task-${i}`, titleId: t.id, name: `Task ${i}`, status: 'planning', createdAt: now, assigneeStudentId: 'student-test' }));
let updates = [];
const errors = [];
const requests = [];
async function context(role, options = {}) {
  const ctx = await browser.newContext(options);
  const token = await new SignJWT({ studentId: 'student-test', classId: 'class-test', profId: 'prof-test' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode('phase14-16-local-test-only'));
  await ctx.addCookies([{ name: role === 'student' ? 'student_token' : 'prof_token', value: token, url: base }]);
  await ctx.route('**/api/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    requests.push({ path, method, at: Date.now() });
    const body = req.postDataJSON();
    let data = {};
    let status = 200;
    if (path === '/api/student/notifications' && method === 'PATCH') {
      if (failRead) { failRead = false; status = 500; data = { error: 'Simulated read failure' }; }
      else { notificationReadAt = now; data = { success: true }; }
    }
    else if (path === '/api/student/notifications') data = { notifications: [{ readAt: notificationReadAt, id: 'feedback-test', titleId: 'title-0', titleText: 'Alpha project', classId: 'class-test', slotId: 'slot-test', body: 'Please add your test results.', status: 'open', type: 'request_changes', professorName: 'Test Professor', createdAt: now }] };
    else if (path === '/api/student/groups') data = { group: { id: 'group-test', status: 'locked', maxSize: 1 }, members: titles[0].members, studentId: 'student-test' };
    else if (path === '/api/student/slots' || path.endsWith('/slots')) data = { slots: [slot, { ...slot, id: 'slot-other', label: 'Other slot' }] };
    else if (path.includes('class-info')) data = { class: { name: 'Test Class', term: '2026' } };
    else if (path === '/api/classes/class-test/students') data = { students: [{ id: 'solo', name: 'Solo Student', idNumber: '010', password: 'default', memberships: [], slotProgress: [{ slotId: 'slot-test', slotLabel: 'P1', pendingCount: 0, verifiedCount: 0, rejectedCount: 0 }] }, { id: 'pending', name: 'Pending Student', idNumber: '011', password: 'default', memberships: [{ groupId: 'group-test', slotId: 'slot-test' }], slotProgress: [{ slotId: 'slot-test', slotLabel: 'P1', pendingCount: 1, verifiedCount: 0, rejectedCount: 0 }] }, { id: 'approved', name: 'Approved Student', idNumber: '012', password: 'default', memberships: [{ groupId: 'approved-group', slotId: 'slot-test' }], slotProgress: [{ slotId: 'slot-test', slotLabel: 'P1', pendingCount: 0, verifiedCount: 1, rejectedCount: 0 }] }] };
    else if (path.includes('without-group') || path.endsWith('/students')) data = { students: [] };
    else if (path.includes('invites')) data = { invites: [] };
    else if (path.includes('leave-requests')) data = { requests: [] };
    else if (path.endsWith('/tasks/stalled')) data = { stalledTasks: [] };
    else if (path.endsWith('/tech-tags')) data = { tags: ['React', 'Node.js', 'PostgreSQL'] };
    else if (path.endsWith('/titles/check')) data = { matches: [] };
    else if (path.endsWith('/doc-fields')) data = { fields: [] };
    else if (path.endsWith('/reports')) data = { reports: [] };
    else if (path.includes('/feedback')) data = { feedback: [] };
    else if (path === '/api/student/titles' && method === 'POST') { lastTitleBody = body; data = { title: { id: 'submitted-fixture', ...body } }; }
    else if (/\/titles\/title-\d$/.test(path) && method === 'PATCH') { lastTitleBody = body; const title = titles.find(t => path.endsWith(t.id)); Object.assign(title, body); data = { title }; }
    else if (path.endsWith('/verify')) {
      if (failDecision) { failDecision = false; status = 500; data = { error: 'Simulated decision failure' }; }
      else { lastDecision = body; const title = titles.find(t => path.includes(t.id)); title.status = body.decision; data = { title }; }
    }
    else if (path === '/api/dashboard/class-test/slot-other/titles') data = { titles: [] };
    else if (path === '/api/student/titles' || path.endsWith('/verified') || path === '/api/dashboard/class-test/slot-test/titles') data = { titles };
    else if (/\/titles\/title-\d$/.test(path)) data = { title: titles.find(t => path.endsWith(t.id)), docFields: [] };
    else if (path.endsWith('/tasks') && method === 'GET') {
      await new Promise(r => setTimeout(r, 350));
      data = { tasks: tasks.filter(t => t.titleId === url.searchParams.get('titleId')) };
    } else if (path.endsWith('/tasks') && method === 'POST') {
      const task = { ...body, id: 'task-created', createdAt: now };
      tasks.push(task); data = { task };
    } else if (path.includes('/tasks/') && method === 'PATCH') {
      await new Promise(r => setTimeout(r, 600));
      if (failMove) { status = 500; data = { error: 'Simulated move failure' }; failMove = false; }
      else { const task = tasks.find(t => path.endsWith(t.id)); Object.assign(task, body); data = { task }; }
    } else if (path.includes('/tasks/') && method === 'DELETE') { tasks = tasks.filter(t => !path.endsWith(t.id)); data = { ok: true }; }
    else if (path.endsWith('/updates') && method === 'GET') data = { updates: updates.filter(u => u.titleId === url.searchParams.get('titleId')) };
    else if (path.endsWith('/updates') && method === 'POST') { const update = { ...body, id: `update-${updates.length}`, postedByStudentId: 'student-test', createdAt: now }; updates.push(update); data = { update }; }
    else if (path.includes('/updates/') && method === 'PATCH') { const update = updates.find(u => path.endsWith(u.id)); Object.assign(update, body, { updatedAt: now }); data = { update }; }
    else if (path.includes('/updates/') && method === 'DELETE') { updates = updates.filter(u => !path.endsWith(u.id)); data = { ok: true }; }
    else if (path === '/api/classes') data = { classes: deleted || (archivedAt && !url.searchParams.has('includeArchived')) ? [] : [{ id: 'class-test', name: 'Test Class', term: '2026', archivedAt }] };
    else if (path === '/api/classes/class-test') {
      if (method === 'PATCH') archivedAt = body.archived ? now : null;
      if (method === 'DELETE') { assert.equal(body.confirmName, 'Test Class'); deleted = true; }
      data = { class: { name: 'Test Class', term: '2026', archivedAt } };
    } else { errors.push(`Unexpected API: ${method} ${path}`); status = 501; }
    if (path === '/api/classes/class-test/students') {
      for (const student of data.students) for (const progress of student.slotProgress) {
        progress.inGroup = student.memberships.length > 0;
        progress.members = progress.inGroup ? [{ id: student.id, name: student.name, idNumber: student.idNumber }, { id: 'teammate', name: 'Jamie Teammate', idNumber: '099' }] : [];
        progress.titles = progress.inGroup ? [{ id: `project-${student.id}`, text: `${student.name}'s project`, status: progress.verifiedCount ? 'verified' : 'pending' }] : [];
      }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { ctx, page };
}
async function visible(locator) { await locator.waitFor({ state: 'visible', timeout: 15000 }); }
try {
  const { ctx, page } = await context('student');
  await page.goto(`${base}/c/class-test/slot-test`);
  await visible(page.getByText(slot.instructions));
  assert.equal(await page.getByRole('tab', { name: 'Submissions', exact: true }).getAttribute('aria-selected'), 'true');
  titles[0].repoUrl = null;
  await page.reload();
  await page.getByRole('tab', { name: 'Board', exact: true }).click();
  await page.getByRole('button', { name: 'Complete required information', exact: true }).click();
  const incomplete = page.locator('#title-title-0');
  assert.equal(await incomplete.locator('select').isDisabled(), true);
  await incomplete.getByRole('button', { name: 'Complete required information', exact: true }).click();
  const completion = page.getByRole('dialog');
  assert.equal(await completion.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true);
  await completion.getByLabel('GitHub repository (required)', { exact: true }).fill('https://github.com/example/project');
  await completion.getByRole('button', { name: 'Save', exact: true }).click();
  await completion.waitFor({ state: 'detached' });
  await incomplete.locator('select:not([disabled])').waitFor({ state: 'visible' });
  console.log('PASS incomplete approved title locks tools; completing required form unlocks progress');
  await page.getByRole('button', { name: 'Feedback notifications, 1 unread' }).click();
  await visible(page.getByText('Please add your test results.', { exact: true }));
  await page.getByRole('link', { name: 'Open project', exact: true }).click();
  await visible(page.locator('#title-title-0'));
  assert.equal(await page.locator('#title-title-2 option[value="done"]').isDisabled(), true);
  console.log('PASS feedback notification content/project link and disabled Done for pending title');
  // Phase 17: submission and editing share a keyboard-accessible, free-entry picker.
  await page.getByRole('button', { name: '+ Submit another title', exact: true }).click();
  const proposal = page.getByRole('dialog');
  await proposal.getByLabel('Title', { exact: true }).fill('New proposal');
  await proposal.getByLabel('Description (required)', { exact: true }).fill('A test proposal description');
  await proposal.getByLabel('GitHub repository (required)', { exact: true }).fill('https://github.com/example/project');
  const tagInput = proposal.getByRole('combobox', { name: 'Search tech stack' });
  await tagInput.fill('rea');
  await visible(proposal.getByRole('option', { name: /^React(?: Used in slot)?$/ }));
  await tagInput.press('ArrowDown'); await tagInput.press('Enter');
  await visible(proposal.getByRole('button', { name: 'Remove React' }));
  await tagInput.fill('react'); await tagInput.press('Enter');
  assert.equal(await proposal.getByRole('button', { name: 'Remove React' }).count(), 1);
  await tagInput.fill('CustomStack'); await tagInput.press('Enter');
  await proposal.getByRole('button', { name: 'Submit title', exact: true }).click();
  await proposal.waitFor({ state: 'hidden' });
  assert.deepEqual(lastTitleBody.techStack, ['React', 'CustomStack']);
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('combobox', { name: 'Search tech stack' }).fill('Node');
  await page.getByRole('option', { name: /^Node\.js/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.deepEqual(lastTitleBody.techStack, ['Node.js']);
  console.log('PASS Phase 17: prior tags, keyboard selection, case-insensitive deduplication, custom tags, submit/edit saves');
  await page.getByRole('tab', { name: 'Board' }).click();
  await visible(page.getByText('Task 0', { exact: true }));
  await page.getByRole('combobox', { name: 'Active project' }).selectOption('title-1');
  await visible(page.getByText('Task 1', { exact: true }));
  assert.equal(await page.getByText('Task 0', { exact: true }).count(), 0);
  await page.getByRole('combobox', { name: 'Active project' }).selectOption('title-0');
  assert.equal(await page.getByText('Task 0', { exact: true }).isVisible(), true, 'Cached project should display immediately');
  const taskCard = () => page.locator('[draggable="true"]').filter({ hasText: 'Task 0' });
  const select = taskCard().getByRole('combobox');
  await select.selectOption('in_progress');
  assert.equal(await select.inputValue(), 'in_progress');
  await page.waitForTimeout(1000);
  failMove = true;
  await select.selectOption('done');
  assert.equal(await select.inputValue(), 'done');
  await visible(page.getByText('Simulated move failure', { exact: true }));
  assert.equal(await select.inputValue(), 'in_progress', 'Failed move rolls back');
  await page.waitForTimeout(500);
  await taskCard().dragTo(page.locator('p').filter({ hasText: /^Review$/ }), { sourcePosition: { x: 10, y: 10 } });
  await page.waitForTimeout(100);
  assert.equal(await select.inputValue(), 'review', 'Drag updates status immediately');
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'New Task', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Task Name').fill('Created task');
  await page.getByRole('dialog').getByRole('button', { name: 'Create Task', exact: true }).click();
  await visible(page.getByText('Created task', { exact: true }));
  const createdCard = page.locator('[draggable="true"]').filter({ hasText: 'Created task' });
  await createdCard.getByRole('button', { name: 'Edit task' }).click();
  await page.getByRole('dialog').getByLabel('Task Name').fill('Edited task');
  await page.getByRole('dialog').getByRole('button', { name: 'Save Changes' }).click();
  await visible(page.getByText('Edited task', { exact: true }));
  await page.locator('[draggable="true"]').filter({ hasText: 'Edited task' }).getByRole('button', { name: 'Delete task' }).click();
  await page.getByText('Edited task', { exact: true }).waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Log for this project' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input').first().fill('First update');
  await dialog.locator('textarea').first().fill('Progress from browser one');
  await dialog.getByRole('button', { name: 'Post update' }).click();
  await visible(page.getByText('First update', { exact: true }));
  assert.equal(await page.getByText('Task 0', { exact: true }).isVisible(), true);
  const second = await context('student');
  await second.page.goto(`${base}/c/class-test/slot-test`);
  await second.page.getByRole('tab', { name: 'Board' }).click();
  await visible(second.page.getByText('First update', { exact: true }));
  // A remote change must enter the cache through the next poll.
  updates.push({ id: 'remote-update', titleId: 'title-0', headline: 'Remote update', body: 'Another browser posted this', kind: 'progress', postedByStudentId: 'student-test', createdAt: now });
  await visible(page.getByText('Remote update', { exact: true }));
  await visible(second.page.getByText('Remote update', { exact: true }));
  const updateRow = () => page.locator('div.flex.gap-3.text-sm').filter({ hasText: 'First update' });
  await updateRow().getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('dialog').locator('input').first().fill('Edited update');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await visible(page.getByText('Edited update', { exact: true }));
  await page.locator('div.flex.gap-3.text-sm').filter({ hasText: 'Edited update' }).getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByText('Edited update', { exact: true }).waitFor({ state: 'detached' });
  assert.equal(await page.getByText('Task 0', { exact: true }).isVisible(), true);
  await page.getByRole('tab', { name: 'Titles', exact: true }).click();
  await page.getByRole('tab', { name: 'Board' }).click();
  assert.equal(await page.getByText('Task 0', { exact: true }).isVisible(), true, 'Board tab cache survives unmount');
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(500);
  let pagePolls = 0;
  const countPoll = req => { if (req.url().includes('/api/student/tasks?')) pagePolls++; };
  page.on('request', countPoll);
  await page.waitForTimeout(11000);
  assert.equal(pagePolls, 0, 'Hidden tab does not poll');
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(11000);
  assert.ok(pagePolls > 0, 'Visible tab resumes polling');
  assert.equal(await page.getByText('Task 0', { exact: true }).isVisible(), true);
  page.off('request', countPoll);
  const mobile = await context('student', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await mobile.page.goto(`${base}/c/class-test/slot-test`);
  await mobile.page.getByRole('tab', { name: 'Board' }).click();
  await visible(mobile.page.getByText('Task 0', { exact: true }));
  await visible(mobile.page.getByRole('button', { name: 'New Task', exact: true }));
  await visible(mobile.page.getByRole('button', { name: 'All Tasks', exact: true }));
  assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Phone board should not overflow the page');
  const scroller = mobile.page.locator('[data-kanban-scroller]');
  assert.ok(await scroller.evaluate(el => el.scrollWidth > el.clientWidth), 'Kanban columns should scroll horizontally on a phone');
  const phoneCard = mobile.page.locator('[draggable="true"]').filter({ hasText: 'Task 0' });
  await visible(phoneCard.getByRole('button', { name: 'Move', exact: true }));
  await phoneCard.getByRole('combobox').selectOption('done');
  assert.equal(await phoneCard.getByRole('combobox').inputValue(), 'done');
  await mobile.ctx.close();
  console.log('PASS Phase 19: phone layout, horizontal column scroller, reachable controls, status fallback');
  console.log('PASS student: instructions, title cache isolation, optimistic move/rollback, drag-and-drop, task create/edit/delete, hidden/visible polling, update create/edit/delete, two-context polling, tab cache');
  const prof = await context('prof');
  await prof.page.goto(`${base}/dashboard/class-test`);
  await visible(prof.page.getByText('Alpha project', { exact: true }));
  await prof.page.getByRole('button', { name: /Roster \/ Students/ }).click();
  assert.equal(await prof.page.locator('thead th').count(), 4);
  assert.equal(await prof.page.locator('tbody button').count(), 0);
  await visible(prof.page.getByText('No project yet', { exact: true }));
  await visible(prof.page.getByText("Pending Student's project", { exact: true }));
  await prof.page.getByRole('button', { name: 'Has pending', exact: true }).click();
  assert.equal(await prof.page.locator('tbody tr').count(), 1);
  const pendingRow = prof.page.getByRole('row', { name: 'View Pending Student', exact: true });
  await pendingRow.focus(); await pendingRow.press('Enter');
  const detail = prof.page.getByRole('dialog');
  await visible(detail.getByRole('heading', { name: 'Pending Student', exact: true }));
  assert.match(await detail.textContent(), /Jamie Teammate/);
  await detail.getByRole('button', { name: 'Show password' }).click();
  await visible(detail.getByText('default', { exact: true }));
  assert.equal(await detail.getByRole('link', { name: 'View profile' }).getAttribute('href'), '/dashboard/class-test/students/pending');
  await detail.getByRole('button', { name: 'Edit student', exact: true }).click();
  await detail.getByLabel('Name', { exact: true }).fill('Unsaved change');
  await detail.getByRole('button', { name: 'Cancel', exact: true }).click();
  await visible(detail.getByRole('heading', { name: 'Pending Student', exact: true }));
  await prof.page.keyboard.press('Escape');
  assert.equal(await pendingRow.evaluate(el => el === document.activeElement), true);
  await prof.page.getByRole('button', { name: 'All', exact: true }).click();
  await prof.page.getByLabel('Search students by name or ID').fill('012');
  assert.equal(await prof.page.locator('tbody tr').count(), 1);
  await prof.page.setViewportSize({ width: 820, height: 1180 });
  await prof.page.getByRole('row', { name: 'View Approved Student', exact: true }).click();
  await visible(detail.getByRole('button', { name: 'Open on board' }));
  if (process.env.ROSTER_SCREENSHOT) await prof.page.screenshot({ path: process.env.ROSTER_SCREENSHOT });
  await detail.getByRole('button', { name: 'Open on board' }).click();
  await detail.waitFor({ state: 'hidden' });
  await prof.page.setViewportSize({ width: 1280, height: 900 });
  console.log('PASS simplified roster, group members/titles, search/filter, keyboard modal/focus restore, edit cancel, profile link and tablet board action');
  await prof.page.getByText('Alpha project', { exact: true }).click();
  await visible(prof.page.getByRole('dialog').getByText('Task 0', { exact: true }));
  await prof.page.keyboard.press('Escape');
  const queue = prof.page.getByRole('region', { name: 'Verification queue' });
  await visible(queue.getByRole('article', { name: 'Gamma proposal' }));
  assert.equal(await queue.getByText('Alice Groupmate', { exact: true }).count(), 2);
  assert.equal(await queue.getByText('Bob Groupmate', { exact: true }).count(), 2);
  assert.equal(await queue.getByText('Original Submitter', { exact: false }).count(), 2);
  await queue.getByRole('textbox', { name: 'Search verification queue' }).fill('Gamma');
  assert.equal(await queue.getByRole('article').count(), 1);
  await queue.getByRole('button', { name: 'Full review', exact: true }).click();
  await visible(prof.page.getByRole('dialog').getByRole('heading', { name: 'Gamma proposal' }));
  await prof.page.keyboard.press('Escape');
  await queue.getByRole('button', { name: 'Approve', exact: true }).click();
  await visible(prof.page.getByText('Simulated decision failure', { exact: true }));
  assert.equal(await queue.getByRole('article', { name: 'Gamma proposal' }).count(), 1);
  await queue.getByRole('button', { name: 'Approve', exact: true }).click();
  await queue.getByRole('article', { name: 'Gamma proposal' }).waitFor({ state: 'detached' });
  await queue.getByRole('textbox', { name: 'Search verification queue' }).fill('');
  await queue.getByLabel('Rejection comment (optional)').fill('Please narrow the scope');
  await queue.getByRole('button', { name: 'Reject', exact: true }).click();
  await visible(queue.getByText('All caught up.', { exact: false }));
  assert.equal(lastDecision.comment, 'Please narrow the scope');
  await queue.getByRole('combobox', { name: 'Verification status' }).selectOption('rejected');
  await visible(queue.getByRole('article', { name: 'Delta proposal' }));
  await prof.page.setViewportSize({ width: 820, height: 1180 });
  await queue.getByRole('combobox', { name: 'Verification status' }).selectOption('all');
  assert.equal(await queue.getByRole('article').count(), 4);
  assert.ok(await prof.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Tablet should not overflow horizontally');
  await prof.page.getByRole('combobox', { name: 'Project slot', exact: true }).selectOption('slot-other');
  await visible(queue.getByText('All caught up.', { exact: false }));
  await prof.page.getByRole('combobox', { name: 'Project slot', exact: true }).selectOption('slot-test');
  await visible(queue.getByText('All caught up.', { exact: false }));
  titles[2].status = 'pending'; titles[3].status = 'pending';
  await prof.page.reload();
  await visible(queue.getByRole('article', { name: 'Gamma proposal' }));
  await queue.getByRole('button', { name: 'Approve all (2)', exact: true }).click();
  await visible(prof.page.getByRole('dialog').getByText('Gamma proposal', { exact: true }));
  await prof.page.getByRole('button', { name: 'Confirm approvals', exact: true }).click();
  await visible(queue.getByText('2 approved. 0 could not be approved.', { exact: true }));
  assert.equal(titles[2].status, 'verified'); assert.equal(titles[3].status, 'verified');
  await queue.getByRole('combobox', { name: 'Verification status' }).selectOption('all');
  assert.ok(await queue.locator('[aria-label="Approval cards"]').evaluate(el => el.scrollWidth > el.clientWidth));
  await prof.page.getByRole('dialog').waitFor({ state: 'detached' });
  await prof.page.waitForTimeout(250);
  await prof.page.screenshot({ path: join(tmpdir(), 'approval-queue-check.png'), fullPage: true });
  console.log('PASS bulk approval, horizontal queue, and Submissions default for existing groups');
  console.log('PASS Phase 18: submitter/groupmates, search/status/slot filters, full review, failed approval retry, approve/reject, tablet layout');
  await prof.page.getByRole('button', { name: 'Settings / Rules', exact: true }).click();
  await prof.page.getByRole('button', { name: 'Archive class', exact: true }).click();
  await visible(prof.page.getByRole('button', { name: 'Restore class', exact: true }));
  await prof.page.goto(`${base}/dashboard`);
  await visible(prof.page.getByText('No classes yet', { exact: false }));
  await prof.page.getByRole('checkbox', { name: 'Show archived classes' }).check();
  await prof.page.getByRole('link').filter({ hasText: 'Test Class' }).click();
  await prof.page.getByRole('button', { name: 'Settings / Rules', exact: true }).click();
  await prof.page.getByRole('button', { name: 'Restore class', exact: true }).click();
  await visible(prof.page.getByRole('button', { name: 'Archive class', exact: true }));
  await prof.page.getByRole('button', { name: 'Delete class', exact: true }).click();
  const deleteButton = prof.page.getByRole('button', { name: 'Permanently delete class' });
  assert.equal(await deleteButton.isDisabled(), true);
  await prof.page.getByLabel('Type Test Class to confirm').fill('wrong');
  assert.equal(await deleteButton.isDisabled(), true);
  await prof.page.getByLabel('Type Test Class to confirm').fill('Test Class');
  await deleteButton.click();
  await prof.page.waitForURL(`${base}/dashboard`);
  assert.equal(deleted, true);
  assert.deepEqual(errors, []);
  console.log('PASS professor: review data, archive/default filtering, restore, typed deletion confirmation');
  console.log(`PASS ${requests.length} intercepted requests; zero database writes`);
  await ctx.close();
} finally { await browser.close(); }
