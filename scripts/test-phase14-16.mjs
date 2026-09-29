import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { PgDialect } from 'drizzle-orm/pg-core';
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(`(function(require, exports) { ${code}\n})`, { Response, Request, console, Date, URL })(name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`, mocks);
    return require(name);
  }, exports);
  return exports;
}
const schema = load('src/lib/schema.ts');
const next = require('next/server');
const helpers = { jsonError: (error, status) => next.NextResponse.json({ error }, { status }), assertSlotInClass: async () => ({ duplicateCheck: 'strict' }), assertClassOwnedByProf: async () => ({ name: 'Test Class' }) };
const auth = { getStudentSession: async () => ({ studentId: 'student', classId: 'class' }), getProfSession: async () => ({ profId: 'prof' }) };
function database(rows = []) {
  const queries = [];
  const db = {};
  for (const operation of ['select', 'insert', 'update', 'delete']) db[operation] = () => {
    const query = { operation };
    queries.push(query);
    const chain = {};
    for (const name of ['from', 'where', 'limit', 'values', 'set', 'returning', 'orderBy', 'innerJoin', 'leftJoin']) chain[name] = value => { query[name] = value; return chain; };
    chain.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
    return chain;
  };
  return { db, queries };
}
const request = body => new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const common = { '@/lib/auth': auth, '@/lib/schema': schema, '@/lib/helpers': helpers, '@/lib/project-updates': { logProgressChange: async () => {} }, '@/lib/rate-limit': { assertActionRateLimit: async () => null } };
const similarDb = database([{ id: 'duplicate', text: 'Inventory manager' }]);
const duplicate = load('src/lib/title-duplicates.ts', { ...common, '@/lib/db': similarDb });
await duplicate.findSimilarTitles('class', 'slot', 'Inventory %_', 'self');
const compiled = new PgDialect().sqlToQuery(similarDb.queries[0].where);
assert.match(compiled.sql, /"class_id"/);
assert.match(compiled.sql, /"slot_id"/);
assert.match(compiled.sql, /"deleted_at" is null/);
assert.match(compiled.sql, /"id" <>/);
assert.match(compiled.sql, /similarity/);
assert.match(compiled.sql, /strpos/);
assert.ok(compiled.params.includes('Inventory %_'));
assert.equal((await duplicate.duplicateGuard('class', 'slot', 'Inventory', 'strict', true)).status, 409);
assert.equal((await (await duplicate.duplicateGuard('class', 'slot', 'Inventory', 'warn', false)).json()).requiresConfirmation, true);
assert.equal(await duplicate.duplicateGuard('class', 'slot', 'Inventory', 'warn', true), null);
console.log('PASS similarity: class/slot scoping, deleted/self exclusion, literal wildcard handling, strict/warn confirmation');
for (const file of ['src/app/api/student/titles/route.ts', 'src/app/api/dashboard/titles/route.ts']) {
  const db = database();
  const route = load(file, { ...common, '@/lib/db': db, '@/lib/title-duplicates': duplicate, '@/lib/titles-query': {} });
  for (const text of ['', '    ', 'abcd', 123]) {
    const response = await route.POST(request({ classId: 'class', groupId: 'group', slotId: 'slot', text, description: 'Description' }));
    assert.equal(response.status, 422, `${file}: ${JSON.stringify(text)}`);
  }
  assert.equal(db.queries.length, 0);
}
const title = { id: 'title', text: 'Original title', classId: 'class', slotId: 'slot', groupId: 'group', status: 'pending' };
for (const file of ['src/app/api/student/titles/[titleId]/route.ts', 'src/app/api/dashboard/titles/[titleId]/route.ts']) {
  const db = database([{ id: 'membership' }]);
  const route = load(file, { ...common, '@/lib/db': db, '@/lib/title-duplicates': duplicate, '@/lib/titles-query': { selectTitleBy: async () => title } });
  for (const text of ['', '   ', 'abcd', 123]) assert.equal((await route.PATCH(request({ text }), { params: { titleId: 'title' } })).status, 422);
  assert.equal((await route.PATCH(request({ text: 'Inventory manager' }), { params: { titleId: 'title' } })).status, 409);
  assert.equal(db.queries.some(q => q.operation === 'update'), false);
}
console.log('PASS title routes: blank, whitespace, short and non-string input rejected; strict duplicate edit rejected');
const classDb = database();
const classes = load('src/app/api/classes/[classId]/route.ts', { ...common, '@/lib/db': classDb });
for (const confirmName of [undefined, '', 'Wrong', 42]) assert.equal((await classes.DELETE(request({ confirmName }), { params: { classId: 'class' } })).status, 400);
assert.equal(classDb.queries.length, 0);
assert.equal((await classes.DELETE(request({ confirmName: 'Test Class' }), { params: { classId: 'class' } })).status, 200);
assert.equal(classDb.queries[0].operation, 'delete');
console.log('PASS class deletion: invalid confirmation cannot reach delete');
const feedDb = database([{ classId: 'other-class' }]);
const feed = load('src/app/api/prof/updates/route.ts', { ...common, '@/lib/db': feedDb, '@/lib/helpers': { ...helpers, assertClassOwnedByProf: async () => null } });
assert.equal((await feed.GET(new Request('http://localhost/api/prof/updates?titleId=foreign-title'))).status, 403);
assert.equal(feedDb.queries.length, 1, 'Ownership checked before reading updates');
console.log('PASS professor update feed: rejects another professor\'s class before reading activity');


const listDb = database();
const list = load('src/app/api/classes/route.ts', { ...common, '@/lib/db': listDb });
await list.GET(new next.NextRequest('http://localhost/api/classes'));
await list.GET(new next.NextRequest('http://localhost/api/classes?includeArchived=1'));
const normalList = new PgDialect().sqlToQuery(listDb.queries[0].where).sql;
const archivedList = new PgDialect().sqlToQuery(listDb.queries[1].where).sql;
assert.match(normalList, /"archived_at" is null/);
assert.match(normalList, /"prof_id"/);
assert.doesNotMatch(archivedList, /"archived_at"/);
assert.match(archivedList, /"prof_id"/);
console.log('PASS class list: hides archived by default; explicit inclusion still filters ownership');

export { load, database, common, schema, helpers, auth };
