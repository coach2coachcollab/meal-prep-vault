
DROP VIEW IF EXISTS public.public_profiles;

CREATE TABLE public.public_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  avatar_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_profiles TO authenticated, anon;
GRANT ALL ON public.public_profiles TO service_role;

ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read public profile info"
ON public.public_profiles FOR SELECT TO authenticated, anon
USING (true);

-- Backfill from existing profiles
INSERT INTO public.public_profiles (user_id, name, avatar_url)
SELECT user_id, name, avatar_url FROM public.profiles
ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url;

-- Sync trigger
CREATE OR REPLACE FUNCTION public.sync_public_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.public_profiles WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  INSERT INTO public.public_profiles (user_id, name, avatar_url, updated_at)
  VALUES (NEW.user_id, NEW.name, NEW.avatar_url, now())
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_public_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_public_profile ON public.profiles;
CREATE TRIGGER trg_sync_public_profile
AFTER INSERT OR UPDATE OF name, avatar_url OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_public_profile();
