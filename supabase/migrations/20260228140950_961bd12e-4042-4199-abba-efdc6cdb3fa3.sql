
-- Create meal_ratings table
CREATE TABLE public.meal_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id uuid NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(meal_id, user_id)
);

-- Enable RLS
ALTER TABLE public.meal_ratings ENABLE ROW LEVEL SECURITY;

-- Users can read all ratings
CREATE POLICY "Anyone authed can read ratings"
  ON public.meal_ratings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can insert own ratings
CREATE POLICY "Users can insert own ratings"
  ON public.meal_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update own ratings
CREATE POLICY "Users can update own ratings"
  ON public.meal_ratings FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete own ratings
CREATE POLICY "Users can delete own ratings"
  ON public.meal_ratings FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_meal_ratings_updated_at
  BEFORE UPDATE ON public.meal_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
