import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Flame, Beef, Wheat, Droplets } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MacroResult {
  bmr: number;
  tdee: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export function MacroCalculator() {
  const { user } = useAuth();
  const [gender, setGender] = useState("male");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [goal, setGoal] = useState("maintain");
  const [result, setResult] = useState<MacroResult | null>(null);

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

    // Mifflin-St Jeor
    const bmr = gender === "male"
      ? 10 * w + 6.25 * h - 5 * a + 5
      : 10 * w + 6.25 * h - 5 * a - 161;

    const tdee = bmr * activityMultipliers[activityLevel];
    const calories = tdee * goalMultipliers[goal];
    const protein = w * 2.2; // 1g per lb
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
      if (error) console.error("Save error:", error);
      else toast.success("Calculation saved!");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Macro Calculator
        </h2>
        <p className="text-muted-foreground">Calculate your BMR, TDEE, and personalized macro targets</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
                <Label>Weight (kg)</Label>
                <Input type="number" placeholder="70" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Height (cm)</Label>
                <Input type="number" placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} />
              </div>
            </div>
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
            <Button className="w-full" onClick={calculate}>
              Calculate Macros
            </Button>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">BMR</p>
                    <p className="text-2xl font-bold">{result.bmr}</p>
                    <p className="text-xs text-muted-foreground">cal/day</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">TDEE</p>
                    <p className="text-2xl font-bold">{result.tdee}</p>
                    <p className="text-xs text-muted-foreground">cal/day</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Daily Macro Targets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10">
                    <Flame className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">Calories</p>
                    </div>
                    <p className="text-xl font-bold">{result.calories}</p>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10">
                    <Beef className="h-5 w-5 text-destructive" />
                    <div className="flex-1">
                      <p className="font-medium">Protein</p>
                    </div>
                    <p className="text-xl font-bold">{result.protein}g</p>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-accent">
                    <Wheat className="h-5 w-5 text-accent-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">Carbs</p>
                    </div>
                    <p className="text-xl font-bold">{result.carbs}g</p>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary">
                    <Droplets className="h-5 w-5 text-secondary-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">Fats</p>
                    </div>
                    <p className="text-xl font-bold">{result.fats}g</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
