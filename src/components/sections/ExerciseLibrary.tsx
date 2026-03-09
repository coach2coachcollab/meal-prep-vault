import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Loader2, Dumbbell, Info, Trash2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

interface Exercise {
  id: string;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  category: string | null;
  instructions: string | null;
  image_url: string | null;
  is_public: boolean | null;
  user_id: string | null;
}

const EXERCISE_PAGE_SIZE = 24;

const MUSCLE_GROUPS = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms",
  "Core", "Quadriceps", "Hamstrings", "Glutes", "Calves", "Full Body"
];

const EQUIPMENT_OPTIONS = [
  "Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", 
  "Kettlebell", "Resistance Band", "TRX", "Medicine Ball", "Other"
];

const CATEGORY_OPTIONS = ["Strength", "Cardio", "Flexibility", "Plyometric"];

export function ExerciseLibrary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("all");
  const [equipmentFilter, setEquipmentFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    muscle_group: "",
    equipment: "",
    category: "Strength",
    instructions: "",
  });

  // Query for exercises
  const {
    data: exercises = [],
    isLoading: loading,
  } = useQuery({
    queryKey: queryKeys.exercises(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, muscle_group, equipment, category, instructions, image_url, is_public, user_id")
        .order("name", { ascending: true });
      if (error) console.error("Failed to load exercises", error);
      return (data || []) as Exercise[];
    },
  });

  const customExercises = exercises.filter((e) => e.user_id === user?.id);

  const filtered = exercises.filter((exercise) => {
    const matchesSearch = exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exercise.muscle_group || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exercise.equipment || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMuscle = muscleFilter === "all" || exercise.muscle_group === muscleFilter;
    const matchesEquipment = equipmentFilter === "all" || exercise.equipment === equipmentFilter;
    return matchesSearch && matchesMuscle && matchesEquipment;
  });

  const muscleGroups = [...new Set(exercises.map((e) => e.muscle_group).filter(Boolean))];
  const equipmentTypes = [...new Set(exercises.map((e) => e.equipment).filter(Boolean))];

  const createExercise = async () => {
    if (!user || !form.name.trim()) {
      toast.error("Please enter an exercise name");
      return;
    }
    setSaving(true);

    const { error } = await supabase.from("exercises").insert({
      user_id: user.id,
      name: form.name,
      muscle_group: form.muscle_group || null,
      equipment: form.equipment || null,
      category: form.category || "Strength",
      instructions: form.instructions || null,
      is_public: false,
    });

    if (error) {
      toast.error("Failed to save exercise");
    } else {
      toast.success("Exercise created! 💪");
      setForm({ name: "", muscle_group: "", equipment: "", category: "Strength", instructions: "" });
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.exercises() });
    }
    setSaving(false);
  };

  const deleteExercise = async (exerciseId: string) => {
    const { error } = await supabase.from("exercises").delete().eq("id", exerciseId);
    if (error) {
      toast.error("Failed to delete exercise");
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.exercises() });
      toast.success("Exercise deleted");
    }
  };

  // Exercise detail view
  if (selectedExercise) {
    return (
      <div className="space-y-5">
        <Button variant="ghost" size="sm" onClick={() => setSelectedExercise(null)}>
          ← Back to Library
        </Button>
        <Card>
          <CardContent className="p-6 space-y-4">
            {selectedExercise.image_url ? (
              <img
                src={selectedExercise.image_url}
                alt={selectedExercise.name}
                className="w-full h-48 object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-48 bg-gradient-to-br from-primary/10 via-accent/10 to-secondary flex items-center justify-center rounded-lg">
                <Dumbbell className="h-16 w-16 text-muted-foreground/40" />
              </div>
            )}
            <h2 className="text-2xl font-heading">{selectedExercise.name}</h2>
            <div className="flex flex-wrap gap-2">
              {selectedExercise.muscle_group && (
                <Badge variant="secondary">{selectedExercise.muscle_group}</Badge>
              )}
              {selectedExercise.equipment && (
                <Badge variant="outline">{selectedExercise.equipment}</Badge>
              )}
              {selectedExercise.category && (
                <Badge className="bg-primary/10 text-primary">{selectedExercise.category}</Badge>
              )}
            </div>
            {selectedExercise.instructions && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Instructions</h3>
                <p className="text-sm whitespace-pre-wrap">{selectedExercise.instructions}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-heading flex items-center gap-2 text-foreground">
            Exercise Library
            {customExercises.length > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs">{customExercises.length} Custom</Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">Browse and create exercises for your workouts</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Add Exercise</span>
        </Button>
      </div>

      {/* Search + Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search exercises..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={muscleFilter} onValueChange={setMuscleFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Muscle group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All muscles</SelectItem>
                {(muscleGroups.length > 0 ? muscleGroups : MUSCLE_GROUPS).map((m) => (
                  <SelectItem key={m} value={m!}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All equipment</SelectItem>
                {(equipmentTypes.length > 0 ? equipmentTypes : EQUIPMENT_OPTIONS).map((e) => (
                  <SelectItem key={e} value={e!}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} exercises found
        {customExercises.length > 0 && <span className="text-primary ml-1">({customExercises.length} custom)</span>}
      </p>

      {/* Exercise Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="h-16 w-16 rounded-full bg-icon-bg flex items-center justify-center mx-auto mb-3">
            <Dumbbell className="h-8 w-8 text-foreground" />
          </div>
          <p className="text-muted-foreground">
            {searchTerm ? "No exercises match your search" : "No exercises yet. Add your first one!"}
          </p>
          <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Exercise
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {filtered.map((exercise) => (
            <Card key={exercise.id} className="overflow-hidden hover:shadow-md transition-shadow">
              {/* Image or placeholder */}
              <div className="relative h-36 overflow-hidden">
                {exercise.image_url ? (
                  <img src={exercise.image_url} alt={exercise.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/10 via-accent/10 to-secondary flex items-center justify-center">
                    <Dumbbell className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
                {/* Muscle group badge overlay */}
                {exercise.muscle_group && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-3 pb-2 pt-6">
                    <Badge className="bg-primary/90 text-primary-foreground text-xs">
                      {exercise.muscle_group}
                    </Badge>
                  </div>
                )}
              </div>

              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-base truncate">{exercise.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {exercise.equipment && (
                      <Badge variant="outline" className="text-[11px] px-2 py-0.5">{exercise.equipment}</Badge>
                    )}
                    {exercise.category && (
                      <Badge variant="outline" className="text-[11px] px-2 py-0.5">{exercise.category}</Badge>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setSelectedExercise(exercise)}>
                    <Info className="h-4 w-4" /> Details
                  </Button>
                  {exercise.user_id === user?.id && (
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => deleteExercise(exercise.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load More */}
      {hasNextPage && exercises.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
            {isFetchingNextPage ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Loading...</> : "Load More Exercises"}
          </Button>
        </div>
      )}

      {/* Create Exercise Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" /> Add Custom Exercise
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Exercise Name *</Label>
              <Input
                placeholder="e.g., Barbell Back Squat"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Muscle Group</Label>
                <Select value={form.muscle_group} onValueChange={(v) => setForm({ ...form, muscle_group: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSCLE_GROUPS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Equipment</Label>
                <Select value={form.equipment} onValueChange={(v) => setForm({ ...form, equipment: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_OPTIONS.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Instructions (optional)</Label>
              <Textarea
                placeholder="Step-by-step instructions..."
                rows={4}
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              />
            </div>
            <Button className="w-full" onClick={createExercise} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</> : "Create Exercise"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
