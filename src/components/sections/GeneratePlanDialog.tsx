import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, ClipboardCopy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface GeneratePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlanGenerated: () => void;
}

export function GeneratePlanDialog({ open, onOpenChange, onPlanGenerated }: GeneratePlanDialogProps) {
  const { user } = useAuth();
  const [planName, setPlanName] = useState("Nutrition Plan");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [calories, setCalories] = useState("");
  const [duration, setDuration] = useState("7");
  const [mealsPerDay, setMealsPerDay] = useState("3");
  const [dietPref, setDietPref] = useState("balanced");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open && user) {
      importFromCalculator();
    }
  }, [open, user]);

  // Auto-calculate calories when macros change
  useEffect(() => {
    const p = parseFloat(protein) || 0;
    const c = parseFloat(carbs) || 0;
    const f = parseFloat(fats) || 0;
    if (p || c || f) {
      setCalories(String(Math.round(p * 4 + c * 4 + f * 9)));
    }
  }, [protein, carbs, fats]);

  const importFromCalculator = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_macros")
      .select("calories, protein_g, carbs_g, fat_g")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setProtein(String(data.protein_g));
      setCarbs(String(data.carbs_g));
      setFats(String(data.fat_g));
      setCalories(String(data.calories));
    }
  };

  const generate = async () => {
    if (!user) return;
    const cal = parseInt(calories);
    const p = parseInt(protein);
    const c = parseInt(carbs);
    const f = parseInt(fats);
    if (!cal || !p) {
      toast.error("Please set your nutrition targets");
      return;
    }

    setGenerating(true);
    try {
      // Fetch meals
      const { data: meals } = await supabase
        .from("meals")
        .select("id, title, calories, protein, carbs, fats, tags")
        .order("created_at", { ascending: false });

      if (!meals || meals.length < 3) {
        toast.error("Add at least 3 meals to your Meal Vault first!");
        return;
      }

      // Get profile prefs
      const { data: prof } = await supabase
        .from("profiles")
        .select("diet_prefs, allergies")
        .eq("user_id", user.id)
        .single();

      const macros = { calories: cal, protein_g: p, carbs_g: c, fat_g: f };
      const mealsForAI = meals.map((m) => ({
        id: m.id, title: m.title, calories: m.calories || 0,
        protein: m.protein || 0, carbs: m.carbs || 0, fats: m.fats || 0, tags: m.tags || [],
      }));

      const { data, error } = await supabase.functions.invoke("generate-meal-plan", {
        body: {
          meals: mealsForAI,
          macros,
          dietPrefs: prof?.diet_prefs || [],
          allergies: prof?.allergies || [],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Save the plan
      const durationDays = parseInt(duration);
      const mCount = parseInt(mealsPerDay);
      const startDate = new Date().toISOString().split("T")[0];

      const { data: planRow, error: planErr } = await supabase.from("meal_plans").insert({
        user_id: user.id,
        name: planName,
        description: `${durationDays}-day meal plan with ${mCount} meals per day targeting ${cal} calories daily`,
        start_date: startDate,
      }).select("id").single();

      if (planErr) throw planErr;

      const plan = data as { days: Array<{ day: string; meals: Record<string, { meal_id: string; title: string }> }> };
      const entries = plan.days.flatMap((day) =>
        Object.entries(day.meals).map(([time, meal]) => ({
          meal_plan_id: planRow.id,
          meal_id: meal.meal_id,
          day_of_week: day.day,
          meal_time: time,
        }))
      );

      await supabase.from("meal_plan_entries").insert(entries);

      toast.success("Nutrition plan generated successfully!");
      onOpenChange(false);
      onPlanGenerated();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[95vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Nutrition Plan</DialogTitle>
          <DialogDescription>Create a personalized meal plan based on your nutrition goals</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label>Plan Name</Label>
            <Input value={planName} onChange={(e) => setPlanName(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Daily Nutrition Targets</Label>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={importFromCalculator}>
                <ClipboardCopy className="h-3.5 w-3.5" /> Import from Calculator
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Protein (g)</Label>
                <Input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Carbs (g)</Label>
                <Input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fats (g)</Label>
                <Input type="number" value={fats} onChange={(e) => setFats(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Daily Calories <span className="text-[10px]">(auto-calculated)</span></Label>
                <Input type="number" value={calories} readOnly className="bg-muted/50" />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold mb-2 block">Plan Settings</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Plan Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days (1 week)</SelectItem>
                    <SelectItem value="14">14 days (2 weeks)</SelectItem>
                    <SelectItem value="21">21 days (3 weeks)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Meals Per Day</Label>
                <Select value={mealsPerDay} onValueChange={setMealsPerDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 meals</SelectItem>
                    <SelectItem value="4">4 meals</SelectItem>
                    <SelectItem value="5">5 meals</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Dietary Preference</Label>
                <Select value={dietPref} onValueChange={setDietPref}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="high-protein">High Protein</SelectItem>
                    <SelectItem value="low-carb">Low Carb</SelectItem>
                    <SelectItem value="keto">Keto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1 gap-2" onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Generating..." : "Generate Plan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
