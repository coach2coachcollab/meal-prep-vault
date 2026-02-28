import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, Flame, Beef, Wheat, Droplets, Star, Trash2, Search, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const moods = ["😊", "😐", "😴", "😤", "😢"];

interface JournalEntry {
  id: string;
  meal_type: string;
  food_name: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  recipe_id: string | null;
}

interface DbMeal {
  id: string;
  title: string;
  description: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  image_url: string | null;
  tags: string[] | null;
  servings: number | null;
}

export function MealJournal() {
  const { user } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [macroTargets, setMacroTargets] = useState<{ calories: number; protein_g: number; carbs_g: number; fat_g: number } | null>(null);
  const [dailyNote, setDailyNote] = useState({ energy_level: 0, mood_emoji: "", notes: "" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addMealType, setAddMealType] = useState("Breakfast");

  // Manual entry
  const [foodName, setFoodName] = useState("");
  const [foodCals, setFoodCals] = useState("");
  const [foodProtein, setFoodProtein] = useState("");
  const [foodCarbs, setFoodCarbs] = useState("");
  const [foodFat, setFoodFat] = useState("");

  // Recipe picker
  const [dbMeals, setDbMeals] = useState<DbMeal[]>([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [mode, setMode] = useState<"pick" | "manual">("pick");

  // Map recipe_id -> image for entries
  const [mealImages, setMealImages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      loadData();
      loadMeals();
    }
  }, [user, date]);

  const loadMeals = async () => {
    const { data } = await supabase
      .from("meals")
      .select("id, title, description, calories, protein, carbs, fats, image_url, tags, servings")
      .order("title");
    if (data) {
      setDbMeals(data);
      const imgMap: Record<string, string> = {};
      data.forEach((m) => { if (m.image_url) imgMap[m.id] = m.image_url; });
      setMealImages(imgMap);
    }
  };

  const loadData = async () => {
    if (!user) return;
    const { data: e } = await supabase.from("journal_entries").select("*").eq("user_id", user.id).eq("date", date);
    if (e) setEntries(e);
    const { data: m } = await supabase.from("user_macros").select("calories, protein_g, carbs_g, fat_g").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (m) setMacroTargets(m);
    const { data: n } = await supabase.from("journal_daily_notes").select("*").eq("user_id", user.id).eq("date", date).maybeSingle();
    if (n) setDailyNote({ energy_level: n.energy_level || 0, mood_emoji: n.mood_emoji || "", notes: n.notes || "" });
    else setDailyNote({ energy_level: 0, mood_emoji: "", notes: "" });
  };

  const totals = entries.reduce((s, e) => ({
    calories: s.calories + Number(e.calories),
    protein: s.protein + Number(e.protein_g),
    carbs: s.carbs + Number(e.carbs_g),
    fat: s.fat + Number(e.fat_g),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const shiftDate = (dir: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + dir);
    setDate(d.toISOString().split("T")[0]);
  };

  const logFromRecipe = async (meal: DbMeal) => {
    if (!user) return;
    const { error } = await supabase.from("journal_entries").insert({
      user_id: user.id, date, meal_type: addMealType, food_name: meal.title,
      calories: meal.calories || 0, protein_g: meal.protein || 0,
      carbs_g: meal.carbs || 0, fat_g: meal.fats || 0,
      recipe_id: meal.id, servings: meal.servings || 1,
    });
    if (!error) {
      setDialogOpen(false);
      setRecipeSearch("");
      loadData();
      toast.success(`${meal.title} logged!`);
    }
  };

  const addFood = async () => {
    if (!user || !foodName.trim()) return;
    const { error } = await supabase.from("journal_entries").insert({
      user_id: user.id, date, meal_type: addMealType, food_name: foodName,
      calories: parseFloat(foodCals) || 0, protein_g: parseFloat(foodProtein) || 0,
      carbs_g: parseFloat(foodCarbs) || 0, fat_g: parseFloat(foodFat) || 0,
    });
    if (!error) {
      setFoodName(""); setFoodCals(""); setFoodProtein(""); setFoodCarbs(""); setFoodFat("");
      setDialogOpen(false);
      loadData();
      toast.success("Food logged!");
    }
  };

  const deleteEntry = async (id: string) => {
    await supabase.from("journal_entries").delete().eq("id", id);
    loadData();
  };

  const saveDailyNote = async () => {
    if (!user) return;
    const { error } = await supabase.from("journal_daily_notes").upsert({
      user_id: user.id, date, ...dailyNote,
    }, { onConflict: "user_id,date" });
    if (!error) toast.success("Notes saved!");
  };

  const statusMessage = () => {
    if (!macroTargets) return null;
    const diff = totals.calories - macroTargets.calories;
    if (Math.abs(diff) <= 150) return { text: "Great day! You hit your targets. 🎉", color: "text-primary" };
    if (diff < -150) return { text: "You might want to add a snack — your body needs fuel. 💪", color: "text-accent-foreground" };
    return { text: "No worries — one day doesn't define your progress. ❤️", color: "text-muted-foreground" };
  };

  const filteredMeals = dbMeals.filter((m) =>
    m.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
    (m.tags || []).some((t) => t.toLowerCase().includes(recipeSearch.toLowerCase()))
  );

  const openDialog = (type: string) => {
    setAddMealType(type);
    setMode("pick");
    setRecipeSearch("");
    setDialogOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Date nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => shiftDate(-1)}><ChevronLeft className="h-5 w-5" /></Button>
        <div className="text-center">
          <p className="font-semibold">{new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
          {date === new Date().toISOString().split("T")[0] && <p className="text-xs text-primary">Today</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => shiftDate(1)}><ChevronRight className="h-5 w-5" /></Button>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-4 gap-3 text-center text-xs">
            <div><Flame className="h-4 w-4 mx-auto mb-1 text-primary" /><p className="font-bold text-lg">{totals.calories}</p><p className="text-muted-foreground">/ {macroTargets?.calories || "—"}</p></div>
            <div><Beef className="h-4 w-4 mx-auto mb-1 text-primary" /><p className="font-bold">{totals.protein}g</p><p className="text-muted-foreground">protein</p></div>
            <div><Wheat className="h-4 w-4 mx-auto mb-1 text-accent-foreground" /><p className="font-bold">{totals.carbs}g</p><p className="text-muted-foreground">carbs</p></div>
            <div><Droplets className="h-4 w-4 mx-auto mb-1 text-secondary-foreground" /><p className="font-bold">{totals.fat}g</p><p className="text-muted-foreground">fat</p></div>
          </div>
          {statusMessage() && entries.length > 0 && (
            <p className={cn("text-xs text-center mt-3", statusMessage()!.color)}>{statusMessage()!.text}</p>
          )}
        </CardContent>
      </Card>

      {/* Meal sections */}
      {mealTypes.map((type) => {
        const typeEntries = entries.filter((e) => e.meal_type === type);
        return (
          <div key={type}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">{type}</h3>
              <Button variant="ghost" size="sm" onClick={() => openDialog(type)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {typeEntries.length > 0 ? (
              <div className="space-y-2">
                {typeEntries.map((e) => (
                  <Card key={e.id}>
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                      {/* Meal photo */}
                      {e.recipe_id && mealImages[e.recipe_id] ? (
                        <img
                          src={mealImages[e.recipe_id]}
                          alt={e.food_name}
                          className="h-12 w-12 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{e.food_name}</p>
                        <p className="text-xs text-muted-foreground">{e.calories} kcal · {e.protein_g}P · {e.carbs_g}C · {e.fat_g}F</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteEntry(e.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pl-1 mb-2">No food logged</p>
            )}
          </div>
        );
      })}

      {/* Mood & Energy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Mood & Energy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Energy Level</Label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setDailyNote({ ...dailyNote, energy_level: n })}>
                  <Star className={cn("h-6 w-6", n <= dailyNote.energy_level ? "fill-primary text-primary" : "text-muted")} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Mood</Label>
            <div className="flex gap-2 mt-1">
              {moods.map((m) => (
                <button key={m} onClick={() => setDailyNote({ ...dailyNote, mood_emoji: m })}
                  className={cn("text-2xl p-1 rounded", dailyNote.mood_emoji === m && "bg-primary/10 ring-2 ring-primary/30")}
                >{m}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea placeholder="Any notes about today?" rows={2} value={dailyNote.notes} onChange={(e) => setDailyNote({ ...dailyNote, notes: e.target.value })} />
          </div>
          <Button size="sm" variant="outline" onClick={saveDailyNote}>Save Notes</Button>
        </CardContent>
      </Card>

      {/* Add food dialog — recipe picker + manual */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Log {addMealType}</DialogTitle></DialogHeader>

          {/* Tab toggle */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setMode("pick")}
              className={cn("flex-1 text-sm py-1.5 rounded-md transition-colors", mode === "pick" ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}
            >
              From Vault
            </button>
            <button
              onClick={() => setMode("manual")}
              className={cn("flex-1 text-sm py-1.5 rounded-md transition-colors", mode === "manual" ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}
            >
              Manual Entry
            </button>
          </div>

          {mode === "pick" ? (
            <div className="space-y-3 pt-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search recipes..." className="pl-10" value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} />
              </div>

              {filteredMeals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No recipes found. Add meals in the Meal Vault first!</p>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {filteredMeals.map((meal) => (
                    <button
                      key={meal.id}
                      onClick={() => logFromRecipe(meal)}
                      className="w-full text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors flex gap-3 items-center"
                    >
                      {meal.image_url ? (
                        <img src={meal.image_url} alt={meal.title} className="h-14 w-14 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{meal.title}</p>
                        {meal.description && <p className="text-xs text-muted-foreground truncate">{meal.description}</p>}
                        <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{meal.calories || 0} cal</span>
                          <span>{meal.protein || 0}g P</span>
                          <span>{meal.carbs || 0}g C</span>
                          <span>{meal.fats || 0}g F</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="space-y-1"><Label>Food Name</Label><Input placeholder="e.g., Chicken breast" value={foodName} onChange={(e) => setFoodName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Calories</Label><Input type="number" placeholder="0" value={foodCals} onChange={(e) => setFoodCals(e.target.value)} /></div>
                <div className="space-y-1"><Label>Protein (g)</Label><Input type="number" placeholder="0" value={foodProtein} onChange={(e) => setFoodProtein(e.target.value)} /></div>
                <div className="space-y-1"><Label>Carbs (g)</Label><Input type="number" placeholder="0" value={foodCarbs} onChange={(e) => setFoodCarbs(e.target.value)} /></div>
                <div className="space-y-1"><Label>Fat (g)</Label><Input type="number" placeholder="0" value={foodFat} onChange={(e) => setFoodFat(e.target.value)} /></div>
              </div>
              <Button className="w-full" onClick={addFood}>Log Food</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
