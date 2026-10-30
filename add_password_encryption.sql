-- Recoverable passwords are AES-GCM ciphertext; login still uses bcrypt hashes.
ALTER TABLE students ADD COLUMN IF NOT EXISTS password_encrypted text;
ALTER TABLE classes ALTER COLUMN default_student_password SET DEFAULT '2026';
