import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus, ChevronLeft, ChevronRight, Flame, Beef, Wheat, Droplets, Trash2, Search,
  UtensilsCrossed, ImagePlus, MoreHorizontal, Pencil, CheckCircle2, Circle,
  Settings2, ChevronDown, StickyNote, Star, Smile, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { MealJournalSkeleton } from "@/components/skeletons/MealJournalSkeleton";
import { WeeklySummaryCharts } from "./WeeklySummaryCharts";

const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const moods = ["😊", "😐", "😴", "😤", "😢"];

interface JournalEntry {
  id: string;
  meal_type: string;
  food_name: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  recipe_id: string | null;
  image_url: string | null;
}

interface DbMeal {
  id: string;
  title: string;
  description: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  image_url: string | null;
  tags: string[] | null;
  servings: number | null;
}

interface Habit {
  id: string;
  name: string;
  icon: string;
  completed: boolean;
  streak: number;
}

const defaultHabitsByGoal: Record<string, string[]> = {
  "Hormone balance": ["Sleep 7-8 hours", "Drink 8 glasses of water", "20+ minutes movement"],
  "Lose fat": ["Drink 8 glasses of water", "30+ minutes movement", "Eat protein at every meal"],
  "Build muscle": ["Strength training today", "Hit protein target", "Drink 10 glasses of water"],
  "Maintain weight": ["Drink 8 glasses of water", "30 minutes movement", "Eat balanced meals"],
  "Improve energy": ["Sleep 7-8 hours", "Drink 8 glasses of water", "20+ minutes movement"],
};

