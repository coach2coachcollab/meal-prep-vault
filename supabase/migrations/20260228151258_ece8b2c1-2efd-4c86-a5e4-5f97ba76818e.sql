
-- Create saved_posts table for bookmarking
CREATE TABLE public.saved_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own saved posts"
ON public.saved_posts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
