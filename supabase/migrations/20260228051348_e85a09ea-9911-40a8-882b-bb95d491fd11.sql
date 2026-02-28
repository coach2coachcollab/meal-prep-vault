
-- Drop existing restrictive policies on meals
DROP POLICY IF EXISTS "Users can view own and public meals" ON public.meals;
DROP POLICY IF EXISTS "Users can insert own meals" ON public.meals;
DROP POLICY IF EXISTS "Users can update own meals" ON public.meals;
DROP POLICY IF EXISTS "Users can delete own meals" ON public.meals;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Users can view own and public meals"
ON public.meals FOR SELECT TO authenticated
USING ((is_public = true) OR (auth.uid() = user_id));

CREATE POLICY "Users can insert own meals"
ON public.meals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meals"
ON public.meals FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meals"
ON public.meals FOR DELETE TO authenticated
USING (auth.uid() = user_id);
