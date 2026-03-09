import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { calculateMacros } from "@/lib/calculations";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Static data ── */

const GOALS = [
  { id: "lose_fat", label: "Lose Weight", icon: "🔥" },
  { id: "build_muscle", label: "Build Muscle", icon: "💪" },
  { id: "athletic", label: "Athletic Performance", icon: "🏃" },
  { id: "recomp", label: "Body Recomposition", icon: "🔄" },
  { id: "health", label: "Improve Health", icon: "🌿" },
];

const EXERCISE_LEVELS = [
  { id: "none", label: "Very Light", desc: "Little to no exercise" },
  { id: "light", label: "Light", desc: "1–2 days/week" },
  { id: "moderate", label: "Moderate", desc: "3–4 days/week" },
  { id: "intense", label: "Intense", desc: "5–6 days/week" },
  { id: "very_intense", label: "Very Intense", desc: "Daily intense training" },
];

const DAILY_ACTIVITY = [
  { id: "very_light", label: "Very Light", desc: "Mostly sitting (desk job)" },
  { id: "light", label: "Light", desc: "Some walking" },
  { id: "moderate", label: "Moderate", desc: "On your feet often" },
  { id: "heavy", label: "Heavy", desc: "Standing / walking job" },
];

const DIETS = [
  { id: "anything", label: "Anything", desc: "No restrictions — flexible eating" },
  { id: "mediterranean", label: "Mediterranean", desc: "Rich in olive oil, fish, whole grains & veggies" },
  { id: "paleo", label: "Paleo", desc: "Whole foods — no grains, dairy, or processed items" },
  { id: "vegetarian", label: "Vegetarian", desc: "Plant-based with dairy & eggs allowed" },
  { id: "vegan", label: "Vegan", desc: "100% plant-based, no animal products" },
  { id: "keto", label: "Ketogenic", desc: "Very low carb, high fat for ketosis" },
  { id: "whole30", label: "Whole30", desc: "30-day whole-food reset" },
  { id: "gluten_free", label: "Gluten-Free", desc: "No wheat, barley, or rye" },
  { id: "dairy_free", label: "Dairy-Free", desc: "No milk, cheese, or dairy products" },
  { id: "high_protein", label: "High Protein", desc: "Focus on lean protein sources" },
];

const ALLERGIES = ["None", "Nuts", "Shellfish", "Eggs", "Soy", "Gluten", "Dairy", "Fish", "Wheat"];

const MACRO_RATIOS = [
  { id: "balanced", label: "Balanced", p: 0.30, c: 0.40, f: 0.30, desc: "P30 C40 F30" },
  { id: "low_carb", label: "Low Carb", p: 0.35, c: 0.25, f: 0.40, desc: "P35 C25 F40" },
  { id: "high_carb", label: "High Carb", p: 0.25, c: 0.50, f: 0.25, desc: "P25 C50 F25" },
  { id: "high_protein", label: "High Protein", p: 0.40, c: 0.30, f: 0.30, desc: "P40 C30 F30" },
];

const MEALS_PER_DAY = [1, 2, 3, 4, 5, 6];

const STEP_LABELS = ["Details", "Goal", "Activity", "Diet", "Results"];

/* ── Mapping to existing DB/calculation values ── */

const ACTIVITY_CALC_MAP: Record<string, Record<string, string>> = {
  none:          { very_light: "sedentary", light: "sedentary", moderate: "light", heavy: "light" },
  light:         { very_light: "light", light: "light", moderate: "moderate", heavy: "moderate" },
  moderate:      { very_light: "moderate", light: "moderate", moderate: "active", heavy: "active" },
  intense:       { very_light: "active", light: "active", moderate: "active", heavy: "very_active" },
  very_intense:  { very_light: "active", light: "very_active", moderate: "very_active", heavy: "very_active" },
};

const GOAL_CALC_MAP: Record<string, string> = {
  lose_fat: "lose", build_muscle: "gain", athletic: "maintain", recomp: "maintain", health: "maintain",
};

const GOAL_LABEL_MAP: Record<string, string> = {
  lose_fat: "Lose fat", build_muscle: "Build muscle", athletic: "Athletic performance",
  recomp: "Body recomposition", health: "Improve health",
};

