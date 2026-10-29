import assert from 'node:assert/strict';
import { load, database, common, helpers } from './test-phase14-16.mjs';
const regular = '11111111-1111-4111-8111-111111111111';
const irregular = '22222222-2222-4222-8222-222222222222';
const slot = { id: 'slot', classId: 'class', groupSize: 1, excludedStudentIds: [irregular] };
const studentAuth = { getStudentSession: async () => ({ studentId: irregular, classId: 'class' }) };
const scopedHelpers = { ...helpers, assertSlotInClass: async () => slot, assertStudentInClass: async () => ({ id: irregular }) };
const request = (body = {}, method = 'POST') => new Request('http://localhost?slotId=slot&text=Example', { method, body: method === 'GET' ? undefined : JSON.stringify(body) });
function queued(results, writeRows = []) {
  const mock = database(writeRows);
  let next = 0;
  mock.db.select = () => database(results[next++] || []).db.select();
  return mock;
}
const { isSlotParticipant } = load('src/lib/slot-participation.ts');
assert.equal(isSlotParticipant(slot, regular), true);
assert.equal(isSlotParticipant(slot, irregular), false);
assert.equal(isSlotParticipant({}, irregular), true);
for (const [value, rows, grouped, valid] of [
  [[], [], [], true], [[irregular], [{ id: irregular }], [], true],
  [['bad'], [], [], false], [[irregular], [], [], false],
  [[irregular], [{ id: irregular }], [{ id: 'membership' }], false],
]) {
  const mock = queued([rows, grouped]);
  const validator = load('src/lib/slot-participation-server.ts', { ...common, '@/lib/db': mock });
  assert.equal((await validator.validateSlotExclusions('class', value, 'slot')) === null, valid);
}
for (const [file, method, body] of [
  ['src/app/api/student/groups/route.ts', 'GET', {}],
  ['src/app/api/student/groups/route.ts', 'POST', { slotId: 'slot' }],
  ['src/app/api/student/titles/route.ts', 'POST', { slotId: 'slot', text: 'Example title', description: 'Abstract', repoUrl: 'https://github.com/example/project' }],
  ['src/app/api/student/without-group/route.ts', 'GET', {}],
  ['src/app/api/student/titles/check/route.ts', 'GET', {}],
  ['src/app/api/student/titles/verified/route.ts', 'GET', {}],
  ['src/app/api/student/slots/[slotId]/tech-tags/route.ts', 'GET', {}],
]) {
  const mock = database();
  const route = load(file, { ...common, '@/lib/auth': studentAuth, '@/lib/helpers': scopedHelpers, '@/lib/db': mock, '@/lib/titles-query': {}, '@/lib/tech-tags': { getTechTags: async () => [] } });
  const req = request(body, method);
  req.nextUrl = new URL(req.url);
  assert.equal((await route[method](req, { params: { slotId: 'slot' } })).status, 403, file);
  assert.equal(mock.queries.length, 0, 'Excluded students cannot trigger group creation or data writes');
}
const list = load('src/app/api/student/slots/route.ts', { ...common, '@/lib/auth': studentAuth, '@/lib/db': database([slot, { id: 'other', excludedStudentIds: [] }]) });
const available = (await (await list.GET()).json()).slots;
assert.deepEqual(available.map(s => s.id), ['other']);
assert.equal('excludedStudentIds' in available[0], false);
const classmates = [{ id: regular, name: 'Regular', idNumber: '001' }, { id: irregular, name: 'Irregular', idNumber: '002' }];
const rosterDb = queued([classmates, [], [slot, { id: 'other', label: 'Other subject', excludedStudentIds: [] }], []]);
const roster = load('src/app/api/classes/[classId]/students/route.ts', { ...common, '@/lib/db': rosterDb });
const rosterData = await (await roster.GET(request(), { params: { classId: 'class' } })).json();
assert.equal(rosterData.students.length, 2, 'Class roster stays intact');
assert.equal(rosterData.students[0].slotProgress[0].enrolled, true);
assert.equal(rosterData.students[1].slotProgress[0].enrolled, false);
assert.equal(rosterData.students[1].slotProgress[1].enrolled, true);

const inviteDb = database([{ id: 'group', slotId: 'slot' }]);
const invite = load('src/app/api/student/groups/[groupId]/invite/route.ts', { ...common, '@/lib/db': inviteDb, '@/lib/helpers': scopedHelpers });
assert.equal((await invite.POST(request({ studentId: irregular }), { params: { groupId: 'group' } })).status, 403);
assert.equal(inviteDb.queries.filter(q => q.operation !== 'select').length, 0);
const acceptDb = database([{ id: 'invite', slotId: 'slot' }]);
const accept = load('src/app/api/student/invites/[inviteId]/respond/route.ts', { ...common, '@/lib/auth': studentAuth, '@/lib/db': acceptDb, '@/lib/helpers': scopedHelpers });
assert.equal((await accept.POST(request({ action: 'accept' }), { params: { inviteId: 'invite' } })).status, 403);
assert.equal(acceptDb.queries.filter(q => q.operation !== 'select').length, 0);
const profGroupDb = database();
const profGroup = load('src/app/api/classes/[classId]/students/[studentId]/group/route.ts', { ...common, '@/lib/db': profGroupDb, '@/lib/helpers': scopedHelpers });
assert.equal((await profGroup.POST(request({ slotId: 'slot' }), { params: { classId: 'class', studentId: irregular } })).status, 422);
assert.equal(profGroupDb.queries.length, 0);
console.log('PASS per-slot exclusions: class/student validation, grouped-student protection, unchanged class/other-slot enrollment, student visibility, no auto-solo/submission, invitations/acceptance and professor group assignment blocked');

for (const [file, method] of [['src/app/api/classes/[classId]/slots/route.ts', 'POST'], ['src/app/api/classes/[classId]/slots/[slotId]/route.ts', 'PATCH']]) {
  const mock = queued([[{ id: irregular }], []], [{ ...slot }]);
  const route = load(file, { ...common, '@/lib/db': mock, '@/lib/helpers': scopedHelpers });
  assert.equal((await route[method](request({ label: 'Subject', excludedStudentIds: [irregular] }, method), { params: { classId: 'class', slotId: 'slot' } })).status, method === 'POST' ? 201 : 200);
  const mutation = mock.queries.find(q => q.operation === (method === 'POST' ? 'insert' : 'update'));
  assert.equal(JSON.stringify((mutation.values || mutation.set).excludedStudentIds), JSON.stringify([irregular]));
}
console.log('PASS slot create/update persist enrollment exclusions without deleting students or projects');
