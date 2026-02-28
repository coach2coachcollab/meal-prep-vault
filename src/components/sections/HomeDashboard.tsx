import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Flame, Beef, Wheat, Droplets, Target, Calendar, CheckCircle2, Users, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

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
      setTodayJournal({
        calories: journal.reduce((s, j) => s + (Number(j.calories) || 0), 0),
        protein: journal.reduce((s, j) => s + (Number(j.protein_g) || 0), 0),
        carbs: journal.reduce((s, j) => s + (Number(j.carbs_g) || 0), 0),
        fat: journal.reduce((s, j) => s + (Number(j.fat_g) || 0), 0),
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

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const calPercent = macros ? Math.min(100, (todayJournal.calories / macros.calories) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{greeting()}, {profileName || "there"} 👋</h2>
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

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Flame, label: "Log Meal", tab: "nutrition" },
          { icon: Calendar, label: "View Plan", tab: "plan" },
          { icon: Target, label: "My Macros", tab: "nutrition" },
          { icon: Users, label: "Community", tab: "community" },
        ].map((action) => (
          <button
            key={action.label}
            onClick={() => onNavigate(action.tab)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-card border hover:bg-accent transition-colors"
          >
            <action.icon className="h-5 w-5 text-primary" />
            <span className="text-[10px] font-medium text-muted-foreground">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Habits & Water */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("nutrition")}>
          <CardContent className="pt-4 pb-4 flex flex-col items-center">
            <CheckCircle2 className="h-5 w-5 text-primary mb-1" />
            <p className="text-lg font-bold">{habitsToday.done}/{habitsToday.total}</p>
            <p className="text-[10px] text-muted-foreground">Habits done</p>
            <Progress value={habitsToday.total > 0 ? (habitsToday.done / habitsToday.total) * 100 : 0} className="w-full h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("nutrition")}>
          <CardContent className="pt-4 pb-4 flex flex-col items-center">
            <div className="relative h-12 w-12 mb-1">
              <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
                <circle cx="24" cy="24" r="20" fill="none" className="stroke-muted" strokeWidth="4" />
                <circle
                  cx="24" cy="24" r="20" fill="none"
                  className="stroke-primary"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.min(waterToday.glasses / waterToday.goal, 1) * 125.6} ${125.6 - Math.min(waterToday.glasses / waterToday.goal, 1) * 125.6}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Droplets className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-lg font-bold">{waterToday.glasses}/{waterToday.goal}</p>
            <p className="text-[10px] text-muted-foreground">Glasses of water</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Tip */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-semibold text-primary mb-1">💡 Daily Tip</p>
          <p className="text-sm text-foreground">{tip}</p>
        </CardContent>
      </Card>
    </div>
  );
}
