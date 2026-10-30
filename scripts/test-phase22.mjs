import assert from 'node:assert/strict';
import { PgDialect } from 'drizzle-orm/pg-core';
import { load, database, common } from './test-phase14-16.mjs';
const request = body => new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) });
function sequence(...results) {
  const base = database([{ id: 'saved' }]);
  const insert = base.db.insert;
  base.db.insert = () => { const chain = insert(); chain.catch = () => Promise.resolve([]); return chain; };
  base.db.select = () => {
    const next = database(results.shift() || []);
    const chain = next.db.select();
    base.queries.push(...next.queries);
    return chain;
  };
  return base;
}
const title = { id: 'title', classId: 'class', groupId: 'group', slotId: 'slot', description: 'Project abstract', repoUrl: 'https://github.com/example/project', text: 'Test project' };
for (const status of ['pending', 'rejected', 'verified']) {
  const db = database([{ id: 'member' }]);
  const route = load('src/app/api/student/titles/[titleId]/route.ts', { ...common, '@/lib/db': db, '@/lib/titles-query': { selectTitleBy: async () => ({ ...title, status }) } });
  assert.equal((await route.PATCH(request({ progressStatus: 'done' }), { params: { titleId: 'title' } })).status, status === 'verified' ? 200 : 403);
  assert.equal(db.queries.some(q => q.operation === 'update'), status === 'verified');
  const tasks = sequence([{ ...title, titleId: 'title', status: 'planning' }], [{ id: 'member' }], [{ ...title, status }]);
  const taskRoute = load('src/app/api/student/tasks/[taskId]/route.ts', { ...common, '@/lib/titles-query': { selectTitleBy: async () => ({ ...title, status }) }, '@/lib/db': tasks });
  assert.equal((await taskRoute.PATCH(request({ status: 'done' }), { params: { taskId: 'task' } })).status, status === 'verified' ? 200 : 403);
  assert.equal(tasks.queries.some(q => q.operation === 'update'), status === 'verified');
}
const creation = sequence([{ ...title, status: 'verified' }], [{ id: 'member' }]);
const create = load('src/app/api/student/tasks/route.ts', { ...common, '@/lib/db': creation });
assert.equal((await create.POST(request({ titleId: 'title', name: 'Task', status: 'done' }))).status, 201);
assert.equal(creation.queries.find(q => q.operation === 'insert').values.status, 'planning');
console.log('PASS pending/rejected completion blocked, approved completion allowed, creation always Planning');
const rosterDb = sequence(
  [{ id: 'solo', name: 'Solo', idNumber: '001' }, { id: 'member', name: 'Member', idNumber: '002' }],
  [{ studentId: 'member', groupId: 'group', slotId: 'slot' }],
  [{ id: 'slot', label: 'P1' }, { id: 'slot2', label: 'P2' }],
  [{ groupId: 'group', slotId: 'slot', status: 'pending', text: 'Newest' }, { groupId: 'group', slotId: 'slot', status: 'verified', text: 'Approved' }]
);
const roster = load('src/app/api/classes/[classId]/students/route.ts', { ...common, '@/lib/db': rosterDb });
const data = await (await roster.GET(request({}), { params: { classId: 'class' } })).json();
assert.equal(rosterDb.queries.length, 4);
assert.equal(data.students[0].slotProgress.length, 2);
assert.equal(data.students[0].slotProgress[0].inGroup, false);
assert.equal(data.students[0].slotProgress[0].pendingCount, 0);
assert.equal(data.students[1].slotProgress[0].pendingCount, 1);
assert.equal(data.students[1].slotProgress[0].verifiedCount, 1);
assert.equal(data.students[1].slotProgress[0].latestTitleText, 'Newest');
assert.equal(data.students[1].slotProgress[0].members[0].name, 'Member');
assert.equal(data.students[1].slotProgress[0].members[0].idNumber, '002');
assert.equal(data.students[1].slotProgress[0].titles.length, 2);
assert.equal(data.students[1].slotProgress[1].members.length, 0);
assert.equal(data.students[0].slotProgress[0].titles.length, 0);
assert.match(new PgDialect().sqlToQuery(rosterDb.queries[3].where).sql, /"deleted_at" is null/);
console.log('PASS roster progress covers empty slots, membership, mixed statuses, fixed query count and soft deletes');
const notificationsDb = database([]);
const joins = [];
const selectNotifications = notificationsDb.db.select;
notificationsDb.db.select = () => {
  const chain = selectNotifications();
  chain.innerJoin = (_table, condition) => { joins.push(condition); return chain; };
  return chain;
};
const notifications = load('src/app/api/student/notifications/route.ts', { ...common, '@/lib/db': notificationsDb });
assert.equal((await notifications.GET()).status, 200);
const where = new PgDialect().sqlToQuery(notificationsDb.queries[0].where);
assert.ok(where.params.includes('class'));
const membershipJoin = new PgDialect().sqlToQuery(joins[1]);
assert.ok(membershipJoin.params.includes('student'));
assert.match(membershipJoin.sql, /"student_id"/);
assert.match(membershipJoin.sql, /"group_id"/);
assert.match(membershipJoin.sql, /"slot_id"/);
assert.match(where.sql, /"deleted_at" is null/);
const unauth = load('src/app/api/student/notifications/route.ts', { ...common, '@/lib/db': database(), '@/lib/auth': { getStudentSession: async () => null } });
assert.equal((await unauth.GET()).status, 401);
console.log('PASS notification authentication, class scope and deleted-project exclusion');

// Exercise real JWT expiry and cookie lifetime together, without external services.
const { readFileSync } = await import('node:fs');
const { default: ts } = await import('typescript');
const { default: vm } = await import('node:vm');
const jose = await import('jose');
const cookieWrites = [];
const authExports = {};
const authCode = ts.transpileModule(readFileSync('src/lib/auth.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
vm.runInNewContext(`(function(require, exports) { ${authCode}\n})`, { TextEncoder, process: { env: { JWT_SECRET: 'isolated-auth-test-secret', NODE_ENV: 'production' } } })(
  name => name === 'jose' ? jose : { cookies: async () => ({ set: (...args) => cookieWrites.push(args) }) }, authExports
);
for (const role of ['Prof', 'Student']) {
  for (const remember of [false, true]) {
    const token = await authExports[`sign${role}Token`]({ studentId: 'student', profId: 'prof', classId: 'class', email: 'test@example.com' }, remember);
    const claims = jose.decodeJwt(token);
    const expected = 86400 * (remember ? 7 : 1);
    assert.equal(claims.exp - claims.iat, expected);
    await authExports[`set${role}Cookie`](token, remember);
    const options = cookieWrites.at(-1)[2];
    assert.equal(options.maxAge, expected);
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
  }
}
console.log('PASS student/professor JWT and cookie expiry: 24 hours by default, 7 days when remembered');
