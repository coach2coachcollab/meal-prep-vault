import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flame, Beef, Wheat, Droplets, Target, Calendar, CheckCircle2, Users, TrendingDown, TrendingUp, Minus, Activity, Utensils, Dumbbell, Zap, ChevronRight, Calculator, UtensilsCrossed } from "lucide-react";
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
  const shownMilestones = useRef(new Set<string>());
  const { streak } = useStreak();

  // MERGED: dashboard + nudge in a single round-trip block
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
        // Fetch a bounded recent slice → powers today's totals + recent-meals strip + hasLoggedToday
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

      // Distinct recent (last 5) by (recipe_id + food_name)
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

  // One-tap re-log directly from Home
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
        title: `Keep your 🔥 ${streak}-day streak alive`,
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

  return (
    <div className="space-y-3">
      <h1 className="sr-only">Your nutrition overview</h1>
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-heading truncate">{greeting()}, {profileName || "there"} 👋</h2>
        <p className="text-muted-foreground text-[11px] shrink-0">{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
      </div>

      {/* Macro Ring - Hero (compact, side-by-side) */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("nutrition")}>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24 shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" className="stroke-muted" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  className="stroke-primary"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${calPercent * 2.64} ${264 - calPercent * 2.64}`}
                  style={{ filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.4))" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Flame className="h-4 w-4 text-primary" />
                <span className="text-xl font-bold leading-tight">{todayJournal.calories}</span>
                <span className="text-[9px] text-muted-foreground">of {macros?.calories || "—"} kcal</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 flex-1">
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-macro-protein/10">
                <Beef className="h-3.5 w-3.5 text-macro-protein" />
                <span className="text-sm font-bold">{todayJournal.protein}g</span>
                <span className="text-[9px] text-muted-foreground">protein</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-macro-carbs/10">
                <Wheat className="h-3.5 w-3.5 text-macro-carbs" />
                <span className="text-sm font-bold">{todayJournal.carbs}g</span>
                <span className="text-[9px] text-muted-foreground">carbs</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-macro-fat/10">
                <Droplets className="h-3.5 w-3.5 text-macro-fat" />
                <span className="text-sm font-bold">{todayJournal.fat}g</span>
                <span className="text-[9px] text-muted-foreground">fat</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* One-tap recent meals */}
      {recentMeals.length > 0 && (
        <div>
          <p className="text-[10px] font-label uppercase text-muted-foreground mb-1 pl-1">Recent · one tap to re-log</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
            {recentMeals.map((r: any, i: number) => (
              <button
                key={`${r.recipe_id || "m"}-${r.food_name}-${i}`}
                onClick={() => relogRecent(r)}
                className="shrink-0 w-28 text-left p-1.5 rounded-lg border bg-card hover:border-primary hover:bg-primary/5 transition-colors"
              >
                {r.image_url ? (
                  <img loading="lazy" decoding="async" src={r.image_url} alt={r.food_name} className="h-10 w-full rounded-md object-cover mb-1" />
                ) : (
                  <div className="h-10 w-full rounded-md bg-muted flex items-center justify-center mb-1">
                    <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <p className="text-xs font-medium truncate">{r.food_name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{r.calories} kcal · {r.meal_type}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Habits & Water */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="cursor-pointer hover:shadow-md transition-shadow border border-border" onClick={() => onNavigate("nutrition:today")}>
          <CardContent className="py-3 px-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-icon-bg flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-foreground leading-tight">{habitsToday.done}/{habitsToday.total}</p>
              <p className="text-[9px] text-section-label font-label uppercase truncate">Today's Wins</p>
              <Progress value={habitsToday.total > 0 ? (habitsToday.done / habitsToday.total) * 100 : 0} className="w-full h-1 mt-1" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow border border-border" onClick={() => onNavigate("nutrition:today")}>
          <CardContent className="py-3 px-3 flex items-center gap-3">
            <div className="relative h-9 w-9 shrink-0">
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
                <Droplets className="h-3.5 w-3.5 text-water-ring" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-foreground leading-tight">{waterToday.glasses}/{waterToday.goal}</p>
              <p className="text-[9px] text-section-label font-label uppercase truncate">Glasses of water</p>
            </div>
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

      {/* What's next */}
      {whatsNext && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-[10px] font-label uppercase text-primary mb-1">What's next?</p>
                <p className="text-sm font-semibold text-foreground">{whatsNext.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{whatsNext.description}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <whatsNext.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
            <Button size="sm" className="w-full mt-3" onClick={whatsNext.onClick}>
              {whatsNext.cta}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
