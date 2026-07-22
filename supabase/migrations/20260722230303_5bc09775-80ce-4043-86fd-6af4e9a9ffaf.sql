
-- 1. Tighten SELECT policies on shared tables
DROP POLICY IF EXISTS "Anyone authed can read partners" ON public.partners;
CREATE POLICY "Authed can read active partners" ON public.partners
  FOR SELECT TO authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

DROP POLICY IF EXISTS "Anyone authed can read ratings" ON public.meal_ratings;
CREATE POLICY "Read ratings on public meals or own" ON public.meal_ratings
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id AND (m.is_public = true OR m.user_id = auth.uid()))
  );

-- 2. Restrict public_profiles to authenticated only
DROP POLICY IF EXISTS "Anyone authenticated can read public profile info" ON public.public_profiles;
DROP POLICY IF EXISTS "Anyone can read public profile info" ON public.public_profiles;
CREATE POLICY "Authenticated users can read public profiles" ON public.public_profiles
  FOR SELECT TO authenticated
  USING (true);
REVOKE SELECT ON public.public_profiles FROM anon;

-- 3. Revoke EXECUTE from authenticated & anon on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_public_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- has_role is called by RLS policies as the invoker; keep authenticated execute
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 4. Storage: recipe-images strict ownership by first folder = auth.uid()
DROP POLICY IF EXISTS "Authed users can upload recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Owner can update recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own recipe images" ON storage.objects;

CREATE POLICY "Users can upload own recipe images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recipe-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own recipe images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'recipe-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own recipe images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
