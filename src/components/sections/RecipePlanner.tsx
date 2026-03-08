import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Plus, ChefHat, ImagePlus, X } from "lucide-react";
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveRecipe = async () => {
    if (!user || !title.trim()) {
      toast.error("Please enter a recipe title");
      return;
    }

    const ingredientList = ingredients.split("\n").filter(Boolean).map((i) => i.trim());
    const instructionList = instructions.split("\n").filter(Boolean).map((i) => i.trim());

    setSaving(true);
    let imageUrl: string | null = null;
    let imageFilename: string | null = null;

    try {
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        imageFilename = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("recipe-images")
          .upload(imageFilename, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("recipe-images")
          .getPublicUrl(imageFilename);
        imageUrl = urlData.publicUrl;
      }

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
        image_url: imageUrl,
        image_filename: imageFilename,
      });

      if (error) throw error;

      toast.success("Recipe saved to your collection!");
      setTitle("");
      setDescription("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFats("");
      setIngredients("");
      setInstructions("");
      removeImage();
    } catch (err: any) {
      toast.error(err.message || "Failed to save recipe");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-heading flex items-center gap-2 text-foreground">
          <div className="h-10 w-10 rounded-full bg-icon-bg flex items-center justify-center"><BookOpen className="h-5 w-5 text-foreground" /></div>
          Recipe Planner
        </h2>
        <p className="text-section-label font-semibold">Create and save your own custom recipes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" /> New Recipe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Recipe Photo</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            {imagePreview ? (
              <div className="relative w-full max-w-xs">
                <img
                  src={imagePreview}
                  alt="Recipe preview"
                  className="w-full h-48 object-cover rounded-lg border border-border"
                />
                <button
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-background/80 backdrop-blur rounded-full p-1 hover:bg-destructive/20 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-sm">Add a photo</span>
              </button>
            )}
          </div>

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
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ingredients (one per line)</Label>
              <Textarea
                placeholder={"2 cups oats\n1 scoop whey protein\n1 banana\n2 eggs"}
                rows={5}
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Instructions (one per line)</Label>
              <Textarea
                placeholder={"Mix dry ingredients\nAdd wet ingredients\nCook on medium heat\nServe with toppings"}
                rows={5}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>
          </div>

          <Button className="w-full sm:w-auto sm:px-12" onClick={saveRecipe} disabled={saving}>
            <Plus className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Recipe"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
