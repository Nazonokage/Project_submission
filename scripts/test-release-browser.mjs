// Runs only synthetic browser fixtures, against a dedicated local server.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

if (!existsSync('.next/BUILD_ID')) throw new Error('Run npm run build before browser release tests');
const listener = createServer();
await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const env = { ...process.env, JWT_SECRET: 'phase14-16-local-test-only',
  DATABASE_URL: 'postgresql://synthetic:synthetic@localhost.invalid/test',
  DATABASE_URL_POOLED: 'postgresql://synthetic:synthetic@localhost.invalid/test',
  GMAIL_USER: 'synthetic@example.invalid', GMAIL_APP_PASSWORD: 'synthetic-not-a-password',
  TEST_BASE_URL: `http://127.0.0.1:${port}`, APP_ORIGIN: `http://127.0.0.1:${port}`,
};
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], { env, stdio: 'ignore' });
const results = [];
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (server.exitCode !== null) throw new Error('Isolated test server exited');
    try { if ((await fetch(env.TEST_BASE_URL, { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('Isolated test server did not start');
  const files = readdirSync('scripts').filter(file => file.startsWith('test-') && file.endsWith('.mjs') &&
    !['test-release.mjs', 'test-release-browser.mjs'].includes(file) && /['"]playwright['"]/.test(readFileSync(`scripts/${file}`, 'utf8'))).sort();
  for (const file of files) {
    console.log(`RUN ${file}`);
    const start = Date.now();
    const result = spawnSync(process.execPath, [`scripts/${file}`], { env, encoding: 'utf8', timeout: 240000 });
    const passed = result.status === 0;
    results.push({ file, passed, durationMs: Date.now() - start });
    console.log(`${passed ? 'PASS' : 'FAIL'} ${file}`);
    if (!passed) console.error((result.stderr || result.stdout || result.error?.message || '').slice(-5000));
  }
} finally { server.kill(); }
const prior = existsSync('docs/release-test-results.json') ? JSON.parse(readFileSync('docs/release-test-results.json', 'utf8')) : {};
writeFileSync('docs/release-test-results.json', JSON.stringify({ ...prior, browser: results }, null, 2) + '\n');
console.log(`${results.filter(result => result.passed).length}/${results.length} browser suites passed`);
if (results.some(result => !result.passed)) process.exitCode = 1;
