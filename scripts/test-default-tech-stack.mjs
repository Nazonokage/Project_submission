import assert from 'node:assert/strict';
import { load, database, common, helpers } from './test-phase14-16.mjs';
const request = (body, method = 'POST') => new Request('http://localhost', { method, body: JSON.stringify(body) });
const params = { params: { classId: 'class', slotId: 'slot' } };
const ruleHelpers = { ...helpers, assertSlotInClass: async () => ({ id: 'slot' }) };
for (const [file, method] of [
  ['src/app/api/classes/[classId]/slots/route.ts', 'POST'],
  ['src/app/api/classes/[classId]/slots/[slotId]/route.ts', 'PATCH'],
]) {
  for (const tags of [[' react ', 'React', 'nodejs', 'Custom Tool'], [], 'React', null, [42]]) {
    const mock = database([{ id: 'slot' }]);
    const route = load(file, { ...common, '@/lib/helpers': ruleHelpers, '@/lib/db': mock });
    const response = await route[method](request({ label: 'Project', defaultTechStack: tags }, method), params);
    const valid = Array.isArray(tags) && tags.every(tag => typeof tag === 'string');
    assert.equal(response.status, valid ? method === 'POST' ? 201 : 200 : 422);
    if (valid) {
      const mutation = mock.queries.find(q => q.operation === (method === 'POST' ? 'insert' : 'update'));
      const saved = (mutation.values || mutation.set).defaultTechStack;
      assert.equal(JSON.stringify(saved), JSON.stringify(tags.length ? ['React', 'Node.js', 'Custom Tool'] : []));
    } else assert.equal(mock.queries.length, 0);
  }
  const denied = database();
  const route = load(file, { ...common, '@/lib/db': denied, '@/lib/helpers': { ...ruleHelpers, assertClassOwnedByProf: async () => null } });
  assert.equal((await route[method](request({ label: 'Project', defaultTechStack: ['React'] }, method), params)).status, 404);
  assert.equal(denied.queries.length, 0);
}
console.log('PASS slot defaults: create/update/clear, normalization, invalid input, ownership checks');

for (const [tags, required, expected, expectedTags] of [
  [undefined, false, 201, ['React', 'Node.js']],
  [[], false, 201, []],
  [['python'], false, 201, ['Python']],
  [[], true, 422, null],
]) {
  const mock = database([{ id: 'title' }]);
  let selects = 0;
  mock.db.select = () => database(selects++ === 0 ? [{ group: { id: 'group' } }] : []).db.select();
  const route = load('src/app/api/student/titles/route.ts', {
    ...common, '@/lib/db': mock,
    '@/lib/titles-query': {},
    '@/lib/helpers': { ...helpers, assertSlotInClass: async () => ({ id: 'slot', defaultTechStack: ['React', 'Node.js'], requireTechStack: required, titlesAllowedMax: 5 }) },
    '@/lib/title-duplicates': { duplicateGuard: async () => null },
  });
  const response = await route.POST(request({ slotId: 'slot', text: 'My project', description: 'Project abstract', repoUrl: 'https://github.com/example/project', ...(tags === undefined ? {} : { techStack: tags }) }));
  assert.equal(response.status, expected);
  if (expectedTags) assert.equal(JSON.stringify(mock.queries.find(q => q.operation === 'insert').values.techStack), JSON.stringify(expectedTags));
  else assert.equal(mock.queries.length, 0);
}
const edited = database([{ id: 'member' }]);
const editRoute = load('src/app/api/student/titles/[titleId]/route.ts', {
  ...common, '@/lib/db': edited,
  '@/lib/titles-query': { selectTitleBy: async () => ({ id: 'title', classId: 'class', slotId: 'slot', groupId: 'group', status: 'verified', text: 'My project' }) },
});
assert.equal((await editRoute.PATCH(request({ description: 'Updated abstract', techStack: [] }, 'PATCH'), { params: { titleId: 'title' } })).status, 200);
const patch = edited.queries.find(q => q.operation === 'update').set;
assert.equal(JSON.stringify(patch.techStack), '[]');
assert.equal(patch.description, 'Updated abstract');
assert.equal(patch.status, undefined);
console.log('PASS student choice: omitted tags use defaults, explicit removals/replacements persist, required rule respected, approved project descriptions remain editable');
