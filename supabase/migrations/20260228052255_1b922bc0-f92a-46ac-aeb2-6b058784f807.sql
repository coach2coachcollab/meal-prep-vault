
-- Drop all existing meals policies
DROP POLICY IF EXISTS "Users can view own and public meals" ON public.meals;
DROP POLICY IF EXISTS "Users can insert own meals" ON public.meals;
DROP POLICY IF EXISTS "Users can update own meals" ON public.meals;
DROP POLICY IF EXISTS "Users can delete own meals" ON public.meals;

-- Recreate as explicitly PERMISSIVE
CREATE POLICY "Users can view own and public meals"
ON public.meals AS PERMISSIVE FOR SELECT TO authenticated
USING ((is_public = true) OR (auth.uid() = user_id));

CREATE POLICY "Users can insert own meals"
ON public.meals AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meals"
ON public.meals AS PERMISSIVE FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meals"
ON public.meals AS PERMISSIVE FOR DELETE TO authenticated
USING (auth.uid() = user_id);
