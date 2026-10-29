import assert from 'node:assert/strict';
import { load, database, common, helpers } from './test-phase14-16.mjs';

const groupId = '55555555-5555-4555-8555-555555555555';
const params = { params: { classId: 'class', studentId: 'student' } };
const request = (body = { groupId }) => new Request('http://localhost', { method: 'DELETE', body: JSON.stringify(body) });
const routeFile = 'src/app/api/classes/[classId]/students/[studentId]/group/route.ts';
function setup({ group = true, member = true, overrides = {} } = {}) {
  const databaseMock = database();
  let selects = 0;
  databaseMock.db.select = () => database(selects++ === 0
    ? group ? [{ id: groupId, slotId: 'slot' }] : []
    : member ? [{ id: 'membership' }] : []).db.select();
  const calls = [];
  const route = load(routeFile, {
    ...common, '@/lib/db': databaseMock,
    '@/lib/helpers': { ...helpers, assertStudentInClass: async () => ({ id: 'student' }) },
    '@/lib/leave': { applyApprovedLeave: async (...args) => { calls.push(args); return { emptied: false, remaining: 1 }; } },
    ...overrides,
  });
  return { route, calls, queries: databaseMock.queries };
}
for (const [options, body, status] of [
  [{ overrides: { '@/lib/auth': { getProfSession: async () => null } } }, { groupId }, 401],
  [{ overrides: { '@/lib/helpers': { ...helpers, assertClassOwnedByProf: async () => null } } }, { groupId }, 404],
  [{ overrides: { '@/lib/helpers': { ...helpers, assertStudentInClass: async () => null } } }, { groupId }, 404],
  [{}, { groupId: 'invalid' }, 422],
  [{ group: false }, { groupId }, 404],
  [{ member: false }, { groupId }, 409],
]) {
  const test = setup(options);
  assert.equal((await test.route.DELETE(request(body), params)).status, status);
  assert.equal(test.calls.length, 0, 'Denied or stale requests must not remove anyone');
  assert.equal(test.queries.length, 0, 'Denied or stale requests must not mutate data');
}
const success = setup();
const response = await success.route.DELETE(request(), params);
assert.equal(response.status, 200);
assert.equal((await response.json()).remaining, 1);
assert.deepEqual(success.calls[0], [groupId, 'student']);
assert.equal(success.queries[0].set.status, 'approved');
assert.equal(success.queries[0].set.resolvedByProfId, 'prof');
assert.equal(success.queries[1].values.action, 'group.member_removed');
console.log('PASS direct removal: professor/class/student authorization, stale membership, pending leave resolution, shared leave flow, activity record');

for (const remaining of [[], [{ id: 'remaining-member' }]]) {
  const mock = database();
  let index = 0;
  const results = [[{ id: 'membership' }], remaining, [{ id: groupId, maxSize: 2, status: 'locked' }]];
  mock.db.select = () => database(results[index++]).db.select();
  const leave = load('src/lib/leave.ts', { ...common, '@/lib/db': mock });
  const result = await leave.applyApprovedLeave(groupId, 'student');
  assert.equal(result.emptied, remaining.length === 0);
  assert.equal(result.remaining, remaining.length);
  assert.equal(mock.queries.filter(q => q.operation === 'delete').length, remaining.length ? 1 : 2);
  if (remaining.length) assert.equal(mock.queries.find(q => q.operation === 'update').set.status, 'forming');
}
console.log('PASS leave lifecycle: surviving group reopens; last-member removal follows existing empty-group cleanup');
