import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { migrationStatements } from './lib/sql-migration.mjs';

const pg = new PGlite();
try {
  const statements = migrationStatements(`-- initial comment;
    BEGIN;
    CREATE TABLE fixture (value text);
    INSERT INTO fixture VALUES ('semi;colon'), ('it''s;quoted');
    /* outer ; /* nested ; */ comment */
    CREATE FUNCTION fixture_value() RETURNS text LANGUAGE plpgsql AS $body$
    BEGIN RETURN 'body;value'; END $body$;
    COMMIT; -- final comment`);
  assert.equal(statements.length, 3);
  await pg.transaction(async tx => { for (const statement of statements) await tx.exec(statement); });
  assert.equal((await pg.query('SELECT fixture_value() AS value')).rows[0].value, 'body;value');
  await assert.rejects(pg.transaction(async tx => {
    for (const statement of migrationStatements("INSERT INTO fixture VALUES ('rollback'); INSERT INTO nonexistent VALUES (1);")) await tx.exec(statement);
  }));
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM fixture WHERE value='rollback'")).rows[0].n, 0);
  const security = migrationStatements(readFileSync('security_hardening.sql', 'utf8'));
  assert.equal(security.filter(value => value.includes('CREATE OR REPLACE FUNCTION')).length, 4);
  assert.throws(() => migrationStatements("SELECT 'unfinished"), /Unterminated/);
  assert.throws(() => migrationStatements('BEGIN; SELECT 1;'), /COMMIT/);
  console.log('PASS SQL runner preserves function bodies/quoted semicolons/comments; batches atomically; failures roll back');
} finally { await pg.close(); }
