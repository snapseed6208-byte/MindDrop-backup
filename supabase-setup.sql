-- ============================================================
-- MindDrop: Supabase SQL Setup
-- Safe to run multiple times (idempotent)
-- Run this in Supabase SQL Editor (https://supabase.com)
-- ============================================================

-- ─── 1. CREATE cloud_records TABLE ───

CREATE TABLE IF NOT EXISTS cloud_records (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_cloud_records_user_id ON cloud_records(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_records_updated_at ON cloud_records(updated_at);

-- ─── 2. RLS on cloud_records ───

ALTER TABLE cloud_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own cloud_records" ON cloud_records;
CREATE POLICY "Users can view their own cloud_records"
  ON cloud_records
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own cloud_records" ON cloud_records;
CREATE POLICY "Users can insert their own cloud_records"
  ON cloud_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own cloud_records" ON cloud_records;
CREATE POLICY "Users can update their own cloud_records"
  ON cloud_records
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own cloud_records" ON cloud_records;
CREATE POLICY "Users can delete their own cloud_records"
  ON cloud_records
  FOR DELETE
  USING (auth.uid() = user_id);

-- ─── 3. STORAGE BUCKET ───
-- Manually create the bucket in Supabase Dashboard:
--   Storage → Create bucket → Name: minddrop-media
--   Public: false | File size limit: 50 MB

-- ─── 4. STORAGE RLS POLICIES ───
-- Run these AFTER creating the minddrop-media bucket.

DROP POLICY IF EXISTS "Users can view their own media" ON storage.objects;
CREATE POLICY "Users can view their own media"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'minddrop-media'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload their own media" ON storage.objects;
CREATE POLICY "Users can upload their own media"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'minddrop-media'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own media" ON storage.objects;
CREATE POLICY "Users can update their own media"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'minddrop-media'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects;
CREATE POLICY "Users can delete their own media"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'minddrop-media'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
