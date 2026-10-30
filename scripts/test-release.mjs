import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = readdirSync(new URL('.', import.meta.url)).filter(file =>
  (file.startsWith('test-') || file === 'security-review-offline.mjs') &&
  file.endsWith('.mjs') && !['test-release.mjs', 'test-release-browser.mjs'].includes(file) &&
  !/['"]playwright['"]/.test(readFileSync(new URL(file, import.meta.url), 'utf8'))
).sort();
const results = [];
for (const file of files) {
  const start = Date.now();
  const result = spawnSync(process.execPath, [`scripts/${file}`], { encoding: 'utf8', timeout: 90000 });
  const passed = result.status === 0;
  results.push({ file, passed, durationMs: Date.now() - start });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${file}`);
  if (!passed) console.error((result.stderr || result.stdout || result.error?.message || '').slice(-4000));
}
writeFileSync('docs/release-test-results.json', JSON.stringify({ version: JSON.parse(readFileSync('package.json', 'utf8')).version, offline: results }, null, 2) + '\n');
console.log(`${results.filter(result => result.passed).length}/${results.length} offline suites passed`);
if (results.some(result => !result.passed)) process.exitCode = 1;
