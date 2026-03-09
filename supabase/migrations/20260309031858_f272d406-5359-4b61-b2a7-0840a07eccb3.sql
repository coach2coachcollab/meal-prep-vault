
-- Workout templates table
CREATE TABLE public.workout_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  difficulty TEXT DEFAULT 'intermediate',
  category TEXT DEFAULT 'full_body',
  estimated_minutes INTEGER,
  coach_notes TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Template exercises junction table
CREATE TABLE public.workout_template_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  sets INTEGER DEFAULT 3,
  reps INTEGER,
  weight_kg NUMERIC,
  rest_seconds INTEGER DEFAULT 60,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_template_exercises ENABLE ROW LEVEL SECURITY;

-- Templates: all authenticated can read public or own
CREATE POLICY "Users can view public and own templates"
  ON public.workout_templates FOR SELECT
  TO authenticated
  USING (is_public = true OR auth.uid() = user_id);

-- Templates: only coaches/admins can insert
CREATE POLICY "Coaches can insert templates"
  ON public.workout_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'coach') OR public.has_role(auth.uid(), 'admin'));

-- Templates: only owner coaches/admins can update
CREATE POLICY "Coaches can update own templates"
  ON public.workout_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Templates: only owner can delete
CREATE POLICY "Coaches can delete own templates"
  ON public.workout_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Template exercises: readable if template is accessible
CREATE POLICY "Users can view template exercises"
  ON public.workout_template_exercises FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workout_templates
    WHERE id = workout_template_exercises.template_id
    AND (is_public = true OR user_id = auth.uid())
  ));

-- Template exercises: insertable by template owner
CREATE POLICY "Template owner can insert exercises"
  ON public.workout_template_exercises FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workout_templates
    WHERE id = workout_template_exercises.template_id
    AND user_id = auth.uid()
  ));

-- Template exercises: updatable by template owner
CREATE POLICY "Template owner can update exercises"
  ON public.workout_template_exercises FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workout_templates
    WHERE id = workout_template_exercises.template_id
    AND user_id = auth.uid()
  ));

-- Template exercises: deletable by template owner
CREATE POLICY "Template owner can delete exercises"
  ON public.workout_template_exercises FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workout_templates
    WHERE id = workout_template_exercises.template_id
    AND user_id = auth.uid()
  ));

-- Updated_at trigger
CREATE TRIGGER update_workout_templates_updated_at
  BEFORE UPDATE ON public.workout_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
