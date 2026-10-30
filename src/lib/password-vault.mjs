import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function encryptionKey() {
  const key = Buffer.from(process.env.STUDENT_PASSWORD_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('Configure STUDENT_PASSWORD_KEY as a 32-byte base64 key');
  return key;
}
function additionalData({ classId, studentId, passwordHash }) {
  return Buffer.from(`student-password:v1:${classId}:${studentId}:${passwordHash}`);
}
export function encryptStudentPassword(password, context) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(additionalData(context));
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}
export function decryptStudentPassword(value, context) {
  const [version, iv, tag, ciphertext, extra] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext || extra) throw new Error('Invalid encrypted password format');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAAD(additionalData(context));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}
