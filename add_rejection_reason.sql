-- Migration: store an optional professor comment when a title is rejected.
-- Run this in Neon SQL Editor (or drizzle-kit push). Safe to re-run.

ALTER TABLE titles
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
