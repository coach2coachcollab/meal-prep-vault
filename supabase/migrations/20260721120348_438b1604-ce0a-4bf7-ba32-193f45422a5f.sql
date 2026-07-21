
-- 1. profiles: drop overly permissive read policy, add restricted public view
DROP POLICY IF EXISTS "Authenticated users can read public profile info" ON public.profiles;

DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT user_id, name, avatar_url FROM public.profiles;
GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 2. notifications: tighten insert policy
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications tied to own actions"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = actor_id
  AND user_id <> auth.uid()
  AND (
    (post_id IS NOT NULL AND user_id = (SELECT user_id FROM public.community_posts WHERE id = post_id))
    OR (comment_id IS NOT NULL AND user_id = (SELECT user_id FROM public.post_comments WHERE id = comment_id))
  )
);

-- 3. storage: recipe-images UPDATE requires ownership
DROP POLICY IF EXISTS "Authed users can update recipe images" ON storage.objects;
CREATE POLICY "Users can update own recipe images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'recipe-images' AND owner = auth.uid())
WITH CHECK (bucket_id = 'recipe-images' AND owner = auth.uid());

-- 4. storage: remove broad SELECT on recipe-images (bucket stays public for direct URL serving)
DROP POLICY IF EXISTS "Anyone can view recipe images" ON storage.objects;

-- 5. Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- has_role must remain callable by authenticated for RLS policies
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
