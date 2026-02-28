import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Sparkles, RefreshCw, Save, Trash2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface MealSlot {
  meal_id: string;
  title: string;
}

interface DayPlan {
  day: string;
  meals: {
    breakfast: MealSlot;
    lunch: MealSlot;
    dinner: MealSlot;
    snack: MealSlot;
  };
}

interface GeneratedPlan {
  days: DayPlan[];
}

interface SavedPlan {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface DbMeal {
  id: string;
  title: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  tags: string[] | null;
}

const mealTimes = ["breakfast", "lunch", "dinner", "snack"] as const;
const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function MealPlans() {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [swapTarget, setSwapTarget] = useState<{ day: number; time: typeof mealTimes[number] } | null>(null);
  const [macros, setMacros] = useState<{ calories: number; protein_g: number; carbs_g: number; fat_g: number } | null>(null);
  const [profile, setProfile] = useState<{ diet_prefs: string[]; allergies: string[] }>({ diet_prefs: [], allergies: [] });
  const [saving, setSaving] = useState(false);
  const [dbMeals, setDbMeals] = useState<DbMeal[]>([]);

  useEffect(() => {
    if (user) {
      loadUserData();
      loadSavedPlans();
      loadMeals();
    }
  }, [user]);

  const loadMeals = async () => {
    const { data } = await supabase
      .from("meals")
      .select("id, title, calories, protein, carbs, fats, tags")
      .order("created_at", { ascending: false });
    if (data) setDbMeals(data);
  };

  const loadUserData = async () => {
    if (!user) return;
    const [{ data: macro }, { data: prof }] = await Promise.all([
      supabase.from("user_macros").select("calories, protein_g, carbs_g, fat_g").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("profiles").select("diet_prefs, allergies").eq("user_id", user.id).single(),
    ]);
    if (macro) setMacros(macro);
    if (prof) setProfile({ diet_prefs: prof.diet_prefs || [], allergies: prof.allergies || [] });
  };

  const loadSavedPlans = async () => {
    if (!user) return;
    const { data } = await supabase.from("meal_plans").select("id, name, description, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setSavedPlans(data);
  };

  const generatePlan = async () => {
    if (!macros) {
      toast.error("Set your macro targets in the Macros calculator first!");
      return;
    }
    if (dbMeals.length < 4) {
      toast.error("Add at least 4 meals to your Meal Vault first!");
      return;
    }
    setGenerating(true);
    try {
      const mealsForAI = dbMeals.map((m) => ({
        id: m.id, title: m.title, calories: m.calories || 0, protein: m.protein || 0, carbs: m.carbs || 0, fats: m.fats || 0, tags: m.tags || [],
      }));
      const { data, error } = await supabase.functions.invoke("generate-meal-plan", {
        body: { meals: mealsForAI, macros, dietPrefs: profile.diet_prefs, allergies: profile.allergies },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPlan(data as GeneratedPlan);
      setSelectedDay(0);
      toast.success("Meal plan generated! 🎉");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  };

  const swapMeal = (mealId: string) => {
    if (!plan || !swapTarget) return;
    const newPlan = { ...plan, days: plan.days.map((d, i) => {
      if (i !== swapTarget.day) return d;
      const meal = dbMeals.find((m) => m.id === mealId);
      if (!meal) return d;
      return { ...d, meals: { ...d.meals, [swapTarget.time]: { meal_id: meal.id, title: meal.title } } };
    }) };
    setPlan(newPlan);
    setSwapTarget(null);
    toast.success("Meal swapped!");
  };

  const savePlan = async () => {
    if (!user || !plan) return;
    setSaving(true);
    try {
      const { data: planRow, error: planErr } = await supabase.from("meal_plans").insert({
        user_id: user.id,
        name: `Week Plan — ${new Date().toLocaleDateString()}`,
        description: `Auto-generated ${macros?.calories} kcal plan`,
      }).select("id").single();
      if (planErr) throw planErr;

      const entries = plan.days.flatMap((day) =>
        mealTimes.map((time) => ({
          meal_plan_id: planRow.id,
          meal_id: day.meals[time].meal_id,
          day_of_week: day.day,
          meal_time: time,
        }))
      );
      const { error: entryErr } = await supabase.from("meal_plan_entries").insert(entries);
      if (entryErr) throw entryErr;

      toast.success("Plan saved!");
      loadSavedPlans();
    } catch (e: any) {
      toast.error("Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (id: string) => {
    await supabase.from("meal_plan_entries").delete().eq("meal_plan_id", id);
    await supabase.from("meal_plans").delete().eq("id", id);
    toast.success("Plan deleted");
    loadSavedPlans();
  };

  const getMealMacros = (mealId: string) => dbMeals.find((m) => m.id === mealId);

  const getDayTotals = (day: DayPlan) => {
    let cal = 0, p = 0, c = 0, f = 0;
    mealTimes.forEach((t) => {
      const m = getMealMacros(day.meals[t].meal_id);
      if (m) { cal += m.calories || 0; p += m.protein || 0; c += m.carbs || 0; f += m.fats || 0; }
    });
    return { cal, p, c, f };
  };

  const currentDay = plan?.days[selectedDay];
  const totals = currentDay ? getDayTotals(currentDay) : null;

  return (
    <div className="space-y-5">
      {!plan && (
        <div className="space-y-4">
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-bold mb-1">AI Meal Plan Generator</h3>
            <p className="text-sm text-muted-foreground mb-2 max-w-xs mx-auto">
              Generate a personalized 7-day meal plan from your Meal Vault recipes, matched to your macro targets.
            </p>
            {dbMeals.length > 0 && (
              <p className="text-xs text-muted-foreground mb-4">{dbMeals.length} recipes available</p>
            )}
            <Button onClick={generatePlan} disabled={generating} size="lg">
              {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate Plan</>}
            </Button>
            {!macros && <p className="text-xs text-destructive mt-3">⚠️ Set your macros first in the Macros tab</p>}
            {dbMeals.length < 4 && <p className="text-xs text-destructive mt-2">⚠️ Add at least 4 meals to your Meal Vault</p>}
          </div>

          {savedPlans.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Saved Plans</h4>
              {savedPlans.map((sp) => (
                <Card key={sp.id}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{sp.name}</p>
                      <p className="text-xs text-muted-foreground">{sp.description}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deletePlan(sp.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {plan && currentDay && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setSelectedDay(Math.max(0, selectedDay - 1))} disabled={selectedDay === 0}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <h3 className="font-bold text-lg">{currentDay.day}</h3>
              <p className="text-xs text-muted-foreground">Day {selectedDay + 1} of 7</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDay(Math.min(6, selectedDay + 1))} disabled={selectedDay === 6}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex justify-center gap-1.5">
            {dayNames.map((_, i) => (
              <button key={i} onClick={() => setSelectedDay(i)} className={`h-2 w-2 rounded-full transition-colors ${i === selectedDay ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>

          {totals && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-3">
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div><p className="font-bold text-base">{totals.cal}</p><p className="text-muted-foreground">kcal</p></div>
                  <div><p className="font-bold text-base">{totals.p}g</p><p className="text-muted-foreground">protein</p></div>
                  <div><p className="font-bold text-base">{totals.c}g</p><p className="text-muted-foreground">carbs</p></div>
                  <div><p className="font-bold text-base">{totals.f}g</p><p className="text-muted-foreground">fat</p></div>
                </div>
                {macros && (
                  <p className="text-[10px] text-center text-muted-foreground mt-1">
                    Target: {macros.calories} kcal · {macros.protein_g}g P · {macros.carbs_g}g C · {macros.fat_g}g F
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {mealTimes.map((time) => {
              const meal = currentDay.meals[time];
              const mealData = getMealMacros(meal.meal_id);
              return (
                <Card key={time}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="capitalize text-xs">{time}</Badge>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSwapTarget({ day: selectedDay, time })}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Swap
                      </Button>
                    </div>
                    <p className="font-medium text-sm">{meal.title}</p>
                    {mealData && (
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{mealData.calories || 0} cal</span>
                        <span>{mealData.protein || 0}g P</span>
                        <span>{mealData.carbs || 0}g C</span>
                        <span>{mealData.fats || 0}g F</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setPlan(null)}>Discard</Button>
            <Button className="flex-1" onClick={savePlan} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save Plan
            </Button>
          </div>
          <Button variant="ghost" className="w-full" onClick={generatePlan} disabled={generating}>
            <Sparkles className="h-4 w-4 mr-1" /> Regenerate
          </Button>
        </div>
      )}

      <Dialog open={!!swapTarget} onOpenChange={() => setSwapTarget(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Swap {swapTarget?.time}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {dbMeals.map((meal) => (
              <button key={meal.id} onClick={() => swapMeal(meal.id)} className="w-full text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors">
                <p className="font-medium text-sm">{meal.title}</p>
                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                  <span>{meal.calories || 0} cal</span>
                  <span>{meal.protein || 0}g P</span>
                  <span>{meal.carbs || 0}g C</span>
                  <span>{meal.fats || 0}g F</span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
