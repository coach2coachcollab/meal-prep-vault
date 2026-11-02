-- Upsert uploads (used by the admin importer and recipe forms) need SELECT as well as INSERT and
-- UPDATE. 20260721120348 removed the broad SELECT policy, which made every upsert fail.
-- Scoped to the user's own folder so files still can't be listed across users; the bucket stays
-- public, so images are served by direct URL regardless.
CREATE POLICY "Users can view own recipe images" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
