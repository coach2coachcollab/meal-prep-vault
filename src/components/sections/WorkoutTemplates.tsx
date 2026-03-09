import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Dumbbell, Clock, ChevronDown, ChevronUp, Shield, Zap, Flame, ArrowLeft, Play } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

interface TemplateExercise {
  id: string;
  sort_order: number;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  rest_seconds: number | null;
  notes: string | null;
  exercise: {
    id: string;
    name: string;
    muscle_group: string | null;
    equipment: string | null;
    category: string | null;
  };
}

interface WorkoutTemplate {
  id: string;
  name: string;
  description: string | null;
  difficulty: string | null;
  category: string | null;
  estimated_minutes: number | null;
  coach_notes: string | null;
  is_public: boolean | null;
  user_id: string;
  created_at: string;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; icon: typeof Zap }> = {
  beginner: { label: "Beginner", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: Zap },
  intermediate: { label: "Intermediate", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: Flame },
  advanced: { label: "Advanced", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: Shield },
};

const CATEGORY_LABELS: Record<string, string> = {
  full_body: "Full Body",
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper Body",
  lower: "Lower Body",
  cardio: "Cardio",
  hiit: "HIIT",
  mobility: "Mobility",
};

interface WorkoutTemplatesProps {
  onStartFromTemplate?: (templateId: string) => void;
}

export function WorkoutTemplates({ onStartFromTemplate }: WorkoutTemplatesProps) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: queryKeys.workoutTemplates(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as WorkoutTemplate[];
    },
    enabled: !!user,
  });

  const { data: templateExercises = [] } = useQuery({
    queryKey: queryKeys.workoutTemplateExercises(selectedTemplate?.id),
    queryFn: async () => {
      if (!selectedTemplate) return [];
      const { data, error } = await supabase
        .from("workout_template_exercises")
        .select("*, exercises(id, name, muscle_group, equipment, category)")
        .eq("template_id", selectedTemplate.id)
        .order("sort_order");
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        exercise: d.exercises,
      })) as TemplateExercise[];
    },
    enabled: !!selectedTemplate,
  });

  // Creator names
  const creatorIds = [...new Set(templates.map((t) => t.user_id))];
  const { data: creatorProfiles = {} } = useQuery({
    queryKey: ["template-creators", creatorIds.join(",")],
    queryFn: async () => {
      if (creatorIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", creatorIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p) => { map[p.user_id] = p.name || "Coach"; });
      return map;
    },
    enabled: creatorIds.length > 0,
  });

  const filtered = templates.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchDifficulty = difficultyFilter === "all" || t.difficulty === difficultyFilter;
    const matchCategory = categoryFilter === "all" || t.category === categoryFilter;
    return matchSearch && matchDifficulty && matchCategory;
  });

  const availableCategories = [...new Set(templates.map((t) => t.category).filter(Boolean))];

  // ─── Detail View ───
  if (selectedTemplate) {
    const diff = DIFFICULTY_CONFIG[selectedTemplate.difficulty || "intermediate"];
    const DiffIcon = diff?.icon || Zap;

    return (
      <div className="space-y-5">
        <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back to Templates
        </Button>

        <div className="space-y-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-2xl font-heading text-foreground">{selectedTemplate.name}</h2>
              {onStartFromTemplate && (
                <Button onClick={() => onStartFromTemplate(selectedTemplate.id)} className="gap-2 shrink-0">
                  <Play className="h-4 w-4" /> Start Workout
                </Button>
              )}
            </div>
            {selectedTemplate.description && (
              <p className="text-sm text-muted-foreground mt-1">{selectedTemplate.description}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {diff && (
              <Badge variant="outline" className={diff.color}>
                <DiffIcon className="h-3 w-3 mr-1" /> {diff.label}
              </Badge>
            )}
            {selectedTemplate.category && (
              <Badge variant="secondary">{CATEGORY_LABELS[selectedTemplate.category] || selectedTemplate.category}</Badge>
            )}
            {selectedTemplate.estimated_minutes && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" /> ~{selectedTemplate.estimated_minutes} min
              </Badge>
            )}
            <Badge variant="outline" className="text-muted-foreground">
              by {creatorProfiles[selectedTemplate.user_id] || "Coach"}
            </Badge>
          </div>

          {selectedTemplate.coach_notes && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Coach Notes</p>
                <p className="text-sm text-foreground">{selectedTemplate.coach_notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Exercises */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Exercises ({templateExercises.length})
            </h3>
            {templateExercises.map((te, idx) => (
              <Card key={te.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{te.exercise.name}</p>
                      <div className="flex gap-1 mt-0.5">
                        {te.exercise.muscle_group && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{te.exercise.muscle_group}</Badge>
                        )}
                        {te.exercise.equipment && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{te.exercise.equipment}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">
                        {te.sets || 3} × {te.reps || "—"}
                      </p>
                      {te.weight_kg && (
                        <p className="text-[10px] text-muted-foreground">{te.weight_kg} kg</p>
                      )}
                      {te.rest_seconds && (
                        <p className="text-[10px] text-muted-foreground">{te.rest_seconds}s rest</p>
                      )}
                    </div>
                  </div>
                  {te.notes && (
                    <p className="text-xs text-muted-foreground mt-2 pl-12">{te.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── List View ───
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-heading text-foreground">Workout Templates</h2>
        <p className="text-sm text-muted-foreground">Coach-designed programs ready to follow</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Difficulty" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
            {availableCategories.length > 0 && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {availableCategories.map((c) => (
                    <SelectItem key={c!} value={c!}>{CATEGORY_LABELS[c!] || c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">{filtered.length} templates available</p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Dumbbell className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No templates yet</h3>
            <p className="text-sm text-muted-foreground">Coach templates will appear here once created.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {filtered.map((t) => {
            const diff = DIFFICULTY_CONFIG[t.difficulty || "intermediate"];
            const DiffIcon = diff?.icon || Zap;
            const creatorName = creatorProfiles[t.user_id] || "Coach";

            return (
              <Card
                key={t.id}
                className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedTemplate(t)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate">{t.name}</h3>
                      {t.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>
                      )}
                    </div>
                    {onStartFromTemplate && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartFromTemplate(t.id);
                        }}
                      >
                        <Play className="h-3.5 w-3.5" /> Start
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {diff && (
                      <Badge variant="outline" className={`text-[10px] ${diff.color}`}>
                        <DiffIcon className="h-3 w-3 mr-0.5" /> {diff.label}
                      </Badge>
                    )}
                    {t.category && (
                      <Badge variant="secondary" className="text-[10px]">
                        {CATEGORY_LABELS[t.category] || t.category}
                      </Badge>
                    )}
                    {t.estimated_minutes && (
                      <Badge variant="outline" className="text-[10px] gap-0.5">
                        <Clock className="h-3 w-3" /> {t.estimated_minutes}m
                      </Badge>
                    )}
                  </div>

                  <p className="text-[10px] text-muted-foreground">by {creatorName}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
