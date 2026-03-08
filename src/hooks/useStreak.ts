import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { calculateStreak } from "@/lib/calculations";
import { queryKeys } from "@/lib/query-keys";

export function useStreak() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [justIncreased, setJustIncreased] = useState(false);
  const prevStreak = useRef<number | null>(null);

  const { data: streak = 0 } = useQuery({
    queryKey: queryKeys.streak(user?.id),
    queryFn: async () => {
      if (!user) return 0;
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

      return calculateStreak(activeDays);
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (prevStreak.current !== null && streak > prevStreak.current) {
      setJustIncreased(true);
      setTimeout(() => setJustIncreased(false), 1500);
    }
    prevStreak.current = streak;
  }, [streak]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.streak(user?.id) });
  };

  return { streak, justIncreased, refresh };
}
