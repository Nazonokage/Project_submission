import assert from 'node:assert/strict';
import { PgDialect } from 'drizzle-orm/pg-core';
import { load, database, common } from './test-phase14-16.mjs';

const request = body => new Request('http://localhost/api/test', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const title = {
  id: 'title', text: 'Student project', classId: 'class', slotId: 'slot', groupId: 'group',
  description: 'A project overview', repoUrl: 'https://github.com/student/project',
  progressStatus: 'planning', status: 'pending', profId: 'prof',
};
const fixtures = rows => {
  const fixture = database(rows);
  const insert = fixture.db.insert;
  fixture.db.insert = (...args) => {
    const chain = insert(...args);
    chain.catch = fn => Promise.resolve(rows).catch(fn);
    return chain;
  };
  return fixture;
};
const mocks = fixture => ({
  ...common, '@/lib/db': fixture,
  '@/lib/titles-query': { selectTitleBy: async () => title },
  '@/lib/title-duplicates': { duplicateGuard: async () => null },
});

for (const approvalStatus of ['pending', 'rejected']) {
  title.status = approvalStatus;
  const fixture = fixtures([title]);
  const route = load('src/app/api/student/titles/[titleId]/route.ts', mocks(fixture));
  for (const progressStatus of ['planning', 'in_progress', 'review', 'done']) {
    assert.equal((await route.PATCH(request({ progressStatus }), { params: { titleId: 'title' } })).status, 403);
  }
  const tasks = load('src/app/api/student/tasks/route.ts', mocks(fixture));
  assert.equal((await tasks.POST(request({ titleId: 'title', name: 'New task' }))).status, 403);
  const task = load('src/app/api/student/tasks/[taskId]/route.ts', mocks(fixture));
  for (const status of ['planning', 'in_progress', 'review', 'done']) {
    assert.equal((await task.PATCH(request({ status }), { params: { taskId: 'task' } })).status, 403);
  }
  assert.equal((await task.DELETE(request({}), { params: { taskId: 'task' } })).status, 403);
  assert.equal(fixture.queries.some(q => q.operation === 'update' || q.operation === 'insert'), false);
}
console.log('PASS pending/rejected students cannot change any project/task status, create tasks, or delete tasks');

title.status = 'verified';
const approved = fixtures([{ ...title, titleId: title.id, status: 'planning' }]);
const progress = load('src/app/api/student/titles/[titleId]/route.ts', mocks(approved));
assert.equal((await progress.PATCH(request({ progressStatus: 'in_progress' }), { params: { titleId: 'title' } })).status, 200);
const task = load('src/app/api/student/tasks/[taskId]/route.ts', mocks(approved));
assert.equal((await task.PATCH(request({ status: 'in_progress' }), { params: { taskId: 'task' } })).status, 200);
assert.ok(approved.queries.some(q => q.set?.status === 'in_progress'));
console.log('PASS approved students can move their project and tasks');

for (const file of ['src/app/api/dashboard/titles/[titleId]/verify/route.ts', 'src/app/api/dashboard/titles/[titleId]/route.ts']) {
  for (const previousStatus of ['pending', 'rejected', 'verified']) {
    title.status = previousStatus;
    title.progressStatus = 'review';
    const fixture = fixtures([title]);
    const route = load(file, mocks(fixture));
    const body = file.includes('/verify/') ? { decision: 'verified' } : { status: 'verified' };
    assert.equal((await route.PATCH(request(body), { params: { titleId: 'title' } })).status, 200);
    const patch = fixture.queries.find(q => q.operation === 'update').set;
    assert.equal(patch.progressStatus, previousStatus === 'verified' ? undefined : 'planning');
  }
}
console.log('PASS both approval paths start in Planning; repeated approval preserves progress');

const mineFixture = fixtures([]);
const mine = load('src/app/api/student/tasks/mine/route.ts', mocks(mineFixture));
await mine.GET(new Request('http://localhost/api/student/tasks/mine'));
const sql = new PgDialect().sqlToQuery(mineFixture.queries[0].where);
assert.match(sql.sql, /"titles"\."status"/);
assert.ok(sql.params.includes('verified'));
console.log('PASS personal task list excludes unapproved projects');

for (const status of ['pending', 'rejected']) {
  const stale = { ...title, status, progressStatus: 'in_progress' };
  const fixture = fixtures([stale]);
  const reads = load('src/lib/titles-query.ts', { ...common, '@/lib/db': fixture });
  assert.equal((await reads.selectTitles()).at(0).progressStatus, 'planning');
  assert.equal((await reads.selectTitleBy()).progressStatus, 'planning');
  const staffProgress = load('src/app/api/dashboard/titles/[titleId]/progress/route.ts', {
    ...mocks(fixture), '@/lib/titles-query': { selectTitleBy: async () => stale },
  });
  assert.equal((await staffProgress.PATCH(request({ progressStatus: 'in_progress' }), { params: { titleId: 'title' } })).status, 403);
  assert.equal(fixture.queries.some(q => q.operation === 'update'), false);
}
console.log('PASS legacy In Progress titles read as Planning; unapproved staff progress changes are blocked');

title.status = 'verified';
title.progressStatus = 'in_progress';
for (const file of ['src/app/api/dashboard/titles/[titleId]/verify/route.ts', 'src/app/api/dashboard/titles/[titleId]/route.ts']) {
  const fixture = fixtures([title]);
  const route = load(file, mocks(fixture));
  const body = file.includes('/verify/') ? { decision: 'rejected' } : { status: 'rejected', progressStatus: 'in_progress' };
  assert.equal((await route.PATCH(request(body), { params: { titleId: 'title' } })).status, 200);
  const patch = fixture.queries.find(q => q.operation === 'update').set;
  assert.equal(patch.status, 'rejected');
  assert.equal(patch.progressStatus, 'planning');
}
console.log('PASS rejecting an In Progress project stores Planning in both approval endpoints');
