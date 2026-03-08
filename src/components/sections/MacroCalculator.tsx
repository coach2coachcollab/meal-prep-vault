import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, ChefHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import { toast } from "sonner";

interface MacroResult {
  bmr: number;
  tdee: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

const GOAL_MAP: Record<string, string> = {
  "Lose fat": "lose",
  "Build muscle": "gain",
  "Maintain weight": "maintain",
  "Improve energy": "maintain",
};

const ACTIVITY_MAP: Record<string, string> = {
  sedentary: "sedentary",
  light: "light",
  moderate: "moderate",
  active: "active",
  very_active: "very_active",
};

interface MacroCalculatorProps {
  onNavigateToMealVault?: () => void;
}

export function MacroCalculator({ onNavigateToMealVault }: MacroCalculatorProps) {
  const { user } = useAuth();
  const { isImperial, weightUnit, heightUnit, toKg, toCm, KG_TO_LBS, CM_TO_IN } = usePreferredUnits();
  const [gender, setGender] = useState("male");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [goal, setGoal] = useState("maintain");
  const [result, setResult] = useState<MacroResult | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("age, weight_kg, height_cm, activity_level, goal")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        if (data.age) setAge(String(data.age));
        if (data.weight_kg) {
          setWeight(isImperial
            ? String(Math.round(data.weight_kg * KG_TO_LBS))
            : String(data.weight_kg));
        }
        if (data.height_cm) {
          setHeight(isImperial
            ? String(Math.round(data.height_cm * CM_TO_IN))
            : String(data.height_cm));
        }
        if (data.activity_level && ACTIVITY_MAP[data.activity_level]) {
          setActivityLevel(data.activity_level);
        }
        if (data.goal && GOAL_MAP[data.goal]) {
          setGoal(GOAL_MAP[data.goal]);
        }
      });
  }, [user, isImperial]);

  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };

  const goalMultipliers: Record<string, number> = {
    lose: 0.8,
    maintain: 1.0,
    gain: 1.15,
  };

  const calculate = async () => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age);

    if (!w || !h || !a) {
      toast.error("Please fill in all fields");
      return;
    }

    const wKg = toKg(w);
    const hCm = toCm(h);

    // Mifflin-St Jeor
    const bmr = gender === "male"
      ? 10 * wKg + 6.25 * hCm - 5 * a + 5
      : 10 * wKg + 6.25 * hCm - 5 * a - 161;

    const tdee = bmr * activityMultipliers[activityLevel];
    const calories = tdee * goalMultipliers[goal];
    const protein = wKg * 2.2; // 1g per lb
    const fats = (calories * 0.25) / 9;
    const carbs = (calories - protein * 4 - fats * 9) / 4;

    const res: MacroResult = {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fats: Math.round(fats),
    };
    setResult(res);

    // Save to database
    if (user) {
      // Save calculation history
      const { error } = await supabase.from("macro_calculations").insert({
        user_id: user.id,
        gender,
        age: a,
        weight: w,
        height: h,
        activity_level: activityLevel,
        goal,
        bmr: res.bmr,
        tdee: res.tdee,
        calories: res.calories,
        protein: res.protein,
        carbs: res.carbs,
        fats: res.fats,
      });

      // Upsert active macros so Meal Plan Generator can use them
      const { data: existing } = await supabase
        .from("user_macros")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("user_macros").update({
          calories: res.calories,
          protein_g: res.protein,
          carbs_g: res.carbs,
          fat_g: res.fats,
          calculation_method: "mifflin",
          is_custom: false,
        }).eq("user_id", user.id);
      } else {
        await supabase.from("user_macros").insert({
          user_id: user.id,
          calories: res.calories,
          protein_g: res.protein,
          carbs_g: res.carbs,
          fat_g: res.fats,
          calculation_method: "mifflin",
          is_custom: false,
        });
      }

      if (error) console.error("Save error:", error);
      else toast.success("Macros calculated & saved! You can now generate a meal plan.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading flex items-center gap-2 text-foreground">
          <div className="h-10 w-10 rounded-full bg-icon-bg flex items-center justify-center"><Calculator className="h-5 w-5 text-foreground" /></div>
          Macro Calculator
        </h2>
        <p className="text-section-label font-semibold">Calculate your BMR, TDEE, and personalized macro targets</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Details</CardTitle>
          <CardDescription>Enter your information for accurate calculations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Age</Label>
              <Input type="number" placeholder="25" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Weight ({isImperial ? "lbs" : "kg"})</Label>
              <Input type="number" placeholder={isImperial ? "154" : "70"} value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Height ({isImperial ? "in" : "cm"})</Label>
              <Input type="number" placeholder={isImperial ? "69" : "175"} value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Activity Level</Label>
              <Select value={activityLevel} onValueChange={setActivityLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary (office job)</SelectItem>
                  <SelectItem value="light">Light (1-3 days/week)</SelectItem>
                  <SelectItem value="moderate">Moderate (3-5 days/week)</SelectItem>
                  <SelectItem value="active">Active (6-7 days/week)</SelectItem>
                  <SelectItem value="very_active">Very Active (athlete)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Goal</Label>
              <Select value={goal} onValueChange={setGoal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lose">Lose Weight (-20%)</SelectItem>
                  <SelectItem value="maintain">Maintain Weight</SelectItem>
                  <SelectItem value="gain">Gain Muscle (+15%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" onClick={calculate}>
            Calculate Macros
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">BMR</p>
                <p className="text-2xl font-bold">{result.bmr}</p>
                <p className="text-xs text-muted-foreground">cal/day</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">TDEE</p>
                <p className="text-2xl font-bold">{result.tdee}</p>
                <p className="text-xs text-muted-foreground">cal/day</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6 pb-4 text-center">
              <p className="text-sm text-muted-foreground">Target Daily Calories</p>
              <p className="text-3xl font-bold">{result.calories}</p>
              <p className="text-xs text-muted-foreground">
                For {goal === "lose" ? "weight loss" : goal === "gain" ? "muscle gain" : "maintenance"}
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <Card className="border-macro-protein/30 bg-macro-protein/5">
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xl font-bold text-macro-protein">{result.protein}g</p>
                <p className="text-xs text-muted-foreground">Protein</p>
              </CardContent>
            </Card>
            <Card className="border-macro-carbs/30 bg-macro-carbs/5">
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xl font-bold text-macro-carbs">{result.carbs}g</p>
                <p className="text-xs text-muted-foreground">Carbs</p>
              </CardContent>
            </Card>
            <Card className="border-macro-fat/30 bg-macro-fat/5">
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xl font-bold text-macro-fat">{result.fats}g</p>
                <p className="text-xs text-muted-foreground">Fats</p>
              </CardContent>
            </Card>
          </div>

          {/* CTA to generate meal plan */}
          {onNavigateToMealVault && (
            <Card className="border-primary/20">
              <CardContent className="pt-6 pb-6 text-center space-y-3">
                <h3 className="text-lg font-bold text-foreground">Ready to Start Your Meal Plan?</h3>
                <p className="text-sm text-muted-foreground">Browse our meal vault to find recipes that fit your nutrition targets</p>
                <Button onClick={onNavigateToMealVault} size="lg" className="gap-2">
                  <ChefHat className="h-4 w-4" /> Browse Meal Vault
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
