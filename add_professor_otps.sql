-- Migration: Add professor_otps table for email OTP login
-- Run this in Neon SQL Editor

CREATE TABLE professor_otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  otp         TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clean up expired OTPs automatically on query (index helps)
CREATE INDEX idx_otps_email       ON professor_otps(email);
CREATE INDEX idx_otps_expires_at  ON professor_otps(expires_at);
