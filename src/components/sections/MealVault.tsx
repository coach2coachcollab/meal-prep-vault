import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Heart, Search, Plus, Clock, Users, Loader2, ChefHat, ImagePlus, Eye, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MealDetailView } from "./MealDetailView";

interface Meal {
  id: string;
  title: string;
  description: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  tags: string[] | null;
  is_public: boolean | null;
  user_id: string | null;
  ingredients: any;
  instructions: any;
  image_url: string | null;
  category?: string | null;
  cuisine?: string | null;
  diet_tags?: string[] | null;
  health_tags?: string[] | null;
  coach_notes?: string | null;
}

export function MealVault() {
  const { user } = useAuth();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});

  const [form, setForm] = useState({
    title: "", description: "", calories: "", protein: "", carbs: "", fats: "",
    prep_time: "", cook_time: "", servings: "1", tags: "", ingredients: "", instructions: "",
  });

  useEffect(() => {
    loadMeals();
    loadRatings();
    if (user) loadFavorites();
  }, [user]);

  const loadMeals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("meals")
      .select("id, title, description, calories, protein, carbs, fats, prep_time, cook_time, servings, tags, is_public, user_id, ingredients, instructions, image_url, category, cuisine, diet_tags, health_tags, coach_notes")
      .order("created_at", { ascending: false });
    if (data) setMeals(data);
    if (error) console.error("Failed to load meals", error);
    setLoading(false);
  };

  const loadFavorites = async () => {
    if (!user) return;
    const { data } = await supabase.from("favorite_meals").select("meal_id").eq("user_id", user.id);
    if (data) setFavorites(data.map((f) => f.meal_id));
  };

  const loadRatings = async () => {
    const { data } = await supabase.from("meal_ratings").select("meal_id, rating");
    if (data) {
      const map: Record<string, number[]> = {};
      data.forEach((r) => {
        if (!map[r.meal_id]) map[r.meal_id] = [];
        map[r.meal_id].push(r.rating);
      });
      const result: Record<string, { avg: number; count: number }> = {};
      Object.entries(map).forEach(([id, vals]) => {
        result[id] = { avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, count: vals.length };
      });
      setRatings(result);
    }
  };

  const toggleFavorite = async (mealId: string) => {
    if (!user) return;
    if (favorites.includes(mealId)) {
      await supabase.from("favorite_meals").delete().eq("user_id", user.id).eq("meal_id", mealId);
      setFavorites(favorites.filter((id) => id !== mealId));
      toast.success("Removed from favorites");
    } else {
      await supabase.from("favorite_meals").insert({ user_id: user.id, meal_id: mealId });
      setFavorites([...favorites, mealId]);
      toast.success("Added to favorites");
    }
  };

  const createRecipe = async () => {
    if (!user || !form.title.trim()) {
      toast.error("Please enter a recipe title");
      return;
    }
    setSaving(true);
    const ingredientList = form.ingredients.split("\n").filter(Boolean).map((i) => i.trim());
    const instructionList = form.instructions.split("\n").filter(Boolean).map((i) => i.trim());
    const tagList = form.tags.split(",").filter(Boolean).map((t) => t.trim().toLowerCase());

    let image_url: string | null = null;
    let image_filename: string | null = null;

    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("recipe-images").upload(fileName, imageFile);
      if (uploadErr) {
        toast.error("Image upload failed");
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(fileName);
      image_url = urlData.publicUrl;
      image_filename = fileName;
    }

    const { error } = await supabase.from("meals").insert({
      user_id: user.id, title: form.title, description: form.description || null,
      calories: parseFloat(form.calories) || 0, protein: parseFloat(form.protein) || 0,
      carbs: parseFloat(form.carbs) || 0, fats: parseFloat(form.fats) || 0,
      prep_time: parseInt(form.prep_time) || null, cook_time: parseInt(form.cook_time) || null,
      servings: parseInt(form.servings) || 1, tags: tagList,
      ingredients: ingredientList, instructions: instructionList,
      is_public: false, image_url, image_filename,
    });

    if (error) {
      toast.error("Failed to save recipe");
    } else {
      toast.success("Recipe created! 🎉");
      setForm({ title: "", description: "", calories: "", protein: "", carbs: "", fats: "", prep_time: "", cook_time: "", servings: "1", tags: "", ingredients: "", instructions: "" });
      setImageFile(null);
      setImagePreview(null);
      setShowCreate(false);
      loadMeals();
    }
    setSaving(false);
  };

  const filtered = meals.filter((meal) => {
    const matchesSearch = meal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (meal.tags || []).some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFavorite = !showFavoritesOnly || favorites.includes(meal.id);
    return matchesSearch && matchesFavorite;
  });

  // Detail view
  if (selectedMeal) {
    return (
      <MealDetailView
        meal={selectedMeal}
        isFavorite={favorites.includes(selectedMeal.id)}
        onToggleFavorite={() => toggleFavorite(selectedMeal.id)}
        onBack={() => setSelectedMeal(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <div className="h-10 w-10 rounded-full bg-icon-bg flex items-center justify-center"><Heart className="h-5 w-5 text-foreground" /></div>
            Meal Vault
          </h2>
          <p className="text-section-label font-semibold text-sm">Browse recipes and save your favorites</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Meal
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search meals or tags..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <Button variant={showFavoritesOnly ? "default" : "outline"} onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}>
          <Heart className="h-4 w-4 mr-1" /> Favorites
        </Button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <ChefHat className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            {searchTerm ? "No meals match your search" : "No recipes yet. Add your first one!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((meal) => {
            const totalTime = (meal.prep_time || 0) + (meal.cook_time || 0);
            const allTags = [...(meal.tags || []), ...(meal.diet_tags || []), ...(meal.health_tags || [])];
            const mealRating = ratings[meal.id];

            return (
              <Card key={meal.id} className="overflow-hidden hover:shadow-md transition-shadow">
                {/* Image banner */}
                {meal.image_url && (
                  <div className="relative h-40 overflow-hidden">
                    <img src={meal.image_url} alt={meal.title} className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(meal.id); }}
                      className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center"
                    >
                      <Heart className={`h-4 w-4 ${favorites.includes(meal.id) ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                    </button>
                  </div>
                )}

                <CardContent className={`${meal.image_url ? 'pt-3' : 'pt-4'} pb-3 px-4 space-y-2.5`}>
                  {/* Title + desc */}
                  <div>
                    <h3 className="font-semibold text-sm truncate">{meal.title}</h3>
                    {meal.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{meal.description}</p>
                    )}
                  </div>

                  {/* Macro badges */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{meal.calories || 0}</span>
                    <span className="text-[10px] text-muted-foreground">cal</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-macro-protein/15 text-macro-protein border-0 font-semibold">
                      {meal.protein || 0}g <span className="font-normal ml-0.5">protein</span>
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-macro-carbs/15 text-macro-carbs border-0 font-semibold">
                      {meal.carbs || 0}g <span className="font-normal ml-0.5">carbs</span>
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-macro-fat/15 text-macro-fat border-0 font-semibold">
                      {meal.fats || 0}g <span className="font-normal ml-0.5">fat</span>
                    </Badge>
                  </div>

                  {/* Time + servings + rating */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      {totalTime > 0 && (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {totalTime} min</span>
                      )}
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {meal.servings || 1} serving{(meal.servings || 1) > 1 ? "s" : ""}</span>
                    </div>
                    {mealRating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-star text-star" />
                        <span className="font-medium">{mealRating.avg}</span>
                        <span>({mealRating.count})</span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {allTags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                      ))}
                      {allTags.length > 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{allTags.length - 3} more</Badge>
                      )}
                    </div>
                  )}

                  {/* View button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs"
                    onClick={() => setSelectedMeal(meal)}
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Recipe Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[90vh] overflow-y-auto w-[95vw] max-w-2xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ChefHat className="h-5 w-5" /> Create Recipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Recipe Name *</Label>
                <Input placeholder="e.g., Protein Pancakes" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="Brief description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Photo</Label>
              <label className="flex flex-col items-center justify-center w-full h-32 sm:h-40 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors overflow-hidden">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <ImagePlus className="h-8 w-8 mb-1" />
                    <span className="text-xs">Click to upload</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
                }} />
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-2"><Label>Calories</Label><Input type="number" placeholder="0" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} /></div>
              <div className="space-y-2"><Label>Protein (g)</Label><Input type="number" placeholder="0" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} /></div>
              <div className="space-y-2"><Label>Carbs (g)</Label><Input type="number" placeholder="0" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} /></div>
              <div className="space-y-2"><Label>Fats (g)</Label><Input type="number" placeholder="0" value={form.fats} onChange={(e) => setForm({ ...form, fats: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Prep (min)</Label><Input type="number" placeholder="0" value={form.prep_time} onChange={(e) => setForm({ ...form, prep_time: e.target.value })} /></div>
              <div className="space-y-2"><Label>Cook (min)</Label><Input type="number" placeholder="0" value={form.cook_time} onChange={(e) => setForm({ ...form, cook_time: e.target.value })} /></div>
              <div className="space-y-2"><Label>Servings</Label><Input type="number" placeholder="1" value={form.servings} onChange={(e) => setForm({ ...form, servings: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Tags (comma-separated)</Label><Input placeholder="high-protein, meal-prep, quick" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Ingredients (one per line)</Label><Textarea placeholder={"2 cups oats\n1 scoop whey protein\n1 banana"} rows={5} value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} /></div>
              <div className="space-y-2"><Label>Instructions (one per line)</Label><Textarea placeholder={"Mix dry ingredients\nAdd wet ingredients\nCook on medium heat"} rows={5} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
            </div>
            <Button className="w-full" onClick={createRecipe} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Save Recipe
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
