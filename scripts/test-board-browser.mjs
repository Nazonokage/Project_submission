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
const titles = ['Alpha project', 'Beta project'].map((text, i) => ({ id: `title-${i}`, classId: 'class-test', slotId: 'slot-test', groupId: 'group-test', text, description: 'Project description', status: 'verified', progressStatus: 'planning', members: [{ id: 'student-test', name: 'Test Student', idNumber: '001' }], techStack: [], documentation: {} }));
titles.push(...['Gamma proposal', 'Delta proposal'].map((text, i) => ({ ...titles[0], id: `title-${i + 2}`, text, status: 'pending', addedBy: 'student', submittedBy: { id: 'former-student', name: 'Original Submitter', role: 'student' }, members: [{ id: 'member-a', name: 'Alice Groupmate', idNumber: '002' }, { id: 'member-b', name: 'Bob Groupmate', idNumber: '003' }] })));
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
async function context(role) {
  const ctx = await browser.newContext();
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
    if (path === '/api/student/groups') data = { group: { id: 'group-test', status: 'locked', maxSize: 1 }, members: titles[0].members, studentId: 'student-test' };
    else if (path === '/api/student/slots' || path.endsWith('/slots')) data = { slots: [slot, { ...slot, id: 'slot-other', label: 'Other slot' }] };
    else if (path.includes('class-info')) data = { class: { name: 'Test Class', term: '2026' } };
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
  // Phase 17: submission and editing share a keyboard-accessible, free-entry picker.
  await page.getByRole('button', { name: '+ Submit another title', exact: true }).click();
  const proposal = page.getByRole('dialog');
  await proposal.getByLabel('Title', { exact: true }).fill('New proposal');
  await proposal.getByLabel('Description', { exact: true }).fill('A test proposal description');
  const tagInput = proposal.getByRole('combobox', { name: 'Tech stack tag' });
  await tagInput.fill('rea');
  await visible(proposal.getByRole('option', { name: 'React', exact: true }));
  await tagInput.press('ArrowDown'); await tagInput.press('Enter');
  await visible(proposal.getByRole('button', { name: 'Remove React' }));
  await tagInput.fill('react'); await tagInput.press('Enter');
  assert.equal(await proposal.getByRole('button', { name: 'Remove React' }).count(), 1);
  await tagInput.fill('CustomStack'); await tagInput.press('Enter');
  await proposal.getByRole('button', { name: 'Submit title', exact: true }).click();
  await proposal.waitFor({ state: 'hidden' });
  assert.deepEqual(lastTitleBody.techStack, ['React', 'CustomStack']);
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('combobox', { name: 'Tech stack tag' }).fill('Node');
  await page.getByRole('option', { name: 'Node.js', exact: true }).click();
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
  console.log('PASS student: instructions, title cache isolation, optimistic move/rollback, drag-and-drop, task create/edit/delete, hidden/visible polling, update create/edit/delete, two-context polling, tab cache');
  const prof = await context('prof');
  await prof.page.goto(`${base}/dashboard/class-test`);
  await visible(prof.page.getByText('Alpha project', { exact: true }));
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
