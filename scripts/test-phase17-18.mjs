import assert from 'node:assert/strict';
import { PgDialect } from 'drizzle-orm/pg-core';
import { load, database, common, schema, helpers, auth } from './test-phase14-16.mjs';

const { normalizeTechStack } = load('src/lib/tech-stack.ts');
assert.equal(JSON.stringify(normalizeTechStack([' React ', 'react', 'REACT', '', ' Node.js ', null, 42])), JSON.stringify(['React', 'Node.js']));
assert.equal(JSON.stringify(normalizeTechStack(null)), '[]');
let query;
const tags = load('src/lib/tech-tags.ts', { ...common, '@/lib/db': { db: { execute: async sql => { query = sql; return { rows: [{ tag: 'React' }] }; } } } });
assert.equal(JSON.stringify(await tags.getTechTags('class', 'slot')), '["React"]');
const sql = new PgDialect().sqlToQuery(query);
assert.match(sql.sql, /unnest/);
assert.match(sql.sql, /"class_id"/);
assert.match(sql.sql, /"slot_id"/);
assert.match(sql.sql, /"deleted_at" IS NULL/);
assert.match(sql.sql, /GROUP BY lower/);
assert.ok(sql.params.includes('class') && sql.params.includes('slot'));
console.log('PASS tag normalization and slot-scoped SQL, excluding deleted titles');
let tagCalls = 0;
const tagHelper = { getTechTags: async () => { tagCalls++; return ['React']; } };
const params = { params: { slotId: 'slot' } };
for (const role of ['student', 'prof']) {
  const file = `src/app/api/${role}/slots/[slotId]/tech-tags/route.ts`;
  const db = database([{ id: 'slot', classId: 'class' }]);
  const base = { ...common, '@/lib/db': db, '@/lib/tech-tags': tagHelper };
  const unauth = load(file, { ...base, '@/lib/auth': { getStudentSession: async () => null, getProfSession: async () => null } });
  assert.equal((await unauth.GET(new Request('http://localhost'), params)).status, 401);
  const forbidden = load(file, { ...base, '@/lib/helpers': { ...helpers, assertSlotInClass: async () => null, assertClassOwnedByProf: async () => null } });
  assert.equal((await forbidden.GET(new Request('http://localhost'), params)).status, 404);
  assert.equal(tagCalls, role === 'student' ? 0 : 1);
  const allowed = load(file, { ...base, '@/lib/helpers': { ...helpers, assertSlotInClass: async () => ({ id: 'slot', classId: 'class' }) } });
  assert.equal((await allowed.GET(new Request('http://localhost'), params)).status, 200);
}
console.log('PASS student/professor suggestion authentication and ownership');
for (const file of ['src/app/api/student/titles/[titleId]/route.ts', 'src/app/api/dashboard/titles/[titleId]/route.ts']) {
  const db = database([{ id: 'member' }]);
  const route = load(file, { ...common, '@/lib/db': db, '@/lib/title-duplicates': { duplicateGuard: async () => null }, '@/lib/titles-query': { selectTitleBy: async () => ({ id: 'title', classId: 'class', slotId: 'slot', groupId: 'group', status: 'pending', text: 'Original title' }) } });
  const res = await route.PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ techStack: [' React ', 'react', 'Custom'] }) }), { params: { titleId: 'title' } });
  assert.equal(res.status, 200);
  assert.equal(JSON.stringify(db.queries.find(q => q.operation === 'update').set.techStack), '["React","Custom"]');
}
console.log('PASS student/professor edit routes persist normalized tags');
