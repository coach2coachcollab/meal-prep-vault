import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const UNITS_KEY = ["preferred-units"] as const;

export function usePreferredUnits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: useMetric = true, isLoading: loading } = useQuery({
    queryKey: UNITS_KEY,
    queryFn: async () => {
      if (!user) return true;
      const { data } = await supabase
        .from("profiles")
        .select("preferred_units")
        .eq("user_id", user.id)
        .single();
      return data?.preferred_units !== "imperial";
    },
    enabled: !!user,
    staleTime: Infinity,
  });

  const setUseMetric = async (metric: boolean) => {
    // Optimistic update — all consumers see the change instantly
    queryClient.setQueryData(UNITS_KEY, metric);

    if (user) {
      const { error } = await supabase
        .from("profiles")
        .update({ preferred_units: metric ? "metric" : "imperial" } as any)
        .eq("user_id", user.id);
      if (error) {
        // Revert on failure
        queryClient.setQueryData(UNITS_KEY, !metric);
      }
    }
  };

  const isImperial = !useMetric;
  const weightUnit = useMetric ? "kg" : "lbs";
  const heightUnit = useMetric ? "cm" : "in";
  const waistUnit = useMetric ? "cm" : "in";

  const KG_TO_LBS = 2.20462;
  const CM_TO_IN = 0.393701;
  const LBS_TO_KG = 0.453592;
  const IN_TO_CM = 2.54;

  const convertWeight = (kg: number) => useMetric ? kg : Math.round(kg * KG_TO_LBS * 10) / 10;
  const convertLength = (cm: number) => useMetric ? cm : Math.round(cm * CM_TO_IN * 10) / 10;
  const toKg = (value: number) => useMetric ? value : value * LBS_TO_KG;
  const toCm = (value: number) => useMetric ? value : value * IN_TO_CM;

  return {
    useMetric,
    setUseMetric,
    isImperial,
    weightUnit,
    heightUnit,
    waistUnit,
    loading,
    convertWeight,
    convertLength,
    toKg,
    toCm,
    KG_TO_LBS,
    CM_TO_IN,
  };
}
