
-- Create a table for multiple progress photos per log entry
CREATE TABLE public.progress_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  progress_log_id uuid NOT NULL REFERENCES public.progress_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  angle text NOT NULL CHECK (angle IN ('front', 'back', 'side')),
  photo_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(progress_log_id, angle)
);

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own progress photos"
ON public.progress_photos FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
