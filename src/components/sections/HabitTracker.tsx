import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Circle, Plus, Flame, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Habit {
  id: string;
  name: string;
  icon: string;
  completed: boolean;
  streak: number;
}

const defaultHabitsByGoal: Record<string, string[]> = {
  "Hormone balance": ["Sleep 7-8 hours", "Drink 8 glasses of water", "20+ minutes movement", "Stress relief activity", "Take supplements"],
  "Lose fat": ["Drink 8 glasses of water", "30+ minutes movement", "Eat protein at every meal", "Log all meals"],
  "Build muscle": ["Strength training today", "Hit protein target", "Drink 10 glasses of water", "Sleep 8 hours"],
  "Maintain weight": ["Drink 8 glasses of water", "30 minutes movement", "Eat balanced meals", "Get quality sleep"],
  "Improve energy": ["Sleep 7-8 hours", "Drink 8 glasses of water", "20+ minutes movement", "Eat balanced meals"],
};

export function HabitTracker() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [weekData, setWeekData] = useState<Record<string, boolean[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newHabit, setNewHabit] = useState("");
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (user) loadHabits();
  }, [user]);

  const loadHabits = async () => {
    if (!user) return;
    const { data: habitsData } = await supabase.from("user_habits").select("*").eq("user_id", user.id).eq("is_active", true).order("sort_order");

    if (!habitsData || habitsData.length === 0) {
      await seedDefaults();
      return;
    }

    // Load today's logs
    const { data: todayLogs } = await supabase.from("habit_logs").select("habit_id, completed").eq("user_id", user.id).eq("date", today);
    const completedSet = new Set((todayLogs || []).filter((l) => l.completed).map((l) => l.habit_id));

    // Calc streaks
    const enriched: Habit[] = [];
    for (const h of habitsData) {
      const { data: streakData } = await supabase.from("habit_logs").select("date, completed").eq("habit_id", h.id).eq("completed", true).order("date", { ascending: false }).limit(30);
      let streak = 0;
      if (streakData) {
        const dates = streakData.map((d) => d.date);
        const check = new Date();
        for (let i = 0; i < 30; i++) {
          const ds = check.toISOString().split("T")[0];
          if (dates.includes(ds)) { streak++; check.setDate(check.getDate() - 1); }
          else if (i === 0) { check.setDate(check.getDate() - 1); continue; } // allow today not done yet
          else break;
        }
      }
      enriched.push({ id: h.id, name: h.name, icon: h.icon, completed: completedSet.has(h.id), streak });
    }
    setHabits(enriched);

    // Week data
    loadWeek(habitsData.map((h) => h.id));
  };

  const loadWeek = async (habitIds: string[]) => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    const { data: weekLogs } = await supabase.from("habit_logs").select("habit_id, date, completed").eq("user_id", user!.id).in("date", dates).eq("completed", true);
    const map: Record<string, boolean[]> = {};
    for (const hid of habitIds) {
      map[hid] = dates.map((d) => !!(weekLogs || []).find((l) => l.habit_id === hid && l.date === d));
    }
    setWeekData(map);
  };

  const seedDefaults = async () => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("goal").eq("user_id", user.id).single();
    const goal = profile?.goal || "Maintain weight";
    const defaults = defaultHabitsByGoal[goal] || defaultHabitsByGoal["Maintain weight"];
    for (let i = 0; i < defaults.length; i++) {
      await supabase.from("user_habits").insert({ user_id: user.id, name: defaults[i], sort_order: i });
    }
    loadHabits();
  };

  const toggleHabit = async (habit: Habit) => {
    if (!user) return;
    if (habit.completed) {
      await supabase.from("habit_logs").delete().eq("habit_id", habit.id).eq("date", today);
    } else {
      await supabase.from("habit_logs").upsert({ habit_id: habit.id, user_id: user.id, date: today, completed: true }, { onConflict: "habit_id,date" });
    }
    loadHabits();
  };

  const addHabit = async () => {
    if (!user || !newHabit.trim()) return;
    await supabase.from("user_habits").insert({ user_id: user.id, name: newHabit, sort_order: habits.length });
    setNewHabit("");
    setDialogOpen(false);
    loadHabits();
    toast.success("Habit added!");
  };

  const deleteHabit = async (id: string) => {
    await supabase.from("user_habits").delete().eq("id", id);
    loadHabits();
    toast.success("Habit removed");
  };

  const done = habits.filter((h) => h.completed).length;
  const total = habits.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading">Habits Today</h2>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-sm font-medium">{done}/{total} habits done</p>
            {done === total && total > 0 && <span className="text-xs text-primary font-medium">🎉 All done!</span>}
          </div>
          <Progress value={total > 0 ? (done / total) * 100 : 0} className="h-2" />
        </CardContent>
      </Card>

      {/* Habit list */}
      <div className="space-y-2">
        {habits.map((h) => (
          <Card key={h.id} className={cn("transition-all", h.completed && "bg-primary/5 border-primary/20")}>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <button onClick={() => toggleHabit(h)}>
                {h.completed ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
              </button>
              <div className="flex-1">
                <p className={cn("text-sm font-medium", h.completed && "line-through text-muted-foreground")}>{h.name}</p>
                {h.streak > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Flame className="h-3 w-3 text-primary" /> {h.streak} day streak
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteHabit(h.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weekly View */}
      {habits.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">This Week</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-8 gap-1 text-[10px] text-muted-foreground">
                <span></span>
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="text-center">{d}</span>)}
              </div>
              {habits.map((h) => (
                <div key={h.id} className="grid grid-cols-8 gap-1 items-center">
                  <span className="text-[10px] truncate">{h.name.slice(0, 8)}</span>
                  {(weekData[h.id] || Array(7).fill(false)).map((done, i) => (
                    <div key={i} className={cn("h-4 w-4 rounded-full mx-auto", done ? "bg-primary" : "bg-muted")} />
                  ))}
                </div>
              ))}
              {/* Daily completion counts */}
              <div className="grid grid-cols-8 gap-1 items-center pt-1 border-t border-border mt-1">
                <span className="text-[10px] text-muted-foreground font-medium">Done</span>
                {Array.from({ length: 7 }, (_, dayIdx) => {
                  const doneCount = habits.filter((h) => (weekData[h.id] || Array(7).fill(false))[dayIdx]).length;
                  return (
                    <span key={dayIdx} className={cn("text-[10px] text-center font-semibold", doneCount === habits.length && habits.length > 0 ? "text-primary" : "text-muted-foreground")}>
                      {doneCount}/{habits.length}
                    </span>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
