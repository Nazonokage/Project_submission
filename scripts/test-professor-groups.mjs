import assert from 'node:assert/strict';
import { PgDialect } from 'drizzle-orm/pg-core';
import { load, database, common, helpers } from './test-phase14-16.mjs';
const file = 'src/app/api/classes/[classId]/students/[studentId]/group/route.ts';
const studentId = '11111111-1111-4111-8111-111111111111';
const peerId = '22222222-2222-4222-8222-222222222222';
const params = { params: { classId: '33333333-3333-4333-8333-333333333333', studentId } };
const slotId = '44444444-4444-4444-8444-444444444444';
const req = body => new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) });
function setup({ members = [], result = [{ groupId: 'group' }], overrides = {} } = {}) {
  const db = database(members); const statements = []; let batches = 0;
  db.db.execute = query => { statements.push(query); return query; };
  db.db.batch = async () => { batches++; return [{ rows: [] }, { rows: result }, { rows: [] }]; };
  const route = load(file, { ...common, '@/lib/db': db, '@/lib/helpers': { ...helpers, assertStudentInClass: async () => ({ id: studentId }), assertSlotInClass: async () => ({ id: slotId, groupSize: 2 }) }, ...overrides });
  return { route, statements, batches: () => batches };
}
const solo = setup();
assert.equal((await solo.route.POST(req({ slotId }), params)).status, 201);
assert.equal(solo.batches(), 1);
const sql = new PgDialect().sqlToQuery(solo.statements[1]);
assert.match(sql.sql, /INSERT INTO groups/);
assert.match(sql.sql, /INSERT INTO student_group_slots/);
assert.match(sql.sql, /class_id/);
assert.match(sql.sql, /m.group_id <>/);
assert.match(sql.sql, /<= p.group_size/);
assert.match(sql.sql, /group_invites/);
assert.ok(sql.params.includes(studentId));
const existing = setup({ members: [{ groupId: '55555555-5555-4555-8555-555555555555' }] });
assert.equal((await existing.route.POST(req({ slotId, memberIds: [peerId] }), params)).status, 200);
const invalid = setup();
assert.equal((await invalid.route.POST(req({ slotId, memberIds: ['bad-id'] }), params)).status, 422);
assert.equal((await invalid.route.POST(req({ slotId, memberIds: [peerId, '66666666-6666-4666-8666-666666666666'] }), params)).status, 422);
assert.equal(invalid.batches(), 0);
const conflict = setup({ result: [] });
assert.equal((await conflict.route.POST(req({ slotId, memberIds: [peerId] }), params)).status, 409);
const unauth = setup({ overrides: { '@/lib/auth': { getProfSession: async () => null } } });
assert.equal((await unauth.route.POST(req({ slotId }), params)).status, 401);
assert.equal(unauth.batches(), 0);
const forbidden = setup({ overrides: { '@/lib/helpers': { ...helpers, assertClassOwnedByProf: async () => null } } });
assert.equal((await forbidden.route.POST(req({ slotId }), params)).status, 404);
assert.equal(forbidden.batches(), 0);
console.log('PASS professor group auth, solo/create and add modes, member validation, capacity conflict and atomic SQL scoping');

if (process.argv.includes('--explain')) {
  process.loadEnvFile('.env.local');
  const { neon } = await import('@neondatabase/serverless');
  const connection = neon(process.env.DATABASE_URL_POOLED);
  // EXPLAIN without ANALYZE only plans the statement; readOnly enforces no writes.
  await connection.transaction([connection('EXPLAIN ' + sql.sql, sql.params)], { readOnly: true });
  console.log('PASS database validates atomic group SQL with read-only EXPLAIN; no writes');
}
