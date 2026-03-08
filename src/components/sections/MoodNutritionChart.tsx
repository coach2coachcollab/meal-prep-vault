import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

const moodMap: Record<string, number> = { "😊": 5, "😐": 3, "😴": 2, "😤": 1, "😢": 1 };

interface DayPoint {
  day: string;
  calories: number;
  protein: number;
  mood: number;
  energy: number;
  moodEmoji: string;
}

export function MoodNutritionChart() {
  const { user } = useAuth();
  const [points, setPoints] = useState<DayPoint[]>([]);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    if (!user) return;

    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split("T")[0]);
    }

    const [notesRes, journalRes] = await Promise.all([
      supabase
        .from("journal_daily_notes")
        .select("date, energy_level, mood_emoji")
        .eq("user_id", user.id)
        .gte("date", days[0])
        .lte("date", days[6]),
      supabase
        .from("journal_entries")
        .select("date, calories, protein_g")
        .eq("user_id", user.id)
        .gte("date", days[0])
        .lte("date", days[6]),
    ]);

    const notesMap: Record<string, { energy: number; mood: number; moodEmoji: string }> = {};
    (notesRes.data || []).forEach((n) => {
      notesMap[n.date] = {
        energy: n.energy_level || 0,
        mood: moodMap[n.mood_emoji || ""] || 0,
        moodEmoji: n.mood_emoji || "",
      };
    });

    const calMap: Record<string, { calories: number; protein: number }> = {};
    (journalRes.data || []).forEach((e) => {
      if (!calMap[e.date]) calMap[e.date] = { calories: 0, protein: 0 };
      calMap[e.date].calories += Number(e.calories) || 0;
      calMap[e.date].protein += Number(e.protein_g) || 0;
    });

    const result = days
      .map((d) => {
        const dateObj = new Date(d + "T12:00:00");
        const note = notesMap[d];
        const cal = calMap[d];
        if (!note && !cal) return null;
        return {
          day: dateObj.toLocaleDateString("en-US", { weekday: "short" }),
          calories: Math.round(cal?.calories || 0),
          protein: Math.round(cal?.protein || 0),
          mood: note?.mood || 0,
          energy: note?.energy || 0,
          moodEmoji: note?.moodEmoji || "",
        };
      })
      .filter(Boolean) as DayPoint[];

    setPoints(result);
  };

  // Need at least 2 data points with both nutrition and mood
  const validPoints = points.filter((p) => p.calories > 0 && (p.mood > 0 || p.energy > 0));
  if (validPoints.length < 2) return null;

  const energyColor = (energy: number) => {
    if (energy >= 4) return "hsl(var(--primary))";
    if (energy >= 3) return "hsl(var(--accent-foreground))";
    return "hsl(var(--muted-foreground))";
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-label uppercase text-muted-foreground">
        Calories vs Energy (past 7 days)
      </p>
      <ResponsiveContainer width="100%" height={130}>
        <ScatterChart margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="calories"
            type="number"
            tick={{ fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            name="Calories"
            unit=" cal"
          />
          <YAxis
            dataKey="energy"
            type="number"
            domain={[0, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            name="Energy"
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
            }}
            formatter={(value: number, name: string) => {
              if (name === "Calories") return [`${value} cal`, "Calories"];
              return [`${value}/5`, "Energy"];
            }}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as DayPoint | undefined;
              return p ? `${p.day} ${p.moodEmoji || ""}` : "";
            }}
          />
          <Scatter data={validPoints} name="Days">
            {validPoints.map((p, i) => (
              <Cell key={i} fill={energyColor(p.energy)} r={6} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex gap-3 justify-center text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary inline-block" /> High energy
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" /> Low energy
        </span>
      </div>
    </div>
  );
}
