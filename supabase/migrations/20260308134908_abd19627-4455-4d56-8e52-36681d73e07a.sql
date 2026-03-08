ALTER TABLE public.comment_likes ADD COLUMN reaction_type TEXT NOT NULL DEFAULT '👍';

-- Drop the existing unique constraint if any, and add new one with reaction_type
ALTER TABLE public.comment_likes DROP CONSTRAINT IF EXISTS comment_likes_comment_id_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS comment_likes_comment_user_reaction_idx ON public.comment_likes (comment_id, user_id, reaction_type);