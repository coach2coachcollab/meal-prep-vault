import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { calculateMacros } from "@/lib/calculations";

const GOALS = [
  { id: "lose_fat", label: "Lose Fat", icon: "🔥", desc: "Burn fat, lean out" },
  { id: "build_muscle", label: "Build Muscle", icon: "💪", desc: "Gain size & strength" },
  { id: "maintain", label: "Maintain", icon: "⚖️", desc: "Stay where you are" },
  { id: "hormone", label: "Hormone Balance", icon: "🌿", desc: "Feel balanced & well" },
  { id: "energy", label: "Improve Energy", icon: "⚡", desc: "More fuel, less crash" },
];

const ACTIVITY = [
  { id: "sedentary", label: "Sedentary", desc: "Desk job, little exercise" },
  { id: "light", label: "Lightly Active", desc: "1–3 days/week" },
  { id: "moderate", label: "Moderately Active", desc: "3–5 days/week" },
  { id: "very_active", label: "Very Active", desc: "6–7 days/week" },
];

const DIETS = ["None", "Gluten-free", "Dairy-free", "Vegan", "Vegetarian", "Keto", "Paleo", "High-protein"];
const ALLERGIES = ["None", "Nuts", "Shellfish", "Eggs", "Soy", "Gluten", "Dairy", "Fish", "Wheat"];

const GOAL_MAP: Record<string, string> = {
  lose_fat: "lose",
  build_muscle: "gain",
  maintain: "maintain",
  hormone: "maintain",
  energy: "maintain",
};

