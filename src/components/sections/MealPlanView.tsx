import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, Calendar, List, Trash2, Eye, Pencil, Heart,
  Flame, Search, Loader2, ArrowLeft, ChevronDown, ChevronUp, Sparkles, RefreshCw, ShoppingCart, Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { r2 } from "@/lib/utils";

interface SavedPlan {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  start_date: string | null;
  end_date: string | null;
}

interface PlanEntry {
  id: string;
  meal_plan_id: string;
  meal_id: string;
  day_of_week: string;
  meal_time: string;
  meal?: {
    id: string;
    title: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fats: number | null;
    image_url: string | null;
  };
}

interface DbMeal {
  id: string;
  title: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  image_url: string | null;
}

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const mealTimeColors: Record<string, string> = {
  breakfast: "bg-macro-carbs/20 text-macro-carbs",
  lunch: "bg-primary/20 text-primary",
  dinner: "bg-macro-fat/20 text-macro-fat",
  snack: "bg-accent/20 text-accent",
};

interface MealPlanViewProps {
  searchTerm: string;
  showFavoritesOnly: boolean;
  refreshKey: number;
}

export function MealPlanView({ searchTerm, showFavoritesOnly, refreshKey }: MealPlanViewProps) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [viewingPlan, setViewingPlan] = useState<SavedPlan | null>(null);
  const [entries, setEntries] = useState<PlanEntry[]>([]);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const [targetMacros, setTargetMacros] = useState<{ calories: number; protein_g: number; carbs_g: number; fat_g: number } | null>(null);

  // Swap meal state
  const [swapEntry, setSwapEntry] = useState<PlanEntry | null>(null);
  const [allMeals, setAllMeals] = useState<DbMeal[]>([]);
  const [swapSearch, setSwapSearch] = useState("");

  const [duplicating, setDuplicating] = useState<string | null>(null);

  // Shopping list generation
  const [generatingList, setGeneratingList] = useState(false);

  const [dragEntryId, setDragEntryId] = useState<string | null>(null);
  const [dragOverEntryId, setDragOverEntryId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadPlans();
      loadTargetMacros();
      loadAllMeals();
    }
  }, [user, refreshKey]);

  const loadPlans = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("meal_plans")
      .select("id, name, description, created_at, start_date, end_date")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setPlans(data);
    setLoading(false);
  };

  const loadTargetMacros = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_macros")
      .select("calories, protein_g, carbs_g, fat_g")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setTargetMacros(data);
  };

  const loadAllMeals = async () => {
    const { data } = await supabase
      .from("meals")
      .select("id, title, calories, protein, carbs, fats, image_url")
      .order("title");
    if (data) setAllMeals(data.map((m) => ({
      id: m.id, title: m.title, calories: m.calories, protein: m.protein,
      carbs: m.carbs, fats: m.fats, image_url: m.image_url,
    })));
  };

  const viewPlan = async (plan: SavedPlan) => {
    setViewingPlan(plan);
    const { data } = await supabase
      .from("meal_plan_entries")
      .select("id, meal_plan_id, meal_id, day_of_week, meal_time, meal:meals(id, title, calories, protein, carbs, fats, image_url)")
      .eq("meal_plan_id", plan.id);
    if (data) setEntries(data.map((e: any) => ({ ...e, meal: e.meal })));
  };

  const swapMeal = async (newMeal: DbMeal) => {
    if (!swapEntry) return;

    // Update in database
    const { error } = await supabase
      .from("meal_plan_entries")
      .update({ meal_id: newMeal.id })
      .eq("id", swapEntry.id);

    if (error) {
      toast.error("Failed to swap meal");
      return;
    }

    // Update local state
    setEntries((prev) =>
      prev.map((e) =>
        e.id === swapEntry.id
          ? { ...e, meal_id: newMeal.id, meal: newMeal }
          : e
      )
    );

    setSwapEntry(null);
    setSwapSearch("");
    toast.success(`Swapped to "${newMeal.title}"`);
  };

  const removeEntry = async (entryId: string) => {
    const { error } = await supabase
      .from("meal_plan_entries")
      .delete()
      .eq("id", entryId);

    if (error) {
      toast.error("Failed to remove meal");
      return;
    }

    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    toast.success("Meal removed from plan");
  };

  const reorderEntries = async (dragId: string, dropId: string) => {
    const dragEntry = entries.find((e) => e.id === dragId);
    const dropEntry = entries.find((e) => e.id === dropId);
    if (!dragEntry || !dropEntry || dragEntry.day_of_week !== dropEntry.day_of_week) return;

    // Swap meal_time values
    const dragTime = dragEntry.meal_time;
    const dropTime = dropEntry.meal_time;

    const [r1, r2] = await Promise.all([
      supabase.from("meal_plan_entries").update({ meal_time: dropTime }).eq("id", dragId),
      supabase.from("meal_plan_entries").update({ meal_time: dragTime }).eq("id", dropId),
    ]);

    if (r1.error || r2.error) {
      toast.error("Failed to reorder meals");
      return;
    }

    setEntries((prev) =>
      prev.map((e) => {
        if (e.id === dragId) return { ...e, meal_time: dropTime };
        if (e.id === dropId) return { ...e, meal_time: dragTime };
        return e;
      })
    );
    toast.success("Meals reordered");
  };

  const generateShoppingList = async () => {
    if (!user || !viewingPlan) return;
    setGeneratingList(true);
    try {
      // Get unique meal IDs from plan entries
      const mealIds = [...new Set(entries.map((e) => e.meal_id))];

      // Fetch ingredients for all meals
      const { data: meals } = await supabase
        .from("meals")
        .select("id, title, ingredients, servings")
        .in("id", mealIds);

      if (!meals || meals.length === 0) {
        toast.error("No meals with ingredients found");
        return;
      }

      // Aggregate ingredients, counting occurrences per meal across the week
      const mealCounts: Record<string, number> = {};
      entries.forEach((e) => {
        mealCounts[e.meal_id] = (mealCounts[e.meal_id] || 0) + 1;
      });

      const ingredientMap = new Map<string, { ingredient: string; count: number }>();
      meals.forEach((meal) => {
        const ings = Array.isArray(meal.ingredients) ? meal.ingredients : [];
        const timesUsed = mealCounts[meal.id] || 1;
        ings.forEach((ing: string) => {
          const key = ing.toLowerCase().trim();
          if (!key) return;
          const existing = ingredientMap.get(key);
          if (existing) {
            existing.count += timesUsed;
          } else {
            ingredientMap.set(key, { ingredient: ing.trim(), count: timesUsed });
          }
        });
      });

      if (ingredientMap.size === 0) {
        toast.error("No ingredients found in plan meals. Add ingredients to your recipes first!");
        return;
      }

      // Get or create grocery list
      let { data: lists } = await supabase
        .from("grocery_lists")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      let listId: string;
      if (lists && lists.length > 0) {
        listId = lists[0].id;
      } else {
        const { data } = await supabase
          .from("grocery_lists")
          .insert({ user_id: user.id, name: "My Grocery List" })
          .select("id")
          .single();
        if (!data) throw new Error("Failed to create grocery list");
        listId = data.id;
      }

      // Insert all aggregated ingredients
      const items = Array.from(ingredientMap.values()).map(({ ingredient, count }) => ({
        grocery_list_id: listId,
        ingredient,
        quantity: count > 1 ? `×${count} servings` : null,
        is_checked: false,
      }));

      const { error } = await supabase.from("grocery_list_items").insert(items);
      if (error) throw error;

      toast.success(`${items.length} ingredients added to your Grocery List! 🛒`);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to generate shopping list");
    } finally {
      setGeneratingList(false);
    }
  };

  const duplicatePlan = async (plan: SavedPlan) => {
    if (!user) return;
    setDuplicating(plan.id);
    try {
      // Create new plan
      const { data: newPlan, error: planErr } = await supabase
        .from("meal_plans")
        .insert({
          user_id: user.id,
          name: `${plan.name} (Copy)`,
          description: plan.description,
        })
        .select("id")
        .single();
      if (planErr || !newPlan) throw planErr;

      // Copy all entries
      const { data: sourceEntries } = await supabase
        .from("meal_plan_entries")
        .select("meal_id, day_of_week, meal_time")
        .eq("meal_plan_id", plan.id);

      if (sourceEntries && sourceEntries.length > 0) {
        const newEntries = sourceEntries.map((e) => ({
          meal_plan_id: newPlan.id,
          meal_id: e.meal_id,
          day_of_week: e.day_of_week,
          meal_time: e.meal_time,
        }));
        const { error: entryErr } = await supabase.from("meal_plan_entries").insert(newEntries);
        if (entryErr) throw entryErr;
      }

      toast.success("Plan duplicated! Opening copy for editing...");
      await loadPlans();

      // Open the duplicated plan for viewing/editing
      const dupPlan: SavedPlan = {
        id: newPlan.id,
        name: `${plan.name} (Copy)`,
        description: plan.description,
        created_at: new Date().toISOString(),
        start_date: null,
        end_date: null,
      };
      viewPlan(dupPlan);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to duplicate plan");
    } finally {
      setDuplicating(null);
    }
  };

  const setAsActive = (planId: string) => {
    setActivePlanId(planId);
    toast.success("Meal plan set as active");
  };

  const deletePlan = async (planId: string) => {
    await supabase.from("meal_plan_entries").delete().eq("meal_plan_id", planId);
    await supabase.from("meal_plans").delete().eq("id", planId);
    toast.success("Plan deleted");
    setPlans(plans.filter((p) => p.id !== planId));
    if (viewingPlan?.id === planId) setViewingPlan(null);
  };

  const getPlanStats = (plan: SavedPlan) => {
    const desc = plan.description || "";
    const calMatch = desc.match(/(\d+)\s*calories/);
    return {
      targetCal: calMatch ? parseInt(calMatch[1]) : targetMacros?.calories || 2000,
    };
  };

  const filtered = plans.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSwapMeals = allMeals.filter((m) =>
    m.title.toLowerCase().includes(swapSearch.toLowerCase())
  );

  // --- VIEWING A PLAN ---
  if (viewingPlan) {
    const entriesByDay: Record<string, PlanEntry[]> = {};
    entries.forEach((e) => {
      if (!entriesByDay[e.day_of_week]) entriesByDay[e.day_of_week] = [];
      entriesByDay[e.day_of_week].push(e);
    });
    const sortedDays = dayNames.filter((d) => entriesByDay[d]);

    const getDayTotals = (day: string) => {
      const dayEntries = entriesByDay[day] || [];
      let cal = 0, p = 0, c = 0, f = 0;
      dayEntries.forEach((e) => {
        if (e.meal) {
          cal += e.meal.calories || 0;
          p += e.meal.protein || 0;
          c += e.meal.carbs || 0;
          f += e.meal.fats || 0;
        }
      });
      return { cal: r2(cal), p: r2(p), c: r2(c), f: r2(f) };
    };

    // Calendar rendering
    const renderCalendar = () => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const planStart = viewingPlan.start_date
        ? new Date(viewingPlan.start_date)
        : new Date(viewingPlan.created_at);

      const dayToDateMap: Record<number, { day: string; entries: PlanEntry[] }> = {};
      sortedDays.forEach((dayName, idx) => {
        const date = new Date(planStart);
        date.setDate(date.getDate() + idx);
        if (date.getMonth() === month && date.getFullYear() === year) {
          dayToDateMap[date.getDate()] = { day: dayName, entries: entriesByDay[dayName] || [] };
        }
      });

      const cells = [];
      for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} className="min-h-[100px]" />);
      for (let d = 1; d <= daysInMonth; d++) {
        const mapped = dayToDateMap[d];
        const totals = mapped ? getDayTotals(mapped.day) : null;
        cells.push(
          <div key={d} className={`min-h-[100px] border border-border p-1 ${mapped ? "bg-card" : ""}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-bold ${mapped ? "text-foreground" : "text-muted-foreground"}`}>{d}</span>
              {totals && <span className="text-[10px] text-muted-foreground">{totals.cal} cal</span>}
            </div>
            {mapped && mapped.entries.slice(0, 3).map((e) => (
              <button
                key={e.id}
                onClick={() => setSwapEntry(e)}
                className={`w-full text-left text-[9px] px-1 py-0.5 rounded mb-0.5 truncate cursor-pointer hover:ring-1 hover:ring-primary transition-all ${mealTimeColors[e.meal_time] || "bg-muted"}`}
              >
                {e.meal?.title || "Unknown"}
                <span className="ml-1 opacity-70">{r2(e.meal?.calories || 0)} cal</span>
              </button>
            ))}
            {mapped && mapped.entries.length > 3 && (
              <span className="text-[9px] text-muted-foreground">+{mapped.entries.length - 3} more</span>
            )}
          </div>
        );
      }

      return (
        <div>
          <div className="flex items-center justify-between mb-3">
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(year, month - 1))}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <span className="font-semibold">
              {currentMonth.toLocaleString("default", { month: "long" })} {year}
            </span>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(year, month + 1))}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-0 text-center text-xs font-semibold text-muted-foreground mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0">{cells}</div>
        </div>
      );
    };

    // List rendering
    const renderList = () => (
      <div className="space-y-3">
        {sortedDays.map((dayName, idx) => {
          const totals = getDayTotals(dayName);
          const dayEntries = entriesByDay[dayName] || [];
          const isExpanded = expandedDay === idx;
          const targetCal = targetMacros?.calories || 2000;

          return (
            <Card key={dayName}>
              <CardContent className="p-4">
                <button
                  className="w-full flex items-center justify-between"
                  onClick={() => setExpandedDay(isExpanded ? null : idx)}
                >
                  <div className="text-left">
                    <p className="font-bold text-sm">Day {idx + 1}</p>
                    <p className="text-xs text-muted-foreground">{dayName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm">
                        <Flame className="h-3.5 w-3.5 text-macro-carbs" />
                        <span className="font-semibold">{totals.cal} / {targetCal} cal</span>
                      </div>
                      <div className="w-20 h-1.5 bg-muted rounded-full mt-1">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min(100, (totals.cal / targetCal) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="hidden sm:flex gap-2 text-xs">
                      <span className="text-macro-protein font-semibold">P: {totals.p}g</span>
                      <span className="text-macro-carbs font-semibold">C: {totals.c}g</span>
                      <span className="text-macro-fat font-semibold">F: {totals.f}g</span>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {dayEntries
                      .sort((a, b) => {
                        const order = ["breakfast", "lunch", "dinner", "snack"];
                        return order.indexOf(a.meal_time) - order.indexOf(b.meal_time);
                      })
                      .map((e) => (
                      <div
                        key={e.id}
                        draggable
                        onDragStart={() => setDragEntryId(e.id)}
                        onDragEnd={() => { setDragEntryId(null); setDragOverEntryId(null); }}
                        onDragOver={(ev) => { ev.preventDefault(); setDragOverEntryId(e.id); }}
                        onDragLeave={() => setDragOverEntryId(null)}
                        onDrop={(ev) => {
                          ev.preventDefault();
                          if (dragEntryId && dragEntryId !== e.id) reorderEntries(dragEntryId, e.id);
                          setDragEntryId(null);
                          setDragOverEntryId(null);
                        }}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-grab active:cursor-grabbing transition-all ${
                          dragOverEntryId === e.id && dragEntryId !== e.id
                            ? "ring-2 ring-primary ring-offset-2 scale-[1.02]"
                            : ""
                        } ${dragEntryId === e.id ? "opacity-50" : ""} ${mealTimeColors[e.meal_time]?.replace("text-", "bg-").split(" ")[0] || "bg-muted/50"}`}
                      >
                        <div className="flex flex-col gap-0.5 text-muted-foreground shrink-0 cursor-grab">
                          <div className="w-4 h-0.5 bg-current rounded" />
                          <div className="w-4 h-0.5 bg-current rounded" />
                          <div className="w-4 h-0.5 bg-current rounded" />
                        </div>
                        {e.meal?.image_url && (
                          <img src={e.meal.image_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <Badge variant="outline" className="text-[10px] capitalize mb-0.5">{e.meal_time}</Badge>
                          <p className="text-sm font-medium truncate">{e.meal?.title || "Unknown"}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground shrink-0 flex items-center gap-2">
                          <Flame className="h-3 w-3" />
                          <span>{r2(e.meal?.calories || 0)}</span>
                          <span className="text-macro-protein">P:{r2(e.meal?.protein || 0)}</span>
                          <span className="text-macro-carbs">C:{r2(e.meal?.carbs || 0)}</span>
                          <span className="text-macro-fat">F:{r2(e.meal?.fats || 0)}</span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => setSwapEntry(e)}
                            className="h-7 w-7 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors"
                            title="Swap meal"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => removeEntry(e.id)}
                            className="h-7 w-7 rounded-md border border-border flex items-center justify-center hover:bg-destructive/10 transition-colors"
                            title="Remove meal"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setViewingPlan(null)}>
          <ArrowLeft className="h-4 w-4" /> Back to Meal Vault
        </Button>

        <div className="flex justify-between items-center">
          <div className="flex justify-center flex-1">
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              <button
                className={`px-4 py-2 text-sm flex items-center gap-1.5 ${viewMode === "calendar" ? "bg-card font-semibold" : "text-muted-foreground"}`}
                onClick={() => setViewMode("calendar")}
              >
                <Calendar className="h-4 w-4" /> Calendar View
              </button>
              <button
                className={`px-4 py-2 text-sm flex items-center gap-1.5 ${viewMode === "list" ? "bg-card font-semibold" : "text-muted-foreground"}`}
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" /> Meals List
              </button>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={generateShoppingList}
            disabled={generatingList || entries.length === 0}
          >
            {generatingList ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
            Shopping List
          </Button>
        </div>

        {/* Weekly Nutrition Summary */}
        {sortedDays.length > 0 && (() => {
          const weekTotals = sortedDays.reduce(
            (acc, day) => {
              const t = getDayTotals(day);
              return { cal: acc.cal + t.cal, p: acc.p + t.p, c: acc.c + t.c, f: acc.f + t.f };
            },
            { cal: 0, p: 0, c: 0, f: 0 }
          );
          const numDays = sortedDays.length;
          const avg = { cal: r2(weekTotals.cal / numDays), p: r2(weekTotals.p / numDays), c: r2(weekTotals.c / numDays), f: r2(weekTotals.f / numDays) };
          const tCal = targetMacros?.calories || 2000;
          const tP = targetMacros?.protein_g || 150;
          const tC = targetMacros?.carbs_g || 200;
          const tF = targetMacros?.fat_g || 65;

          const MacroBar = ({ label, value, target, color }: { label: string; value: number; target: number; color: string }) => {
            const pct = Math.min(100, (value / target) * 100);
            const isOver = value > target;
            return (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{label}</span>
                  <span className={`font-semibold ${isOver ? "text-destructive" : ""}`}>
                    {value} <span className="text-muted-foreground font-normal">/ {target}</span>
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          };

          return (
            <Card className="border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">Weekly Nutrition Summary</p>
                    <p className="text-[10px] text-muted-foreground">Daily average across {numDays} day{numDays > 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{avg.cal}</p>
                    <p className="text-[10px] text-muted-foreground">avg kcal/day</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <MacroBar label="Calories" value={avg.cal} target={tCal} color="bg-primary" />
                  <MacroBar label="Protein" value={avg.p} target={tP} color="bg-macro-protein" />
                  <MacroBar label="Carbs" value={avg.c} target={tC} color="bg-macro-carbs" />
                  <MacroBar label="Fat" value={avg.f} target={tF} color="bg-macro-fat" />
                </div>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="font-bold text-sm">{r2(weekTotals.cal)}</p>
                    <p className="text-[10px] text-muted-foreground">total cal</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-macro-protein/10">
                    <p className="font-bold text-sm text-macro-protein">{r2(weekTotals.p)}g</p>
                    <p className="text-[10px] text-muted-foreground">protein</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-macro-carbs/10">
                    <p className="font-bold text-sm text-macro-carbs">{r2(weekTotals.c)}g</p>
                    <p className="text-[10px] text-muted-foreground">carbs</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-macro-fat/10">
                    <p className="font-bold text-sm text-macro-fat">{r2(weekTotals.f)}g</p>
                    <p className="text-[10px] text-muted-foreground">fat</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {viewMode === "calendar" ? renderCalendar() : renderList()}

        {/* Swap Meal Dialog */}
        <Dialog open={!!swapEntry} onOpenChange={(open) => { if (!open) { setSwapEntry(null); setSwapSearch(""); } }}>
          <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col w-[95vw] max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Swap {swapEntry?.meal_time ? `${swapEntry.meal_time.charAt(0).toUpperCase()}${swapEntry.meal_time.slice(1)}` : "Meal"} — {swapEntry?.day_of_week}
              </DialogTitle>
            </DialogHeader>

            {swapEntry?.meal && (
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <p className="text-xs text-muted-foreground mb-1">Current meal:</p>
                <div className="flex items-center gap-2">
                  {swapEntry.meal.image_url && (
                    <img src={swapEntry.meal.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{swapEntry.meal.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r2(swapEntry.meal.calories || 0)} cal · P:{r2(swapEntry.meal.protein || 0)}g · C:{r2(swapEntry.meal.carbs || 0)}g · F:{r2(swapEntry.meal.fats || 0)}g
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search meals..."
                className="pl-10"
                value={swapSearch}
                onChange={(e) => setSwapSearch(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 max-h-[50vh]">
              {filteredSwapMeals.map((meal) => (
                <button
                  key={meal.id}
                  onClick={() => swapMeal(meal)}
                  disabled={meal.id === swapEntry?.meal_id}
                  className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center gap-3 ${
                    meal.id === swapEntry?.meal_id
                      ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                      : "border-border hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  {meal.image_url && (
                    <img src={meal.image_url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{meal.title}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{r2(meal.calories || 0)} cal</span>
                      <span className="text-macro-protein">P:{r2(meal.protein || 0)}g</span>
                      <span className="text-macro-carbs">C:{r2(meal.carbs || 0)}g</span>
                      <span className="text-macro-fat">F:{r2(meal.fats || 0)}g</span>
                    </div>
                  </div>
                  {meal.id === swapEntry?.meal_id && (
                    <Badge variant="outline" className="text-[10px] shrink-0">Current</Badge>
                  )}
                </button>
              ))}
              {filteredSwapMeals.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">No meals found</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // --- PLAN LIST ---
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground text-sm">
          {searchTerm ? "No plans match your search" : "No meal plans yet. Generate your first one!"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{filtered.length} meal plan{filtered.length !== 1 ? "s" : ""}</p>
      {filtered.map((plan) => {
        const stats = getPlanStats(plan);
        const isActive = activePlanId === plan.id;
        const createdDate = new Date(plan.created_at);
        const isPast = !isActive;

        return (
          <Card key={plan.id} className={isActive ? "border-primary" : ""}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">{plan.name}</h3>
                  {isPast && <Badge variant="outline" className="text-[10px]">Past</Badge>}
                  {isActive && <Badge className="text-[10px] bg-primary">Active</Badge>}
                </div>
                <Heart className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-destructive" />
              </div>

              {plan.description && (
                <p className="text-xs text-muted-foreground">{plan.description}</p>
              )}

              {targetMacros && (
                <div>
                  <p className="text-xs font-semibold mb-1.5">Target Macros:</p>
                  <div className="flex gap-2">
                    <div className="flex-1 text-center py-1.5 rounded bg-muted/50 text-xs">
                      <span className="font-bold">{targetMacros.calories}</span>
                      <span className="text-muted-foreground ml-0.5">cal</span>
                    </div>
                    <div className="flex-1 text-center py-1.5 rounded bg-macro-protein/10 text-xs">
                      <span className="font-bold text-macro-protein">{targetMacros.protein_g}g</span>
                      <span className="text-muted-foreground ml-0.5">protein</span>
                    </div>
                    <div className="flex-1 text-center py-1.5 rounded bg-macro-carbs/10 text-xs">
                      <span className="font-bold text-macro-carbs">{targetMacros.carbs_g}g</span>
                      <span className="text-muted-foreground ml-0.5">carbs</span>
                    </div>
                    <div className="flex-1 text-center py-1.5 rounded bg-macro-fat/10 text-xs">
                      <span className="font-bold text-macro-fat">{targetMacros.fat_g}g</span>
                      <span className="text-muted-foreground ml-0.5">fat</span>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground">
                Created {createdDate.toLocaleDateString()}
              </p>

              <div className="flex gap-2">
                {!isActive && (
                  <Button size="sm" className="flex-1 gap-1.5" onClick={() => setAsActive(plan.id)}>
                    <Sparkles className="h-3.5 w-3.5" /> Set as Active Plan
                  </Button>
                )}
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => viewPlan(plan)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => duplicatePlan(plan)} disabled={duplicating === plan.id} title="Duplicate plan">
                  {duplicating === plan.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => deletePlan(plan.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
