import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Droplets, Plus, Minus, Settings2, Star, Smile, Zap, StickyNote, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WeeklySummaryCharts } from "./WeeklySummaryCharts";

const moods = ["😊", "😐", "😴", "😤", "😢"];

export function WaterTracker() {
  const { user } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [glasses, setGlasses] = useState(0);
  const [goal, setGoal] = useState(8);
  const [editGoal, setEditGoal] = useState("8");

  // Mood / Energy / Notes
  const [dailyNote, setDailyNote] = useState({ energy_level: 0, mood_emoji: "", notes: "" });
  const [noteSaved, setNoteSaved] = useState(false);

  const isToday = date === new Date().toISOString().split("T")[0];

  const shiftDate = (dir: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + dir);
    setDate(d.toISOString().split("T")[0]);
  };

  useEffect(() => {
    if (user) {
      loadWater();
      loadDailyNote();
    }
  }, [user, date]);

  const loadWater = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("water_logs")
      .select("glasses, goal")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle();
    if (data) {
      setGlasses(data.glasses);
      setGoal(data.goal);
      setEditGoal(String(data.goal));
    } else {
      setGlasses(0);
      setGoal(8);
      setEditGoal("8");
    }
  };

  const loadDailyNote = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("journal_daily_notes")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle();
    if (data) {
      setDailyNote({
        energy_level: data.energy_level || 0,
        mood_emoji: data.mood_emoji || "",
        notes: data.notes || "",
      });
    } else {
      setDailyNote({ energy_level: 0, mood_emoji: "", notes: "" });
    }
  };

  const updateGlasses = async (newCount: number) => {
    if (!user || newCount < 0) return;
    setGlasses(newCount);
    const { error } = await supabase
      .from("water_logs")
      .upsert(
        { user_id: user.id, date, glasses: newCount, goal },
        { onConflict: "user_id,date" }
      );
    if (error) console.error("Water log error", error);
    if (newCount === goal && newCount > 0) toast.success("💧 Daily water goal reached!");
  };

  const saveGoal = async () => {
    const newGoal = parseInt(editGoal) || 8;
    setGoal(newGoal);
    if (!user) return;
    await supabase
      .from("water_logs")
      .upsert(
        { user_id: user.id, date, glasses, goal: newGoal },
        { onConflict: "user_id,date" }
      );
    toast.success("Goal updated!");
  };

  const saveDailyNote = async () => {
    if (!user) return;
    const { error } = await supabase.from("journal_daily_notes").upsert({
      user_id: user.id, date, ...dailyNote,
    }, { onConflict: "user_id,date" });
    if (!error) {
      setNoteSaved(true);
      toast.success("Daily notes saved!");
      setTimeout(() => setNoteSaved(false), 2000);
    }
  };

  const pct = goal > 0 ? Math.min((glasses / goal) * 100, 100) : 0;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="space-y-5">
      {/* Date nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => shiftDate(-1)}><ChevronLeft className="h-5 w-5" /></Button>
        <div className="text-center">
          <p className="font-semibold">{new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
          {isToday && <p className="text-xs text-primary">Today</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => shiftDate(1)}><ChevronRight className="h-5 w-5" /></Button>
      </div>

      {/* Header */}
      <div>
        <h2 className="text-xl font-heading flex items-center gap-2">
          <Smile className="h-5 w-5 text-primary" />
          Daily Wellness
        </h2>
        <p className="text-sm text-muted-foreground">Track your water, mood & energy</p>
      </div>
      {/* Water + Mood side by side */}
      <div className="grid grid-cols-2 gap-3">
        {/* Water Ring */}
        <Card>
          <CardContent className="pt-4 pb-4 flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-2">
              <p className="text-xs font-label uppercase flex items-center gap-1 text-section-label">
                <Droplets className="h-3.5 w-3.5 text-primary" /> Water
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Settings2 className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48">
                  <div className="space-y-2">
                    <Label className="text-xs">Daily Goal (glasses)</Label>
                    <div className="flex gap-2">
                      <Input type="number" value={editGoal} onChange={(e) => setEditGoal(e.target.value)} className="h-8" />
                      <Button size="sm" onClick={saveGoal}>Set</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="relative w-28 h-28 mb-2">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 112 112">
                <circle cx="56" cy="56" r={radius} fill="none" stroke="hsl(var(--water-ring-bg))" strokeWidth="7" />
                <circle
                  cx="56" cy="56" r={radius} fill="none"
                  stroke="hsl(var(--water-ring))" strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-foreground">{glasses}</span>
                <span className="text-[10px] text-muted-foreground">of {goal}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateGlasses(glasses - 1)} disabled={glasses <= 0}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" className="h-10 w-10 rounded-full" onClick={() => updateGlasses(glasses + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {pct >= 100 && (
              <p className="text-[10px] text-primary font-medium mt-2 text-center">🎉 Goal reached!</p>
            )}
          </CardContent>
        </Card>

        {/* Mood & Energy */}
        <Card>
          <CardContent className="pt-4 pb-4 space-y-3">
            {/* Energy */}
            <div>
              <p className="text-xs font-label uppercase flex items-center gap-1 mb-1.5 text-section-label">
                <Zap className="h-3.5 w-3.5 text-primary" /> Energy
              </p>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setDailyNote({ ...dailyNote, energy_level: n })}>
                    <Star className={cn("h-5 w-5 transition-colors", n <= dailyNote.energy_level ? "fill-star-filled text-star-filled" : "text-star-empty")} />
                  </button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div>
              <p className="text-xs font-label uppercase flex items-center gap-1 mb-1.5 text-section-label">
                <Smile className="h-3.5 w-3.5 text-primary" /> Mood
              </p>
              <div className="flex gap-1">
                {moods.map((m) => (
                  <button
                    key={m}
                    onClick={() => setDailyNote({ ...dailyNote, mood_emoji: m })}
                    className={cn(
                      "text-xl p-0.5 rounded transition-all",
                      dailyNote.mood_emoji === m && "bg-primary/10 ring-2 ring-primary/30 scale-110"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick status */}
            <div className="pt-1 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {dailyNote.energy_level > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Zap className="h-3 w-3" /> {dailyNote.energy_level}/5
                  </span>
                )}
                {dailyNote.mood_emoji && <span>{dailyNote.mood_emoji}</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-2">
          <p className="text-xs font-label uppercase flex items-center gap-1 text-section-label">
            <StickyNote className="h-3.5 w-3.5 text-primary" /> Daily Notes
          </p>
          <Textarea
            placeholder="How are you feeling today? Any wins or struggles?"
            rows={3}
            value={dailyNote.notes}
            onChange={(e) => setDailyNote({ ...dailyNote, notes: e.target.value })}
            className="text-sm"
          />
          <Button size="sm" variant="outline" className="w-full" onClick={saveDailyNote}>
            {noteSaved ? "✓ Saved" : "Save Notes"}
          </Button>
        </CardContent>
      </Card>


      {/* Weekly Summary */}
      <WeeklySummaryCharts />
    </div>
  );
}
