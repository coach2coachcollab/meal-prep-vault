import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { Droplets, Zap, Smile, TrendingUp, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import confetti from "canvas-confetti";

const MILESTONES = [3, 7, 14, 30];
const milestoneMessages: Record<number, string> = {
  3: "🔥 3-day water streak! You're building a habit!",
  7: "🔥 7-day streak! One full week — amazing consistency!",
  14: "🔥 14-day streak! Two weeks strong — you're unstoppable! 💪",
  30: "🔥 30-day streak! A whole month — legendary hydration! 🏆",
};

const moodMap: Record<string, number> = { "😊": 5, "😐": 3, "😴": 2, "😤": 1, "😢": 1 };

type Range = "week" | "month";

interface DayData {
  day: string;
  glasses: number;
  goal: number;
  energy: number;
  mood: number;
  moodEmoji: string;
}

export function WeeklySummaryCharts() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("week");
  const [chartData, setChartData] = useState<DayData[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  useEffect(() => {
    if (user) loadData();
  }, [user, range]);

  useEffect(() => {
    if (user) loadStreak();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    const numDays = range === "week" ? 7 : 30;
    const days: string[] = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split("T")[0]);
    }

    const [waterRes, notesRes] = await Promise.all([
      supabase
        .from("water_logs")
        .select("date, glasses, goal")
        .eq("user_id", user.id)
        .gte("date", days[0])
        .lte("date", days[days.length - 1]),
      supabase
        .from("journal_daily_notes")
        .select("date, energy_level, mood_emoji")
        .eq("user_id", user.id)
        .gte("date", days[0])
        .lte("date", days[days.length - 1]),
    ]);

    const waterMap: Record<string, { glasses: number; goal: number }> = {};
    (waterRes.data || []).forEach((w) => {
      waterMap[w.date] = { glasses: w.glasses, goal: w.goal };
    });

    const notesMap: Record<string, { energy: number; mood: number; moodEmoji: string }> = {};
    (notesRes.data || []).forEach((n) => {
      notesMap[n.date] = {
        energy: n.energy_level || 0,
        mood: moodMap[n.mood_emoji || ""] || 0,
        moodEmoji: n.mood_emoji || "",
      };
    });

    const result = days.map((d) => {
      const dateObj = new Date(d + "T12:00:00");
      const dayLabel = range === "week"
        ? dateObj.toLocaleDateString("en-US", { weekday: "short" })
        : dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        day: dayLabel,
        glasses: waterMap[d]?.glasses || 0,
        goal: waterMap[d]?.goal || 8,
        energy: notesMap[d]?.energy || 0,
        mood: notesMap[d]?.mood || 0,
        moodEmoji: notesMap[d]?.moodEmoji || "",
      };
    });

    setChartData(result);
  };

  const loadStreak = async () => {
    if (!user) return;
    // Fetch last 90 days of water logs ordered by date descending
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const { data } = await supabase
      .from("water_logs")
      .select("date, glasses, goal, best_streak")
      .eq("user_id", user.id)
      .gte("date", startDate.toISOString().split("T")[0])
      .order("date", { ascending: false });

    if (!data || data.length === 0) { setStreak(0); setBestStreak(0); return; }

    // Get stored best streak from the most recent entry
    const storedBest = Math.max(...data.map((w) => w.best_streak || 0));

    // Build a map of date -> met goal
    const metMap: Record<string, boolean> = {};
    data.forEach((w) => { metMap[w.date] = w.glasses >= w.goal; });

    // Count consecutive days starting from today going backward
    let count = 0;
    const d = new Date();
    for (let i = 0; i < 90; i++) {
      const key = d.toISOString().split("T")[0];
      if (metMap[key]) {
        count++;
      } else {
        // If today has no entry yet, skip it and keep checking
        if (i === 0 && !(key in metMap)) { d.setDate(d.getDate() - 1); continue; }
        break;
      }
      d.setDate(d.getDate() - 1);
    }
    setStreak(count);

    // Update best streak if current exceeds stored
    const newBest = Math.max(count, storedBest);
    setBestStreak(newBest);
    if (count > storedBest && count > 0) {
      // Persist new best streak on today's water log
      const today = new Date().toISOString().split("T")[0];
      await supabase
        .from("water_logs")
        .update({ best_streak: count })
        .eq("user_id", user.id)
        .eq("date", today);

      // 🎉 Confetti for new personal best!
      toast.success(`🏆 New personal best streak: ${count} days!`, { duration: 5000 });
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["hsl(142,71%,45%)", "hsl(48,96%,53%)", "hsl(217,91%,60%)", "hsl(339,90%,51%)"],
      });
      setTimeout(() => {
        confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 } });
      }, 300);
    }

    // Celebrate milestone if exact match
    if (MILESTONES.includes(count)) {
      toast.success(milestoneMessages[count], { duration: 5000 });
    }
  };

  const totalDays = chartData.length;
  const avgWater = totalDays > 0
    ? Math.round((chartData.reduce((s, d) => s + d.glasses, 0) / totalDays) * 10) / 10
    : 0;
  const energyDays = chartData.filter(d => d.energy > 0);
  const avgEnergy = energyDays.length > 0
    ? Math.round((energyDays.reduce((s, d) => s + d.energy, 0) / energyDays.length) * 10) / 10
    : 0;
  const daysLogged = chartData.filter((d) => d.glasses > 0 || d.energy > 0 || d.mood > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="font-heading text-lg">Summary</h3>
        </div>
        {/* Toggle */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setRange("week")}
            className={cn("text-xs px-3 py-1 rounded-md transition-colors", range === "week" ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}
          >
            7 Days
          </button>
          <button
            onClick={() => setRange("month")}
            className={cn("text-xs px-3 py-1 rounded-md transition-colors", range === "month" ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <Flame className={cn("h-4 w-4 mx-auto mb-1", streak > 0 ? "text-streak" : "text-muted-foreground")} />
            <p className="text-lg font-bold">{streak}</p>
            <p className="text-[10px] text-muted-foreground">streak 🔥</p>
            {bestStreak > 0 && (
              <p className="text-[9px] text-muted-foreground mt-0.5">best: {bestStreak}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <Droplets className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{avgWater}</p>
            <p className="text-[10px] text-muted-foreground">avg/day</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <Zap className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{avgEnergy || "—"}</p>
            <p className="text-[10px] text-muted-foreground">avg energy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <Smile className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{daysLogged}/{totalDays}</p>
            <p className="text-[10px] text-muted-foreground">tracked</p>
          </CardContent>
        </Card>
      </div>

      {/* Water intake bar chart */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-xs font-medium flex items-center gap-1 mb-3">
            <Droplets className="h-3.5 w-3.5 text-primary" /> Water Intake
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} barSize={range === "week" ? 20 : 6}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: range === "week" ? 10 : 8 }}
                tickLine={false}
                axisLine={false}
                interval={range === "month" ? 4 : 0}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                formatter={(value: number) => [`${value} glasses`, "Water"]}
              />
              <Bar dataKey="glasses" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Energy & Mood line chart */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-xs font-medium flex items-center gap-1 mb-3">
            <Zap className="h-3.5 w-3.5 text-primary" /> Energy & Mood Trends
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: range === "week" ? 10 : 8 }}
                tickLine={false}
                axisLine={false}
                interval={range === "month" ? 4 : 0}
              />
              <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                formatter={(value: number, name: string) => {
                  if (name === "energy") return [`${value}/5`, "Energy"];
                  return [`${value}/5`, "Mood"];
                }}
              />
              <Line type="monotone" dataKey="energy" stroke="hsl(var(--primary))" strokeWidth={2} dot={range === "week" ? { r: 3 } : false} name="energy" />
              <Line type="monotone" dataKey="mood" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={range === "week" ? { r: 3 } : false} strokeDasharray="4 2" name="mood" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-primary inline-block rounded" /> Energy
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-accent-foreground inline-block rounded" style={{ borderTop: "2px dashed" }} /> Mood
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}