-- ============================================================
-- MindDrop: Supabase SQL Setup
-- Run this in Supabase SQL Editor (https://supabase.com)
-- ============================================================

-- 1. Create cloud_records table
-- Stores complete record JSON for straightforward sync
CREATE TABLE IF NOT EXISTS cloud_records (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 2. Index for efficient user-level queries
CREATE INDEX IF NOT EXISTS idx_cloud_records_user_id ON cloud_records(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_records_updated_at ON cloud_records(updated_at);

-- 3. Enable Row Level Security
ALTER TABLE cloud_records ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: users can only access their own data

-- SELECT: users can only see their own records
CREATE POLICY "Users can view their own records"
  ON cloud_records
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: users can insert their own records
CREATE POLICY "Users can insert their own records"
  ON cloud_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can update their own records
CREATE POLICY "Users can update their own records"
  ON cloud_records
  FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: users can delete their own records
CREATE POLICY "Users can delete their own records"
  ON cloud_records
  FOR DELETE
  USING (auth.uid() = user_id);
