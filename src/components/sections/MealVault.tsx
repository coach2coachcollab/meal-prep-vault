import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Heart, Search, Plus, Clock, Users, Flame, Loader2, ChefHat, ImagePlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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

  // Create form state
  const [form, setForm] = useState({
    title: "", description: "", calories: "", protein: "", carbs: "", fats: "",
    prep_time: "", cook_time: "", servings: "1", tags: "", ingredients: "", instructions: "",
  });

  useEffect(() => {
    loadMeals();
    if (user) loadFavorites();
  }, [user]);

  const loadMeals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("meals")
      .select("id, title, description, calories, protein, carbs, fats, prep_time, cook_time, servings, tags, is_public, user_id, ingredients, instructions, image_url")
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
      user_id: user.id,
      title: form.title,
      description: form.description || null,
      calories: parseFloat(form.calories) || 0,
      protein: parseFloat(form.protein) || 0,
      carbs: parseFloat(form.carbs) || 0,
      fats: parseFloat(form.fats) || 0,
      prep_time: parseInt(form.prep_time) || null,
      cook_time: parseInt(form.cook_time) || null,
      servings: parseInt(form.servings) || 1,
      tags: tagList,
      ingredients: ingredientList,
      instructions: instructionList,
      is_public: false,
      image_url,
      image_filename,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" />
            Meal Vault
          </h2>
          <p className="text-muted-foreground">Browse recipes and save your favorites</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Meal
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search meals or tags..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <Button variant={showFavoritesOnly ? "default" : "outline"} onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}>
          <Heart className="h-4 w-4 mr-1" /> Favorites
        </Button>
      </div>

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
        <div className="grid gap-3">
          {filtered.map((meal) => (
            <Card key={meal.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="flex">
                <div className="flex-1 min-w-0 p-4">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-semibold text-sm leading-tight truncate pr-2">{meal.title}</h3>
                    <button onClick={() => toggleFavorite(meal.id)} className="shrink-0">
                      <Heart className={`h-4 w-4 transition-colors ${favorites.includes(meal.id) ? "fill-destructive text-destructive" : "text-muted-foreground hover:text-destructive"}`} />
                    </button>
                  </div>
                  {meal.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{meal.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] mb-2">
                    <span className="font-medium text-primary">{meal.calories || 0}<span className="text-muted-foreground font-normal">cal</span></span>
                    <span>{meal.protein || 0}g<span className="text-muted-foreground"> protein</span></span>
                    <span>{meal.carbs || 0}g<span className="text-muted-foreground"> carbs</span></span>
                    <span>{meal.fats || 0}g<span className="text-muted-foreground"> fats</span></span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {(meal.prep_time || meal.cook_time) && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {(meal.prep_time || 0) + (meal.cook_time || 0)}min</span>
                    )}
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {meal.servings || 1} serving{(meal.servings || 1) > 1 ? "s" : ""}</span>
                  </div>
                  {meal.tags && meal.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {meal.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                      ))}
                      {meal.tags.length > 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{meal.tags.length - 3}</Badge>
                      )}
                    </div>
                  )}
                </div>
                {meal.image_url && (
                  <div className="w-24 shrink-0">
                    <img
                      src={meal.image_url}
                      alt={meal.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Recipe Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ChefHat className="h-5 w-5" /> Create Recipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Recipe Name *</Label>
              <Input placeholder="e.g., Protein Pancakes" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input placeholder="Brief description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Photo</Label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors overflow-hidden">
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
                  if (file) {
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }
                }} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Calories</Label>
                <Input type="number" placeholder="0" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Protein (g)</Label>
                <Input type="number" placeholder="0" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Carbs (g)</Label>
                <Input type="number" placeholder="0" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fats (g)</Label>
                <Input type="number" placeholder="0" value={form.fats} onChange={(e) => setForm({ ...form, fats: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Prep (min)</Label>
                <Input type="number" placeholder="0" value={form.prep_time} onChange={(e) => setForm({ ...form, prep_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cook (min)</Label>
                <Input type="number" placeholder="0" value={form.cook_time} onChange={(e) => setForm({ ...form, cook_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Servings</Label>
                <Input type="number" placeholder="1" value={form.servings} onChange={(e) => setForm({ ...form, servings: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tags (comma-separated)</Label>
              <Input placeholder="high-protein, meal-prep, quick" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Ingredients (one per line)</Label>
              <Textarea placeholder={"2 cups oats\n1 scoop whey protein\n1 banana"} rows={4} value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Instructions (one per line)</Label>
              <Textarea placeholder={"Mix dry ingredients\nAdd wet ingredients\nCook on medium heat"} rows={4} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
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
