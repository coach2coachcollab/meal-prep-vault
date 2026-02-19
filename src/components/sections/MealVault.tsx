import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Heart, Search, Plus, Clock, Users, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Sample meals for the vault
const sampleMeals = [
  { id: "s1", title: "Grilled Chicken Bowl", description: "High protein chicken with quinoa and veggies", calories: 520, protein: 45, carbs: 48, fats: 14, prep_time: 15, cook_time: 20, servings: 1, tags: ["high-protein", "meal-prep"], is_public: true },
  { id: "s2", title: "Salmon & Avocado Salad", description: "Omega-3 rich salmon on fresh greens", calories: 480, protein: 35, carbs: 12, fats: 32, prep_time: 10, cook_time: 15, servings: 1, tags: ["keto", "omega-3"], is_public: true },
  { id: "s3", title: "Turkey Meatballs", description: "Lean turkey meatballs with zucchini noodles", calories: 390, protein: 42, carbs: 18, fats: 16, prep_time: 20, cook_time: 25, servings: 2, tags: ["high-protein", "low-carb"], is_public: true },
  { id: "s4", title: "Greek Yogurt Parfait", description: "Protein-packed yogurt with berries and granola", calories: 320, protein: 24, carbs: 42, fats: 8, prep_time: 5, cook_time: 0, servings: 1, tags: ["breakfast", "quick"], is_public: true },
  { id: "s5", title: "Steak & Sweet Potato", description: "Grass-fed steak with roasted sweet potato", calories: 620, protein: 48, carbs: 52, fats: 22, prep_time: 10, cook_time: 30, servings: 1, tags: ["high-protein", "bulking"], is_public: true },
  { id: "s6", title: "Veggie Stir Fry", description: "Colorful vegetables with tofu in teriyaki sauce", calories: 340, protein: 18, carbs: 38, fats: 14, prep_time: 15, cook_time: 10, servings: 2, tags: ["vegetarian", "quick"], is_public: true },
  { id: "s7", title: "Overnight Oats", description: "Protein oats with chia, banana and almond butter", calories: 410, protein: 22, carbs: 56, fats: 14, prep_time: 5, cook_time: 0, servings: 1, tags: ["breakfast", "meal-prep"], is_public: true },
  { id: "s8", title: "Shrimp Tacos", description: "Grilled shrimp with slaw and chipotle sauce", calories: 440, protein: 32, carbs: 36, fats: 18, prep_time: 15, cook_time: 10, servings: 2, tags: ["seafood", "quick"], is_public: true },
];

export function MealVault() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    if (user) loadFavorites();
  }, [user]);

  const loadFavorites = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("favorite_meals")
      .select("meal_id")
      .eq("user_id", user.id);
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

  const filtered = sampleMeals.filter((meal) => {
    const matchesSearch = meal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meal.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));
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
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Meal
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search meals or tags..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
        >
          <Heart className="h-4 w-4 mr-1" /> Favorites
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((meal) => (
          <Card key={meal.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg leading-tight">{meal.title}</CardTitle>
                <button
                  onClick={() => toggleFavorite(meal.id)}
                  className="shrink-0 ml-2"
                >
                  <Heart
                    className={`h-5 w-5 transition-colors ${
                      favorites.includes(meal.id)
                        ? "fill-destructive text-destructive"
                        : "text-muted-foreground hover:text-destructive"
                    }`}
                  />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">{meal.description}</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
                <div className="p-2 rounded bg-primary/10">
                  <Flame className="h-3 w-3 mx-auto mb-1 text-primary" />
                  <p className="font-semibold">{meal.calories}</p>
                  <p className="text-muted-foreground">cal</p>
                </div>
                <div className="p-2 rounded bg-destructive/10">
                  <p className="font-semibold">{meal.protein}g</p>
                  <p className="text-muted-foreground">protein</p>
                </div>
                <div className="p-2 rounded bg-accent">
                  <p className="font-semibold">{meal.carbs}g</p>
                  <p className="text-muted-foreground">carbs</p>
                </div>
                <div className="p-2 rounded bg-secondary">
                  <p className="font-semibold">{meal.fats}g</p>
                  <p className="text-muted-foreground">fats</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {meal.prep_time + meal.cook_time}min</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {meal.servings} serving{meal.servings > 1 ? "s" : ""}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {meal.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