export function NutritionToday({ autoOpenLog }: { autoOpenLog?: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addMealType, setAddMealType] = useState("Breakfast");
  const [habitsExpanded, setHabitsExpanded] = useState(false);
  const [weekExpanded, setWeekExpanded] = useState(false);

  // Manual entry state
  const [foodName, setFoodName] = useState("");
  const [foodCals, setFoodCals] = useState("");
  const [foodProtein, setFoodProtein] = useState("");
  const [foodCarbs, setFoodCarbs] = useState("");
  const [foodFat, setFoodFat] = useState("");
  const [mealPhoto, setMealPhoto] = useState<File | null>(null);
  const [mealPhotoPreview, setMealPhotoPreview] = useState<string | null>(null);
  const [saveToVault, setSaveToVault] = useState(false);

  // Recipe picker state
  const [recipeSearch, setRecipeSearch] = useState("");
  const [mode, setMode] = useState<"pick" | "manual">("pick");
  const [selectedVaultMeal, setSelectedVaultMeal] = useState<DbMeal | null>(null);
  const [vaultServings, setVaultServings] = useState(1);

  // Water state
  const [editGoal, setEditGoal] = useState("8");

  // Daily notes state
  const [dailyNote, setDailyNote] = useState({ energy_level: 0, mood_emoji: "", notes: "" });

  // Habit dialog
  const [habitDialogOpen, setHabitDialogOpen] = useState(false);
  const [newHabit, setNewHabit] = useState("");

  const isToday = date === new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (autoOpenLog) setDialogOpen(true);
  }, [autoOpenLog]);

  // Journal entries query
  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: queryKeys.journalEntries(user?.id, date),
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("journal_entries").select("*").eq("user_id", user.id).eq("date", date);
      return (data || []) as JournalEntry[];
    },
    enabled: !!user,
  });

  // Macro targets query
  const { data: macroTargets = null } = useQuery({
    queryKey: queryKeys.macros(user?.id),
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("user_macros").select("calories, protein_g, carbs_g, fat_g").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      return data as { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  // Water query
  const { data: waterData } = useQuery({
    queryKey: queryKeys.waterLog(user?.id, date),
    queryFn: async () => {
      if (!user) return { glasses: 0, goal: 8 };
      const { data } = await supabase.from("water_logs").select("glasses, goal").eq("user_id", user.id).eq("date", date).maybeSingle();
      if (data) {
        setEditGoal(String(data.goal));
        return { glasses: data.glasses, goal: data.goal };
      }
      setEditGoal("8");
      return { glasses: 0, goal: 8 };
    },
    enabled: !!user,
  });

  const glasses = waterData?.glasses ?? 0;
  const waterGoal = waterData?.goal ?? 8;

  // Daily note query
  const { data: dailyNoteData } = useQuery({
    queryKey: queryKeys.dailyNote(user?.id, date),
    queryFn: async () => {
      if (!user) return { energy_level: 0, mood_emoji: "", notes: "" };
      const { data } = await supabase.from("journal_daily_notes").select("*").eq("user_id", user.id).eq("date", date).maybeSingle();
      if (data) return { energy_level: data.energy_level || 0, mood_emoji: data.mood_emoji || "", notes: data.notes || "" };
      return { energy_level: 0, mood_emoji: "", notes: "" };
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (dailyNoteData) setDailyNote(dailyNoteData);
  }, [dailyNoteData]);

  // Habits query
  const { data: habitData } = useQuery({
    queryKey: queryKeys.habits(user?.id),
    queryFn: async () => {
      if (!user) return { habits: [] as Habit[] };
      let habitsData = await supabase.from("user_habits").select("*").eq("user_id", user.id).eq("is_active", true).order("sort_order").then(r => r.data);

      if (!habitsData || habitsData.length === 0) {
        const { data: profile } = await supabase.from("profiles").select("goal").eq("user_id", user.id).single();
        const goal = profile?.goal || "Maintain weight";
        const defaults = defaultHabitsByGoal[goal] || defaultHabitsByGoal["Maintain weight"];
        for (let i = 0; i < defaults.length; i++) {
          await supabase.from("user_habits").insert({ user_id: user.id, name: defaults[i], sort_order: i });
        }
        habitsData = await supabase.from("user_habits").select("*").eq("user_id", user.id).eq("is_active", true).order("sort_order").then(r => r.data);
        if (!habitsData) return { habits: [] as Habit[] };
      }

      const habitIds = habitsData.map(h => h.id);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

      const [{ data: todayLogs }, { data: streakLogs }] = await Promise.all([
        supabase.from("habit_logs").select("habit_id, completed").eq("user_id", user.id).eq("date", date),
        supabase.from("habit_logs").select("habit_id, date").in("habit_id", habitIds).eq("completed", true).gte("date", thirtyDaysAgoStr),
      ]);

      const completedSet = new Set((todayLogs || []).filter((l) => l.completed).map((l) => l.habit_id));
      const logsByHabit: Record<string, Set<string>> = {};
      for (const log of streakLogs || []) {
        if (!logsByHabit[log.habit_id]) logsByHabit[log.habit_id] = new Set();
        logsByHabit[log.habit_id].add(log.date);
      }

      const enriched: Habit[] = habitsData.map((h) => {
        const dates = logsByHabit[h.id] || new Set();
        let streak = 0;
        const check = new Date();
        for (let i = 0; i < 30; i++) {
          const ds = check.toISOString().split("T")[0];
          if (dates.has(ds)) { streak++; check.setDate(check.getDate() - 1); }
          else if (i === 0) { check.setDate(check.getDate() - 1); continue; }
          else break;
        }
        return { id: h.id, name: h.name, icon: h.icon, completed: completedSet.has(h.id), streak };
      });

      return { habits: enriched };
    },
    enabled: !!user,
  });

  const habits = habitData?.habits || [];

  // DB meals query
  const { data: dbMeals = [] } = useQuery({
    queryKey: queryKeys.dbMeals(),
    queryFn: async () => {
      const { data } = await supabase.from("meals").select("id, title, description, calories, protein, carbs, fats, image_url, tags, servings").order("title");
      return (data || []) as DbMeal[];
    },
    refetchOnWindowFocus: false,
  });

  const mealImages: Record<string, string> = {};
  dbMeals.forEach((m) => { if (m.image_url) mealImages[m.id] = m.image_url; });

  // Targeted invalidators — only touch caches that actually changed.
  // Optimistic setQueryData already updates the primary list; these keep
  // aggregate/derived views (dashboard, streak) in sync without a 5-way refetch.
  const invalidateForJournal = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(user?.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.streak(user?.id) });
  };
  const invalidateForWater = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(user?.id) });
  };
  const invalidateForHabit = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.habits(user?.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(user?.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.streak(user?.id) });
  };

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const rawTotals = entries.reduce((s, e) => ({
    calories: s.calories + Number(e.calories),
    protein: s.protein + Number(e.protein_g),
    carbs: s.carbs + Number(e.carbs_g),
    fat: s.fat + Number(e.fat_g)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const totals = { calories: r2(rawTotals.calories), protein: r2(rawTotals.protein), carbs: r2(rawTotals.carbs), fat: r2(rawTotals.fat) };

  const shiftDate = (dir: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + dir);
    setDate(d.toISOString().split("T")[0]);
  };

  // Water functions
  const updateGlasses = async (newCount: number) => {
    if (!user || newCount < 0) return;
    queryClient.setQueryData(queryKeys.waterLog(user.id, date), { glasses: newCount, goal: waterGoal });
    const { error } = await supabase.from("water_logs").upsert({ user_id: user.id, date, glasses: newCount, goal: waterGoal }, { onConflict: "user_id,date" });
    if (error) console.error("Water log error", error);
    if (newCount === waterGoal && newCount > 0) toast.success("💧 Daily water goal reached!");
    invalidateForWater();
  };

  const saveWaterGoal = async () => {
    const newGoal = parseInt(editGoal) || 8;
    if (!user) return;
    queryClient.setQueryData(queryKeys.waterLog(user.id, date), { glasses, goal: newGoal });
    await supabase.from("water_logs").upsert({ user_id: user.id, date, glasses, goal: newGoal }, { onConflict: "user_id,date" });
    toast.success("Goal updated!");
  };

  // Habit functions
  const toggleHabit = async (habit: Habit) => {
    if (!user) return;
    if (habit.completed) {
      await supabase.from("habit_logs").delete().eq("habit_id", habit.id).eq("date", date);
    } else {
      await supabase.from("habit_logs").upsert({ habit_id: habit.id, user_id: user.id, date, completed: true }, { onConflict: "habit_id,date" });
    }
    invalidateForHabit();
  };

  const addHabit = async () => {
    if (!user || !newHabit.trim()) return;
    await supabase.from("user_habits").insert({ user_id: user.id, name: newHabit, sort_order: habits.length });
    setNewHabit("");
    setHabitDialogOpen(false);
    invalidateForHabit();
    toast.success("Habit added!");
  };

  const deleteHabit = async (id: string) => {
    await supabase.from("user_habits").delete().eq("id", id);
    invalidateForHabit();
    toast.success("Habit removed");
  };

  // Meal logging functions
  const logFromRecipe = async (meal: DbMeal, servingCount: number = 1) => {
    if (!user) return;
    const totalServings = meal.servings || 1;
    const factor = servingCount / totalServings;

    const optimisticEntry: JournalEntry = {
      id: `temp-${Date.now()}`,
      meal_type: addMealType,
      food_name: meal.title,
      calories: r2((meal.calories || 0) * factor),
      protein_g: r2((meal.protein || 0) * factor),
      carbs_g: r2((meal.carbs || 0) * factor),
      fat_g: r2((meal.fats || 0) * factor),
      recipe_id: meal.id,
      image_url: null,
      servings: servingCount,
    };

    const qk = queryKeys.journalEntries(user.id, date);
    const prev = queryClient.getQueryData<JournalEntry[]>(qk);
    queryClient.setQueryData(qk, [...(prev || []), optimisticEntry]);

    setDialogOpen(false);
    setRecipeSearch("");
    setSelectedVaultMeal(null);
    setVaultServings(1);
    toast.success(`${meal.title} logged (${servingCount} serving${servingCount !== 1 ? "s" : ""})!`);

    const { error } = await supabase.from("journal_entries").insert({
      user_id: user.id, date, meal_type: addMealType, food_name: meal.title,
      calories: optimisticEntry.calories,
      protein_g: optimisticEntry.protein_g,
      carbs_g: optimisticEntry.carbs_g,
      fat_g: optimisticEntry.fat_g,
      recipe_id: meal.id, servings: servingCount
    });
    if (error) {
      queryClient.setQueryData(qk, prev);
      toast.error("Failed to log meal");
    }
    invalidateForJournal();
  };

  const addFood = async () => {
    if (!user || !foodName.trim() && !mealPhoto) return;

    let image_url: string | null = null;
    if (mealPhoto) {
      const ext = mealPhoto.name.split(".").pop();
      const fileName = `journal/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("recipe-images").upload(fileName, mealPhoto);
      if (uploadErr) {
        toast.error("Photo upload failed");
        return;
      }
      const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(fileName);
      image_url = urlData.publicUrl;
    }

    let recipe_id: string | null = null;
    if (saveToVault && (foodName.trim() || image_url)) {
      const { data: mealData, error: mealErr } = await supabase.from("meals").insert({
        user_id: user.id,
        title: foodName.trim() || "Meal photo",
        calories: parseFloat(foodCals) || 0,
        protein: parseFloat(foodProtein) || 0,
        carbs: parseFloat(foodCarbs) || 0,
        fats: parseFloat(foodFat) || 0,
        image_url,
        servings: 1,
        is_public: false
      }).select("id").single();
      if (!mealErr && mealData) recipe_id = mealData.id;
    }

    const optimisticEntry: JournalEntry = {
      id: `temp-${Date.now()}`,
      meal_type: addMealType,
      food_name: foodName.trim() || "Meal photo",
      calories: parseFloat(foodCals) || 0,
      protein_g: parseFloat(foodProtein) || 0,
      carbs_g: parseFloat(foodCarbs) || 0,
      fat_g: parseFloat(foodFat) || 0,
      recipe_id,
      image_url,
      servings: 1,
    };

    const qk = queryKeys.journalEntries(user.id, date);
    const prev = queryClient.getQueryData<JournalEntry[]>(qk);
    queryClient.setQueryData(qk, [...(prev || []), optimisticEntry]);

    setFoodName(""); setFoodCals(""); setFoodProtein(""); setFoodCarbs(""); setFoodFat("");
    setMealPhoto(null); setMealPhotoPreview(null); setSaveToVault(false);
    setDialogOpen(false);
    toast.success(recipe_id ? "Food logged & saved to Vault! 🎉" : "Food logged!");

    const { error } = await supabase.from("journal_entries").insert({
      user_id: user.id, date, meal_type: addMealType, food_name: optimisticEntry.food_name,
      calories: optimisticEntry.calories, protein_g: optimisticEntry.protein_g,
      carbs_g: optimisticEntry.carbs_g, fat_g: optimisticEntry.fat_g,
      image_url,
      ...(recipe_id ? { recipe_id } : {})
    });
    if (error) {
      queryClient.setQueryData(qk, prev);
      toast.error("Failed to log food");
    }
    invalidateForJournal();
  };

  const deleteEntry = async (id: string) => {
    if (!user) return;
    const qk = queryKeys.journalEntries(user.id, date);
    const prev = queryClient.getQueryData<JournalEntry[]>(qk);
    queryClient.setQueryData(qk, (prev || []).filter((e) => e.id !== id));
    const { error } = await supabase.from("journal_entries").delete().eq("id", id);
    if (error) {
      queryClient.setQueryData(qk, prev);
      toast.error("Failed to delete entry");
    }
    invalidateForJournal();
  };

  const saveDailyNote = async () => {
    if (!user) return;
    const { error } = await supabase.from("journal_daily_notes").upsert({ user_id: user.id, date, ...dailyNote }, { onConflict: "user_id,date" });
    if (!error) toast.success("Notes saved!");
  };

  const statusMessage = () => {
    if (!macroTargets) return null;
    const diff = totals.calories - macroTargets.calories;
    if (Math.abs(diff) <= 150) return { text: "Great day! You hit your targets. 🎉", color: "text-primary" };
    if (diff < -150) return { text: "You might want to add a snack — your body needs fuel. 💪", color: "text-muted-foreground" };
    return { text: "No worries — one day doesn't define your progress. ❤️", color: "text-muted-foreground" };
  };

  const filteredMeals = dbMeals.filter((m) =>
    m.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
    (m.tags || []).some((t) => t.toLowerCase().includes(recipeSearch.toLowerCase()))
  );

  const openDialog = (type: string) => {
    setAddMealType(type);
    setMode("pick");
    setRecipeSearch("");
    setDialogOpen(true);
  };

  const habitsDone = habits.filter(h => h.completed).length;
  const waterPct = waterGoal > 0 ? Math.min((glasses / waterGoal) * 100, 100) : 0;

  if (entriesLoading) return <MealJournalSkeleton />;

  return (
    <div className="space-y-5">
      {/* Date navigator */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => shiftDate(-1)}><ChevronLeft className="h-5 w-5" /></Button>
        <div className="text-center">
          <p className="font-semibold">{new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
          {isToday && <p className="text-xs text-primary">Today</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => shiftDate(1)}><ChevronRight className="h-5 w-5" /></Button>
      </div>

      {/* Macro summary */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center">
            <div className="rounded-xl bg-primary/10 py-3 sm:py-4 px-1 flex flex-col justify-center min-w-0">
              <Flame className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 sm:mb-1.5 text-primary shrink-0" />
              <p className="font-bold text-base sm:text-xl text-foreground truncate">{totals.calories}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-auto">kcal</p>
            </div>
            <div className="rounded-xl bg-macro-protein/10 py-3 sm:py-4 px-1 flex flex-col justify-center min-w-0">
              <Beef className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 sm:mb-1.5 text-macro-protein shrink-0" />
              <p className="font-bold text-sm sm:text-lg text-foreground truncate">{totals.protein}g</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-auto">protein</p>
            </div>
            <div className="rounded-xl bg-macro-carbs/10 py-3 sm:py-4 px-1 flex flex-col justify-center min-w-0">
              <Wheat className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 sm:mb-1.5 text-macro-carbs shrink-0" />
              <p className="font-bold text-sm sm:text-lg text-foreground truncate">{totals.carbs}g</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-auto">carbs</p>
            </div>
            <div className="rounded-xl bg-macro-fat/10 py-3 sm:py-4 px-1 flex flex-col justify-center min-w-0">
              <Droplets className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 sm:mb-1.5 text-macro-fat shrink-0" />
              <p className="font-bold text-sm sm:text-lg text-foreground truncate">{totals.fat}g</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-auto">fat</p>
            </div>
          </div>
          {statusMessage() && entries.length > 0 &&
            <p className={cn("text-xs text-center mt-3", statusMessage()!.color)}>{statusMessage()!.text}</p>
          }
        </CardContent>
      </Card>

      {/* Meal sections */}
      {mealTypes.map((type) => {
        const typeEntries = entries.filter((e) => e.meal_type === type);
        return (
          <div key={type}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">{type}</h3>
              <Button variant="ghost" size="sm" onClick={() => openDialog(type)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {typeEntries.length > 0 ? (
              <div className="space-y-2">
                {typeEntries.map((e) => (
                  <Card key={e.id}>
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                      {e.recipe_id && mealImages[e.recipe_id] ? (
                        <img loading="lazy" decoding="async" src={mealImages[e.recipe_id]} alt={e.food_name} className="h-12 w-12 rounded-lg object-cover shrink-0" />
                      ) : (e as any).image_url ? (
                        <img loading="lazy" decoding="async" src={(e as any).image_url} alt={e.food_name} className="h-12 w-12 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{e.food_name}</p>
                        <p className="text-xs text-muted-foreground">{e.calories} kcal · {e.protein_g}P · {e.carbs_g}C · {e.fat_g}F</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setAddMealType(e.meal_type);
                            setFoodName(e.food_name);
                            setFoodCals(String(e.calories || ""));
                            setFoodProtein(String(e.protein_g || ""));
                            setFoodCarbs(String(e.carbs_g || ""));
                            setFoodFat(String(e.fat_g || ""));
                            setMode("manual");
                            setDialogOpen(true);
                            deleteEntry(e.id);
                          }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteEntry(e.id)}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pl-1 mb-2">No food logged</p>
            )}
          </div>
        );
      })}

      {/* Inline Water Tracker */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Droplets className="h-4 w-4 text-primary" /> Water
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48">
                <div className="space-y-2">
                  <Label className="text-xs">Daily Goal (glasses)</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={editGoal} onChange={(e) => setEditGoal(e.target.value)} className="h-8" />
                    <Button size="sm" onClick={saveWaterGoal}>Set</Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateGlasses(glasses - 1)} disabled={glasses <= 0}>
                <span className="text-lg">−</span>
              </Button>
              <div className="text-center min-w-[60px]">
                <span className="text-xl font-bold">{glasses}</span>
                <span className="text-sm text-muted-foreground">/{waterGoal}</span>
              </div>
              <Button size="icon" className="h-8 w-8 rounded-full" onClick={() => updateGlasses(glasses + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1">
              <Progress value={waterPct} className="h-2" />
            </div>
            {waterPct >= 100 && <span className="text-xs text-primary font-medium">🎉</span>}
          </div>
        </CardContent>
      </Card>

      {/* Collapsible Habits */}
      <Collapsible open={habitsExpanded} onOpenChange={setHabitsExpanded}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardContent className="py-4 cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Today's Wins</span>
                  <span className="text-xs text-muted-foreground">({habitsDone}/{habits.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  {habitsDone === habits.length && habits.length > 0 && <span className="text-xs text-primary">🎉 All done!</span>}
                  <ChevronDown className={cn("h-4 w-4 transition-transform", habitsExpanded && "rotate-180")} />
                </div>
              </div>
              <Progress value={habits.length > 0 ? (habitsDone / habits.length) * 100 : 0} className="h-1.5 mt-2" />
            </CardContent>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 space-y-2">
              {habits.map((h) => (
                <div key={h.id} className={cn("flex items-center gap-3 p-2 rounded-lg transition-all", h.completed && "bg-primary/5")}>
                  <button onClick={() => toggleHabit(h)}>
                    {h.completed ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                  </button>
                  <div className="flex-1">
                    <p className={cn("text-sm", h.completed && "line-through text-muted-foreground")}>{h.name}</p>
                    {h.streak > 0 && <p className="text-[10px] text-muted-foreground">🔥 {h.streak} day streak</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteHabit(h.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setHabitDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Habit
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Daily Notes (condensed) */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Daily Notes</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setDailyNote({ ...dailyNote, energy_level: n })}>
                  <Star className={cn("h-4 w-4 transition-colors", n <= dailyNote.energy_level ? "fill-star-filled text-star-filled" : "text-star-empty")} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Smile className="h-3.5 w-3.5 text-muted-foreground" />
              {moods.map((m) => (
                <button key={m} onClick={() => setDailyNote({ ...dailyNote, mood_emoji: m })}
                  className={cn("text-lg p-0.5 rounded transition-all", dailyNote.mood_emoji === m && "bg-primary/10 ring-1 ring-primary/30 scale-110")}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <Textarea placeholder="How are you feeling today?" rows={2} value={dailyNote.notes}
            onChange={(e) => setDailyNote({ ...dailyNote, notes: e.target.value })} className="text-sm" />
          <Button size="sm" variant="outline" className="w-full" onClick={saveDailyNote}>Save Notes</Button>
        </CardContent>
      </Card>

      {/* This Week expandable */}
      <Collapsible open={weekExpanded} onOpenChange={setWeekExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-sm font-medium">
            <span>📊 This Week</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", weekExpanded && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <WeeklySummaryCharts />
        </CollapsibleContent>
      </Collapsible>

      {/* Add food dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[70vh] flex flex-col overflow-hidden">
          <DialogHeader><DialogTitle>Log {addMealType}</DialogTitle></DialogHeader>

          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button onClick={() => setMode("pick")}
              className={cn("flex-1 text-sm py-1.5 rounded-md transition-colors", mode === "pick" ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}>
              From Vault
            </button>
            <button onClick={() => setMode("manual")}
              className={cn("flex-1 text-sm py-1.5 rounded-md transition-colors", mode === "manual" ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}>
              Manual Entry
            </button>
          </div>

          {mode === "pick" ? (
            <div className="space-y-3 pt-1">
              {selectedVaultMeal ? (
                <div className="space-y-4">
                  <div className="flex gap-3 items-center p-3 rounded-lg border bg-muted/30">
                    {selectedVaultMeal.image_url ? (
                      <img loading="lazy" decoding="async" src={selectedVaultMeal.image_url} alt={selectedVaultMeal.title} className="h-14 w-14 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{selectedVaultMeal.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Recipe total: {selectedVaultMeal.calories || 0} cal · {selectedVaultMeal.servings || 1} serving{(selectedVaultMeal.servings || 1) > 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => setSelectedVaultMeal(null)}>Change</Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">How many servings?</Label>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setVaultServings(Math.max(0.5, vaultServings - 0.5))}>
                        <span className="text-lg">−</span>
                      </Button>
                      <Input type="number" min="0.25" step="0.25" value={vaultServings}
                        onChange={(e) => setVaultServings(Math.max(0.25, parseFloat(e.target.value) || 1))} className="w-20 text-center font-semibold" />
                      <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setVaultServings(vaultServings + 0.5)}>
                        <span className="text-lg">+</span>
                      </Button>
                    </div>
                  </div>

                  {(() => {
                    const total = selectedVaultMeal.servings || 1;
                    const factor = vaultServings / total;
                    return (
                      <div className="grid grid-cols-4 gap-2 p-3 rounded-lg bg-muted/50">
                        <div className="text-center">
                          <p className="font-bold text-sm">{r2((selectedVaultMeal.calories || 0) * factor)}</p>
                          <p className="text-[10px] text-muted-foreground">Cal</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-sm">{r2((selectedVaultMeal.protein || 0) * factor)}g</p>
                          <p className="text-[10px] text-muted-foreground">Protein</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-sm">{r2((selectedVaultMeal.carbs || 0) * factor)}g</p>
                          <p className="text-[10px] text-muted-foreground">Carbs</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-sm">{r2((selectedVaultMeal.fats || 0) * factor)}g</p>
                          <p className="text-[10px] text-muted-foreground">Fat</p>
                        </div>
                      </div>
                    );
                  })()}

                  <Button className="w-full" onClick={() => logFromRecipe(selectedVaultMeal, vaultServings)}>
                    Log {vaultServings} Serving{vaultServings !== 1 ? "s" : ""}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search recipes..." className="pl-10" value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} />
                  </div>

                  {filteredMeals.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No recipes found. Add meals in the Vault first!</p>
                  ) : (
                    <div className="space-y-2 flex-1 overflow-y-auto min-h-0 max-h-[40vh]">
                      {filteredMeals.map((meal) => (
                        <button key={meal.id} onClick={() => { setSelectedVaultMeal(meal); setVaultServings(1); }}
                          className="w-full text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors flex gap-3 items-center">
                          {meal.image_url ? (
                            <img loading="lazy" decoding="async" src={meal.image_url} alt={meal.title} className="h-14 w-14 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{meal.title}</p>
                            {meal.description && <p className="text-xs text-muted-foreground truncate">{meal.description}</p>}
                            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{meal.calories || 0} cal</span>
                              <span>{meal.protein || 0}g P</span>
                              <span>{meal.carbs || 0}g C</span>
                              <span>{meal.fats || 0}g F</span>
                              {(meal.servings || 1) > 1 && <span>· {meal.servings} srv</span>}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <Label>Meal Photo</Label>
                <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors overflow-hidden">
                  {mealPhotoPreview ? (
                    <img loading="lazy" decoding="async" src={mealPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground">
                      <ImagePlus className="h-8 w-8 mb-1" />
                      <span className="text-sm font-medium">Snap or upload a photo</span>
                      <span className="text-xs mt-0.5">Tap to capture your meal</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) { setMealPhoto(file); setMealPhotoPreview(URL.createObjectURL(file)); }
                  }} />
                </label>
              </div>
              <div className="space-y-1">
                <Label>Food Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input placeholder="e.g., Chicken breast" value={foodName} onChange={(e) => setFoodName(e.target.value)} />
              </div>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                    + Add macros (optional)
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Calories</Label><Input type="number" placeholder="0" value={foodCals} onChange={(e) => setFoodCals(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Protein (g)</Label><Input type="number" placeholder="0" value={foodProtein} onChange={(e) => setFoodProtein(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Carbs (g)</Label><Input type="number" placeholder="0" value={foodCarbs} onChange={(e) => setFoodCarbs(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Fat (g)</Label><Input type="number" placeholder="0" value={foodFat} onChange={(e) => setFoodFat(e.target.value)} /></div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <Button className="w-full" onClick={addFood} disabled={!foodName.trim() && !mealPhoto}>Log Food</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Habit dialog */}
      <Dialog open={habitDialogOpen} onOpenChange={setHabitDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Custom Habit</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="e.g., Drink 8 glasses of water" value={newHabit} onChange={(e) => setNewHabit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHabit()} />
            <Button className="w-full" onClick={addHabit}>Add Habit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
