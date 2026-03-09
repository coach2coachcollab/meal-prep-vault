import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Heart, Search, Plus, Clock, Users, Loader2, ChefHat, ImagePlus, Eye, Star, MessageCircle, Sparkles, Trash2, Pencil, Globe, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { r2 } from "@/lib/utils";
import { MealDetailView } from "./MealDetailView";
import { MealPlanView } from "./MealPlanView";
import { GeneratePlanDialog } from "./GeneratePlanDialog";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

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

const MEAL_PAGE_SIZE = 24;

export function MealVault() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [activeTab, setActiveTab] = useState<"meals" | "plans">("meals");
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cuisineFilter, setCuisineFilter] = useState("all");

  const [form, setForm] = useState({
    title: "", description: "", calories: "", protein: "", carbs: "", fats: "",
    prep_time: "", cook_time: "", servings: "1", tags: "", ingredients: "", instructions: "",
  });

  // Infinite query for meals
  const {
    data: mealsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loading,
  } = useInfiniteQuery({
    queryKey: queryKeys.meals(),
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .from("meals")
        .select("id, title, description, calories, protein, carbs, fats, prep_time, cook_time, servings, tags, is_public, user_id, ingredients, instructions, image_url, category, cuisine, diet_tags, health_tags, coach_notes")
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + MEAL_PAGE_SIZE - 1);
      if (error) console.error("Failed to load meals", error);
      return {
        meals: (data || []) as Meal[],
        nextOffset: (data?.length || 0) === MEAL_PAGE_SIZE ? pageParam + MEAL_PAGE_SIZE : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
  });

  const meals = useMemo(() => mealsData?.pages.flatMap((p) => p.meals) || [], [mealsData]);

  // Favorites query
  const { data: favorites = [] } = useQuery({
    queryKey: queryKeys.favorites(user?.id),
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("favorite_meals").select("meal_id").eq("user_id", user.id);
      return (data || []).map((f) => f.meal_id);
    },
    enabled: !!user,
  });

  // Ratings query
  const { data: ratings = {} } = useQuery({
    queryKey: queryKeys.mealRatings(),
    queryFn: async () => {
      const { data } = await supabase.from("meal_ratings").select("meal_id, rating");
      if (!data) return {};
      const map: Record<string, number[]> = {};
      data.forEach((r) => {
        if (!map[r.meal_id]) map[r.meal_id] = [];
        map[r.meal_id].push(r.rating);
      });
      const result: Record<string, { avg: number; count: number }> = {};
      Object.entries(map).forEach(([id, vals]) => {
        result[id] = { avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, count: vals.length };
      });
      return result;
    },
  });

  // Comment counts query
  const { data: commentCounts = {} } = useQuery({
    queryKey: queryKeys.mealCommentCounts(),
    queryFn: async () => {
      const { data: posts } = await supabase
        .from("community_posts")
        .select("id, recipe_id")
        .not("recipe_id", "is", null);
      if (!posts || posts.length === 0) return {};
      const postIds = posts.map((p) => p.id);
      const { data: comments } = await supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds);
      if (!comments) return {};
      const postToRecipe = new Map(posts.map((p) => [p.id, p.recipe_id!]));
      const counts: Record<string, number> = {};
      comments.forEach((c) => {
        const recipeId = postToRecipe.get(c.post_id);
        if (recipeId) counts[recipeId] = (counts[recipeId] || 0) + 1;
      });
      return counts;
    },
  });

  const toggleFavorite = async (mealId: string) => {
    if (!user) return;
    if (favorites.includes(mealId)) {
      await supabase.from("favorite_meals").delete().eq("user_id", user.id).eq("meal_id", mealId);
      toast.success("Removed from favorites");
    } else {
      await supabase.from("favorite_meals").insert({ user_id: user.id, meal_id: mealId });
      toast.success("Added to favorites");
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.favorites(user.id) });
  };

  const togglePublic = async (mealId: string, currentValue: boolean) => {
    const { error } = await supabase.from("meals").update({ is_public: !currentValue }).eq("id", mealId);
    if (error) {
      toast.error("Failed to update visibility");
    } else {
      toast.success(!currentValue ? "Recipe is now public" : "Recipe is now private");
      queryClient.invalidateQueries({ queryKey: queryKeys.meals() });
    }
  };

  const deleteMeal = async (mealId: string) => {
    const { error } = await supabase.from("meals").delete().eq("id", mealId);
    if (error) {
      toast.error("Failed to delete meal");
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.meals() });
      toast.success("Meal deleted");
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
      if (uploadErr) { toast.error("Image upload failed"); setSaving(false); return; }
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
      setImageFile(null); setImagePreview(null); setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.meals() });
    }
    setSaving(false);
  };

  const customMeals = meals.filter((m) => m.user_id === user?.id);

  const filtered = meals.filter((meal) => {
    const matchesSearch = meal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (meal.tags || []).some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (meal.ingredients && JSON.stringify(meal.ingredients).toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFavorite = !showFavoritesOnly || favorites.includes(meal.id);
    const matchesCategory = categoryFilter === "all" || meal.category === categoryFilter;
    const matchesCuisine = cuisineFilter === "all" || meal.cuisine === cuisineFilter;
    return matchesSearch && matchesFavorite && matchesCategory && matchesCuisine;
  });

  const categories = [...new Set(meals.map((m) => m.category).filter(Boolean))];
  const cuisines = [...new Set(meals.map((m) => m.cuisine).filter(Boolean))];

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-heading flex items-center gap-2 text-foreground">
            Meal Vault
            {customMeals.length > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs">{customMeals.length} Custom Meals</Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">Browse, create, and organize meal ideas and plans</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Create New Meal</span>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowGenerateDialog(true)}>
            <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Generate Nutrition Plan</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center">
        <div className="inline-flex w-full rounded-lg border border-border overflow-hidden">
          <button
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "meals" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("meals")}
          >
            Individual Meals
          </button>
          <button
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "plans" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("plans")}
          >
            Meal Plans
          </button>
        </div>
      </div>

      {activeTab === "meals" ? (
        <>
          {/* Search + Filters */}
          <Card>
            <CardContent className="p-3">
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search meals, ingredients, or tags..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                {categories.length > 0 && (
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="All categories" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((c) => <SelectItem key={c} value={c!}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {cuisines.length > 0 && (
                  <Select value={cuisineFilter} onValueChange={setCuisineFilter}>
                    <SelectTrigger className="w-[130px]"><SelectValue placeholder="All cuisines" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All cuisines</SelectItem>
                      {cuisines.map((c) => <SelectItem key={c} value={c!}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Button variant={showFavoritesOnly ? "default" : "outline"} onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}>
                  <Heart className="h-4 w-4 mr-1" /> Favorites
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results count */}
          <p className="text-sm text-muted-foreground">
            {filtered.length} meals found
            {customMeals.length > 0 && <span className="text-primary ml-1">({customMeals.length} custom)</span>}
          </p>

          {/* Meal Grid */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-full bg-icon-bg flex items-center justify-center mx-auto mb-3"><ChefHat className="h-8 w-8 text-foreground" /></div>
              <p className="text-muted-foreground">
                {searchTerm ? "No meals match your search" : "No recipes yet. Add your first one!"}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
              {filtered.map((meal) => {
                const totalTime = (meal.prep_time || 0) + (meal.cook_time || 0);
                const allTags = [...(meal.tags || []), ...(meal.diet_tags || []), ...(meal.health_tags || [])];
                const mealRating = ratings[meal.id];
                const s = meal.servings || 1;
                const cal = r2((meal.calories || 0) / s);
                const p = r2((meal.protein || 0) / s);
                const c = r2((meal.carbs || 0) / s);
                const f = r2((meal.fats || 0) / s);

                return (
                  <Card key={meal.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    {/* Image or placeholder */}
                    <div className="relative h-48 overflow-hidden">
                      {meal.image_url ? (
                        <img src={meal.image_url} alt={meal.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 via-accent/10 to-secondary flex items-center justify-center">
                          <ChefHat className="h-12 w-12 text-muted-foreground/40" />
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(meal.id); }}
                        className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center"
                      >
                        <Heart className={`h-4 w-4 ${favorites.includes(meal.id) ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                      </button>
                      {/* Macro overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pb-2.5 pt-8">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-white text-base font-bold">{cal}</span>
                          <span className="text-white/70 text-xs">cal/serving</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-semibold text-white px-1.5 py-0.5 rounded bg-macro-protein/80">{p}g P</span>
                          <span className="text-xs font-semibold text-white px-1.5 py-0.5 rounded bg-macro-carbs/80">{c}g C</span>
                          <span className="text-xs font-semibold text-white px-1.5 py-0.5 rounded bg-macro-fat/80">{f}g F</span>
                        </div>
                      </div>
                    </div>

                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-base truncate">{meal.title}</h3>
                        {meal.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{meal.description}</p>}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          {totalTime > 0 && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {totalTime} min</span>}
                          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {meal.servings || 1} serving{(meal.servings || 1) > 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {mealRating && (
                            <div className="flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 fill-star text-star" />
                              <span className="font-medium">{mealRating.avg}</span>
                              <span>({mealRating.count})</span>
                            </div>
                          )}
                          {(commentCounts[meal.id] || 0) > 0 && (
                            <div className="flex items-center gap-1">
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>{commentCounts[meal.id]}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {allTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {allTags.slice(0, 4).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[11px] px-2 py-0.5">{tag}</Badge>
                          ))}
                          {allTags.length > 4 && <Badge variant="outline" className="text-[11px] px-2 py-0.5">+{allTags.length - 4}</Badge>}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setSelectedMeal(meal)}>
                          <Eye className="h-4 w-4" /> View
                        </Button>
                        {meal.user_id === user?.id && (
                          <>
                            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => deleteMeal(meal.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {hasNextPage && meals.length > 0 && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {isFetchingNextPage ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Loading...</> : "Load More Meals"}
              </Button>
            </div>
          )}
        </>
      ) : (
        <MealPlanView
          searchTerm={searchTerm}
          showFavoritesOnly={showFavoritesOnly}
          refreshKey={planRefreshKey}
          onViewMeal={async (mealId) => {
            const found = meals.find((m) => m.id === mealId);
            if (found) {
              setSelectedMeal(found);
            } else {
              const { data } = await supabase
                .from("meals")
                .select("id, title, description, calories, protein, carbs, fats, prep_time, cook_time, servings, tags, is_public, user_id, ingredients, instructions, image_url, category, cuisine, diet_tags, health_tags, coach_notes")
                .eq("id", mealId)
                .maybeSingle();
              if (data) setSelectedMeal(data);
            }
          }}
        />
      )}

      {/* Generate Plan Dialog */}
      <GeneratePlanDialog
        open={showGenerateDialog}
        onOpenChange={setShowGenerateDialog}
        onPlanGenerated={() => {
          setPlanRefreshKey((k) => k + 1);
          setActiveTab("plans");
        }}
      />

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