/* ── Conversion ── */
const LBS_TO_KG = 0.453592;
const IN_TO_CM = 2.54;

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    units: "imperial" as "metric" | "imperial",
    gender: "female" as "male" | "female",
    age: "",
    weight: "",
    heightFt: "",
    heightIn: "",
    heightCm: "",
    goal: "",
    targetWeight: "",
    exercise: "",
    dailyActivity: "very_light",
    diet: "anything",
    macroRatio: "balanced",
    mealsPerDay: 3,
    allergies: [] as string[],
  });

  const [results, setResults] = useState<{
    calories: number; protein: number; carbs: number; fat: number; bmr: number; tdee: number;
  } | null>(null);

  const total = 5;

  const set = (updates: Partial<typeof form>) => setForm((f) => ({ ...f, ...updates }));

  const toggleAllergy = (val: string) => {
    setForm((f) => {
      if (val === "None") return { ...f, allergies: ["None"] };
      const without = f.allergies.filter((x) => x !== "None");
      return {
        ...f,
        allergies: f.allergies.includes(val)
          ? without.filter((x) => x !== val)
          : [...without, val],
      };
    });
  };

  /* ── Weight/height in metric ── */
  const getWeightKg = () => {
    const w = parseFloat(form.weight);
    return form.units === "imperial" ? w * LBS_TO_KG : w;
  };
  const getHeightCm = () => {
    if (form.units === "imperial") {
      return (parseInt(form.heightFt) || 0) * 12 * IN_TO_CM + (parseInt(form.heightIn) || 0) * IN_TO_CM;
    }
    return parseFloat(form.heightCm);
  };

  /* ── Navigation validation ── */
  const canNext = () => {
    switch (step) {
      case 0: return !!form.gender && !!form.age && !!form.weight &&
        (form.units === "imperial" ? !!form.heightFt : !!form.heightCm);
      case 1: return !!form.goal;
      case 2: return !!form.exercise;
      case 3: return true;
      default: return false;
    }
  };

  /* ── Calculate ── */
  const handleCalculate = () => {
    const activityLevel = ACTIVITY_CALC_MAP[form.exercise]?.[form.dailyActivity] || "moderate";
    const goalCalc = GOAL_CALC_MAP[form.goal] || "maintain";
    const weightKg = getWeightKg();
    const heightCm = getHeightCm();

    const r = calculateMacros({
      gender: form.gender,
      weightKg,
      heightCm,
      age: parseInt(form.age),
      activityLevel,
      goal: goalCalc,
    });

    // Apply custom macro ratio if not default
    const ratio = MACRO_RATIOS.find((m) => m.id === form.macroRatio);
    if (ratio) {
      const protein = Math.round((r.calories * ratio.p) / 4);
      const carbs = Math.round((r.calories * ratio.c) / 4);
      const fat = Math.round((r.calories * ratio.f) / 9);
      setResults({ calories: r.calories, protein, carbs, fat, bmr: r.bmr, tdee: r.tdee });
    } else {
      setResults({ calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fats, bmr: r.bmr, tdee: r.tdee });
    }
    setStep(4);
  };

  /* ── Save & navigate ── */
  const finishAndSave = async () => {
    if (!user || !results) return;
    setSaving(true);
    const weightKg = Math.round(getWeightKg() * 10) / 10;
    const heightCm = Math.round(getHeightCm() * 10) / 10;
    const goalWeightKg = form.targetWeight
      ? Math.round((form.units === "imperial" ? parseFloat(form.targetWeight) * LBS_TO_KG : parseFloat(form.targetWeight)) * 10) / 10
      : null;

    const dietPref = form.diet === "anything" ? [] : [DIETS.find((d) => d.id === form.diet)?.label || form.diet];
    const allergyList = form.allergies.filter((a) => a !== "None");

    const { error } = await supabase.from("profiles").update({
      name: form.name || undefined,
      goal: GOAL_LABEL_MAP[form.goal] || form.goal,
      activity_level: ACTIVITY_CALC_MAP[form.exercise]?.[form.dailyActivity] || "moderate",
      diet_prefs: dietPref,
      allergies: allergyList,
      age: parseInt(form.age),
      height_cm: heightCm,
      weight_kg: weightKg,
      goal_weight_kg: goalWeightKg,
      preferred_units: form.units,
      onboarding_completed: true,
    }).eq("user_id", user.id);

    // Save macros
    const { data: existing } = await supabase.from("user_macros").select("id").eq("user_id", user.id).maybeSingle();
    const macroData = {
      calories: results.calories, protein_g: results.protein,
      carbs_g: results.carbs, fat_g: results.fat,
      calculation_method: "mifflin", is_custom: false,
    };
    if (existing) {
      await supabase.from("user_macros").update(macroData).eq("user_id", user.id);
    } else {
      await supabase.from("user_macros").insert({ user_id: user.id, ...macroData });
    }

    setSaving(false);
    if (error) { toast.error("Failed to save profile"); }
    else { toast.success("Welcome to NutriCoach! 🎉"); navigate("/", { replace: true }); }
  };

  /* ── Shared styles ── */
  const optionBtn = (active: boolean) => cn(
    "w-full p-4 rounded-xl text-left transition-all border",
    active ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:border-primary/50"
  );

  const pillBtn = (active: boolean) => cn(
    "px-4 py-2.5 rounded-full text-sm font-medium transition-all border",
    active ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
  );

  const inputClass = "w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-foreground text-base font-semibold outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50 placeholder:font-normal";
  const labelClass = "text-[11px] text-muted-foreground font-semibold uppercase tracking-wide";

  /* ── Step indicator ── */
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-0 mb-2">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
              i < step ? "bg-primary text-primary-foreground" :
              i === step ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
              "bg-muted text-muted-foreground"
            )}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn(
              "text-[10px] mt-1 font-medium",
              i <= step ? "text-foreground" : "text-muted-foreground"
            )}>
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={cn(
              "w-8 h-0.5 mx-0.5 mt-[-12px]",
              i < step ? "bg-primary" : "bg-border"
            )} />
          )}
        </div>
      ))}
    </div>
  );

  /* ── RESULTS SCREEN ── */
  if (step === 4 && results) {
    const goalObj = GOALS.find((g) => g.id === form.goal);
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md flex flex-col gap-0">
          <div className="flex items-center gap-2.5 justify-center mb-6">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-xl">🍽️</div>
            <span className="text-2xl font-bold tracking-tight">NutriCoach</span>
          </div>
          <StepIndicator />
          <div className="h-4" />

          <div className="bg-card border border-border rounded-2xl p-7">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🎯</div>
              <h1 className="text-xl font-bold">Your Daily Targets</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {goalObj?.label} · {form.mealsPerDay} meals/day
              </p>
            </div>

            {/* Calorie hero */}
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-5 text-center mb-4">
              <div className="text-4xl font-extrabold text-primary">{results.calories}</div>
              <div className="text-sm text-muted-foreground font-medium">calories / day</div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { val: results.protein, label: "Protein", unit: "g", color: "text-macro-protein" },
                { val: results.carbs, label: "Carbs", unit: "g", color: "text-macro-carbs" },
                { val: results.fat, label: "Fat", unit: "g", color: "text-macro-fat" },
              ].map((m) => (
                <div key={m.label} className="bg-muted/30 border border-border rounded-xl p-3 text-center">
                  <div className={`text-2xl font-extrabold ${m.color}`}>{m.val}<span className="text-sm font-semibold">{m.unit}</span></div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mt-1">{m.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-muted/30 border border-border rounded-xl p-3 text-center">
                <div className="text-lg font-bold">{results.bmr}</div>
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">BMR</div>
              </div>
              <div className="bg-muted/30 border border-border rounded-xl p-3 text-center">
                <div className="text-lg font-bold">{results.tdee}</div>
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">TDEE</div>
              </div>
            </div>

            <div className="bg-muted/20 border border-border rounded-xl p-3 text-center text-sm text-muted-foreground">
              🥗 Your Vault will be seeded with meals matching your preferences
            </div>
          </div>

          <div className="h-3" />
          <button
            onClick={finishAndSave}
            disabled={saving}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-base disabled:opacity-50"
          >
            {saving ? "Setting up..." : "Let's Go 🚀"}
          </button>
        </div>
      </div>
    );
  }

  /* ── MAIN FLOW ── */
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-xl">🍽️</div>
          <span className="text-2xl font-bold tracking-tight">NutriCoach</span>
        </div>

        <StepIndicator />
        <div className="h-4" />

        {/* ── STEP 0: Your Details ── */}
        {step === 0 && (
          <div className="bg-card border border-border rounded-2xl p-7 mb-5">
            <h1 className="text-xl font-bold mb-1">Your Details</h1>
            <p className="text-sm text-muted-foreground mb-5">Let's start with some basic info about you.</p>

            {/* Name */}
            <div className="mb-4">
              <label className={labelClass}>First Name <span className="normal-case text-muted-foreground/60">(optional)</span></label>
              <input className={cn(inputClass, "mt-1")} placeholder="e.g. Cece" value={form.name}
                onChange={(e) => set({ name: e.target.value })} />
            </div>

            {/* Units */}
            <div className="mb-4">
              <label className={labelClass}>Units</label>
              <div className="flex gap-2 mt-1">
                {(["imperial", "metric"] as const).map((u) => (
                  <button key={u} onClick={() => set({ units: u, weight: "", heightFt: "", heightIn: "", heightCm: "", targetWeight: "" })}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-semibold text-sm transition-all border",
                      form.units === u
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                    )}>
                    {u === "imperial" ? "🇺🇸 lbs / ft·in" : "🌍 kg / cm"}
                  </button>
                ))}
              </div>
            </div>

            {/* Weight */}
            <div className="mb-4">
              <label className={labelClass}>Weight ({form.units === "imperial" ? "lbs" : "kg"}) *</label>
              <input className={cn(inputClass, "mt-1")} type="number"
                placeholder={form.units === "imperial" ? "e.g. 160" : "e.g. 72"}
                value={form.weight} onChange={(e) => set({ weight: e.target.value })} />
            </div>

            {/* Height */}
            <div className="mb-4">
              <label className={labelClass}>Height *</label>
              {form.units === "imperial" ? (
                <div className="flex gap-2 mt-1">
                  <input className={inputClass} type="number" placeholder="Feet" value={form.heightFt}
                    onChange={(e) => set({ heightFt: e.target.value })} />
                  <input className={inputClass} type="number" placeholder="Inches" value={form.heightIn}
                    onChange={(e) => set({ heightIn: e.target.value })} />
                </div>
              ) : (
                <input className={cn(inputClass, "mt-1")} type="number" placeholder="e.g. 170"
                  value={form.heightCm} onChange={(e) => set({ heightCm: e.target.value })} />
              )}
            </div>

            {/* Gender */}
            <div className="mb-4">
              <label className={labelClass}>Biological Sex *</label>
              <div className="flex gap-2 mt-1">
                {(["female", "male"] as const).map((g) => (
                  <button key={g} onClick={() => set({ gender: g })}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-semibold text-sm transition-all border",
                      form.gender === g
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                    )}>
                    {g === "female" ? "♀ Female" : "♂ Male"}
                  </button>
                ))}
              </div>
            </div>

            {/* Age */}
            <div className="mb-2">
              <label className={labelClass}>Age *</label>
              <input className={cn(inputClass, "mt-1")} type="number" placeholder="e.g. 35"
                value={form.age} onChange={(e) => set({ age: e.target.value })} />
            </div>

            <div className="mt-4 bg-muted/20 border border-border rounded-xl p-3 text-center text-xs text-muted-foreground">
              ℹ️ We use the Mifflin-St Jeor equation — the gold standard for estimating your metabolic rate.
            </div>
          </div>
        )}

        {/* ── STEP 1: Your Goal ── */}
        {step === 1 && (
          <div className="bg-card border border-border rounded-2xl p-7 mb-5">
            <h1 className="text-xl font-bold mb-1">Your Goal</h1>
            <p className="text-sm text-muted-foreground mb-5">What are you working toward?</p>

            <div className="flex flex-col gap-2 mb-4">
              {GOALS.map((g) => (
                <button key={g.id} onClick={() => set({ goal: g.id })}
                  className={optionBtn(form.goal === g.id)}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{g.icon}</span>
                    <span className="font-semibold text-sm">{g.label}</span>
                  </div>
                </button>
              ))}
            </div>

            <div>
              <label className={labelClass}>
                Target Weight ({form.units === "imperial" ? "lbs" : "kg"}) <span className="normal-case text-muted-foreground/60">(optional)</span>
              </label>
              <input className={cn(inputClass, "mt-1")} type="number"
                placeholder={form.units === "imperial" ? "e.g. 140" : "e.g. 65"}
                value={form.targetWeight} onChange={(e) => set({ targetWeight: e.target.value })} />
            </div>
          </div>
        )}

        {/* ── STEP 2: Activity Level ── */}
        {step === 2 && (
          <div className="bg-card border border-border rounded-2xl p-7 mb-5">
            <h1 className="text-xl font-bold mb-1">Activity Level</h1>
            <p className="text-sm text-muted-foreground mb-5">We combine exercise + daily movement for accuracy.</p>

            <label className={cn(labelClass, "mb-2 block")}>Weekly Purposeful Exercise</label>
            <div className="flex flex-col gap-2 mb-4">
              {EXERCISE_LEVELS.map((a) => (
                <button key={a.id} onClick={() => set({ exercise: a.id })}
                  className={optionBtn(form.exercise === a.id)}>
                  <span className="font-semibold text-sm">{a.label}</span>
                  <span className="text-muted-foreground text-xs ml-2">— {a.desc}</span>
                </button>
              ))}
            </div>

            <div className="h-px bg-border my-4" />

            <label className={cn(labelClass, "mb-2 block")}>Daily Activity (excluding exercise)</label>
            <div className="flex flex-col gap-2">
              {DAILY_ACTIVITY.map((a) => (
                <button key={a.id} onClick={() => set({ dailyActivity: a.id })}
                  className={optionBtn(form.dailyActivity === a.id)}>
                  <span className="font-semibold text-sm">{a.label}</span>
                  <span className="text-muted-foreground text-xs ml-2">— {a.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: Diet & Macro Setup ── */}
        {step === 3 && (
          <div className="bg-card border border-border rounded-2xl p-7 mb-5">
            <h1 className="text-xl font-bold mb-1">Diet & Macro Setup</h1>
            <p className="text-sm text-muted-foreground mb-5">Choose your approach and fine-tune your macros.</p>

            {/* Dietary Preference */}
            <label className={cn(labelClass, "mb-2 block")}>Dietary Preference</label>
            <div className="flex flex-col gap-1.5 mb-4 max-h-48 overflow-y-auto pr-1">
              {DIETS.map((d) => (
                <button key={d.id} onClick={() => set({ diet: d.id })}
                  className={cn(
                    "w-full p-3 rounded-xl text-left transition-all border flex items-start gap-2",
                    form.diet === d.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/30 hover:border-primary/50"
                  )}>
                  {form.diet === d.id && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                  <div>
                    <div className="font-semibold text-sm">{d.label}</div>
                    <div className="text-xs text-muted-foreground">{d.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="h-px bg-border my-4" />

            {/* Macro Ratio */}
            <label className={cn(labelClass, "mb-2 block")}>Macro Ratio</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {MACRO_RATIOS.map((r) => (
                <button key={r.id} onClick={() => set({ macroRatio: r.id })}
                  className={cn(
                    "p-3 rounded-xl text-center transition-all border",
                    form.macroRatio === r.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/30 hover:border-primary/50"
                  )}>
                  <div className="font-semibold text-sm">{r.label}</div>
                  <div className="text-[10px] text-muted-foreground">{r.desc}</div>
                </button>
              ))}
            </div>

            <div className="h-px bg-border my-4" />

            {/* Meals per day */}
            <label className={cn(labelClass, "mb-2 block")}>Meals Per Day</label>
            <div className="flex gap-2 mb-4">
              {MEALS_PER_DAY.map((n) => (
                <button key={n} onClick={() => set({ mealsPerDay: n })}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-sm font-bold transition-all border",
                    form.mealsPerDay === n
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                  )}>
                  {n}
                </button>
              ))}
            </div>

            <div className="h-px bg-border my-4" />

            {/* Allergies */}
            <label className={cn(labelClass, "mb-2 block")}>Food Allergies</label>
            <div className="flex flex-wrap gap-2">
              {ALLERGIES.map((a) => (
                <button key={a} onClick={() => toggleAllergy(a)} className={pillBtn(form.allergies.includes(a))}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="flex gap-2.5">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-4 rounded-xl border border-border bg-transparent text-muted-foreground font-semibold hover:bg-muted/20 transition-colors">
              ← Back
            </button>
          )}
          {step < 3 ? (
            <button disabled={!canNext()} onClick={() => setStep((s) => s + 1)}
              className={cn(
                "py-4 rounded-xl font-bold text-base transition-all",
                step > 0 ? "flex-1" : "flex-[2]",
                canNext()
                  ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}>
              Continue →
            </button>
          ) : step === 3 ? (
            <button onClick={handleCalculate}
              className="flex-[2] py-4 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-base">
              Calculate My Plan 🎯
            </button>
          ) : null}
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-4">
          Powered by NutriCoach • Mifflin-St Jeor Formula
        </p>
      </div>
    </div>
  );
}