const GOAL_LABEL_MAP: Record<string, string> = {
  lose_fat: "Lose fat",
  build_muscle: "Build muscle",
  maintain: "Maintain weight",
  hormone: "Hormone balance",
  energy: "Improve energy",
};

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    goal: "",
    gender: "male" as "male" | "female",
    activity: "",
    age: "",
    heightCm: "",
    weightKg: "",
    diets: [] as string[],
    allergies: [] as string[],
    units: "metric" as "metric" | "imperial",
  });
  const [results, setResults] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const total = 3;
  const progress = (step / total) * 100;

  const toggle = (field: "diets" | "allergies", val: string) => {
    setData((d) => {
      const arr = d[field];
      if (val === "None") return { ...d, [field]: ["None"] };
      const without = arr.filter((x) => x !== "None");
      return arr.includes(val)
        ? { ...d, [field]: without.filter((x) => x !== val) }
        : { ...d, [field]: [...without, val] };
    });
  };

  const handleFinish = async () => {
    if (!user) return;

    const r = calculateMacros({
      gender: data.gender,
      weightKg: parseFloat(data.weightKg),
      heightCm: parseFloat(data.heightCm),
      age: parseInt(data.age),
      activityLevel: data.activity,
      goal: GOAL_MAP[data.goal] || "maintain",
    });

    setResults({ calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fats });
    setStep(4);
  };

  const finishAndSave = async () => {
    if (!user || !results) return;
    setSaving(true);

    // Save profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        goal: GOAL_LABEL_MAP[data.goal] || data.goal,
        activity_level: data.activity,
        diet_prefs: data.diets.filter((d) => d !== "None"),
        allergies: data.allergies.filter((a) => a !== "None"),
        age: parseInt(data.age),
        height_cm: parseFloat(data.heightCm),
        weight_kg: parseFloat(data.weightKg),
        onboarding_completed: true,
      })
      .eq("user_id", user.id);

    // Save macros
    const { data: existingMacros } = await supabase
      .from("user_macros")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMacros) {
      await supabase.from("user_macros").update({
        calories: results.calories,
        protein_g: results.protein,
        carbs_g: results.carbs,
        fat_g: results.fat,
        calculation_method: "mifflin",
        is_custom: false,
      }).eq("user_id", user.id);
    } else {
      await supabase.from("user_macros").insert({
        user_id: user.id,
        calories: results.calories,
        protein_g: results.protein,
        carbs_g: results.carbs,
        fat_g: results.fat,
        calculation_method: "mifflin",
        is_custom: false,
      });
    }

    setSaving(false);

    if (profileError) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Welcome to NutriCoach! 🎉");
      navigate("/", { replace: true });
    }
  };

  const canNext = [
    data.goal && data.gender,
    data.activity && data.age && data.heightCm && data.weightKg,
    true,
  ];

  const goalObj = GOALS.find((g) => g.id === data.goal);

  // RESULTS SCREEN
  if (step === 4 && results) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md flex flex-col gap-0">
          {/* Logo */}
          <div className="flex items-center gap-2.5 justify-center mb-6">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-xl">
              🍽️
            </div>
            <span className="text-2xl font-bold tracking-tight">NutriCoach</span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-7">
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">🎯</div>
              <div className="text-xl font-bold">Your Daily Targets</div>
              <div className="text-sm text-muted-foreground mt-1">
                {goalObj?.label} · {ACTIVITY.find((a) => a.id === data.activity)?.label}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { val: results.calories, label: "Calories", unit: "kcal", color: "text-primary" },
                { val: results.protein, label: "Protein", unit: "g", color: "text-macro-protein" },
                { val: results.carbs, label: "Carbs", unit: "g", color: "text-macro-carbs" },
                { val: results.fat, label: "Fat", unit: "g", color: "text-macro-fat" },
              ].map((m) => (
                <div key={m.label} className="bg-muted/50 border border-border rounded-xl p-3 flex flex-col items-center gap-1">
                  <div className={`text-2xl font-extrabold ${m.color}`}>{m.val}</div>
                  <div className="text-[10px] text-muted-foreground">{m.unit}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{m.label}</div>
                </div>
              ))}
            </div>

            <div className="h-px bg-border my-4" />

            <div className="bg-muted/30 border border-border rounded-xl p-3 text-center text-sm text-muted-foreground">
              🥗 Your Vault is being seeded with meals that match your goal & dietary preferences
            </div>
          </div>

          <div className="h-3" />
          <button
            onClick={finishAndSave}
            disabled={saving}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-base disabled:opacity-50"
          >
            {saving ? "Saving..." : "Let's Go 🚀"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-xl">
            🍽️
          </div>
          <span className="text-2xl font-bold tracking-tight">NutriCoach</span>
        </div>

        {/* Progress */}
        <div className="h-1 bg-muted rounded-full mb-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-400"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground mb-6 text-center">Step {step + 1} of {total}</div>

        {/* STEP 0 — Goal + Gender */}
        {step === 0 && (
          <div className="bg-card border border-border rounded-2xl p-7 mb-5">
            <h1 className="text-xl font-bold mb-1">What's your primary goal?</h1>
            <p className="text-sm text-muted-foreground mb-5">We'll personalize everything around this</p>

            <div className="flex gap-2 mb-4">
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setData((d) => ({ ...d, gender: g }))}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all border ${
                    data.gender === g
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {g === "male" ? "♂ Male" : "♀ Female"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((g, i) => (
                <button
                  key={g.id}
                  onClick={() => setData((d) => ({ ...d, goal: g.id }))}
                  className={`p-3.5 rounded-xl text-left transition-all border ${
                    i === 0 ? "col-span-2 flex items-center gap-2.5" : "flex flex-col gap-0.5"
                  } ${
                    data.goal === g.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/30 hover:border-primary/50"
                  }`}
                >
                  <span className={i === 0 ? "text-xl" : "text-lg"}>{g.icon}</span>
                  <span className="font-semibold text-sm">{g.label}</span>
                  {i === 0 && <span className="text-xs text-muted-foreground">{g.desc}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1 — Activity + Body Stats */}
        {step === 1 && (
          <div className="bg-card border border-border rounded-2xl p-7 mb-5">
            <h1 className="text-xl font-bold mb-1">Activity & Body Stats</h1>
            <p className="text-sm text-muted-foreground mb-5">Used to calculate your exact calorie & macro targets</p>

            {ACTIVITY.map((a) => (
              <button
                key={a.id}
                onClick={() => setData((d) => ({ ...d, activity: a.id }))}
                className={`w-full p-4 rounded-xl text-left mb-2 transition-all border ${
                  data.activity === a.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/30 hover:border-primary/50"
                }`}
              >
                <div className="font-semibold text-sm">{a.label}</div>
                <div className="text-xs text-muted-foreground">{a.desc}</div>
              </button>
            ))}

            <div className="h-px bg-border my-4" />

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { key: "age", label: "Age", placeholder: "e.g. 28" },
                { key: "heightCm", label: "Height (cm)", placeholder: "e.g. 170" },
                { key: "weightKg", label: "Weight (kg)", placeholder: "e.g. 75" },
              ].map((f) => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                    {f.label}
                  </label>
                  <input
                    type="number"
                    placeholder={f.placeholder}
                    value={data[f.key as keyof typeof data] as string}
                    onChange={(e) => setData((d) => ({ ...d, [f.key]: e.target.value }))}
                    className="bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-base font-semibold outline-none focus:border-primary transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 — Diet + Allergies combined */}
        {step === 2 && (
          <div className="bg-card border border-border rounded-2xl p-7 mb-5">
            <h1 className="text-xl font-bold mb-1">Diet & Restrictions</h1>
            <p className="text-sm text-muted-foreground mb-5">We'll filter your Vault and meal plans accordingly</p>

            <div className="text-[10px] text-muted-foreground font-semibold mb-2 uppercase tracking-wide">
              Dietary preference
            </div>
            <div className="flex flex-wrap gap-2">
              {DIETS.map((d) => (
                <button
                  key={d}
                  onClick={() => toggle("diets", d)}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all border ${
                    data.diets.includes(d)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="h-px bg-border my-4" />

            <div className="text-[10px] text-muted-foreground font-semibold mb-2 uppercase tracking-wide">
              Food allergies
            </div>
            <div className="flex flex-wrap gap-2">
              {ALLERGIES.map((a) => (
                <button
                  key={a}
                  onClick={() => toggle("allergies", a)}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all border ${
                    data.allergies.includes(a)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nav */}
        <div className="flex gap-2.5">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-4 rounded-xl border border-border bg-transparent text-muted-foreground font-semibold"
            >
              ← Back
            </button>
          )}
          {step < total - 1 ? (
            <button
              disabled={!canNext[step]}
              onClick={() => setStep((s) => s + 1)}
              className={`py-4 rounded-xl font-bold text-base transition-all ${
                step > 0 ? "flex-1" : "flex-[2]"
              } ${
                canNext[step]
                  ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex-[2] py-4 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-base"
            >
              Calculate My Plan 🎯
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
