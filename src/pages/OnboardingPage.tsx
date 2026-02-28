import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChefHat, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const goals = ["Hormone balance", "Lose fat", "Maintain weight", "Build muscle", "Improve energy"];
const activityLevels = [
  { value: "sedentary", label: "Sedentary", desc: "Desk job, little exercise" },
  { value: "light", label: "Lightly active", desc: "1-3 days/week" },
  { value: "moderate", label: "Moderately active", desc: "3-5 days/week" },
  { value: "active", label: "Very active", desc: "6-7 days/week" },
];
const dietOptions = ["None", "Gluten-free", "Dairy-free", "Vegan", "Vegetarian", "Keto", "Paleo"];
const allergyOptions = ["None", "Nuts", "Shellfish", "Eggs", "Soy"];

export default function OnboardingPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [activity, setActivity] = useState("");
  const [dietPrefs, setDietPrefs] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleMulti = (arr: string[], val: string, setter: (v: string[]) => void) => {
    if (val === "None") {
      setter(["None"]);
    } else {
      const without = arr.filter((v) => v !== "None");
      setter(without.includes(val) ? without.filter((v) => v !== val) : [...without, val]);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return !!goal;
      case 1: return !!activity;
      case 2: return dietPrefs.length > 0;
      case 3: return allergies.length > 0;
      case 4: return !!age && !!heightCm && !!weightKg;
      default: return false;
    }
  };

  const finish = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        goal,
        activity_level: activity,
        diet_prefs: dietPrefs.filter((d) => d !== "None"),
        allergies: allergies.filter((a) => a !== "None"),
        age: parseInt(age),
        height_cm: parseFloat(heightCm),
        weight_kg: parseFloat(weightKg),
        onboarding_completed: true,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Welcome to NutriCoach! 🎉");
      window.location.reload();
    }
  };

  const steps = [
    // Step 0: Goal
    <div key="goal" className="space-y-4">
      <CardHeader className="px-0">
        <CardTitle>What's your primary goal?</CardTitle>
        <CardDescription>We'll personalize your experience based on this</CardDescription>
      </CardHeader>
      <div className="grid gap-3">
        {goals.map((g) => (
          <button
            key={g}
            onClick={() => setGoal(g)}
            className={cn(
              "p-4 rounded-lg border text-left transition-all",
              goal === g ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "hover:border-primary/50"
            )}
          >
            <span className="font-medium">{g}</span>
          </button>
        ))}
      </div>
    </div>,
    // Step 1: Activity
    <div key="activity" className="space-y-4">
      <CardHeader className="px-0">
        <CardTitle>What is your activity level?</CardTitle>
        <CardDescription>This helps us calculate your daily targets</CardDescription>
      </CardHeader>
      <div className="grid gap-3">
        {activityLevels.map((a) => (
          <button
            key={a.value}
            onClick={() => setActivity(a.value)}
            className={cn(
              "p-4 rounded-lg border text-left transition-all",
              activity === a.value ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "hover:border-primary/50"
            )}
          >
            <span className="font-medium">{a.label}</span>
            <p className="text-sm text-muted-foreground">{a.desc}</p>
          </button>
        ))}
      </div>
    </div>,
    // Step 2: Diet
    <div key="diet" className="space-y-4">
      <CardHeader className="px-0">
        <CardTitle>Any dietary preferences?</CardTitle>
        <CardDescription>Select all that apply</CardDescription>
      </CardHeader>
      <div className="flex flex-wrap gap-2">
        {dietOptions.map((d) => (
          <Badge
            key={d}
            variant={dietPrefs.includes(d) ? "default" : "outline"}
            className={cn("cursor-pointer px-4 py-2 text-sm", dietPrefs.includes(d) && "bg-primary text-primary-foreground")}
            onClick={() => toggleMulti(dietPrefs, d, setDietPrefs)}
          >
            {dietPrefs.includes(d) && <Check className="h-3 w-3 mr-1" />}
            {d}
          </Badge>
        ))}
      </div>
    </div>,
    // Step 3: Allergies
    <div key="allergies" className="space-y-4">
      <CardHeader className="px-0">
        <CardTitle>Any food allergies?</CardTitle>
        <CardDescription>We'll exclude these from your meal plans</CardDescription>
      </CardHeader>
      <div className="flex flex-wrap gap-2">
        {allergyOptions.map((a) => (
          <Badge
            key={a}
            variant={allergies.includes(a) ? "default" : "outline"}
            className={cn("cursor-pointer px-4 py-2 text-sm", allergies.includes(a) && "bg-primary text-primary-foreground")}
            onClick={() => toggleMulti(allergies, a, setAllergies)}
          >
            {allergies.includes(a) && <Check className="h-3 w-3 mr-1" />}
            {a}
          </Badge>
        ))}
      </div>
    </div>,
    // Step 4: Body stats
    <div key="body" className="space-y-4">
      <CardHeader className="px-0">
        <CardTitle>Your body stats</CardTitle>
        <CardDescription>We use this to calculate your daily nutrition needs</CardDescription>
      </CardHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Age</Label>
          <Input type="number" placeholder="35" value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Height (cm)</Label>
          <Input type="number" placeholder="165" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Weight (kg)</Label>
          <Input type="number" placeholder="70" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
        </div>
      </div>
    </div>,
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <ChefHat className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">NutriCoach</h1>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-4">Step {step + 1} of 5</p>

        <Card>
          <CardContent className="pt-6">{steps[step]}</CardContent>
        </Card>

        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="flex-1">
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={!canProceed() || saving} className="flex-1">
              {saving ? "Saving..." : "Get Started 🚀"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
