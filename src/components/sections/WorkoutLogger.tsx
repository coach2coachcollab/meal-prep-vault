import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Play, Square, Plus, Trash2, Dumbbell, Clock, Check, Search,
  ChevronDown, ChevronUp, Loader2, Trophy, RotateCcw, ArrowLeft, Weight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import { format } from "date-fns";

interface Exercise {
  id: string;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  category: string | null;
}

interface WorkoutSet {
  tempId: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rest_seconds: number | null;
  completed: boolean;
}

interface WorkoutExercise {
  exercise: Exercise;
  sets: WorkoutSet[];
  collapsed: boolean;
}

interface PastWorkout {
  id: string;
  name: string;
  started_at: string;
  completed_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
}

function formatTimer(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

let tempIdCounter = 0;
const nextTempId = () => `tmp-${++tempIdCounter}`;

export function WorkoutLogger() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Detail view
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);

  // Workout state
  const [isActive, setIsActive] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([]);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Exercise picker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerMuscle, setPickerMuscle] = useState("all");

  // Past workouts
  const { data: pastWorkouts = [], isLoading: loadingHistory } = useQuery({
    queryKey: queryKeys.workoutLogs(user?.id),
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as PastWorkout[];
    },
    enabled: !!user,
  });

  // All exercises for picker
  const { data: allExercises = [] } = useQuery({
    queryKey: queryKeys.exercises(),
    queryFn: async () => {
      const { data } = await supabase
        .from("exercises")
        .select("id, name, muscle_group, equipment, category")
        .order("name");
      return (data || []) as Exercise[];
    },
  });

  const filteredExercises = allExercises.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(pickerSearch.toLowerCase());
    const matchMuscle = pickerMuscle === "all" || e.muscle_group === pickerMuscle;
    return matchSearch && matchMuscle;
  });

  const muscleGroups = [...new Set(allExercises.map((e) => e.muscle_group).filter(Boolean))];

  // Timer
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  const startWorkout = () => {
    setIsActive(true);
    setElapsedSeconds(0);
    setWorkoutExercises([]);
    setWorkoutName("");
  };

  const discardWorkout = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setElapsedSeconds(0);
    setWorkoutExercises([]);
    setWorkoutName("");
  };

  const addExercise = (exercise: Exercise) => {
    const firstSet: WorkoutSet = {
      tempId: nextTempId(),
      exercise_id: exercise.id,
      set_number: 1,
      weight_kg: null,
      reps: null,
      rest_seconds: null,
      completed: false,
    };
    setWorkoutExercises((prev) => [...prev, { exercise, sets: [firstSet], collapsed: false }]);
    setShowPicker(false);
    setPickerSearch("");
  };

  const removeExercise = (idx: number) => {
    setWorkoutExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleCollapse = (idx: number) => {
    setWorkoutExercises((prev) =>
      prev.map((we, i) => (i === idx ? { ...we, collapsed: !we.collapsed } : we))
    );
  };

  const addSet = (exerciseIdx: number) => {
    setWorkoutExercises((prev) =>
      prev.map((we, i) => {
        if (i !== exerciseIdx) return we;
        const lastSet = we.sets[we.sets.length - 1];
        const newSet: WorkoutSet = {
          tempId: nextTempId(),
          exercise_id: we.exercise.id,
          set_number: we.sets.length + 1,
          weight_kg: lastSet?.weight_kg ?? null,
          reps: lastSet?.reps ?? null,
          rest_seconds: lastSet?.rest_seconds ?? null,
          completed: false,
        };
        return { ...we, sets: [...we.sets, newSet] };
      })
    );
  };

  const removeSet = (exerciseIdx: number, setTempId: string) => {
    setWorkoutExercises((prev) =>
      prev.map((we, i) => {
        if (i !== exerciseIdx) return we;
        const newSets = we.sets
          .filter((s) => s.tempId !== setTempId)
          .map((s, idx) => ({ ...s, set_number: idx + 1 }));
        return { ...we, sets: newSets };
      })
    );
  };

  const updateSet = (exerciseIdx: number, setTempId: string, field: keyof WorkoutSet, value: any) => {
    setWorkoutExercises((prev) =>
      prev.map((we, i) => {
        if (i !== exerciseIdx) return we;
        return {
          ...we,
          sets: we.sets.map((s) => (s.tempId === setTempId ? { ...s, [field]: value } : s)),
        };
      })
    );
  };

  const toggleSetComplete = (exerciseIdx: number, setTempId: string) => {
    setWorkoutExercises((prev) =>
      prev.map((we, i) => {
        if (i !== exerciseIdx) return we;
        return {
          ...we,
          sets: we.sets.map((s) =>
            s.tempId === setTempId ? { ...s, completed: !s.completed } : s
          ),
        };
      })
    );
  };

  const finishWorkout = async () => {
    if (!user) return;
    const completedSets = workoutExercises.flatMap((we) => we.sets.filter((s) => s.completed));
    if (completedSets.length === 0) {
      toast.error("Complete at least one set before finishing");
      return;
    }

    setSaving(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const durationMinutes = Math.round(elapsedSeconds / 60);
    const name = workoutName.trim() || `Workout ${format(new Date(), "MMM d")}`;

    const { data: log, error: logError } = await supabase
      .from("workout_logs")
      .insert({
        user_id: user.id,
        name,
        started_at: new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
        completed_at: new Date().toISOString(),
        duration_minutes: durationMinutes,
      })
      .select("id")
      .single();

    if (logError || !log) {
      toast.error("Failed to save workout");
      setSaving(false);
      return;
    }

    const setsToInsert = completedSets.map((s) => ({
      workout_log_id: log.id,
      exercise_id: s.exercise_id,
      set_number: s.set_number,
      weight_kg: s.weight_kg,
      reps: s.reps,
      rest_seconds: s.rest_seconds,
    }));

    const { error: setsError } = await supabase.from("workout_sets").insert(setsToInsert);
    if (setsError) {
      toast.error("Workout saved but some sets failed");
    } else {
      toast.success(`Workout saved! 💪 ${completedSets.length} sets logged`);
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.workoutLogs(user.id) });
    setIsActive(false);
    setElapsedSeconds(0);
    setWorkoutExercises([]);
    setWorkoutName("");
    setSaving(false);
  };

  const totalCompletedSets = workoutExercises.reduce(
    (acc, we) => acc + we.sets.filter((s) => s.completed).length,
    0
  );

  // ─── Active Workout View ───
  if (isActive) {
    return (
      <div className="space-y-4">
        {/* Timer bar */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <Input
                    className="border-none p-0 h-auto text-lg font-bold bg-transparent focus-visible:ring-0"
                    placeholder="Workout Name"
                    value={workoutName}
                    onChange={(e) => setWorkoutName(e.target.value)}
                  />
                  <p className="text-2xl font-mono font-bold text-primary tabular-nums">
                    {formatTimer(elapsedSeconds)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={discardWorkout}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Discard
                </Button>
                <Button size="sm" onClick={finishWorkout} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  Finish
                </Button>
              </div>
            </div>
            {totalCompletedSets > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {totalCompletedSets} set{totalCompletedSets !== 1 ? "s" : ""} completed
              </p>
            )}
          </CardContent>
        </Card>

        {/* Exercise list */}
        {workoutExercises.map((we, exIdx) => (
          <Card key={exIdx}>
            <CardContent className="p-4 space-y-3">
              {/* Exercise header */}
              <div className="flex items-center justify-between">
                <button onClick={() => toggleCollapse(exIdx)} className="flex items-center gap-2 flex-1 text-left">
                  {we.collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <h3 className="font-semibold text-sm">{we.exercise.name}</h3>
                    <div className="flex gap-1 mt-0.5">
                      {we.exercise.muscle_group && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{we.exercise.muscle_group}</Badge>
                      )}
                      {we.exercise.equipment && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{we.exercise.equipment}</Badge>
                      )}
                    </div>
                  </div>
                </button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeExercise(exIdx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              {/* Sets table */}
              {!we.collapsed && (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-[32px_1fr_1fr_1fr_40px] gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                    <span>Set</span>
                    <span>Weight (kg)</span>
                    <span>Reps</span>
                    <span>Rest (s)</span>
                    <span></span>
                  </div>

                  {we.sets.map((set) => (
                    <div
                      key={set.tempId}
                      className={`grid grid-cols-[32px_1fr_1fr_1fr_40px] gap-2 items-center rounded-lg px-1 py-1.5 transition-colors ${
                        set.completed ? "bg-primary/5" : ""
                      }`}
                    >
                      <span className="text-xs font-bold text-muted-foreground text-center">{set.set_number}</span>
                      <Input
                        type="number"
                        className="h-8 text-sm text-center"
                        placeholder="0"
                        value={set.weight_kg ?? ""}
                        onChange={(e) => updateSet(exIdx, set.tempId, "weight_kg", e.target.value ? Number(e.target.value) : null)}
                      />
                      <Input
                        type="number"
                        className="h-8 text-sm text-center"
                        placeholder="0"
                        value={set.reps ?? ""}
                        onChange={(e) => updateSet(exIdx, set.tempId, "reps", e.target.value ? Number(e.target.value) : null)}
                      />
                      <Input
                        type="number"
                        className="h-8 text-sm text-center"
                        placeholder="60"
                        value={set.rest_seconds ?? ""}
                        onChange={(e) => updateSet(exIdx, set.tempId, "rest_seconds", e.target.value ? Number(e.target.value) : null)}
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleSetComplete(exIdx, set.tempId)}
                          className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${
                            set.completed
                              ? "bg-primary text-primary-foreground"
                              : "border border-input hover:bg-accent"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => addSet(exIdx)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Set
                    </Button>
                    {we.sets.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive"
                        onClick={() => removeSet(exIdx, we.sets[we.sets.length - 1].tempId)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Last
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Add exercise button */}
        <Button variant="outline" className="w-full border-dashed" onClick={() => setShowPicker(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Exercise
        </Button>

        {/* Exercise picker dialog */}
        <Dialog open={showPicker} onOpenChange={setShowPicker}>
          <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Add Exercise</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-10"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                />
              </div>
              <Select value={pickerMuscle} onValueChange={setPickerMuscle}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Muscle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {muscleGroups.map((m) => (
                    <SelectItem key={m!} value={m!}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 mt-2">
              {filteredExercises.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No exercises found</p>
              ) : (
                filteredExercises.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => addExercise(ex)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Dumbbell className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ex.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {[ex.muscle_group, ex.equipment].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Idle View (History + Start) ───
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading text-foreground">Workouts</h2>
          <p className="text-sm text-muted-foreground">Track your sets, reps, and progress</p>
        </div>
        <Button onClick={startWorkout} className="gap-2">
          <Play className="h-4 w-4" /> Start Workout
        </Button>
      </div>

      {/* Past workouts */}
      {loadingHistory ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : pastWorkouts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No workouts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Start your first workout to begin tracking!</p>
            <Button onClick={startWorkout}>
              <Play className="h-4 w-4 mr-2" /> Start First Workout
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Workouts</h3>
          {pastWorkouts.map((w) => (
            <Card key={w.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm">{w.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(w.started_at), "MMM d, yyyy · h:mm a")}
                    </p>
                  </div>
                  <div className="text-right">
                    {w.duration_minutes != null && (
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {w.duration_minutes} min
                      </Badge>
                    )}
                    {w.completed_at && (
                      <Badge className="bg-primary/10 text-primary text-xs ml-1">
                        <Check className="h-3 w-3 mr-1" /> Done
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
