import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import * as jose from 'jose';
import { load, database, common, helpers } from './test-phase14-16.mjs';
const require = createRequire(import.meta.url);
const secret = 'isolated-remember-browser-test-secret';
const jar = new Map();
const writes = [];
const remember = {};
const source = ts.transpileModule(readFileSync('src/lib/prof-remember.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
vm.runInNewContext(`(function(require, exports) { ${source}\n})`, { process: { env: { JWT_SECRET: secret, NODE_ENV: 'production' } } })(name => {
  if (name === 'next/headers') return { cookies: async () => ({ get: key => jar.has(key) ? { value: jar.get(key) } : undefined, set: (key, value, options) => { jar.set(key, value); writes.push(options); }, delete: key => jar.delete(key) }) };
  return require(name);
}, remember);
const identity = { profId: 'prof', email: 'prof@example.com' };
await remember.rememberProf(identity);
assert.equal(JSON.stringify(await remember.getRememberedProf()), JSON.stringify(identity));
const token = jar.get(remember.PROF_REMEMBER_COOKIE);
const claims = jose.decodeJwt(token);
assert.equal(claims.exp - claims.iat, 7 * 86400);
assert.deepEqual(JSON.parse(JSON.stringify(writes[0])), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 7 * 86400 });
assert.equal(await remember.verifyRememberedProf(token.slice(0, -12) + 'tampered'), null);
const key = createHmac('sha256', secret).update('professor-remember-device-v1').digest();
const expired = await new jose.SignJWT(identity).setProtectedHeader({ alg: 'HS256' }).setAudience('professor-remember-device').setExpirationTime(1).sign(key);
assert.equal(await remember.verifyRememberedProf(expired), null);
const wrongAudience = await new jose.SignJWT(identity).setProtectedHeader({ alg: 'HS256' }).setAudience('session').setExpirationTime('7d').sign(key);
assert.equal(await remember.verifyRememberedProf(wrongAudience), null);
await assert.rejects(jose.jwtVerify(token, new TextEncoder().encode(secret)), 'Trust cookie must not be accepted as a dashboard session');
const normalSession = await new jose.SignJWT(identity).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('7d').sign(new TextEncoder().encode(secret));
assert.equal(await remember.verifyRememberedProf(normalSession), null);
await remember.forgetProf();
assert.equal(await remember.getRememberedProf(), null);
console.log('PASS trust cookie: 7-day expiry, secure HTTP-only settings, tamper/expiry/audience rejection, session-token separation, forgetting');

const request = (body) => new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) });
function loginSetup({ trusted = identity, session = null, rows = [{ id: 'prof', email: identity.email }], limited = null } = {}) {
  const mock = database(rows);
  const issued = [];
  let emails = 0;
  let rateChecks = 0;
  const route = load('src/app/api/auth/request-otp/route.ts', {
    ...common, '@/lib/db': mock,
    '@/lib/auth': { getProfSession: async () => session, signProfToken: async (payload, remembered) => { issued.push({ payload, remembered }); return 'session'; }, setProfCookie: async () => {} },
    '@/lib/prof-remember': { getRememberedProf: async () => trusted },
    '@/lib/helpers': { ...helpers, generateOtp: () => '123456', cleanupProfessorOtps: async () => {} },
    '@/lib/mailer': { sendOtpEmail: async () => { emails++; } },
    '@/lib/rate-limit': { assertOtpRateLimit: async () => { rateChecks++; return limited; } },
  });
  return { route, mock, issued, emails: () => emails, rateChecks: () => rateChecks };
}
const returning = loginSetup();
const signedIn = await returning.route.POST(request({ email: ' PROF@example.com ' }));
assert.equal((await signedIn.json()).authenticated, true);
assert.equal(returning.emails(), 0);
assert.equal(returning.rateChecks(), 0);
assert.equal(returning.issued[0].remembered, true);
assert.equal(returning.mock.queries.filter(q => q.operation !== 'select').length, 0);
for (const config of [{ trusted: null }, { trusted: { ...identity, email: 'another@example.com' } }, { rows: [] }]) {
  const fallback = loginSetup(config);
  assert.equal((await (await fallback.route.POST(request({ email: identity.email }))).json()).authenticated, undefined);
  assert.equal(fallback.issued.length, 0);
  assert.equal(fallback.emails(), 1);
}
const invalid = loginSetup();
assert.equal((await invalid.route.POST(request({ email: 42 }))).status, 422);
assert.equal(invalid.mock.queries.length, 0);
const limited = loginSetup({ trusted: null, limited: new Response(null, { status: 429 }) });
assert.equal((await limited.route.POST(request({ email: identity.email }))).status, 429);
assert.equal(limited.emails(), 0);
console.log('PASS returning login skips OTP only for a matching remembered professor; new browsers, other emails, missing accounts fall back to rate-limited OTP');

for (const checked of [true, false]) {
  const mock = database([{ id: 'otp' }]);
  let selects = 0;
  mock.db.select = () => database(selects++ ? [{ id: 'prof', email: identity.email, name: 'Professor' }] : [{ id: 'otp' }]).db.select();
  const actions = [];
  const verify = load('src/app/api/auth/verify-otp/route.ts', {
    ...common, '@/lib/db': mock,
    '@/lib/helpers': { ...helpers, cleanupProfessorOtps: async () => {} },
    '@/lib/auth': { signProfToken: async () => 'session', setProfCookie: async () => actions.push('session') },
    '@/lib/rate-limit': { assertActionRateLimit: async () => null },
    '@/lib/prof-remember': { rememberProf: async () => actions.push('remember'), forgetProf: async () => actions.push('forget') },
  });
  assert.equal((await verify.POST(request({ email: identity.email, otp: '123456', rememberMe: checked }))).status, 200);
  assert.deepEqual(actions, ['session', checked ? 'remember' : 'forget']);
}
const actions = [];
const logout = load('src/app/api/auth/logout/route.ts', { '@/lib/auth': { clearProfCookie: async () => actions.push('session') } });
await logout.POST();
assert.deepEqual(actions, ['session']);
const device = load('src/app/api/auth/remember-device/route.ts', { '@/lib/prof-remember': { forgetProf: async () => actions.push('trust') }, '@/lib/auth': { clearProfCookie: async () => actions.push('session') } });
await device.DELETE();
assert.deepEqual(actions, ['session', 'trust', 'session']);
console.log('PASS OTP establishes trust only when checked; ordinary logout preserves trust; Forget this browser removes trust and session');
