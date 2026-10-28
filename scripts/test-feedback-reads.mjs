import assert from 'node:assert/strict';
import { PgDialect } from 'drizzle-orm/pg-core';
import { load, database, common } from './test-phase14-16.mjs';
const id = '11111111-1111-4111-8111-111111111111';
const request = body => new Request('http://localhost/api/student/notifications', { method: 'PATCH', body: JSON.stringify(body) });
function mock(rows) {
 const result = database(rows);
 const insert = result.db.insert;
 result.db.insert = () => { const chain = insert(); chain.onConflictDoNothing = () => { result.queries.at(-1).ignoreConflict = true; return chain; }; return chain; };
 return result;
}
for (const permitted of [false, true]) {
 const db = mock(permitted ? [{ id }] : []);
 const route = load('src/app/api/student/notifications/route.ts', { ...common, '@/lib/db': db });
 assert.equal((await route.PATCH(request({ feedbackId: id, studentId: 'someone-else' }))).status, permitted ? 200 : 404);
 const sql = new PgDialect().sqlToQuery(db.queries[0].where);
 assert.ok(sql.params.includes('class')); assert.match(sql.sql, /deleted_at.*is null/);
 assert.equal(db.queries.some(q => q.operation === 'update'), false, 'Never resolves feedback');
 if (permitted) {
  const insert = db.queries.find(q => q.operation === 'insert');
  assert.equal(insert.values.studentId, 'student'); assert.equal(insert.values.feedbackId, id); assert.equal(insert.ignoreConflict, true);
  assert.equal((await route.PATCH(request({ feedbackId: id }))).status, 200);
 } else assert.equal(db.queries.some(q => q.operation === 'insert'), false);
}
const db = mock([]);
const route = load('src/app/api/student/notifications/route.ts', { ...common, '@/lib/db': db });
for (const feedbackId of [null, '', 'not-a-uuid', 12]) assert.equal((await route.PATCH(request({ feedbackId }))).status, 422);
assert.equal(db.queries.length, 0);
const anon = load('src/app/api/student/notifications/route.ts', { ...common, '@/lib/db': db, '@/lib/auth': { getStudentSession: async () => null } });
assert.equal((await anon.PATCH(request({ feedbackId: id }))).status, 401);
console.log('PASS read receipts: authentication, membership/class/deleted-title scope, session-owned writes, idempotency, validation, no feedback resolution');
