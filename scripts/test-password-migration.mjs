import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { prepareStudentPassword } from './lib/student-password-migration.mjs';

for (const value of ['2026', 'individual-long-password', ' spaces stay ', 'Paßword-例']) {
  const result = await prepareStudentPassword({ password: value, default_student_password: '2026' });
  assert.equal(result.kind, 'hashed');
  assert.notEqual(result.password, value);
  assert.equal(await bcrypt.compare(value, result.password), true);
  assert.equal(await bcrypt.compare('incorrect-password', result.password), false);
  const again = await prepareStudentPassword({ password: result.password });
  assert.equal(again.kind, 'unchanged');
  assert.equal(again.password, result.password);
}
const reset = await prepareStudentPassword({ password: '2026' }, { resetWeakPasswords: true });
assert.equal(reset.kind, 'reset');
assert.equal(await bcrypt.compare('2026', reset.password), false);
await assert.rejects(prepareStudentPassword({ password: 'x'.repeat(73) }), /byte limit/);
console.log('PASS migration preserves existing short/long/Unicode/space-containing passwords, rejects wrong passwords, is idempotent, and resets only when explicitly requested');
