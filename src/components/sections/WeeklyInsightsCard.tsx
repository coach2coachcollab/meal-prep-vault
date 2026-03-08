import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { MoodNutritionChart } from "./MoodNutritionChart";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface InsightsData {
  insights: string[];
  takeaway: string;
}

function getWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}

export function WeeklyInsightsCard() {
  const { user } = useAuth();
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasCheckedCache, setHasCheckedCache] = useState(false);

  const cacheKey = user ? `weekly_summary_${user.id}_${getWeekStart()}` : "";

  useEffect(() => {
    if (!user) return;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setData(JSON.parse(cached));
      } catch { /* ignore */ }
    }
    setHasCheckedCache(true);
  }, [cacheKey, user]);

  const generate = async (refresh = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: fnData, error } = await supabase.functions.invoke(
        "generate-weekly-summary",
        { body: {} }
      );

      if (error) {
        const msg = (error as any)?.message || "Failed to generate insights";
        toast.error(msg);
        return;
      }

      if (fnData?.error) {
        toast.error(fnData.error);
        return;
      }

      setData(fnData as InsightsData);
      localStorage.setItem(cacheKey, JSON.stringify(fnData));
      if (refresh) toast.success("Insights refreshed!");
    } catch (e) {
      toast.error("Something went wrong. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  if (!hasCheckedCache) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-label uppercase flex items-center gap-1.5 text-section-label">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Weekly Insights
          </p>
          {data && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => generate(true)}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>

        {data ? (
          <div className="space-y-2">
            <ul className="space-y-1.5">
              {data.insights.map((insight, i) => (
                <li key={i} className="text-sm text-foreground flex gap-2">
                  <span className="text-primary mt-0.5 shrink-0">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
            {data.takeaway && (
              <p className="text-sm font-medium text-primary pt-1 border-t border-primary/10">
                {data.takeaway}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-3">
            <p className="text-sm text-muted-foreground mb-3">
              Get AI-powered insights from your mood, energy, meals & water data this week.
            </p>
            <Button
              size="sm"
              onClick={() => generate(false)}
              disabled={loading}
              className="gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> Generate Weekly Insights
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
