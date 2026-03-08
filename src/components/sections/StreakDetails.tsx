import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Flame, Zap, Trophy, Target, Calendar, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import confetti from "canvas-confetti";
import { toast } from "sonner";

const milestones = [
  { days: 3, icon: "🔥", title: "Getting Started", description: "3 day streak!" },
  { days: 7, icon: "⚡", title: "One Week Strong", description: "7 day streak!" },
  { days: 14, icon: "💪", title: "Two Weeks!", description: "14 day streak!" },
  { days: 30, icon: "🏆", title: "Monthly Master", description: "30 day streak!" },
  { days: 60, icon: "⭐", title: "Two Month Hero", description: "60 day streak!" },
  { days: 100, icon: "👑", title: "Century Club", description: "100 day streak!" },
];

interface StreakDetailsProps {
  onBack: () => void;
  streak: number;
}

export function StreakDetails({ onBack, streak }: StreakDetailsProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalActiveDays: 0,
    longestStreak: 0,
    thisWeekDays: 0,
    thisMonthDays: 0,
  });
  const [recentDays, setRecentDays] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      loadStats();
      checkMilestones();
    }
  }, [user, streak]);

  const checkMilestones = () => {
    if (!user) return;
    
    const milestone = milestones.find((m) => m.days === streak);
    if (milestone) {
      const storageKey = `streak_milestone_${user.id}_${milestone.days}`;
      if (!localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, new Date().toISOString());
        
        // Trigger confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#84cc16", "#eab308", "#f97316"],
        });
        
        toast(`${milestone.icon} ${milestone.title}`, {
          description: milestone.description,
          duration: 5000,
        });
      }
    }
  };

  const loadStats = async () => {
    if (!user) return;

    const since90 = new Date();
    since90.setDate(since90.getDate() - 90);
    const since90Str = since90.toISOString().split("T")[0];

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthAgoStr = monthAgo.toISOString().split("T")[0];

    const [{ data: journalDates }, { data: habitDates }] = await Promise.all([
      supabase
        .from("journal_entries")
        .select("date")
        .eq("user_id", user.id)
        .gte("date", since90Str),
      supabase
        .from("habit_logs")
        .select("date")
        .eq("user_id", user.id)
        .eq("completed", true)
        .gte("date", since90Str),
    ]);

    const activeDays = new Set<string>();
    journalDates?.forEach((j) => activeDays.add(j.date));
    habitDates?.forEach((h) => activeDays.add(h.date));

    // Calculate longest streak
    const sortedDays = Array.from(activeDays).sort();
    let longest = 0;
    let currentStreak = 0;
    let prevDate: Date | null = null;

    for (const dateStr of sortedDays) {
      const date = new Date(dateStr);
      if (prevDate) {
        const diff = (date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      longest = Math.max(longest, currentStreak);
      prevDate = date;
    }

    // This week and month
    const thisWeekDays = Array.from(activeDays).filter((d) => d >= weekAgoStr).length;
    const thisMonthDays = Array.from(activeDays).filter((d) => d >= monthAgoStr).length;

    // Recent 14 days for calendar
    const last14: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last14.push(d.toISOString().split("T")[0]);
    }

    setRecentDays(last14.filter((d) => activeDays.has(d)));
    setStats({
      totalActiveDays: activeDays.size,
      longestStreak: longest,
      thisWeekDays,
      thisMonthDays,
    });
  };

  const nextMilestone = milestones.find((m) => m.days > streak);
  const achievedMilestones = milestones.filter((m) => m.days <= streak);

  // Generate last 14 days for mini calendar
  const last14Days: { date: string; dayNum: number; isActive: boolean }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    last14Days.push({
      date: dateStr,
      dayNum: d.getDate(),
      isActive: recentDays.includes(dateStr),
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-bold">Your Streak</h2>
      </div>

      {/* Current Streak Hero */}
      <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
        <CardContent className="pt-6 pb-6 flex flex-col items-center">
          <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mb-3">
            <Flame className="h-10 w-10 text-primary" />
          </div>
          <p className="text-4xl font-bold text-foreground">{streak}</p>
          <p className="text-sm text-muted-foreground">Day Streak</p>
          {nextMilestone && (
            <p className="text-xs text-primary mt-2">
              {nextMilestone.days - streak} days to {nextMilestone.icon} {nextMilestone.title}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 flex flex-col items-center">
            <Trophy className="h-5 w-5 text-primary mb-1" />
            <p className="text-lg font-bold">{stats.longestStreak}</p>
            <p className="text-[10px] text-muted-foreground">Best Streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex flex-col items-center">
            <TrendingUp className="h-5 w-5 text-primary mb-1" />
            <p className="text-lg font-bold">{stats.totalActiveDays}</p>
            <p className="text-[10px] text-muted-foreground">Total Active Days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex flex-col items-center">
            <Calendar className="h-5 w-5 text-primary mb-1" />
            <p className="text-lg font-bold">{stats.thisWeekDays}/7</p>
            <p className="text-[10px] text-muted-foreground">This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex flex-col items-center">
            <Target className="h-5 w-5 text-primary mb-1" />
            <p className="text-lg font-bold">{stats.thisMonthDays}</p>
            <p className="text-[10px] text-muted-foreground">This Month</p>
          </CardContent>
        </Card>
      </div>

      {/* Mini Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Last 14 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {last14Days.map((day) => (
              <div
                key={day.date}
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  day.isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {day.dayNum}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Milestones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {milestones.map((m) => {
            const achieved = streak >= m.days;
            return (
              <div
                key={m.days}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  achieved ? "bg-primary/10" : "bg-muted/50 opacity-60"
                }`}
              >
                <span className="text-xl">{m.icon}</span>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${achieved ? "text-foreground" : "text-muted-foreground"}`}>
                    {m.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.days} days</p>
                </div>
                {achieved && (
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-xs text-primary-foreground">✓</span>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
