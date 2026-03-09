import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Play, Square, Plus, Trash2, Dumbbell, Clock, Check, Search,
  ChevronDown, ChevronUp, Loader2, Trophy, RotateCcw, ArrowLeft, Weight, Crown,
  Timer, X, Copy, LayoutTemplate,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import { format } from "date-fns";
import { WorkoutAnalytics } from "./WorkoutAnalytics";
import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import confetti from "canvas-confetti";

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

interface WorkoutLoggerProps {
  pendingTemplateId?: string | null;
  onTemplateLoaded?: () => void;
}

export function WorkoutLogger({ pendingTemplateId, onTemplateLoaded }: WorkoutLoggerProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { weightUnit, convertWeight, toKg, useMetric } = usePreferredUnits();

  // Detail view
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);

  // Workout state
  const [isActive, setIsActive] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([]);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rest timer
  const [restSeconds, setRestSeconds] = useState(0);
  const [restTarget, setRestTarget] = useState(60);
  const [restActive, setRestActive] = useState(false);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // ─── Personal Records Query (must be before any early returns) ───
  const { data: personalRecords = [] } = useQuery({
    queryKey: ["personal-records", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("workout_sets")
        .select("exercise_id, weight_kg, reps, exercises(name, muscle_group)")
        .order("weight_kg", { ascending: false });
      if (!data) return [];
      const prMap: Record<string, { exercise_id: string; name: string; muscle_group: string | null; weight: number; reps: number }> = {};
      for (const s of data as any[]) {
        if (!s.weight_kg) continue;
        const eid = s.exercise_id;
        if (!prMap[eid] || s.weight_kg > prMap[eid].weight) {
          prMap[eid] = {
            exercise_id: eid,
            name: s.exercises?.name || "Unknown",
            muscle_group: s.exercises?.muscle_group || null,
            weight: s.weight_kg,
            reps: s.reps || 0,
          };
        }
      }
      return Object.values(prMap).sort((a, b) => b.weight - a.weight).slice(0, 10);
    },
    enabled: !!user,
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

  // Rest timer effect
  useEffect(() => {
    if (restActive) {
      restRef.current = setInterval(() => {
        setRestSeconds((s) => {
          if (s + 1 >= restTarget) {
            // Rest complete
            if (restRef.current) clearInterval(restRef.current);
            setRestActive(false);
            toast.info("⏰ Rest over — next set!", { duration: 3000 });
            return 0;
          }
          return s + 1;
        });
      }, 1000);
    }
    return () => {
      if (restRef.current) clearInterval(restRef.current);
    };
  }, [restActive, restTarget]);

  // Listen for "start from template" events from the Templates tab
  const startFromTemplate = useCallback(async (templateId: string) => {
    const { data: template } = await supabase
      .from("workout_templates")
      .select("name")
      .eq("id", templateId)
      .single();

    const { data: exercises } = await supabase
      .from("workout_template_exercises")
      .select("*, exercises(id, name, muscle_group, equipment, category)")
      .eq("template_id", templateId)
      .order("sort_order");

    if (!exercises || exercises.length === 0) {
      toast.error("Template has no exercises");
      return;
    }

    const grouped: WorkoutExercise[] = (exercises as any[]).map((te) => ({
      exercise: {
        id: te.exercises?.id || te.exercise_id,
        name: te.exercises?.name || "Unknown",
        muscle_group: te.exercises?.muscle_group || null,
        equipment: te.exercises?.equipment || null,
        category: te.exercises?.category || null,
      },
      sets: Array.from({ length: te.sets || 3 }, (_, i) => ({
        tempId: nextTempId(),
        exercise_id: te.exercise_id,
        set_number: i + 1,
        weight_kg: te.weight_kg,
        reps: te.reps,
        rest_seconds: te.rest_seconds,
        completed: false,
      })),
      collapsed: false,
    }));

    setWorkoutExercises(grouped);
    setWorkoutName(template?.name || "Template Workout");
    setElapsedSeconds(0);
    setIsActive(true);
    toast.success("Template loaded — let's go! 💪");
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const templateId = (e as CustomEvent).detail?.templateId;
      if (templateId) startFromTemplate(templateId);
    };
    window.addEventListener("start-from-template", handler);
    return () => window.removeEventListener("start-from-template", handler);
  }, [startFromTemplate]);

  const startRestTimer = (seconds: number) => {
    if (restRef.current) clearInterval(restRef.current);
    setRestTarget(seconds);
    setRestSeconds(0);
    setRestActive(true);
  };

  const stopRestTimer = () => {
    if (restRef.current) clearInterval(restRef.current);
    setRestActive(false);
    setRestSeconds(0);
  };

  const startWorkout = () => {
    setIsActive(true);
    setElapsedSeconds(0);
    setWorkoutExercises([]);
    setWorkoutName("");
  };

  const repeatWorkout = async (workoutId: string, workoutNameStr: string) => {
    const { data: sets, error } = await supabase
      .from("workout_sets")
      .select("exercise_id, set_number, weight_kg, reps, rest_seconds, exercises(id, name, muscle_group, equipment, category)")
      .eq("workout_log_id", workoutId)
      .order("exercise_id")
      .order("set_number");

    if (error || !sets || sets.length === 0) {
      toast.error("Could not load workout template");
      return;
    }

    // Group by exercise
    const grouped: Record<string, WorkoutExercise> = {};
    for (const s of sets as any[]) {
      const eid = s.exercise_id;
      if (!grouped[eid]) {
        grouped[eid] = {
          exercise: {
            id: s.exercises?.id || eid,
            name: s.exercises?.name || "Unknown",
            muscle_group: s.exercises?.muscle_group || null,
            equipment: s.exercises?.equipment || null,
            category: s.exercises?.category || null,
          },
          sets: [],
          collapsed: false,
        };
      }
      grouped[eid].sets.push({
        tempId: nextTempId(),
        exercise_id: eid,
        set_number: grouped[eid].sets.length + 1,
        weight_kg: s.weight_kg,
        reps: s.reps,
        rest_seconds: s.rest_seconds,
        completed: false,
      });
    }

    setWorkoutExercises(Object.values(grouped));
    setWorkoutName(workoutNameStr);
    setElapsedSeconds(0);
    setIsActive(true);
    toast.success("Workout loaded — fill in your sets and go! 🔁");
  };

  const deleteWorkout = async (workoutId: string) => {
    if (!user) return;
    // Delete sets first (cascade won't help with RLS), then the log
    await supabase.from("workout_sets").delete().eq("workout_log_id", workoutId);
    const { error } = await supabase.from("workout_logs").delete().eq("id", workoutId);
    if (error) {
      toast.error("Failed to delete workout");
    } else {
      toast.success("Workout deleted");
      queryClient.invalidateQueries({ queryKey: queryKeys.workoutLogs(user.id) });
    }
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
    let justCompleted = false;
    let restDuration = 60;

    setWorkoutExercises((prev) =>
      prev.map((we, i) => {
        if (i !== exerciseIdx) return we;
        return {
          ...we,
          sets: we.sets.map((s) => {
            if (s.tempId !== setTempId) return s;
            const newCompleted = !s.completed;
            if (newCompleted) {
              justCompleted = true;
              restDuration = s.rest_seconds || 60;
            }
            return { ...s, completed: newCompleted };
          }),
        };
      })
    );

    if (justCompleted) {
      startRestTimer(restDuration);
    }
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

    // ── PR Detection ──
    // Group completed sets by exercise
    const exerciseMaxes: Record<string, { weight: number; name: string }> = {};
    for (const we of workoutExercises) {
      for (const s of we.sets) {
        if (!s.completed || !s.weight_kg) continue;
        const prev = exerciseMaxes[s.exercise_id];
        if (!prev || s.weight_kg > prev.weight) {
          exerciseMaxes[s.exercise_id] = { weight: s.weight_kg, name: we.exercise.name };
        }
      }
    }

    // Check against historical PRs
    for (const [exerciseId, current] of Object.entries(exerciseMaxes)) {
      const { data: historicalMax } = await supabase
        .from("workout_sets")
        .select("weight_kg")
        .eq("exercise_id", exerciseId)
        .not("workout_log_id", "eq", log.id)
        .order("weight_kg", { ascending: false })
        .limit(1)
        .single();

      const previousBest = historicalMax?.weight_kg ?? 0;
      if (current.weight > (previousBest as number)) {
        toast.success(`🏆 New PR! ${current.name}: ${Math.round(convertWeight(current.weight) * 10) / 10} ${weightUnit}`, { duration: 5000 });
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      }
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.workoutLogs(user.id) });
    queryClient.invalidateQueries({ queryKey: ["personal-records", user.id] });
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

        {/* Rest Timer Bar */}
        {restActive && (
          <Card className="border-accent bg-accent/10 animate-in slide-in-from-top-2">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center">
                    <Timer className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Rest Timer</p>
                    <p className="text-xl font-mono font-bold tabular-nums">
                      {formatTimer(restTarget - restSeconds)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Progress bar */}
                  <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-1000"
                      style={{ width: `${(restSeconds / restTarget) * 100}%` }}
                    />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={stopRestTimer}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                    <span>Weight ({weightUnit})</span>
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
                        value={set.weight_kg != null ? Math.round(convertWeight(set.weight_kg) * 10) / 10 : ""}
                        onChange={(e) => {
                          const displayVal = e.target.value ? Number(e.target.value) : null;
                          const kgVal = displayVal != null ? Math.round(toKg(displayVal) * 100) / 100 : null;
                          updateSet(exIdx, set.tempId, "weight_kg", kgVal);
                        }}
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

  // ─── Workout Detail View ───
  if (selectedWorkoutId) {
    return <WorkoutDetailView workoutId={selectedWorkoutId} onBack={() => setSelectedWorkoutId(null)} />;
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

      {/* Personal Records */}
      {personalRecords.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Crown className="h-4 w-4 text-yellow-500" /> Personal Records
          </h3>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {personalRecords.map((pr) => (
              <Card key={pr.exercise_id} className="border-yellow-500/20 bg-yellow-500/[0.03]">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{pr.name}</p>
                    {pr.muscle_group && (
                      <p className="text-[10px] text-muted-foreground">{pr.muscle_group}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">{Math.round(convertWeight(pr.weight) * 10) / 10} {weightUnit}</p>
                    {pr.reps > 0 && (
                      <p className="text-[10px] text-muted-foreground">× {pr.reps} reps</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

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
            <Card
              key={w.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedWorkoutId(w.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm">{w.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(w.started_at), "MMM d, yyyy · h:mm a")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {w.duration_minutes != null && (
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {w.duration_minutes} min
                      </Badge>
                    )}
                    {w.completed_at && (
                      <Badge className="bg-primary/10 text-primary text-xs">
                        <Check className="h-3 w-3 mr-1" /> Done
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title="Repeat workout"
                      onClick={(e) => {
                        e.stopPropagation();
                        repeatWorkout(w.id, w.name);
                      }}
                    >
                      <Copy className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWorkout(w.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Analytics */}
      <WorkoutAnalytics />
    </div>
  );
}

// ─── Workout Detail Sub-Component ───
interface WorkoutDetailProps {
  workoutId: string;
  onBack: () => void;
}

interface WorkoutSetRow {
  id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rest_seconds: number | null;
  exercise_id: string;
  exercises: { name: string; muscle_group: string | null; equipment: string | null } | null;
}

function WorkoutDetailView({ workoutId, onBack }: WorkoutDetailProps) {
  const { weightUnit, convertWeight } = usePreferredUnits();
  const { data: workout, isLoading: loadingWorkout } = useQuery({
    queryKey: ["workout-detail", workoutId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("id", workoutId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: sets = [], isLoading: loadingSets } = useQuery({
    queryKey: ["workout-sets", workoutId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_sets")
        .select("id, set_number, weight_kg, reps, rest_seconds, exercise_id, exercises(name, muscle_group, equipment)")
        .eq("workout_log_id", workoutId)
        .order("exercise_id")
        .order("set_number");
      if (error) throw error;
      return (data || []) as unknown as WorkoutSetRow[];
    },
  });

  // Group sets by exercise
  const exerciseGroups = sets.reduce<Record<string, { name: string; muscle_group: string | null; equipment: string | null; sets: WorkoutSetRow[] }>>((acc, s) => {
    if (!acc[s.exercise_id]) {
      acc[s.exercise_id] = {
        name: s.exercises?.name || "Unknown",
        muscle_group: s.exercises?.muscle_group || null,
        equipment: s.exercises?.equipment || null,
        sets: [],
      };
    }
    acc[s.exercise_id].sets.push(s);
    return acc;
  }, {});

  const loading = loadingWorkout || loadingSets;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalSets = sets.length;
  const totalVolume = Math.round(sets.reduce((sum, s) => sum + (convertWeight(s.weight_kg || 0) * (s.reps || 0)), 0));

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Workouts
      </Button>

      {/* Summary card */}
      <Card className="border-primary/20">
        <CardContent className="p-5">
          <h2 className="text-xl font-heading text-foreground">{workout?.name}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {workout?.started_at && format(new Date(workout.started_at), "EEEE, MMM d, yyyy · h:mm a")}
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            {workout?.duration_minutes != null && (
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-semibold">{workout.duration_minutes}</span>
                <span className="text-muted-foreground">min</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-sm">
              <Dumbbell className="h-4 w-4 text-primary" />
              <span className="font-semibold">{Object.keys(exerciseGroups).length}</span>
              <span className="text-muted-foreground">exercises</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Check className="h-4 w-4 text-primary" />
              <span className="font-semibold">{totalSets}</span>
              <span className="text-muted-foreground">sets</span>
            </div>
            {totalVolume > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Weight className="h-4 w-4 text-primary" />
                <span className="font-semibold">{totalVolume.toLocaleString()}</span>
                <span className="text-muted-foreground">{weightUnit} volume</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Exercise breakdown */}
      {Object.entries(exerciseGroups).map(([exId, group]) => (
        <Card key={exId}>
          <CardContent className="p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-sm">{group.name}</h3>
              <div className="flex gap-1 mt-1">
                {group.muscle_group && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{group.muscle_group}</Badge>
                )}
                {group.equipment && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{group.equipment}</Badge>
                )}
              </div>
            </div>

            {/* Sets table */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-4 gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                <span>Set</span>
                <span>Weight ({weightUnit})</span>
                <span>Reps</span>
                <span>Rest (s)</span>
              </div>
              {group.sets.map((s) => (
                <div key={s.id} className="grid grid-cols-4 gap-2 items-center rounded-lg bg-muted/30 px-2 py-2 text-sm">
                  <span className="font-bold text-muted-foreground">{s.set_number}</span>
                  <span className="font-medium">{s.weight_kg != null ? Math.round(convertWeight(s.weight_kg) * 10) / 10 : "—"}</span>
                  <span className="font-medium">{s.reps ?? "—"}</span>
                  <span className="text-muted-foreground">{s.rest_seconds ?? "—"}</span>
                </div>
              ))}
            </div>

            {/* Exercise volume */}
            {group.sets.some((s) => s.weight_kg && s.reps) && (
              <p className="text-xs text-muted-foreground">
                Volume: {Math.round(group.sets.reduce((sum, s) => sum + (convertWeight(s.weight_kg || 0) * (s.reps || 0)), 0)).toLocaleString()} {weightUnit}
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {sets.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No sets recorded for this workout</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
