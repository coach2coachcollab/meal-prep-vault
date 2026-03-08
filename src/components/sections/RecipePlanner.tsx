import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Plus, ChefHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function RecipePlanner() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [instructions, setInstructions] = useState("");

  const saveRecipe = async () => {
    if (!user || !title.trim()) {
      toast.error("Please enter a recipe title");
      return;
    }

    const ingredientList = ingredients.split("\n").filter(Boolean).map((i) => i.trim());
    const instructionList = instructions.split("\n").filter(Boolean).map((i) => i.trim());

    const { error } = await supabase.from("meals").insert({
      user_id: user.id,
      title,
      description,
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fats: parseFloat(fats) || 0,
      ingredients: ingredientList,
      instructions: instructionList,
    });

    if (error) {
      toast.error("Failed to save recipe");
    } else {
      toast.success("Recipe saved to your collection!");
      setTitle("");
      setDescription("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFats("");
      setIngredients("");
      setInstructions("");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Recipe Planner
        </h2>
        <p className="text-muted-foreground">Create and save your own custom recipes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" /> New Recipe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Recipe Name</Label>
              <Input placeholder="e.g., Protein Pancakes" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input placeholder="Brief description..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          {/* Macros */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Nutrition Info</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Calories</Label>
                <Input type="number" placeholder="0" value={calories} onChange={(e) => setCalories(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Protein (g)</Label>
                <Input type="number" placeholder="0" value={protein} onChange={(e) => setProtein(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Carbs (g)</Label>
                <Input type="number" placeholder="0" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Fats (g)</Label>
                <Input type="number" placeholder="0" value={fats} onChange={(e) => setFats(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Ingredients & Instructions */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Ingredients (one per line)</Label>
              <Textarea
                placeholder={"2 cups oats\n1 scoop whey protein\n1 banana\n2 eggs"}
                rows={6}
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Instructions (one per line)</Label>
              <Textarea
                placeholder={"Mix dry ingredients\nAdd wet ingredients\nCook on medium heat\nServe with toppings"}
                rows={6}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>
          </div>

          <Button className="w-full sm:w-auto sm:px-12" onClick={saveRecipe}>
            <Plus className="h-4 w-4 mr-1" /> Save Recipe
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
