CREATE POLICY "Authenticated users can read public profile info"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);