import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell, PieChart, Pie } from "recharts";
import { TrendingUp, Dumbbell, Flame, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subWeeks, startOfWeek, endOfWeek, eachWeekOfInterval, isWithinInterval } from "date-fns";
import { usePreferredUnits } from "@/hooks/usePreferredUnits";

interface WorkoutLog {
  id: string;
  started_at: string;
  duration_minutes: number | null;
  completed_at: string | null;
}

interface WorkoutSetRow {
  workout_log_id: string;
  weight_kg: number | null;
  reps: number | null;
  exercises: { muscle_group: string | null } | null;
}

export function WorkoutAnalytics() {
  const { user } = useAuth();
  const { weightUnit, convertWeight } = usePreferredUnits();

  const { data: logs = [] } = useQuery({
    queryKey: ["workout-analytics-logs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("workout_logs")
        .select("id, started_at, duration_minutes, completed_at")
        .eq("user_id", user.id)
        .gte("started_at", subWeeks(new Date(), 8).toISOString())
        .order("started_at");
      return (data || []) as WorkoutLog[];
    },
    enabled: !!user,
  });

  const logIds = useMemo(() => logs.map((l) => l.id), [logs]);

  const { data: sets = [] } = useQuery({
    queryKey: ["workout-analytics-sets", logIds],
    queryFn: async () => {
      if (logIds.length === 0) return [];
      const { data } = await supabase
        .from("workout_sets")
        .select("workout_log_id, weight_kg, reps, exercises(muscle_group)")
        .in("workout_log_id", logIds);
      return (data || []) as unknown as WorkoutSetRow[];
    },
    enabled: logIds.length > 0,
  });

  // Build weekly data for last 8 weeks
  const weeklyData = useMemo(() => {
    const now = new Date();
    const eightWeeksAgo = subWeeks(now, 7);
    const weeks = eachWeekOfInterval({ start: eightWeeksAgo, end: now }, { weekStartsOn: 1 });

    return weeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekLabel = format(weekStart, "MMM d");

      const weekLogs = logs.filter((l) =>
        isWithinInterval(new Date(l.started_at), { start: weekStart, end: weekEnd })
      );

      const weekLogIds = new Set(weekLogs.map((l) => l.id));
      const weekSets = sets.filter((s) => weekLogIds.has(s.workout_log_id));

      const volume = Math.round(weekSets.reduce((sum, s) => sum + (convertWeight(s.weight_kg || 0) * (s.reps || 0)), 0));
      const totalDuration = weekLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);

      return {
        week: weekLabel,
        workouts: weekLogs.length,
        volume: Math.round(volume),
        duration: totalDuration,
        sets: weekSets.length,
      };
    });
  }, [logs, sets]);

  // Muscle group breakdown
  const muscleData = useMemo(() => {
    const counts: Record<string, number> = {};
    sets.forEach((s) => {
      const mg = s.exercises?.muscle_group || "Other";
      counts[mg] = (counts[mg] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, sets]) => ({ name, sets }))
      .sort((a, b) => b.sets - a.sets);
  }, [sets]);

  const MUSCLE_COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--primary) / 0.8)",
    "hsl(var(--primary) / 0.6)",
    "hsl(var(--primary) / 0.45)",
    "hsl(var(--primary) / 0.3)",
    "hsl(var(--primary) / 0.2)",
    "hsl(var(--accent))",
    "hsl(var(--secondary))",
  ];

  // Summary stats
  const totalWorkouts = logs.length;
  const totalVolume = sets.reduce((sum, s) => sum + ((s.weight_kg || 0) * (s.reps || 0)), 0);
  const totalDuration = logs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
  const avgPerWeek = totalWorkouts > 0 ? (totalWorkouts / Math.min(8, weeklyData.length)).toFixed(1) : "0";

  if (logs.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Analytics (8 weeks)</h3>

      {/* Summary badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{totalWorkouts}</p>
              <p className="text-[10px] text-muted-foreground">Workouts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{avgPerWeek}</p>
              <p className="text-[10px] text-muted-foreground">Avg/week</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Flame className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{(totalVolume / 1000).toFixed(1)}k</p>
              <p className="text-[10px] text-muted-foreground">Total vol (kg)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Dumbbell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{totalDuration}</p>
              <p className="text-[10px] text-muted-foreground">Total min</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Frequency chart */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold mb-3">Weekly Frequency</h4>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`${value} workouts`, "Workouts"]}
                />
                <Bar dataKey="workouts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Volume trend chart */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold mb-3">Weekly Volume (kg)</h4>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`${value.toLocaleString()} kg`, "Volume"]}
                />
                <Line
                  type="monotone"
                  dataKey="volume"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      {/* Muscle group breakdown */}
      {muscleData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold mb-3">Muscle Group Breakdown</h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={muscleData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => [`${value} sets`, "Sets"]}
                  />
                  <Bar dataKey="sets" radius={[0, 4, 4, 0]}>
                    {muscleData.map((_, i) => (
                      <Cell key={i} fill={MUSCLE_COLORS[i % MUSCLE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
