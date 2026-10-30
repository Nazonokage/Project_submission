import assert from 'node:assert/strict';
import { load, database, common } from './test-phase14-16.mjs';
const { isGithubRepoUrl, projectRequirementsError } = load('src/lib/project-readiness.ts');
for (const url of ['', 'https://example.com/a/b', 'https://github.com/a', 'https://github.com.evil.test/a/b', 'http://github.com/a/b', 'https://user:pass@github.com/a/b']) assert.equal(isGithubRepoUrl(url), false, url);
assert.equal(isGithubRepoUrl(' https://github.com/owner/project.git '), true);
assert.ok(projectRequirementsError({ description: ' ', repoUrl: 'https://github.com/a/b' }));
const request = body => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body) });
for (const status of ['pending', 'rejected', 'verified']) {
 const title = { id: 'title', classId: 'class', slotId: 'slot', groupId: 'group', text: 'Project title', status, description: '', repoUrl: null };
 const db = database([{ id: 'member' }]);
 const mocks = { ...common, '@/lib/db': db, '@/lib/titles-query': { selectTitleBy: async () => title } };
 const route = load('src/app/api/student/titles/[titleId]/route.ts', mocks);
 const blockedStatus = status === 'verified' ? 428 : 403;
 assert.equal((await route.PATCH(request({ progressStatus: 'planning' }), { params: { titleId: 'title' } })).status, blockedStatus);
 assert.equal((await route.PATCH(request({ description: 'An abstract', repoUrl: 'https://github.com/owner/project' }), { params: { titleId: 'title' } })).status, 200);
 assert.equal(db.queries.find(q => q.operation === 'update').set.repoUrl, 'https://github.com/owner/project');
 assert.equal((await route.PATCH(request({ repoUrl: 'https://example.com/a/b' }), { params: { titleId: 'title' } })).status, 422);
 const gate = load('src/lib/student-project-access.ts', mocks);
 assert.equal((await gate.requireStudentProjectReady('title','class')).status, blockedStatus);
 for (const file of ['src/app/api/student/tasks/route.ts', 'src/app/api/student/updates/route.ts', 'src/app/api/student/titles/[titleId]/reports/route.ts']) {
  const incomplete = database([title]);
  const tools = load(file, { ...mocks, '@/lib/db': incomplete });
  const response = await tools.POST(request({ titleId: 'title', name: 'Task', body: 'Update', kind: 'progress', headline: 'Progress' }), { params: { titleId: 'title' } });
  assert.equal(response.status, file.includes('/reports/') ? 428 : blockedStatus, file);
  assert.equal(incomplete.queries.some(q => q.operation === 'insert'), false);
 }
}
console.log('PASS required info blocks tools for pending/rejected/approved titles; form remains editable; invalid GitHub URLs rejected');
