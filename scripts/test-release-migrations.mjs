// Isolated PostgreSQL: set PGLITE_MODULE to an installed @electric-sql/pglite path.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE titles (
    id text PRIMARY KEY, status text NOT NULL, progress_status text NOT NULL DEFAULT 'planning',
    description text NOT NULL, documentation jsonb, updated_at timestamptz DEFAULT now()
  ); CREATE TABLE documentation_field_templates (field_key text, label text);`);
  for (const status of ['pending', 'rejected', 'verified']) {
    for (const progress of ['planning', 'in_progress', 'review', 'done']) {
      await db.query('INSERT INTO titles (id, status, progress_status, description, documentation) VALUES ($1,$2,$3,$4,$5)',
        [`${status}-${progress}`, status, progress, 'Shared overview', { abstract: 'Older abstract', key_objectives: 'Keep this objective' }]);
    }
  }
  await db.query('INSERT INTO titles (id,status,description,documentation) VALUES ($1,$2,$3,$4)', ['legacy-only', 'pending', '', { abstract: 'Legacy overview' }]);
  await db.query('INSERT INTO titles (id,status,description,documentation) VALUES ($1,$2,$3,$4)', ['identical', 'pending', 'Same', { abstract: ' Same ' }]);
  await db.exec("INSERT INTO documentation_field_templates VALUES ('abstract','Abstract'),('custom','Keep this label')");
  const scripts = ['consolidate_project_description.sql', 'enforce_approval_planning.sql'];
  for (const file of scripts) await db.exec(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  const { rows } = await db.query('SELECT * FROM titles ORDER BY id');
  for (const row of rows) {
    if (row.status === 'verified') assert.equal(row.progress_status, row.id.slice('verified-'.length));
    else assert.equal(row.progress_status, 'planning');
    assert.equal('abstract' in row.documentation, false);
    if (!['legacy-only', 'identical'].includes(row.id)) {
      assert.equal(row.description, 'Shared overview');
      assert.equal(row.documentation.key_objectives, 'Keep this objective');
      assert.deepEqual(row.documentation._legacyAbstracts, ['Older abstract']);
    }
  }
  assert.equal(rows.find(r => r.id === 'legacy-only').description, 'Legacy overview');
  assert.equal(rows.find(r => r.id === 'identical').documentation._legacyAbstracts, undefined);
  assert.equal((await db.query("SELECT label FROM documentation_field_templates WHERE field_key='abstract'")).rows[0].label, 'Description / Abstract');
  for (const file of scripts) await db.exec(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  assert.deepEqual((await db.query('SELECT * FROM titles ORDER BY id')).rows, rows, 'Both migrations are safe to rerun');
  await assert.rejects(db.exec("UPDATE titles SET progress_status='in_progress' WHERE id='pending-in_progress'"), error => error.code === '23514');
  await db.exec("UPDATE titles SET status='verified' WHERE id='pending-in_progress'");
  await db.exec("UPDATE titles SET progress_status='in_progress' WHERE id='pending-in_progress'");
  await assert.rejects(db.exec("UPDATE titles SET status='rejected' WHERE id='pending-in_progress'"), error => error.code === '23514');
  await db.exec("UPDATE titles SET status='rejected',progress_status='planning' WHERE id='pending-in_progress'");
  console.log('PASS PostgreSQL migration: stale unapproved progress resets, approved progress stays intact, database blocks invalid states, rejection resets atomically, overview conflicts preserved, reruns change nothing');
} finally {
  await db.close();
}
