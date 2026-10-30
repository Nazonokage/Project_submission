import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PgDialect } from 'drizzle-orm/pg-core';
import { load, common, helpers } from './test-phase14-16.mjs';
import { migrationStatements } from './lib/sql-migration.mjs';
const pg = new PGlite();
await pg.exec(`
CREATE TABLE classes (id uuid PRIMARY KEY, default_student_password text NOT NULL DEFAULT '2026');
CREATE TABLE students (id uuid PRIMARY KEY, class_id uuid NOT NULL, password text, is_active boolean DEFAULT true);
CREATE TABLE project_slots (id uuid PRIMARY KEY, class_id uuid NOT NULL, group_size integer DEFAULT 2, excluded_student_ids uuid[] NOT NULL DEFAULT '{}');
CREATE TABLE groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid NOT NULL, slot_id uuid NOT NULL, status text DEFAULT 'forming', max_size integer NOT NULL, updated_at timestamptz DEFAULT now());
CREATE TABLE student_group_slots (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL, group_id uuid REFERENCES groups(id) ON DELETE CASCADE, slot_id uuid NOT NULL, UNIQUE(student_id,slot_id));
CREATE TABLE group_invites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid REFERENCES groups(id) ON DELETE CASCADE, class_id uuid, slot_id uuid, invited_student_id uuid, invited_by_student_id uuid, status text DEFAULT 'pending');
CREATE TABLE group_leave_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid, status text);
CREATE TABLE titles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid, slot_id uuid, group_id uuid REFERENCES groups(id) ON DELETE CASCADE, status text, updated_at timestamptz DEFAULT now());
CREATE TABLE tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid REFERENCES groups(id) ON DELETE CASCADE);
CREATE TABLE project_updates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid REFERENCES groups(id) ON DELETE CASCADE);
CREATE TABLE title_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid REFERENCES groups(id) ON DELETE CASCADE);
CREATE TABLE feedback (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid REFERENCES groups(id) ON DELETE CASCADE);
CREATE TABLE rate_limits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text, action text, created_at timestamptz DEFAULT now());
CREATE TABLE professor_otps (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, created_at timestamptz DEFAULT now());
`);
const migration = readFileSync('security_hardening.sql','utf8');
const applyMigration = () => pg.transaction(async tx => {
  for (const statement of migrationStatements(migration)) await tx.exec(statement);
});
await applyMigration();
await applyMigration();
const cls=randomUUID(), slot=randomUUID(), group=randomUUID(), old=randomUUID();
const [a,b,c,foreign]=Array.from({length:4},randomUUID);
await pg.query('INSERT INTO classes VALUES ($1,$2)',[cls,'']);
await pg.query('INSERT INTO project_slots (id,class_id) VALUES ($1,$2)',[slot,cls]);
for(const student of [a,b,c]) await pg.query('INSERT INTO students (id,class_id) VALUES ($1,$2)',[student,cls]);
await pg.query('INSERT INTO students (id,class_id) VALUES ($1,$2)',[foreign,randomUUID()]);
await pg.query('INSERT INTO groups (id,class_id,slot_id,max_size) VALUES ($1,$2,$3,2),($4,$2,$3,2)',[group,cls,slot,old]);
await pg.query('INSERT INTO student_group_slots (student_id,group_id,slot_id) VALUES ($1,$2,$3),($4,$5,$3)',[a,group,slot,b,old]);
await assert.rejects(pg.query('INSERT INTO student_group_slots (student_id,group_id,slot_id) VALUES ($1,$2,$3)',[foreign,group,slot]), /not eligible/);
const title=(await pg.query('INSERT INTO titles (class_id,slot_id,group_id,status) VALUES ($1,$2,$3,$4) RETURNING id',[cls,slot,old,'pending'])).rows[0].id;
const invite=(await pg.query('INSERT INTO group_invites (group_id,class_id,slot_id,invited_student_id) VALUES ($1,$2,$3,$4) RETURNING id',[group,cls,slot,b])).rows[0].id;
await assert.rejects(pg.query('INSERT INTO group_invites (group_id,class_id,slot_id,invited_student_id) VALUES ($1,$2,$3,$4)',[group,cls,slot,c]),/seats/);
assert.ok((await pg.query('SELECT accept_project_invite($1,$2,$3) AS result',[invite,c,cls])).rows[0].result.error);
await pg.exec(`ALTER TABLE student_group_slots ADD CONSTRAINT simulated_join_failure CHECK (student_id <> '${b}'::uuid) NOT VALID`);
await assert.rejects(pg.query('SELECT accept_project_invite($1,$2,$3) AS result',[invite,b,cls]),/simulated_join_failure/);
assert.equal((await pg.query('SELECT group_id FROM titles WHERE id=$1',[title])).rows[0].group_id,old);
assert.equal((await pg.query('SELECT count(*)::int AS n FROM groups WHERE id=$1',[old])).rows[0].n,1);
await pg.exec('ALTER TABLE student_group_slots DROP CONSTRAINT simulated_join_failure');
const accepted=(await pg.query('SELECT accept_project_invite($1,$2,$3) AS result',[invite,b,cls])).rows[0].result;
assert.equal(accepted.ok,true);
assert.equal((await pg.query('SELECT group_id FROM titles WHERE id=$1',[title])).rows[0].group_id,group);
assert.equal((await pg.query('SELECT count(*)::int AS n FROM groups WHERE id=$1',[old])).rows[0].n,0);
assert.ok((await pg.query('SELECT accept_project_invite($1,$2,$3) AS result',[invite,b,cls])).rows[0].result.error);
await assert.rejects(pg.query('INSERT INTO student_group_slots (student_id,group_id,slot_id) VALUES ($1,$2,$3)',[c,group,slot]),/full/);
assert.equal((await pg.query('SELECT count(*)::int AS n FROM student_group_slots WHERE group_id=$1',[group])).rows[0].n,2);
await assert.rejects(pg.query('UPDATE project_slots SET group_size=1 WHERE id=$1',[slot]),/capacity/);
await assert.rejects(pg.query('UPDATE groups SET max_size=1 WHERE id=$1',[group]),/capacity/);
console.log('PASS migration applies twice; rejects foreign members and overbooked invites; acceptance checks identity; draft migration is atomic; replay and over-capacity joins fail');
// Execute the actual rate-limit SQL against isolated PostgreSQL.
const dialect = new PgDialect();
const db = {
  execute: query => query,
  batch: statements => pg.transaction(async tx => {
    const results=[];
    for (const statement of statements) { const query=dialect.sqlToQuery(statement); results.push(await tx.query(query.sql,query.params)); }
    return results;
  }),
};
const { assertActionRateLimit } = load('src/lib/rate-limit.ts', { ...common, '@/lib/db': { db } });
let allowed=0;
for (let i=0;i<8;i++) {
  const result=await assertActionRateLimit({ key:'synthetic-account',action:'otp_send',max:5,message:'limited' });
  if (result) assert.equal(result.status,429); else allowed++;
}
assert.equal(allowed,5);
await pg.exec('DELETE FROM professor_otps');
assert.equal((await assertActionRateLimit({key:'synthetic-account',action:'otp_send',max:5,message:'limited'})).status,429);
const broken=load('src/lib/rate-limit.ts',{ ...common,'@/lib/db': { db: { execute:q=>q,batch:async()=>{throw new Error('isolated outage');} } } });
assert.equal((await broken.assertActionRateLimit({key:'test',action:'test',max:5,message:'limited'})).status,503);
console.log('PASS real rate-limit SQL permits exactly five attempts; OTP cleanup cannot reset quota; store outage fails closed');
await pg.close();
