
CREATE TABLE public.progress_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric NULL,
  waist_cm numeric NULL,
  hips_cm numeric NULL,
  chest_cm numeric NULL,
  arms_cm numeric NULL,
  thighs_cm numeric NULL,
  body_fat_pct numeric NULL,
  notes text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own progress logs"
  ON public.progress_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
