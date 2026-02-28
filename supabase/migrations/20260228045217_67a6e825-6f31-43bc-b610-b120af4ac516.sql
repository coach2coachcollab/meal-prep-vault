
-- Add photo_url column to progress_logs
ALTER TABLE public.progress_logs ADD COLUMN photo_url text NULL;

-- Create storage bucket for progress photos
INSERT INTO storage.buckets (id, name, public) VALUES ('progress-photos', 'progress-photos', true);

-- RLS: Users can upload their own progress photos
CREATE POLICY "Users can upload own progress photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: Users can view own progress photos
CREATE POLICY "Users can view own progress photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: Users can delete own progress photos
CREATE POLICY "Users can delete own progress photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
