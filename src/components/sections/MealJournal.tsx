import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, Flame, Beef, Wheat, Droplets, Star, Trash2, Search, UtensilsCrossed, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  image_url: string | null;
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

export function MealJournal({ autoOpenLog }: {autoOpenLog?: boolean;}) {
  const { user } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [macroTargets, setMacroTargets] = useState<{calories: number;protein_g: number;carbs_g: number;fat_g: number;} | null>(null);
  const [dailyNote, setDailyNote] = useState({ energy_level: 0, mood_emoji: "", notes: "" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addMealType, setAddMealType] = useState("Breakfast");
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  useEffect(() => {
    if (autoOpenLog) {
      setDialogOpen(true);
    }
  }, [autoOpenLog]);

  // Manual entry
  const [foodName, setFoodName] = useState("");
  const [foodCals, setFoodCals] = useState("");
  const [foodProtein, setFoodProtein] = useState("");
  const [foodCarbs, setFoodCarbs] = useState("");
  const [foodFat, setFoodFat] = useState("");
  const [mealPhoto, setMealPhoto] = useState<File | null>(null);
  const [mealPhotoPreview, setMealPhotoPreview] = useState<string | null>(null);
  const [saveToVault, setSaveToVault] = useState(false);

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
    const { data } = await supabase.
    from("meals").
    select("id, title, description, calories, protein, carbs, fats, image_url, tags, servings").
    order("title");
    if (data) {
      setDbMeals(data);
      const imgMap: Record<string, string> = {};
      data.forEach((m) => {if (m.image_url) imgMap[m.id] = m.image_url;});
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
    if (n) setDailyNote({ energy_level: n.energy_level || 0, mood_emoji: n.mood_emoji || "", notes: n.notes || "" });else
    setDailyNote({ energy_level: 0, mood_emoji: "", notes: "" });
  };

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const rawTotals = entries.reduce((s, e) => ({
    calories: s.calories + Number(e.calories),
    protein: s.protein + Number(e.protein_g),
    carbs: s.carbs + Number(e.carbs_g),
    fat: s.fat + Number(e.fat_g)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const totals = { calories: r2(rawTotals.calories), protein: r2(rawTotals.protein), carbs: r2(rawTotals.carbs), fat: r2(rawTotals.fat) };

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
      recipe_id: meal.id, servings: meal.servings || 1
    });
    if (!error) {
      setDialogOpen(false);
      setRecipeSearch("");
      loadData();
      toast.success(`${meal.title} logged!`);
    }
  };

  const addFood = async () => {
    if (!user || !foodName.trim() && !mealPhoto) return;

    let image_url: string | null = null;
    if (mealPhoto) {
      const ext = mealPhoto.name.split(".").pop();
      const fileName = `journal/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("recipe-images").upload(fileName, mealPhoto);
      if (uploadErr) {
        toast.error("Photo upload failed");
        return;
      }
      const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(fileName);
      image_url = urlData.publicUrl;
    }

    let recipe_id: string | null = null;

    // Optionally save to Meal Vault as a reusable recipe
    if (saveToVault && (foodName.trim() || image_url)) {
      const { data: mealData, error: mealErr } = await supabase.from("meals").insert({
        user_id: user.id,
        title: foodName.trim() || "Meal photo",
        calories: parseFloat(foodCals) || 0,
        protein: parseFloat(foodProtein) || 0,
        carbs: parseFloat(foodCarbs) || 0,
        fats: parseFloat(foodFat) || 0,
        image_url,
        servings: 1,
        is_public: false
      }).select("id").single();
      if (!mealErr && mealData) {
        recipe_id = mealData.id;
      }
    }

    const { error } = await supabase.from("journal_entries").insert({
      user_id: user.id, date, meal_type: addMealType, food_name: foodName.trim() || "Meal photo",
      calories: parseFloat(foodCals) || 0, protein_g: parseFloat(foodProtein) || 0,
      carbs_g: parseFloat(foodCarbs) || 0, fat_g: parseFloat(foodFat) || 0,
      image_url,
      ...(recipe_id ? { recipe_id } : {})
    });
    if (!error) {
      setFoodName("");setFoodCals("");setFoodProtein("");setFoodCarbs("");setFoodFat("");
      setMealPhoto(null);setMealPhotoPreview(null);setSaveToVault(false);
      setDialogOpen(false);
      loadData();
      if (recipe_id) loadMeals(); // refresh vault data
      toast.success(recipe_id ? "Food logged & saved to Vault! 🎉" : "Food logged!");
    }
  };

  const deleteEntry = async (id: string) => {
    await supabase.from("journal_entries").delete().eq("id", id);
    loadData();
  };

  const saveDailyNote = async () => {
    if (!user) return;
    const { error } = await supabase.from("journal_daily_notes").upsert({
      user_id: user.id, date, ...dailyNote
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
          {date === new Date().toISOString().split("T")[0] && <p className="text-xs text-primary-foreground">Today</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => shiftDate(1)}><ChevronRight className="h-5 w-5" /></Button>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-4 gap-3 text-center text-xs">
            <div className="rounded-xl bg-primary/10 py-3 px-1">
              <Flame className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="font-bold text-lg text-foreground">{totals.calories}</p>
              <p className="text-muted-foreground">kcal</p>
            </div>
            <div className="rounded-xl bg-macro-protein/10 py-3 px-1">
              <Beef className="h-4 w-4 mx-auto mb-1 text-macro-protein" />
              <p className="font-bold text-foreground">{totals.protein}g</p>
              <p className="text-muted-foreground">protein</p>
            </div>
            <div className="rounded-xl bg-macro-carbs/10 py-3 px-1">
              <Wheat className="h-4 w-4 mx-auto mb-1 text-macro-carbs" />
              <p className="font-bold text-foreground">{totals.carbs}g</p>
              <p className="text-muted-foreground">carbs</p>
            </div>
            <div className="rounded-xl bg-macro-fat/10 py-3 px-1">
              <Droplets className="h-4 w-4 mx-auto mb-1 text-macro-fat" />
              <p className="font-bold text-foreground">{totals.fat}g</p>
              <p className="text-muted-foreground">fat</p>
            </div>
          </div>
          {statusMessage() && entries.length > 0 &&
          <p className={cn("text-xs text-center mt-3", statusMessage()!.color)}>{statusMessage()!.text}</p>
          }
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
            {typeEntries.length > 0 ?
            <div className="space-y-2">
                {typeEntries.map((e) =>
              <Card key={e.id}>
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                      {/* Meal photo */}
                      {e.recipe_id && mealImages[e.recipe_id] ?
                  <img src={mealImages[e.recipe_id]} alt={e.food_name} className="h-12 w-12 rounded-lg object-cover shrink-0" /> :
                  (e as any).image_url ?
                  <img src={(e as any).image_url} alt={e.food_name} className="h-12 w-12 rounded-lg object-cover shrink-0" /> :

                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
                        </div>
                  }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{e.food_name}</p>
                        <p className="text-xs text-muted-foreground">{e.calories} kcal · {e.protein_g}P · {e.carbs_g}C · {e.fat_g}F</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteEntry(e.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
              )}
              </div> :

            <p className="text-xs text-muted-foreground pl-1 mb-2">No food logged</p>
            }
          </div>);

      })}


      {/* Add food dialog — recipe picker + manual */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[70vh] flex flex-col overflow-hidden">
          <DialogHeader><DialogTitle>Log {addMealType}</DialogTitle></DialogHeader>

          {/* Tab toggle */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setMode("pick")}
              className={cn("flex-1 text-sm py-1.5 rounded-md transition-colors", mode === "pick" ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}>
              
              From Vault
            </button>
            <button
              onClick={() => setMode("manual")}
              className={cn("flex-1 text-sm py-1.5 rounded-md transition-colors", mode === "manual" ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}>
              
              Manual Entry
            </button>
          </div>

          {mode === "pick" ?
          <div className="space-y-3 pt-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search recipes..." className="pl-10" value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} />
              </div>

              {filteredMeals.length === 0 ?
            <p className="text-sm text-muted-foreground text-center py-6">No recipes found. Add meals in the Meal Vault first!</p> :

            <div className="space-y-2 flex-1 overflow-y-auto min-h-0 max-h-[40vh]">
                  {filteredMeals.map((meal) =>
              <button
                key={meal.id}
                onClick={() => logFromRecipe(meal)}
                className="w-full text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors flex gap-3 items-center">
                
                      {meal.image_url ?
                <img src={meal.image_url} alt={meal.title} className="h-14 w-14 rounded-lg object-cover shrink-0" /> :

                <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                        </div>
                }
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
              )}
                </div>
            }
            </div> :

          <div className="space-y-3 pt-1">
              {/* Photo upload — primary action */}
              <div className="space-y-1">
                <Label>Meal Photo</Label>
                <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors overflow-hidden">
                  {mealPhotoPreview ?
                <img src={mealPhotoPreview} alt="Preview" className="w-full h-full object-cover" /> :

                <div className="flex flex-col items-center text-muted-foreground">
                      <ImagePlus className="h-8 w-8 mb-1" />
                      <span className="text-sm font-medium">Snap or upload a photo</span>
                      <span className="text-xs mt-0.5">Tap to capture your meal</span>
                    </div>
                }
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {setMealPhoto(file);setMealPhotoPreview(URL.createObjectURL(file));}
                }} />
                </label>
              </div>
              <div className="space-y-1">
                <Label>Food Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input placeholder="e.g., Chicken breast" value={foodName} onChange={(e) => setFoodName(e.target.value)} />
              </div>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                    + Add macros (optional)
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Calories</Label><Input type="number" placeholder="0" value={foodCals} onChange={(e) => setFoodCals(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Protein (g)</Label><Input type="number" placeholder="0" value={foodProtein} onChange={(e) => setFoodProtein(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Carbs (g)</Label><Input type="number" placeholder="0" value={foodCarbs} onChange={(e) => setFoodCarbs(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Fat (g)</Label><Input type="number" placeholder="0" value={foodFat} onChange={(e) => setFoodFat(e.target.value)} /></div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <Button className="w-full" onClick={addFood} disabled={!foodName.trim() && !mealPhoto}>Log Food</Button>
            </div>
          }
        </DialogContent>
      </Dialog>
    </div>);

}