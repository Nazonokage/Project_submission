// Exercise the current ORM schema and release migrations against isolated PostgreSQL.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { drizzle } from 'drizzle-orm/pglite';
import { PgDialect } from 'drizzle-orm/pg-core';
import { migrationStatements } from './lib/sql-migration.mjs';
import { prepareStudentPassword } from './lib/student-password-migration.mjs';
import { load, common, schema } from './test-phase14-16.mjs';

const exported = spawnSync(process.execPath, ['node_modules/drizzle-kit/bin.cjs', 'export', '--dialect', 'postgresql', '--schema', 'src/lib/schema.ts'], { encoding: 'utf8', timeout: 30000 });
assert.equal(exported.status, 0, exported.stderr);
assert.match(exported.stdout, /^CREATE TABLE/);
const pg = new PGlite({ extensions: { pg_trgm } });
try {
  await pg.exec('CREATE EXTENSION pg_trgm');
  await pg.exec(exported.stdout);
  for (let pass = 0; pass < 2; pass++) {
    for (const file of ['consolidate_project_description.sql', 'enforce_approval_planning.sql', 'security_hardening.sql', 'add_password_encryption.sql']) {
      await pg.transaction(async tx => {
        for (const statement of migrationStatements(readFileSync(file, 'utf8'))) await tx.exec(statement);
      });
    }
  }
  const [{ id: prof }] = (await pg.query("INSERT INTO professors (name,email) VALUES ('Fixture Professor','fixture@example.invalid') RETURNING id")).rows;
  const [{ id: classId }] = (await pg.query("INSERT INTO classes (prof_id,name,term) VALUES ($1,'Release Fixture','Test term') RETURNING id", [prof])).rows;
  const [{ id: slot }] = (await pg.query("INSERT INTO project_slots (class_id,label,group_size) VALUES ($1,'Release Slot',2) RETURNING id", [classId])).rows;
  const { password: preservedHash } = await prepareStudentPassword({ password: '2026' });
  const [{ id: student }] = (await pg.query("INSERT INTO students (class_id,name,id_number,password) VALUES ($1,'Fixture Student','0001',$2) RETURNING id", [classId, preservedHash])).rows;
  const [{ id: peer }] = (await pg.query("INSERT INTO students (class_id,name,id_number,password) VALUES ($1,'Fixture Peer','0002',$2) RETURNING id", [classId, preservedHash])).rows;
  const [{ id: group }] = (await pg.query("INSERT INTO groups (class_id,slot_id,max_size) VALUES ($1,$2,2) RETURNING id", [classId, slot])).rows;
  await pg.query('INSERT INTO student_group_slots (student_id,group_id,slot_id) VALUES ($1,$2,$3)', [student, group, slot]);
  const [{ id: invite }] = (await pg.query('INSERT INTO group_invites (group_id,class_id,slot_id,invited_student_id,invited_by_student_id) VALUES ($1,$2,$3,$4,$5) RETURNING id', [group, classId, slot, peer, student])).rows;
  assert.equal((await pg.query('SELECT accept_project_invite($1,$2,$3) AS result', [invite, peer, classId])).rows[0].result.ok, true);
  const [{ id: title }] = (await pg.query("INSERT INTO titles (class_id,slot_id,group_id,text,description,repo_url,status,added_by,submitted_by_student_id) VALUES ($1,$2,$3,'Release fixture project','Fixture abstract','https://github.com/example/project','verified','student',$4) RETURNING id", [classId, slot, group, student])).rows;
  await pg.query("INSERT INTO tasks (title_id,group_id,class_id,slot_id,name,assignee_student_id) VALUES ($1,$2,$3,$4,'Fixture task',$5)", [title, group, classId, slot, student]);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM tasks WHERE title_id=$1', [title])).rows[0].n, 1);

  const db = drizzle(pg, { schema });
  // Emulate Neon's HTTP transaction batching with the same compiled SQL, while
  // all execution stays inside the isolated PostgreSQL instance.
  const dialect = new PgDialect();
  db.batch = statements => pg.transaction(async tx => {
    const results = [];
    for (const statement of statements) {
      const query = statement.toSQL ? statement.toSQL() : dialect.sqlToQuery(statement.getSQL());
      results.push(await tx.query(query.sql, query.params));
    }
    return results;
  });
  const jar = new Map();
  const cookieApi = { cookies: async () => ({
    get: key => jar.has(key) ? { value: jar.get(key) } : undefined,
    set: (key, value) => jar.set(key, value), delete: key => jar.delete(key),
  }) };
  const auth = load('src/lib/auth.ts', { ...common, '@/lib/db': { db }, 'next/headers': cookieApi });
  const login = load('src/app/api/student/login/route.ts', { ...common, '@/lib/db': { db }, '@/lib/auth': auth });
  const request = password => new Request('http://fixture.invalid/api/student/login', { method: 'POST', body: JSON.stringify({ classId, idNumber: '0001', password }) });
  assert.equal((await login.POST(request('wrong-password'))).status, 401);
  assert.equal((await login.POST(request('2026'))).status, 200);
  assert.ok(jar.has('student_token'));
  assert.equal((await auth.getStudentSession()).studentId, student);
  await pg.query('UPDATE students SET is_active=false WHERE id=$1', [student]);
  assert.equal(await auth.getStudentSession(), null);
  assert.equal((await login.POST(request('2026'))).status, 401);
  await pg.query('UPDATE students SET is_active=true WHERE id=$1', [student]);
  const { password: replacement } = await prepareStudentPassword({ password: 'replacement-test-password' });
  await pg.query('UPDATE students SET password=$1 WHERE id=$2', [replacement, student]);
  assert.equal(await auth.getStudentSession(), null);
  assert.equal((await login.POST(request('2026'))).status, 401);
  assert.equal((await login.POST(request('replacement-test-password'))).status, 200);
  assert.equal((await auth.getStudentSession()).studentId, student);
  console.log('PASS actual ORM schema + all release migrations twice; group acceptance/task persistence; migrated existing password login; real signed cookie/session lookup; inactive and reset sessions denied');

  const helpers = load('src/lib/helpers.ts', { ...common, '@/lib/db': { db } });
  const rateLimits = load('src/lib/rate-limit.ts', { ...common, '@/lib/db': { db } });
  const remember = load('src/lib/prof-remember.ts', { 'next/headers': cookieApi });
  const mail = [];
  const services = { ...common, '@/lib/db': { db }, '@/lib/helpers': helpers,
    '@/lib/auth': auth, '@/lib/rate-limit': rateLimits, '@/lib/prof-remember': remember,
    '@/lib/mailer': { sendOtpEmail: async (email, code) => mail.push({ email, code }) },
  };
  const requestOtp = load('src/app/api/auth/request-otp/route.ts', services);
  const verifyOtp = load('src/app/api/auth/verify-otp/route.ts', services);
  const professorEmail = 'fixture@example.invalid';
  const post = body => new Request('http://fixture.invalid/api/auth/test', { method: 'POST', body: JSON.stringify(body) });
  assert.equal((await requestOtp.POST(post({ email: professorEmail }))).status, 200);
  assert.equal(mail.length, 1);
  assert.match(mail[0].code, /^\d{6}$/);
  assert.notEqual((await pg.query('SELECT otp FROM professor_otps WHERE email=$1', [professorEmail])).rows[0].otp, mail[0].code);
  assert.equal((await verifyOtp.POST(post({ email: professorEmail, otp: '000000' }))).status, 401);
  assert.equal((await verifyOtp.POST(post({ email: professorEmail, otp: mail[0].code, rememberMe: true }))).status, 200);
  assert.equal((await auth.getProfSession()).profId, prof);
  assert.equal((await remember.getRememberedProf()).email, professorEmail);
  assert.equal((await verifyOtp.POST(post({ email: professorEmail, otp: mail[0].code }))).status, 401);
  await auth.clearProfCookie();
  const returning = await requestOtp.POST(post({ email: professorEmail }));
  assert.equal((await returning.json()).authenticated, true);
  assert.equal(mail.length, 1, 'Remembered browser must not send another email');
  assert.equal((await auth.getProfSession()).profId, prof);
  await remember.forgetProf(); await auth.clearProfCookie();
  assert.equal((await requestOtp.POST(post({ email: professorEmail }))).status, 200);
  assert.equal(mail.length, 2, 'Forgetting trust restores OTP login');
  await pg.query("UPDATE professor_otps SET expires_at=now()-interval '1 minute' WHERE email=$1", [professorEmail]);
  assert.equal((await verifyOtp.POST(post({ email: professorEmail, otp: mail[1].code }))).status, 401);
  assert.equal(await auth.getProfSession(), null);
  for (let i = 0; i < 5; i++) assert.equal((await verifyOtp.POST(post({ email: 'blocked@example.invalid', otp: '000000' }))).status, 401);
  assert.equal((await verifyOtp.POST(post({ email: 'blocked@example.invalid', otp: '000000' }))).status, 429);
  console.log('PASS professor OTP issuance/digest/verification and signed session; wrong/expired/replayed codes denied; remembered browser skips email; forget restores OTP; real verification limiter blocks guessing (SMTP delivery simulated)');

  await auth.setProfCookie(await auth.signProfToken({ profId: prof, email: professorEmail }));
  const createStudent = load('src/app/api/classes/[classId]/students/route.ts', services);
  const importStudents = load('src/app/api/classes/[classId]/students/import/route.ts', services);
  const liveLogin = load('src/app/api/student/login/route.ts', services);
  const profile = load('src/app/api/student/me/route.ts', services);
  const createdResponse = await createStudent.POST(post({ name: 'New Fixture Student' }), { params: Promise.resolve({ classId }) });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal('password' in created.student, false);
  assert.equal('passwordEncrypted' in created.student, false);
  assert.equal(created.initialPassword, '2026');
  const importedResponse = await importStudents.POST(post({ names: ['Imported Fixture One', 'Imported Fixture Two'] }), { params: Promise.resolve({ classId }) });
  assert.equal(importedResponse.status, 201);
  const imported = await importedResponse.json();
  assert.equal(imported.count, 2);
  assert.ok(imported.credentials.every(c => c.initialPassword === '2026'));
  for (const credential of [{ idNumber: created.student.idNumber, initialPassword: created.initialPassword }, ...imported.credentials]) {
    const response = await liveLogin.POST(post({ classId, idNumber: credential.idNumber, password: credential.initialPassword, rememberMe: true }));
    assert.equal(response.status, 200);
    assert.ok(await auth.getStudentSession());
  }
  const last = imported.credentials.at(-1);
  const tokenBeforeChange = jar.get('student_token');
  const changed = await profile.PATCH(post({ currentPassword: last.initialPassword, newPassword: 'changed-fixture-password' }));
  assert.equal(changed.status, 200);
  assert.equal(jar.has('student_token'), false);
  jar.set('student_token', tokenBeforeChange);
  assert.equal(await auth.getStudentSession(), null);
  assert.equal((await liveLogin.POST(post({ classId, idNumber: last.idNumber, password: last.initialPassword }))).status, 401);
  assert.equal((await liveLogin.POST(post({ classId, idNumber: last.idNumber, password: 'changed-fixture-password' }))).status, 200);
  assert.ok(await auth.getStudentSession());
  console.log('PASS newly created/imported students authenticate using issued credentials; password-change endpoint invalidates the old cookie/password and the replacement logs in (actual routes + isolated database)');

  const recovery = load('src/app/api/classes/[classId]/students/[studentId]/password/route.ts', services);
  await pg.query("UPDATE classes SET default_student_password='2026' WHERE id=$1", [classId]);
  const peerParams = { params: Promise.resolve({ classId, studentId: peer }) };
  const shown = await recovery.POST(post({ action: 'reveal' }), peerParams);
  assert.equal(shown.status, 200);
  assert.equal((await shown.json()).password, '2026');
  assert.match(shown.headers.get('cache-control'), /no-store/);
  // Current custom passwords are decryptable only for the owning professor.
  const privateParams = { params: Promise.resolve({ classId, studentId: peer }) };
  const changedId = (await pg.query('SELECT id FROM students WHERE class_id=$1 AND id_number=$2', [classId, last.idNumber])).rows[0].id;
  privateParams.params = Promise.resolve({ classId, studentId: changedId });
  const customReveal = await recovery.POST(post({ action: 'reveal' }), privateParams);
  assert.equal(customReveal.status, 200);
  assert.equal((await customReveal.json()).password, 'changed-fixture-password');
  const exportRoute = load('src/app/api/classes/[classId]/students/export/route.ts', services);
  const exportParams = { params: Promise.resolve({ classId }) };
  const csvResponse = await exportRoute.GET(post({}), exportParams);
  assert.equal(csvResponse.status, 200);
  assert.match(csvResponse.headers.get('cache-control'), /no-store/);
  const csv = await csvResponse.text();
  assert.match(csv, /"Name","ID Number","Password"/);
  assert.match(csv, /"2026"/);
  assert.match(csv, /"changed-fixture-password"/);
  assert.doesNotMatch(csv, /\$2[aby]\$|v1\./);
  const studentBeforeRecovery = jar.get('student_token');
  const key = rateLimits.rateKey(`${classId}:${last.idNumber}`);
  await pg.query("INSERT INTO rate_limits (key,action) SELECT $1,'student_login' FROM generate_series(1,10)", [key]);
  assert.equal((await liveLogin.POST(post({ classId, idNumber: last.idNumber, password: 'changed-fixture-password' }))).status, 429);
  const resetResponse = await recovery.POST(post({ action: 'reset' }), privateParams);
  assert.equal(resetResponse.status, 200);
  const replacementPassword = (await resetResponse.json()).password;
  assert.equal(replacementPassword, '2026');
  assert.equal(jar.get('student_token'), studentBeforeRecovery);
  assert.equal(await auth.getStudentSession(), null);
  assert.equal((await liveLogin.POST(post({ classId, idNumber: last.idNumber, password: replacementPassword }))).status, 200);
  assert.equal((await auth.getStudentSession()).studentId, changedId);
  await auth.clearProfCookie();
  assert.equal((await recovery.POST(post({ action: 'reveal' }), peerParams)).status, 401);
  assert.equal((await exportRoute.GET(post({}), exportParams)).status, 401);
  await auth.setProfCookie(await auth.signProfToken({ profId: prof, email: professorEmail }));
  const [{ id: otherProf }] = (await pg.query("INSERT INTO professors (name,email) VALUES ('Other Fixture','other@example.invalid') RETURNING id")).rows;
  await auth.setProfCookie(await auth.signProfToken({ profId: otherProf, email: 'other@example.invalid' }));
  assert.equal((await recovery.POST(post({ action: 'reveal' }), peerParams)).status, 404);
  assert.equal((await exportRoute.GET(post({}), exportParams)).status, 404);
  console.log('PASS default 2026 login; encrypted current passwords appear in professor-only reveal and CSV; reset clears lockout and revokes sessions; unauthorized recovery/export denied');
} finally { await pg.close(); }
