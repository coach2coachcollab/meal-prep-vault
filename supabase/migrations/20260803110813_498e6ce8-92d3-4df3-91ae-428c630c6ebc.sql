-- 1. Private schema for the role-check helper so it is no longer API-exposed
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS "Coaches can insert templates" ON public.workout_templates;
CREATE POLICY "Coaches can insert templates" ON public.workout_templates
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'coach') OR private.has_role(auth.uid(), 'admin'));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 2. Re-scope every policy currently targeting the broad "public" role to "authenticated"

DROP POLICY IF EXISTS "Anyone authed can read challenges" ON public.challenges;
CREATE POLICY "Anyone authed can read challenges" ON public.challenges
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone authed can read comment likes" ON public.comment_likes;
CREATE POLICY "Anyone authed can read comment likes" ON public.comment_likes
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can CRUD own comment likes" ON public.comment_likes;
CREATE POLICY "Users can CRUD own comment likes" ON public.comment_likes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone authed can read posts" ON public.community_posts;
CREATE POLICY "Anyone authed can read posts" ON public.community_posts
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own posts" ON public.community_posts;
CREATE POLICY "Users can delete own posts" ON public.community_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own posts" ON public.community_posts;
CREATE POLICY "Users can insert own posts" ON public.community_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own posts" ON public.community_posts;
CREATE POLICY "Users can update own posts" ON public.community_posts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own exercises" ON public.exercises;
CREATE POLICY "Users can delete own exercises" ON public.exercises
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own exercises" ON public.exercises;
CREATE POLICY "Users can insert own exercises" ON public.exercises
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own exercises" ON public.exercises;
CREATE POLICY "Users can update own exercises" ON public.exercises
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view public and own exercises" ON public.exercises;
CREATE POLICY "Users can view public and own exercises" ON public.exercises
  FOR SELECT TO authenticated USING ((is_public = true) OR (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can CRUD own favorites" ON public.favorite_meals;
CREATE POLICY "Users can CRUD own favorites" ON public.favorite_meals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own grocery items" ON public.grocery_list_items;
CREATE POLICY "Users can CRUD own grocery items" ON public.grocery_list_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.grocery_lists WHERE grocery_lists.id = grocery_list_items.grocery_list_id AND grocery_lists.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.grocery_lists WHERE grocery_lists.id = grocery_list_items.grocery_list_id AND grocery_lists.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can CRUD own grocery lists" ON public.grocery_lists;
CREATE POLICY "Users can CRUD own grocery lists" ON public.grocery_lists
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own habit logs" ON public.habit_logs;
CREATE POLICY "Users can CRUD own habit logs" ON public.habit_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own daily notes" ON public.journal_daily_notes;
CREATE POLICY "Users can CRUD own daily notes" ON public.journal_daily_notes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own journal" ON public.journal_entries;
CREATE POLICY "Users can CRUD own journal" ON public.journal_entries
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own calculations" ON public.macro_calculations;
CREATE POLICY "Users can CRUD own calculations" ON public.macro_calculations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own plan entries" ON public.meal_plan_entries;
CREATE POLICY "Users can CRUD own plan entries" ON public.meal_plan_entries
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meal_plans WHERE meal_plans.id = meal_plan_entries.meal_plan_id AND meal_plans.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meal_plans WHERE meal_plans.id = meal_plan_entries.meal_plan_id AND meal_plans.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can CRUD own meal plans" ON public.meal_plans;
CREATE POLICY "Users can CRUD own meal plans" ON public.meal_plans
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own ratings" ON public.meal_ratings;
CREATE POLICY "Users can delete own ratings" ON public.meal_ratings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own ratings" ON public.meal_ratings;
CREATE POLICY "Users can insert own ratings" ON public.meal_ratings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own ratings" ON public.meal_ratings;
CREATE POLICY "Users can update own ratings" ON public.meal_ratings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own clicks" ON public.partner_clicks;
CREATE POLICY "Users can insert own clicks" ON public.partner_clicks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone authed can read comments" ON public.post_comments;
CREATE POLICY "Anyone authed can read comments" ON public.post_comments
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own comments" ON public.post_comments;
CREATE POLICY "Users can delete own comments" ON public.post_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own comments" ON public.post_comments;
CREATE POLICY "Users can insert own comments" ON public.post_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own comments" ON public.post_comments;
CREATE POLICY "Users can update own comments" ON public.post_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone authed can read reactions" ON public.post_reactions;
CREATE POLICY "Anyone authed can read reactions" ON public.post_reactions
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own reactions" ON public.post_reactions;
CREATE POLICY "Users can delete own reactions" ON public.post_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own reactions" ON public.post_reactions;
CREATE POLICY "Users can insert own reactions" ON public.post_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own progress logs" ON public.progress_logs;
CREATE POLICY "Users can CRUD own progress logs" ON public.progress_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own progress photos" ON public.progress_photos;
CREATE POLICY "Users can CRUD own progress photos" ON public.progress_photos
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own saved posts" ON public.saved_posts;
CREATE POLICY "Users can CRUD own saved posts" ON public.saved_posts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own shopping lists" ON public.shopping_lists;
CREATE POLICY "Users can CRUD own shopping lists" ON public.shopping_lists
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own reminders" ON public.streak_reminders;
CREATE POLICY "Users can delete their own reminders" ON public.streak_reminders
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own reminders" ON public.streak_reminders;
CREATE POLICY "Users can insert their own reminders" ON public.streak_reminders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reminders" ON public.streak_reminders;
CREATE POLICY "Users can update their own reminders" ON public.streak_reminders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own reminders" ON public.streak_reminders;
CREATE POLICY "Users can view their own reminders" ON public.streak_reminders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own habits" ON public.user_habits;
CREATE POLICY "Users can CRUD own habits" ON public.user_habits
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own macros" ON public.user_macros;
CREATE POLICY "Users can CRUD own macros" ON public.user_macros
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own water logs" ON public.water_logs;
CREATE POLICY "Users can CRUD own water logs" ON public.water_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own workout logs" ON public.workout_logs;
CREATE POLICY "Users can CRUD own workout logs" ON public.workout_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own workout sets" ON public.workout_sets;
CREATE POLICY "Users can CRUD own workout sets" ON public.workout_sets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_logs WHERE workout_logs.id = workout_sets.workout_log_id AND workout_logs.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_logs WHERE workout_logs.id = workout_sets.workout_log_id AND workout_logs.user_id = auth.uid()));
