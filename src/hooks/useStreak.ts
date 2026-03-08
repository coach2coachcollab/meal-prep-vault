import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { calculateStreak } from "@/lib/calculations";

export function useStreak() {
  const { user } = useAuth();
  const [streak, setStreak] = useState(0);
  const [justIncreased, setJustIncreased] = useState(false);
  const prevStreak = useRef<number | null>(null);

  const loadStreak = useCallback(async () => {
    if (!user) return;
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceStr = since.toISOString().split("T")[0];

    const [{ data: journalDates }, { data: habitDates }] = await Promise.all([
      supabase
        .from("journal_entries")
        .select("date")
        .eq("user_id", user.id)
        .gte("date", sinceStr),
      supabase
        .from("habit_logs")
        .select("date")
        .eq("user_id", user.id)
        .eq("completed", true)
        .gte("date", sinceStr),
    ]);

    const activeDays = new Set<string>();
    journalDates?.forEach((j) => activeDays.add(j.date));
    habitDates?.forEach((h) => activeDays.add(h.date));

    const count = calculateStreak(activeDays);

    // Check if streak increased
    if (prevStreak.current !== null && count > prevStreak.current) {
      setJustIncreased(true);
      setTimeout(() => setJustIncreased(false), 1500);
    }
    prevStreak.current = count;
    setStreak(count);
  }, [user]);

  useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  return { streak, justIncreased, refresh: loadStreak };
}
