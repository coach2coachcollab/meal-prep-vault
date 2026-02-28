import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Droplets, Plus, Minus, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WaterTracker() {
  const { user } = useAuth();
  const [glasses, setGlasses] = useState(0);
  const [goal, setGoal] = useState(8);
  const [editGoal, setEditGoal] = useState("8");
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (user) loadWater();
  }, [user]);

  const loadWater = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("water_logs")
      .select("glasses, goal")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();
    if (data) {
      setGlasses(data.glasses);
      setGoal(data.goal);
      setEditGoal(String(data.goal));
    }
  };

  const updateGlasses = async (newCount: number) => {
    if (!user || newCount < 0) return;
    setGlasses(newCount);
    const { error } = await supabase
      .from("water_logs")
      .upsert(
        { user_id: user.id, date: today, glasses: newCount, goal },
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
        { user_id: user.id, date: today, glasses, goal: newGoal },
        { onConflict: "user_id,date" }
      );
    toast.success("Goal updated!");
  };

  const pct = goal > 0 ? Math.min((glasses / goal) * 100, 100) : 0;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            Water Tracker
          </h2>
          <p className="text-sm text-muted-foreground">Stay hydrated today</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon"><Settings2 className="h-4 w-4" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
            <div className="space-y-2">
              <Label className="text-xs">Daily Goal (glasses)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={editGoal}
                  onChange={(e) => setEditGoal(e.target.value)}
                  className="h-8"
                />
                <Button size="sm" onClick={saveGoal}>Set</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Progress Ring */}
      <Card>
        <CardContent className="pt-6 pb-6 flex flex-col items-center">
          <div className="relative w-40 h-40 mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
              <circle
                cx="64" cy="64" r={radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="8"
              />
              <circle
                cx="64" cy="64" r={radius}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Droplets className={cn("h-6 w-6 mb-1 transition-colors", pct >= 100 ? "text-primary" : "text-muted-foreground")} />
              <span className="text-2xl font-bold">{glasses}</span>
              <span className="text-xs text-muted-foreground">of {goal} glasses</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={() => updateGlasses(glasses - 1)}
              disabled={glasses <= 0}
            >
              <Minus className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              className="h-14 w-14 rounded-full"
              onClick={() => updateGlasses(glasses + 1)}
            >
              <Plus className="h-6 w-6" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full opacity-0 pointer-events-none"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          {pct >= 100 && (
            <p className="text-sm text-primary font-medium mt-3">🎉 Goal reached! Great job staying hydrated!</p>
          )}
        </CardContent>
      </Card>

      {/* Quick-tap glasses */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground mb-3">Quick set</p>
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: goal }, (_, i) => i + 1).slice(0, 12).map((n) => (
              <button
                key={n}
                onClick={() => updateGlasses(n)}
                className={cn(
                  "h-9 w-9 rounded-full text-xs font-medium transition-all",
                  n <= glasses
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-primary/20"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
