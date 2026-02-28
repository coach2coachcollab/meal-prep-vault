import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, ArrowLeft, Clock, Users, Star, ShoppingCart } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

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

interface MealDetailViewProps {
  meal: Meal;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onBack: () => void;
}

export function MealDetailView({ meal, isFavorite, onToggleFavorite, onBack }: MealDetailViewProps) {
  const [activeTab, setActiveTab] = useState("ingredients");

  const ingredientsList: string[] = Array.isArray(meal.ingredients) ? meal.ingredients : [];
  const instructionsList: string[] = Array.isArray(meal.instructions) ? meal.instructions : [];
  const totalTime = (meal.prep_time || 0) + (meal.cook_time || 0);

  const allTags = [
    ...(meal.tags || []),
    ...(meal.diet_tags || []),
    ...(meal.health_tags || []),
  ];

  return (
    <div className="space-y-6 animate-in slide-in-from-right-5 duration-300">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to Meals
      </Button>

      {/* Title + Favorite */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold">{meal.title}</h2>
          {meal.description && (
            <p className="text-muted-foreground mt-1">{meal.description}</p>
          )}
        </div>
        <Button variant="outline" size="icon" className="shrink-0 ml-3" onClick={onToggleFavorite}>
          <Heart className={`h-5 w-5 ${isFavorite ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
        </Button>
      </div>

      {/* Image + Nutrition side by side */}
      <div className="grid grid-cols-1 gap-4">
        {meal.image_url && (
          <div className="rounded-xl overflow-hidden aspect-video">
            <img src={meal.image_url} alt={meal.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Nutrition Info Card */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Nutrition Information</h3>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className="h-4 w-4 text-muted-foreground/30" />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-xl font-bold">{meal.calories || 0}</p>
                <p className="text-xs text-muted-foreground">Calories</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-600">{meal.protein || 0}g</p>
                <p className="text-xs text-muted-foreground">Protein</p>
              </div>
              <div>
                <p className="text-xl font-bold text-orange-500">{meal.carbs || 0}g</p>
                <p className="text-xs text-muted-foreground">Carbs</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-600">{meal.fats || 0}g</p>
                <p className="text-xs text-muted-foreground">Fats</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Ingredients / Instructions / Grocery List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
          <TabsTrigger value="instructions">Instructions</TabsTrigger>
          <TabsTrigger value="grocery">Grocery List</TabsTrigger>
        </TabsList>

        <TabsContent value="ingredients">
          <Card>
            <CardContent className="pt-5 space-y-3">
              {ingredientsList.length > 0 ? ingredientsList.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No ingredients listed</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instructions">
          <Card>
            <CardContent className="pt-5 space-y-4">
              {instructionsList.length > 0 ? instructionsList.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">{i + 1}</span>
                  <p className="text-sm pt-0.5">{step}</p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No instructions listed</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grocery">
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground mb-3">
                Shopping list for {meal.servings || 1} serving{(meal.servings || 1) > 1 ? "s" : ""}:
              </p>
              <div className="grid grid-cols-1 gap-2">
                {ingredientsList.length > 0 ? ingredientsList.map((item, i) => (
                  <label key={i} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox />
                    <span className="text-sm">{item}</span>
                  </label>
                )) : (
                  <p className="text-sm text-muted-foreground">No items</p>
                )}
              </div>
              {ingredientsList.length > 0 && (
                <Button className="w-full mt-4 gap-2" variant="default">
                  <ShoppingCart className="h-4 w-4" /> Add All to Shopping List
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recipe Details Card */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold mb-4">Recipe Details</h3>
          <div className="flex items-center justify-around text-center mb-4">
            <div>
              <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Prep Time</p>
              <p className="font-semibold text-sm">{totalTime > 0 ? `${totalTime} min` : "—"}</p>
            </div>
            <div>
              <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Servings</p>
              <p className="font-semibold text-sm">{meal.servings || 1}</p>
            </div>
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {meal.coach_notes && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="font-semibold mb-2">Coach Notes</h3>
            <p className="text-sm text-muted-foreground">{meal.coach_notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
