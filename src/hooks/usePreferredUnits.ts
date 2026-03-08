import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePreferredUnits() {
  const { user } = useAuth();
  const [useMetric, setUseMetric] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("profiles")
      .select("preferred_units")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.preferred_units) setUseMetric(data.preferred_units !== "imperial");
        setLoading(false);
      });
  }, [user]);

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
