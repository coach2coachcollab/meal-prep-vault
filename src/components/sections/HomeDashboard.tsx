import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flame, Droplets, Target, TrendingDown, TrendingUp, Minus, Activity, Utensils, Dumbbell, Zap, ChevronRight, UtensilsCrossed, Footprints } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { useStreak } from "@/hooks/useStreak";
import { cn } from "@/lib/utils";
import { buildRelogPayload } from "@/lib/logging-helpers";

export function HomeDashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { streak } = useStreak();

  const { data: dashData, isLoading } = useQuery({
    queryKey: queryKeys.dashboard(user?.id),
    queryFn: async () => {
      if (!user) return null;
      const today = new Date().toISOString().split("T")[0];

      const [
        { data: profile },
        { data: macro },
        { data: recentJournal },
        { data: habits },
        { data: logs },
        { data: water },
        { data: recentWorkout },
        { data: lastTemplate },
      ] = await Promise.all([
        supabase.from("profiles").select("name").eq("user_id", user.id).single(),
        supabase.from("user_macros").select("calories, protein_g, carbs_g, fat_g").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("journal_entries")
          .select("food_name, recipe_id, meal_type, servings, calories, protein_g, carbs_g, fat_g, image_url, date, logged_at")
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false })
          .limit(60),
        supabase.from("user_habits").select("id").eq("user_id", user.id).eq("is_active", true),
        supabase.from("habit_logs").select("id").eq("user_id", user.id).eq("date", today).eq("completed", true),
        supabase.from("water_logs").select("glasses, goal").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("workout_logs").select("id").eq("user_id", user.id).eq("completed_at", today).limit(1),
        supabase.from("workout_templates").select("name, category").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const r = (n: number) => Math.round(n * 100) / 100;
      const todaysEntries = (recentJournal || []).filter((j: any) => j.date === today);
      const todayJournal = {
        calories: r(todaysEntries.reduce((s: number, j: any) => s + (Number(j.calories) || 0), 0)),
        protein: r(todaysEntries.reduce((s: number, j: any) => s + (Number(j.protein_g) || 0), 0)),
        carbs: r(todaysEntries.reduce((s: number, j: any) => s + (Number(j.carbs_g) || 0), 0)),
        fat: r(todaysEntries.reduce((s: number, j: any) => s + (Number(j.fat_g) || 0), 0)),
      };
      const loggedMealTypes = new Set(todaysEntries.map((j: any) => j.meal_type));

      const seen = new Set<string>();
      const recent: any[] = [];
      for (const rr of recentJournal || []) {
        const k = `${(rr as any).recipe_id || ""}::${(rr as any).food_name}`;
        if (seen.has(k)) continue;
        seen.add(k);
        recent.push(rr);
        if (recent.length >= 5) break;
      }

      return {
        profileName: profile?.name || "",
        macros: macro || null,
        todayJournal,
        loggedMealTypes,
        habitsToday: { done: logs?.length || 0, total: habits?.length || 0 },
        waterToday: water ? { glasses: water.glasses, goal: water.goal } : { glasses: 0, goal: 8 },
        recentMeals: recent,
        hasLoggedToday: todaysEntries.length > 0 || (logs?.length ?? 0) > 0,
        hasWorkedOutToday: (recentWorkout?.length ?? 0) > 0,
        lastTemplateName: lastTemplate?.name || null,
        lastTemplateCategory: lastTemplate?.category || null,
      };
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const { data: progressSummary } = useQuery({
    queryKey: queryKeys.progressSummary(user?.id),
    queryFn: async () => {
      if (!user) return null;
      const { data: profile } = await supabase.from("profiles").select("preferred_units").eq("user_id", user.id).single();
      const isMetric = profile?.preferred_units !== "imperial";

      const now = new Date();
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: recentLogs } = await supabase
        .from("progress_logs")
        .select("date, weight_kg, waist_cm")
        .eq("user_id", user.id)
        .gte("date", monthAgo.toISOString().split("T")[0])
        .order("date", { ascending: true });

      if (!recentLogs || recentLogs.length < 2) return null;

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
        weightChange = isMetric ? Math.round(diff * 10) / 10 : Math.round(diff * KG_TO_LBS * 10) / 10;
      }

      let waistChange: number | null = null;
      if (first.waist_cm != null && last.waist_cm != null) {
        const diff = last.waist_cm - first.waist_cm;
        waistChange = isMetric ? Math.round(diff * 10) / 10 : Math.round(diff * CM_TO_IN * 10) / 10;
      }

      const currentWeight = last.weight_kg != null
        ? (isMetric ? last.weight_kg : Math.round(last.weight_kg * KG_TO_LBS * 10) / 10)
        : null;

      return { period, weightChange, waistChange, currentWeight, entries: useLogs.length, useMetric: isMetric };
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const profileName = dashData?.profileName || "";
  const macros = dashData?.macros || null;
  const todayJournal = dashData?.todayJournal || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const loggedMealTypes = dashData?.loggedMealTypes || new Set<string>();
  const habitsToday = dashData?.habitsToday || { done: 0, total: 0 };
  const waterToday = dashData?.waterToday || { glasses: 0, goal: 8 };
  const recentMeals = dashData?.recentMeals || [];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const calPercent = macros ? Math.min(100, (todayJournal.calories / macros.calories) * 100) : 0;
  const proteinPercent = macros ? Math.min(100, (todayJournal.protein / macros.protein_g) * 100) : 0;
  const carbsPercent = macros ? Math.min(100, (todayJournal.carbs / macros.carbs_g) * 100) : 0;
  const fatPercent = macros ? Math.min(100, (todayJournal.fat / macros.fat_g) * 100) : 0;

  const relogRecent = async (r: any) => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("journal_entries")
      .insert(buildRelogPayload(user.id, today, r));
    if (error) { toast.error("Failed to log"); return; }
    toast.success(`${r.food_name} logged!`);
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(user.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.journalEntries(user.id, today) });
    queryClient.invalidateQueries({ queryKey: queryKeys.streak(user.id) });
  };

  const getWhatsNextNudge = () => {
    if (!dashData) return null;
    if (!loggedMealTypes.has("Lunch")) {
      return {
        title: "Lunch not logged yet",
        description: "Quick add it now and stay on track.",
        cta: "Log lunch",
        icon: Utensils,
        onClick: () => onNavigate("nutrition:today"),
      };
    }
    if (streak > 0 && !dashData.hasLoggedToday) {
      return {
        title: `Keep your ${streak}-day streak alive 🔥`,
        description: "Log one meal or one habit to protect your streak.",
        cta: "Log now",
        icon: Zap,
        onClick: () => onNavigate("nutrition:today"),
      };
    }
    if (!dashData.hasWorkedOutToday && dashData.lastTemplateName) {
      return {
        title: `Looks like a ${dashData.lastTemplateCategory?.replace("_", " ") || "workout"} day`,
        description: `${dashData.lastTemplateName} is ready when you are.`,
        cta: "Start workout",
        icon: Dumbbell,
        onClick: () => onNavigate("fitness"),
      };
    }
    return {
      title: "Great momentum today",
      description: "Review your progress or share a win with the community.",
      cta: "View progress",
      icon: ChevronRight,
      onClick: () => onNavigate("profile"),
    };
  };

  const whatsNext = getWhatsNextNudge();

  if (isLoading) return <DashboardSkeleton />;

  const circumference = 2 * Math.PI * 44;

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-heading text-foreground">
          {greeting()}, {profileName || "there"} 👋
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">Here's your progress for today.</p>
      </div>

      {/* Macro Progress Card */}
      <Card className="shadow-sm border border-border" onClick={() => onNavigate("nutrition")}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-label text-muted-foreground tracking-widest uppercase">Macro Progress</span>
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate("nutrition"); }}
              className="text-xs font-semibold text-primary"
            >
              Edit Targets
            </button>
          </div>

          <div className="flex items-center gap-5">
            {/* Ring */}
            <div className="relative shrink-0 h-28 w-28">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="44" fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(calPercent / 100) * circumference} ${circumference}`}
                  style={{ filter: "drop-shadow(0 0 6px hsl(221 83% 53% / 0.5))" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-black leading-none text-foreground">{Math.round(todayJournal.calories).toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">/ {macros?.calories ?? "—"} kcal</span>
                <span className="text-sm font-bold text-primary mt-0.5">{Math.round(calPercent)}%</span>
              </div>
            </div>

            {/* Macro bars */}
            <div className="flex-1 space-y-3">
              {[
                { label: "Protein", current: todayJournal.protein, target: macros?.protein_g, pct: proteinPercent, color: "hsl(var(--macro-protein))" },
                { label: "Carbs", current: todayJournal.carbs, target: macros?.carbs_g, pct: carbsPercent, color: "hsl(var(--macro-carbs))" },
                { label: "Fat", current: todayJournal.fat, target: macros?.fat_g, pct: fatPercent, color: "hsl(var(--macro-fat))" },
              ].map(({ label, current, target, pct, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm font-medium text-foreground">{label}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{Math.round(current)}</span> / {target ?? "—"}g
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mini stat cards */}
      <div className="grid grid-cols-3 gap-2">
        {/* Water */}
        <Card className="border border-border shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("nutrition:today")}>
          <CardContent className="py-3 px-3">
            <p className="text-[11px] text-muted-foreground mb-1">Water</p>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-base font-bold text-foreground">{waterToday.glasses.toFixed(1)}</span>
                <span className="text-[11px] text-muted-foreground"> / {waterToday.goal}L</span>
              </div>
              <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                <Droplets className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Habits */}
        <Card className="border border-border shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("nutrition:today")}>
          <CardContent className="py-3 px-3">
            <p className="text-[11px] text-muted-foreground mb-1">Habits</p>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-base font-bold text-foreground">{habitsToday.done}</span>
                <span className="text-[11px] text-muted-foreground"> / {habitsToday.total}</span>
              </div>
              <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                <Target className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calories */}
        <Card className="border border-border shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("nutrition")}>
          <CardContent className="py-3 px-3">
            <p className="text-[11px] text-muted-foreground mb-1">Energy</p>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-base font-bold text-foreground">{Math.round(todayJournal.calories)}</span>
                <span className="text-[11px] text-muted-foreground"> kcal</span>
              </div>
              <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Meal Plan */}
      <Card className="border border-border shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-label font-semibold text-foreground tracking-widest uppercase">Today's Meal Plan</span>
            <button onClick={() => onNavigate("nutrition")} className="text-xs font-semibold text-primary">View Plan</button>
          </div>
          {recentMeals.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground capitalize mb-0.5">
                  {(() => {
                    const h = new Date().getHours();
                    if (h < 10) return "Breakfast";
                    if (h < 14) return "Lunch";
                    if (h < 18) return "Dinner";
                    return "Snack";
                  })()}
                </p>
                <p className="text-base font-bold text-foreground leading-tight">{recentMeals[0].food_name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round(recentMeals[0].calories)} kcal
                  {recentMeals[0].protein_g ? ` · ${Math.round(recentMeals[0].protein_g)}g P` : ""}
                  {recentMeals[0].carbs_g ? ` · ${Math.round(recentMeals[0].carbs_g)}g C` : ""}
                  {recentMeals[0].fat_g ? ` · ${Math.round(recentMeals[0].fat_g)}g F` : ""}
                </p>
              </div>
              {recentMeals[0].image_url ? (
                <img
                  src={recentMeals[0].image_url}
                  alt={recentMeals[0].food_name}
                  className="h-16 w-16 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Utensils className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => onNavigate("nutrition:today")}
              className="w-full flex items-center gap-3 py-2"
            >
              <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center shrink-0">
                <Utensils className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">No meals logged yet</p>
                <p className="text-xs text-muted-foreground">Tap to log your first meal today</p>
              </div>
            </button>
          )}
        </CardContent>
      </Card>

      {/* Today's Workout */}
      {dashData?.lastTemplateName && (
        <Card className="border border-border shadow-sm overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-label font-semibold text-foreground tracking-widest uppercase block mb-1">Today's Workout</span>
                <p className="text-xl font-black text-foreground leading-tight">{dashData.lastTemplateName}</p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">
                  {dashData.lastTemplateCategory?.replace("_", " ") || "Strength"}
                </p>
                <Button
                  size="sm"
                  className="mt-3 rounded-full px-5 text-sm font-semibold"
                  onClick={() => onNavigate("fitness")}
                >
                  Start Workout
                </Button>
              </div>
              <div className="h-20 w-20 rounded-2xl bg-accent flex items-center justify-center shrink-0">
                <Dumbbell className="h-10 w-10 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent meals – one-tap re-log */}
      {recentMeals.length > 0 && (
        <div>
          <p className="text-xs font-label text-muted-foreground mb-2 pl-0.5">Recent · tap to re-log</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
            {recentMeals.map((r: any, i: number) => (
              <button
                key={`${r.recipe_id || "m"}-${r.food_name}-${i}`}
                onClick={() => relogRecent(r)}
                className="shrink-0 w-28 text-left p-1.5 rounded-xl border border-border bg-card hover:border-primary hover:shadow-sm transition-all"
              >
                {r.image_url ? (
                  <img loading="lazy" decoding="async" src={r.image_url} alt={r.food_name} className="h-14 w-full rounded-lg object-cover mb-1.5" />
                ) : (
                  <div className="h-14 w-full rounded-lg bg-muted flex items-center justify-center mb-1.5">
                    <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <p className="text-xs font-semibold truncate text-foreground">{r.food_name}</p>
                <p className="text-[10px] text-muted-foreground">{r.calories} kcal</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Progress Summary */}
      {progressSummary && (
        <Card className="cursor-pointer hover:shadow-md transition-shadow border border-border" onClick={() => onNavigate("profile")}>
          <CardContent className="py-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-label text-primary">
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
          </CardContent>
        </Card>
      )}

      {/* What's next nudge */}
      {whatsNext && (
        <Card className="border border-primary/20 bg-accent">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <whatsNext.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{whatsNext.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{whatsNext.description}</p>
              </div>
              <Button size="sm" className="shrink-0 h-8 px-3 text-xs rounded-full" onClick={whatsNext.onClick}>
                {whatsNext.cta}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streak banner */}
      {streak > 0 && (
        <button
          onClick={() => onNavigate("streak")}
          className="w-full flex items-center gap-3 p-3 rounded-2xl border border-border bg-card hover:bg-muted/50 transition-colors"
        >
          <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-foreground">You're on a {streak}-day consistency streak.</p>
            <p className="text-xs text-muted-foreground">Keep it up — small steps, big wins.</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      )}
    </div>
  );
}
