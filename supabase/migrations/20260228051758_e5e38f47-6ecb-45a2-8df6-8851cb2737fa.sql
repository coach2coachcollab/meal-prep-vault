
-- Add UPDATE policy for recipe-images bucket (needed for upsert uploads)
CREATE POLICY "Authed users can update recipe images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'recipe-images');
