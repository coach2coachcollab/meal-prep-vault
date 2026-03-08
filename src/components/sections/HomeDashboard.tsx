import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Flame, Beef, Wheat, Droplets, Target, Calendar, CheckCircle2, Users, TrendingDown, TrendingUp, Minus, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";

const tips = [
  "Protein at every meal helps maintain muscle mass and keeps you satisfied longer.",
  "Staying hydrated improves energy, digestion, and hormone balance.",
  "Strength training 2-3x per week supports bone density and metabolism.",
  "Eating enough healthy fats is essential for hormone production.",
  "Sleep is the #1 recovery tool — aim for 7-8 hours consistently.",
  "Fiber-rich foods help maintain stable blood sugar levels throughout the day.",
  "Managing stress is just as important as exercise for your overall health.",
  "Eating colorful vegetables provides diverse micronutrients your body needs.",
];

export function HomeDashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { user } = useAuth();
  const [profileName, setProfileName] = useState("");
  const [macros, setMacros] = useState<{ calories: number; protein_g: number; carbs_g: number; fat_g: number } | null>(null);
  const [todayJournal, setTodayJournal] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [habitsToday, setHabitsToday] = useState({ done: 0, total: 0 });
  const [waterToday, setWaterToday] = useState({ glasses: 0, goal: 8 });
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);
  const [streak] = useState(0); // streak now displayed in global header
  const [isLoading, setIsLoading] = useState(true);
  const [progressSummary, setProgressSummary] = useState<{
    period: "week" | "month";
    weightChange: number | null;
    waistChange: number | null;
    currentWeight: number | null;
    entries: number;
    useMetric: boolean;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      Promise.all([loadData(), loadProgressSummary()])
        .finally(() => setIsLoading(false));
    }
  }, [user]);

  const shownMilestones = useRef(new Set<string>());

  const showMilestone = (key: string, icon: string, title: string, description: string) => {
    const storageKey = `milestone_${user?.id}_${key}`;
    if (shownMilestones.current.has(key)) return;
    if (localStorage.getItem(storageKey)) return;
    shownMilestones.current.add(key);
    localStorage.setItem(storageKey, new Date().toISOString());
    setTimeout(() => {
      toast(title, {
        description,
        icon,
        duration: 6000,
      });
    }, 1500);
  };

  const checkMilestones = async () => {
    if (!user) return;

    // Fetch latest data for checks
    const [{ data: profile }, { data: latestLog }, { count: totalEntries }] = await Promise.all([
      supabase.from("profiles").select("goal_weight_kg").eq("user_id", user.id).single(),
      supabase.from("progress_logs").select("weight_kg").eq("user_id", user.id).order("date", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);

    // Goal weight reached
    if (profile?.goal_weight_kg && latestLog?.weight_kg) {
      if (latestLog.weight_kg <= profile.goal_weight_kg) {
        showMilestone("goal_weight", "🏆", "Goal Weight Reached!", "You've hit your goal weight — incredible work!");
      }
    }

    // Meal logging milestones
    const mealCount = totalEntries || 0;
    if (mealCount >= 100) showMilestone("meals_100", "⭐", "100 Meals Logged!", "You've logged 100 meals — dedication pays off!");
    else if (mealCount >= 50) showMilestone("meals_50", "🌟", "50 Meals Logged!", "Half a century of meals tracked — great consistency!");
    else if (mealCount >= 10) showMilestone("meals_10", "✨", "10 Meals Logged!", "You're building a strong tracking habit!");
  };

  const loadData = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];

    // Profile name
    const { data: profile } = await supabase.from("profiles").select("name").eq("user_id", user.id).single();
    if (profile?.name) setProfileName(profile.name);

    // User macros
    const { data: macro } = await supabase
      .from("user_macros")
      .select("calories, protein_g, carbs_g, fat_g")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (macro) setMacros(macro);

    // Today's journal
    const { data: journal } = await supabase
      .from("journal_entries")
      .select("calories, protein_g, carbs_g, fat_g")
      .eq("user_id", user.id)
      .eq("date", today);
    if (journal) {
      const r = (n: number) => Math.round(n * 100) / 100;
      setTodayJournal({
        calories: r(journal.reduce((s, j) => s + (Number(j.calories) || 0), 0)),
        protein: r(journal.reduce((s, j) => s + (Number(j.protein_g) || 0), 0)),
        carbs: r(journal.reduce((s, j) => s + (Number(j.carbs_g) || 0), 0)),
        fat: r(journal.reduce((s, j) => s + (Number(j.fat_g) || 0), 0)),
      });
    }

    // Today's habits
    const { data: habits } = await supabase.from("user_habits").select("id").eq("user_id", user.id).eq("is_active", true);
    const { data: logs } = await supabase.from("habit_logs").select("id").eq("user_id", user.id).eq("date", today).eq("completed", true);
    setHabitsToday({ done: logs?.length || 0, total: habits?.length || 0 });

    // Today's water
    const { data: water } = await supabase.from("water_logs").select("glasses, goal").eq("user_id", user.id).eq("date", today).maybeSingle();
    if (water) setWaterToday({ glasses: water.glasses, goal: water.goal });
  };

  // Streak logic moved to useStreak hook in global header


  const loadProgressSummary = async () => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("preferred_units").eq("user_id", user.id).single();
    const isMetric = profile?.preferred_units !== "imperial";

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const { data: recentLogs } = await supabase
      .from("progress_logs")
      .select("date, weight_kg, waist_cm")
      .eq("user_id", user.id)
      .gte("date", monthAgo.toISOString().split("T")[0])
      .order("date", { ascending: true });

    if (!recentLogs || recentLogs.length < 2) return;

    // Determine if we have enough for weekly vs monthly
    const weekLogs = recentLogs.filter((l) => new Date(l.date) >= weekAgo);
    const useLogs = weekLogs.length >= 2 ? weekLogs : recentLogs;
    const period = weekLogs.length >= 2 ? "week" as const : "month" as const;

    const first = useLogs[0];
    const last = useLogs[useLogs.length - 1];

    const KG_TO_LBS = 2.20462;
    const CM_TO_IN = 0.393701;

    let weightChange: number | null = null;
    if (first.weight_kg != null && last.weight_kg != null) {
      const diff = last.weight_kg - first.weight_kg;
      weightChange = isMetric
        ? Math.round(diff * 10) / 10
        : Math.round(diff * KG_TO_LBS * 10) / 10;
    }

    let waistChange: number | null = null;
    if (first.waist_cm != null && last.waist_cm != null) {
      const diff = last.waist_cm - first.waist_cm;
      waistChange = isMetric
        ? Math.round(diff * 10) / 10
        : Math.round(diff * CM_TO_IN * 10) / 10;
    }

    const currentWeight = last.weight_kg != null
      ? (isMetric ? last.weight_kg : Math.round(last.weight_kg * KG_TO_LBS * 10) / 10)
      : null;

    setProgressSummary({
      period,
      weightChange,
      waistChange,
      currentWeight,
      entries: useLogs.length,
      useMetric: isMetric,
    });
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const calPercent = macros ? Math.min(100, (todayJournal.calories / macros.calories) * 100) : 0;

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-heading">{greeting()}, {profileName || "there"} 👋</h2>
        <p className="text-muted-foreground text-sm">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>

      {/* Macro Ring */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("nutrition")}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative h-24 w-24 shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" className="stroke-muted" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  className="stroke-primary"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${calPercent * 2.64} ${264 - calPercent * 2.64}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Flame className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold">{todayJournal.calories}</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Daily Calories</p>
              <p className="text-xs text-muted-foreground">{todayJournal.calories} / {macros?.calories || "—"} kcal</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <Beef className="h-3 w-3 text-primary" />
                  <span>{todayJournal.protein}g P</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wheat className="h-3 w-3 text-accent-foreground" />
                  <span>{todayJournal.carbs}g C</span>
                </div>
                <div className="flex items-center gap-1">
                  <Droplets className="h-3 w-3 text-secondary-foreground" />
                  <span>{todayJournal.fat}g F</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Habits & Water */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow border border-border" onClick={() => onNavigate("nutrition:habits")}>
          <CardContent className="pt-4 pb-4 flex flex-col items-center">
            <div className="h-8 w-8 rounded-full bg-icon-bg flex items-center justify-center mb-1">
              <CheckCircle2 className="h-4 w-4 text-foreground" />
            </div>
            <p className="text-lg font-bold text-foreground">{habitsToday.done}/{habitsToday.total}</p>
            <p className="text-[10px] text-section-label font-label uppercase">Habits done</p>
            <Progress value={habitsToday.total > 0 ? (habitsToday.done / habitsToday.total) * 100 : 0} className="w-full h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow border border-border" onClick={() => onNavigate("nutrition:water")}>
          <CardContent className="pt-4 pb-4 flex flex-col items-center">
            <div className="relative h-12 w-12 mb-1">
              <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
                <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--water-ring-bg))" strokeWidth="4" />
                <circle
                  cx="24" cy="24" r="20" fill="none"
                  stroke="hsl(var(--water-ring))"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.min(waterToday.glasses / waterToday.goal, 1) * 125.6} ${125.6 - Math.min(waterToday.glasses / waterToday.goal, 1) * 125.6}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Droplets className="h-4 w-4 text-water-ring" />
              </div>
            </div>
            <p className="text-lg font-bold text-foreground">{waterToday.glasses}/{waterToday.goal}</p>
            <p className="text-[10px] text-section-label font-label uppercase">Glasses of water</p>
          </CardContent>
        </Card>
      </div>


      {/* Progress Summary */}
      {progressSummary && (
        <Card className="cursor-pointer hover:shadow-md transition-shadow border-primary/20" onClick={() => onNavigate("profile")}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-primary" />
              <p className="text-xs font-label uppercase text-primary">
                {progressSummary.period === "week" ? "Weekly" : "Monthly"} Progress
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {progressSummary.weightChange != null && (
                <div className="flex items-center gap-2">
                  {progressSummary.weightChange < 0 ? (
                    <TrendingDown className="h-4 w-4 text-success" />
                  ) : progressSummary.weightChange > 0 ? (
                    <TrendingUp className="h-4 w-4 text-warning" />
                  ) : (
                    <Minus className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-bold">
                      {progressSummary.weightChange > 0 ? "+" : ""}{progressSummary.weightChange} {progressSummary.useMetric ? "kg" : "lbs"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Weight</p>
                  </div>
                </div>
              )}
              {progressSummary.waistChange != null && (
                <div className="flex items-center gap-2">
                  {progressSummary.waistChange < 0 ? (
                    <TrendingDown className="h-4 w-4 text-success" />
                  ) : progressSummary.waistChange > 0 ? (
                    <TrendingUp className="h-4 w-4 text-warning" />
                  ) : (
                    <Minus className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-bold">
                      {progressSummary.waistChange > 0 ? "+" : ""}{progressSummary.waistChange} {progressSummary.useMetric ? "cm" : "in"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Waist</p>
                  </div>
                </div>
              )}
            </div>
            {progressSummary.currentWeight != null && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Current: {progressSummary.currentWeight} {progressSummary.useMetric ? "kg" : "lbs"} · {progressSummary.entries} entries
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Daily Tip */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-label uppercase text-primary mb-1">💡 Daily Tip</p>
          <p className="text-sm text-foreground">{tip}</p>
        </CardContent>
      </Card>
    </div>
  );
}
