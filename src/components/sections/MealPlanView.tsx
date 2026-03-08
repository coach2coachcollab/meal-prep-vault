import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, ChevronRight, Calendar, List, Trash2, Eye, Pencil, Heart,
  Flame, Search, Loader2, ArrowLeft, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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

  useEffect(() => {
    if (user) {
      loadPlans();
      loadTargetMacros();
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

  const viewPlan = async (plan: SavedPlan) => {
    setViewingPlan(plan);
    const { data } = await supabase
      .from("meal_plan_entries")
      .select("id, meal_plan_id, meal_id, day_of_week, meal_time, meal:meals(id, title, calories, protein, carbs, fats, image_url)")
      .eq("meal_plan_id", plan.id);
    if (data) setEntries(data.map((e: any) => ({ ...e, meal: e.meal })));
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
    // Extract from description if available
    const desc = plan.description || "";
    const calMatch = desc.match(/(\d+)\s*calories/);
    return {
      targetCal: calMatch ? parseInt(calMatch[1]) : targetMacros?.calories || 2000,
    };
  };

  const filtered = plans.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
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
      return { cal, p, c, f };
    };

    // Calendar rendering
    const renderCalendar = () => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      // Map plan days to calendar dates (start from plan start_date or created_at)
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
              <div key={e.id} className={`text-[9px] px-1 py-0.5 rounded mb-0.5 truncate ${mealTimeColors[e.meal_time] || "bg-muted"}`}>
                {e.meal?.title || "Unknown"}
                <span className="ml-1 opacity-70">{e.meal?.calories || 0} cal</span>
              </div>
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
                    {dayEntries.map((e) => (
                      <div key={e.id} className={`flex items-center gap-3 p-3 rounded-lg ${mealTimeColors[e.meal_time]?.replace("text-", "bg-").split(" ")[0] || "bg-muted/50"}`}>
                        {e.meal?.image_url && (
                          <img src={e.meal.image_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <Badge variant="outline" className="text-[10px] capitalize mb-0.5">{e.meal_time}</Badge>
                          <p className="text-sm font-medium truncate">{e.meal?.title || "Unknown"}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground shrink-0 flex items-center gap-2">
                          <Flame className="h-3 w-3" />
                          <span>{e.meal?.calories || 0}</span>
                          <span className="text-macro-protein">P:{e.meal?.protein || 0}</span>
                          <span className="text-macro-carbs">C:{e.meal?.carbs || 0}</span>
                          <span className="text-macro-fat">F:{e.meal?.fats || 0}</span>
                          <Eye className="h-3.5 w-3.5 cursor-pointer hover:text-foreground" />
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

        <div className="flex justify-center">
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

        {viewMode === "calendar" ? renderCalendar() : renderList()}
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

              {/* Target Macros */}
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
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <Pencil className="h-3.5 w-3.5" />
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

// Need Sparkles import
import { Sparkles } from "lucide-react";
