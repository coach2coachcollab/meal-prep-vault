import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { Droplets, Zap, Smile, TrendingUp } from "lucide-react";

const moodMap: Record<string, number> = { "😊": 5, "😐": 3, "😴": 2, "😤": 1, "😢": 1 };

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
  const [weekData, setWeekData] = useState<DayData[]>([]);

  useEffect(() => {
    if (user) loadWeekData();
  }, [user]);

  const loadWeekData = async () => {
    if (!user) return;

    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
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
        .lte("date", days[6]),
      supabase
        .from("journal_daily_notes")
        .select("date, energy_level, mood_emoji")
        .eq("user_id", user.id)
        .gte("date", days[0])
        .lte("date", days[6]),
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
      const dayLabel = new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
      return {
        day: dayLabel,
        glasses: waterMap[d]?.glasses || 0,
        goal: waterMap[d]?.goal || 8,
        energy: notesMap[d]?.energy || 0,
        mood: notesMap[d]?.mood || 0,
        moodEmoji: notesMap[d]?.moodEmoji || "",
      };
    });

    setWeekData(result);
  };

  const avgWater = weekData.length > 0
    ? Math.round((weekData.reduce((s, d) => s + d.glasses, 0) / weekData.length) * 10) / 10
    : 0;
  const avgEnergy = weekData.length > 0
    ? Math.round((weekData.reduce((s, d) => s + d.energy, 0) / weekData.filter(d => d.energy > 0).length || 1) * 10) / 10
    : 0;
  const daysLogged = weekData.filter((d) => d.glasses > 0 || d.energy > 0 || d.mood > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-lg">Weekly Summary</h3>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <Droplets className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{avgWater}</p>
            <p className="text-[10px] text-muted-foreground">avg glasses/day</p>
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
            <p className="text-lg font-bold">{daysLogged}/7</p>
            <p className="text-[10px] text-muted-foreground">days tracked</p>
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
            <BarChart data={weekData} barSize={20}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                formatter={(value: number) => [`${value} glasses`, "Water"]}
              />
              <Bar dataKey="glasses" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
            <LineChart data={weekData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                formatter={(value: number, name: string) => {
                  if (name === "energy") return [`${value}/5`, "Energy"];
                  return [`${value}/5`, "Mood"];
                }}
              />
              <Line type="monotone" dataKey="energy" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="energy" />
              <Line type="monotone" dataKey="mood" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" name="mood" />
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