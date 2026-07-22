import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Upload, FileJson, ImagePlus, CheckCircle2, XCircle, Loader2,
  ArrowLeft, AlertTriangle, Trash2, Sparkles, Eye, Pencil, Plus, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

interface RecipeJson {
  title: string;
  description?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  prep_time?: number;
  cook_time?: number;
  servings?: number;
  tags?: string[];
  diet_tags?: string[];
  health_tags?: string[];
  category?: string;
  cuisine?: string;
  coach_notes?: string;
  ingredients?: string[];
  instructions?: string[];
  image_filename?: string;
  is_public?: boolean;
}

interface ImportResult {
  title: string;
  status: "success" | "error";
  message?: string;
  id?: string;
}

interface ImageUploadResult {
  filename: string;
  status: "success" | "error";
  message?: string;
  url?: string;
}

interface AiExtractedRecipe {
  file: File;
  previewUrl: string;
  recipe: RecipeJson | null;
  status: "pending" | "extracting" | "extracted" | "error" | "saved";
  error?: string;
}

export default function ImportRecipesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const aiImageInputRef = useRef<HTMLInputElement>(null);

  // JSON import state
  const [recipes, setRecipes] = useState<RecipeJson[]>([]);
  const [jsonFileName, setJsonFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importProgress, setImportProgress] = useState(0);

  // Batch image upload state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageResults, setImageResults] = useState<ImageUploadResult[]>([]);
  const [imageProgress, setImageProgress] = useState(0);

  // AI extraction state
  const [aiRecipes, setAiRecipes] = useState<AiExtractedRecipe[]>([]);
  const [extractingAll, setExtractingAll] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const updateRecipeField = (index: number, field: keyof RecipeJson, value: any) => {
    setAiRecipes((prev) =>
      prev.map((r, i) =>
        i === index && r.recipe
          ? { ...r, recipe: { ...r.recipe, [field]: value } }
          : r
      )
    );
  };

  const updateIngredient = (recipeIndex: number, ingIndex: number, value: string) => {
    setAiRecipes((prev) =>
      prev.map((r, i) => {
        if (i !== recipeIndex || !r.recipe) return r;
        const ingredients = [...(r.recipe.ingredients || [])];
        ingredients[ingIndex] = value;
        return { ...r, recipe: { ...r.recipe, ingredients } };
      })
    );
  };

  const addIngredient = (recipeIndex: number) => {
    setAiRecipes((prev) =>
      prev.map((r, i) => {
        if (i !== recipeIndex || !r.recipe) return r;
        return { ...r, recipe: { ...r.recipe, ingredients: [...(r.recipe.ingredients || []), ""] } };
      })
    );
  };

  const removeIngredient = (recipeIndex: number, ingIndex: number) => {
    setAiRecipes((prev) =>
      prev.map((r, i) => {
        if (i !== recipeIndex || !r.recipe) return r;
        const ingredients = (r.recipe.ingredients || []).filter((_, j) => j !== ingIndex);
        return { ...r, recipe: { ...r.recipe, ingredients } };
      })
    );
  };

  const updateInstruction = (recipeIndex: number, stepIndex: number, value: string) => {
    setAiRecipes((prev) =>
      prev.map((r, i) => {
        if (i !== recipeIndex || !r.recipe) return r;
        const instructions = [...(r.recipe.instructions || [])];
        instructions[stepIndex] = value;
        return { ...r, recipe: { ...r.recipe, instructions } };
      })
    );
  };

  const addInstruction = (recipeIndex: number) => {
    setAiRecipes((prev) =>
      prev.map((r, i) => {
        if (i !== recipeIndex || !r.recipe) return r;
        return { ...r, recipe: { ...r.recipe, instructions: [...(r.recipe.instructions || []), ""] } };
      })
    );
  };

  const removeInstruction = (recipeIndex: number, stepIndex: number) => {
    setAiRecipes((prev) =>
      prev.map((r, i) => {
        if (i !== recipeIndex || !r.recipe) return r;
        const instructions = (r.recipe.instructions || []).filter((_, j) => j !== stepIndex);
        return { ...r, recipe: { ...r.recipe, instructions } };
      })
    );
  };

  const handleJsonFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setJsonFileName(file.name);
    setImportResults([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        const arr = Array.isArray(raw) ? raw : [raw];
        setRecipes(arr);
        toast.success(`Loaded ${arr.length} recipe(s) from JSON`);
      } catch {
        toast.error("Invalid JSON file");
        setRecipes([]);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleImageFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImageFiles(files);
    setImageResults([]);
    if (files.length) toast.success(`${files.length} image(s) selected`);
  }, []);

  const handleAiImageFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newEntries: AiExtractedRecipe[] = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      recipe: null,
      status: "pending" as const,
    }));
    setAiRecipes((prev) => [...prev, ...newEntries]);
    toast.success(`${files.length} image(s) added for AI extraction`);
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const extractSingleRecipe = async (index: number) => {
    const entry = aiRecipes[index];
    if (!entry || entry.status === "extracting") return;

    setAiRecipes((prev) =>
      prev.map((r, i) => (i === index ? { ...r, status: "extracting" as const, error: undefined } : r))
    );

    try {
      const base64 = await fileToBase64(entry.file);
      const { data, error } = await supabase.functions.invoke("extract-recipe-from-image", {
        body: { imageBase64: base64, mimeType: entry.file.type },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setAiRecipes((prev) =>
        prev.map((r, i) =>
          i === index ? { ...r, status: "extracted" as const, recipe: data.recipe } : r
        )
      );
    } catch (err: any) {
      setAiRecipes((prev) =>
        prev.map((r, i) =>
          i === index ? { ...r, status: "error" as const, error: err.message } : r
        )
      );
    }
  };

  const extractAllRecipes = async () => {
    setExtractingAll(true);
    for (let i = 0; i < aiRecipes.length; i++) {
      if (aiRecipes[i].status === "pending" || aiRecipes[i].status === "error") {
        await extractSingleRecipe(i);
      }
    }
    setExtractingAll(false);
    toast.success("AI extraction complete!");
  };

  const saveExtractedRecipe = async (index: number) => {
    const entry = aiRecipes[index];
    if (!entry?.recipe || !user) return;

    try {
      // Upload the image first
      const path = `${user.id}/ai/${Date.now()}-${entry.file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("recipe-images")
        .upload(path, entry.file, { upsert: true, contentType: entry.file.type });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);

      const r = entry.recipe;
      const { error } = await supabase.from("meals").insert({
        user_id: user.id,
        title: r.title,
        description: r.description || null,
        calories: r.calories || 0,
        protein: r.protein || 0,
        carbs: r.carbs || 0,
        fats: r.fats || 0,
        prep_time: r.prep_time || null,
        cook_time: r.cook_time || null,
        servings: r.servings || 1,
        tags: r.tags || [],
        diet_tags: r.diet_tags || [],
        health_tags: r.health_tags || [],
        category: r.category || null,
        cuisine: r.cuisine || null,
        coach_notes: r.coach_notes || null,
        ingredients: r.ingredients || [],
        instructions: r.instructions || [],
        image_url: urlData.publicUrl,
        image_filename: entry.file.name,
        is_public: r.is_public ?? false,
      });

      if (error) throw error;

      setAiRecipes((prev) =>
        prev.map((rr, i) => (i === index ? { ...rr, status: "saved" as const } : rr))
      );
      toast.success(`"${r.title}" saved to Meal Vault!`);
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    }
  };

  const saveAllExtracted = async () => {
    setSavingAll(true);
    for (let i = 0; i < aiRecipes.length; i++) {
      if (aiRecipes[i].status === "extracted") {
        await saveExtractedRecipe(i);
      }
    }
    setSavingAll(false);
    toast.success("All extracted recipes saved!");
  };

  const importRecipes = async () => {
    if (!user || recipes.length === 0) return;
    setImporting(true);
    setImportProgress(0);
    const results: ImportResult[] = [];

    for (let i = 0; i < recipes.length; i++) {
      const r = recipes[i];
      try {
        const { data, error } = await supabase.from("meals").insert({
          user_id: user.id,
          title: r.title,
          description: r.description || null,
          calories: r.calories || 0,
          protein: r.protein || 0,
          carbs: r.carbs || 0,
          fats: r.fats || 0,
          prep_time: r.prep_time || null,
          cook_time: r.cook_time || null,
          servings: r.servings || 1,
          tags: r.tags || [],
          diet_tags: r.diet_tags || [],
          health_tags: r.health_tags || [],
          category: r.category || null,
          cuisine: r.cuisine || null,
          coach_notes: r.coach_notes || null,
          ingredients: r.ingredients || [],
          instructions: r.instructions || [],
          image_filename: r.image_filename || null,
          is_public: r.is_public ?? true,
        }).select("id").single();

        if (error) throw error;
        results.push({ title: r.title, status: "success", id: data.id });
      } catch (err: any) {
        results.push({ title: r.title, status: "error", message: err.message });
      }
      setImportProgress(Math.round(((i + 1) / recipes.length) * 100));
      setImportResults([...results]);
    }

    const successes = results.filter((r) => r.status === "success").length;
    toast.success(`Imported ${successes}/${recipes.length} recipes`);
    setImporting(false);
  };

  const uploadImages = async () => {
    if (imageFiles.length === 0) return;
    setUploadingImages(true);
    setImageProgress(0);
    const results: ImageUploadResult[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      try {
        const path = `${file.name}`;
        const { error } = await supabase.storage
          .from("recipe-images")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw error;

        const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
        const baseName = file.name;
        await supabase.from("meals").update({ image_url: urlData.publicUrl }).eq("image_filename", baseName);

        results.push({ filename: file.name, status: "success", url: urlData.publicUrl });
      } catch (err: any) {
        results.push({ filename: file.name, status: "error", message: err.message });
      }
      setImageProgress(Math.round(((i + 1) / imageFiles.length) * 100));
      setImageResults([...results]);
    }

    const successes = results.filter((r) => r.status === "success").length;
    toast.success(`Uploaded ${successes}/${imageFiles.length} images`);
    setUploadingImages(false);
  };

  const successCount = importResults.filter((r) => r.status === "success").length;
  const errorCount = importResults.filter((r) => r.status === "error").length;
  const imgSuccessCount = imageResults.filter((r) => r.status === "success").length;
  const imgErrorCount = imageResults.filter((r) => r.status === "error").length;

  const extractedCount = aiRecipes.filter((r) => r.status === "extracted").length;
  const savedCount = aiRecipes.filter((r) => r.status === "saved").length;
  const aiErrorCount = aiRecipes.filter((r) => r.status === "error").length;

  return (
    <div className="h-screen overflow-y-auto bg-background p-4 sm:p-8 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Import Recipes</h1>
          <p className="text-sm text-muted-foreground">Import via AI image scan, JSON, or batch upload</p>
        </div>
      </div>

      {/* AI Image Extraction — TOP */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" /> AI Recipe Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Upload recipe images (screenshots, photos, cards) and AI will extract all the details automatically.
          </p>

          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <input
              ref={aiImageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAiImageFiles}
            />
            <Sparkles className="h-10 w-10 mx-auto mb-3 text-primary/60" />
            <p className="text-sm text-muted-foreground mb-2">
              Drop recipe images or click to browse
            </p>
            <Button variant="outline" size="sm" onClick={() => aiImageInputRef.current?.click()}>
              <ImagePlus className="h-4 w-4 mr-1" /> Select Recipe Images
            </Button>
          </div>

          {aiRecipes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-medium">
                  {aiRecipes.length} image(s) • {extractedCount} extracted • {savedCount} saved
                  {aiErrorCount > 0 && <span className="text-destructive"> • {aiErrorCount} failed</span>}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAiRecipes([])}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Clear
                  </Button>
                  {aiRecipes.some((r) => r.status === "pending" || r.status === "error") && (
                    <Button size="sm" onClick={extractAllRecipes} disabled={extractingAll}>
                      {extractingAll ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-1" />
                      )}
                      Extract All
                    </Button>
                  )}
                  {extractedCount > 0 && (
                    <Button size="sm" onClick={saveAllExtracted} disabled={savingAll}>
                      {savingAll ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-1" />
                      )}
                      Save All to Vault
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {aiRecipes.map((entry, i) => (
                  <div
                    key={i}
                    className="border rounded-lg p-3 bg-muted/20 space-y-2"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={entry.previewUrl}
                        alt="Recipe"
                        className="w-14 h-14 object-cover rounded-md shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {entry.recipe?.title || entry.file.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {entry.status === "pending" && (
                            <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                          )}
                          {entry.status === "extracting" && (
                            <Badge variant="secondary" className="text-[10px]">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Extracting…
                            </Badge>
                          )}
                          {entry.status === "extracted" && (
                            <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Extracted
                            </Badge>
                          )}
                          {entry.status === "saved" && (
                            <Badge className="text-[10px] bg-success/20 text-success border-success/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Saved
                            </Badge>
                          )}
                          {entry.status === "error" && (
                            <Badge variant="destructive" className="text-[10px]">
                              <XCircle className="h-3 w-3 mr-1" /> {entry.error || "Error"}
                            </Badge>
                          )}
                          {entry.recipe?.calories && (
                            <Badge variant="outline" className="text-[10px]">{entry.recipe.calories} cal</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {entry.status === "extracted" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Preview"
                              onClick={() => {
                                setEditingIndex(null);
                                setExpandedIndex(expandedIndex === i ? null : i);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Edit"
                              onClick={() => {
                                setExpandedIndex(null);
                                setEditingIndex(editingIndex === i ? null : i);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              className="h-8"
                              onClick={() => saveExtractedRecipe(i)}
                            >
                              Save
                            </Button>
                          </>
                        )}
                        {(entry.status === "pending" || entry.status === "error") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => extractSingleRecipe(i)}
                          >
                            <Sparkles className="h-3 w-3 mr-1" /> Extract
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Read-only preview */}
                    {expandedIndex === i && entry.recipe && (
                      <div className="text-xs border-t pt-2 space-y-1">
                        {entry.recipe.description && (
                          <p className="text-muted-foreground">{entry.recipe.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {entry.recipe.protein != null && <span>Protein: {entry.recipe.protein}g</span>}
                          {entry.recipe.carbs != null && <span>Carbs: {entry.recipe.carbs}g</span>}
                          {entry.recipe.fats != null && <span>Fat: {entry.recipe.fats}g</span>}
                          {entry.recipe.servings && <span>Servings: {entry.recipe.servings}</span>}
                          {entry.recipe.prep_time && <span>Prep: {entry.recipe.prep_time}m</span>}
                          {entry.recipe.cook_time && <span>Cook: {entry.recipe.cook_time}m</span>}
                        </div>
                        {entry.recipe.ingredients && entry.recipe.ingredients.length > 0 && (
                          <div>
                            <strong>Ingredients:</strong>
                            <ul className="list-disc pl-4 mt-0.5">
                              {entry.recipe.ingredients.map((ing, j) => (
                                <li key={j}>{ing}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {entry.recipe.instructions && entry.recipe.instructions.length > 0 && (
                          <div>
                            <strong>Instructions:</strong>
                            <ol className="list-decimal pl-4 mt-0.5">
                              {entry.recipe.instructions.map((step, j) => (
                                <li key={j}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Editable form */}
                    {editingIndex === i && entry.recipe && (
                      <div className="border-t pt-3 space-y-3 text-sm">
                        <div className="grid gap-2">
                          <Label className="text-xs">Title</Label>
                          <Input
                            value={entry.recipe.title || ""}
                            onChange={(e) => updateRecipeField(i, "title", e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-xs">Description</Label>
                          <Textarea
                            value={entry.recipe.description || ""}
                            onChange={(e) => updateRecipeField(i, "description", e.target.value)}
                            className="text-sm min-h-[60px]"
                            rows={2}
                          />
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          <div>
                            <Label className="text-[10px]">Calories</Label>
                            <Input type="number" className="h-7 text-xs" value={entry.recipe.calories ?? ""} onChange={(e) => updateRecipeField(i, "calories", e.target.value ? Number(e.target.value) : null)} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Protein (g)</Label>
                            <Input type="number" className="h-7 text-xs" value={entry.recipe.protein ?? ""} onChange={(e) => updateRecipeField(i, "protein", e.target.value ? Number(e.target.value) : null)} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Carbs (g)</Label>
                            <Input type="number" className="h-7 text-xs" value={entry.recipe.carbs ?? ""} onChange={(e) => updateRecipeField(i, "carbs", e.target.value ? Number(e.target.value) : null)} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Fat (g)</Label>
                            <Input type="number" className="h-7 text-xs" value={entry.recipe.fats ?? ""} onChange={(e) => updateRecipeField(i, "fats", e.target.value ? Number(e.target.value) : null)} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Prep (min)</Label>
                            <Input type="number" className="h-7 text-xs" value={entry.recipe.prep_time ?? ""} onChange={(e) => updateRecipeField(i, "prep_time", e.target.value ? Number(e.target.value) : null)} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Cook (min)</Label>
                            <Input type="number" className="h-7 text-xs" value={entry.recipe.cook_time ?? ""} onChange={(e) => updateRecipeField(i, "cook_time", e.target.value ? Number(e.target.value) : null)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px]">Servings</Label>
                            <Input type="number" className="h-7 text-xs" value={entry.recipe.servings ?? ""} onChange={(e) => updateRecipeField(i, "servings", e.target.value ? Number(e.target.value) : null)} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Category</Label>
                            <Input className="h-7 text-xs" value={entry.recipe.category || ""} onChange={(e) => updateRecipeField(i, "category", e.target.value || null)} placeholder="e.g. lunch" />
                          </div>
                          <div>
                            <Label className="text-[10px]">Cuisine</Label>
                            <Input className="h-7 text-xs" value={entry.recipe.cuisine || ""} onChange={(e) => updateRecipeField(i, "cuisine", e.target.value || null)} placeholder="e.g. italian" />
                          </div>
                        </div>

                        {/* Ingredients editor */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Ingredients</Label>
                            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => addIngredient(i)}>
                              <Plus className="h-3 w-3 mr-1" /> Add
                            </Button>
                          </div>
                          {(entry.recipe.ingredients || []).map((ing, j) => (
                            <div key={j} className="flex gap-1">
                              <Input
                                className="h-7 text-xs flex-1"
                                value={ing}
                                onChange={(e) => updateIngredient(i, j, e.target.value)}
                              />
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeIngredient(i, j)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        {/* Instructions editor */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Instructions</Label>
                            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => addInstruction(i)}>
                              <Plus className="h-3 w-3 mr-1" /> Add Step
                            </Button>
                          </div>
                          {(entry.recipe.instructions || []).map((step, j) => (
                            <div key={j} className="flex gap-1 items-start">
                              <span className="text-xs text-muted-foreground mt-1.5 w-5 text-right shrink-0">{j + 1}.</span>
                              <Textarea
                                className="text-xs flex-1 min-h-[28px]"
                                rows={1}
                                value={step}
                                onChange={(e) => updateInstruction(i, j, e.target.value)}
                              />
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeInstruction(i, j)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <div className="grid gap-2">
                          <Label className="text-xs">Coach Notes</Label>
                          <Textarea
                            value={entry.recipe.coach_notes || ""}
                            onChange={(e) => updateRecipeField(i, "coach_notes", e.target.value || null)}
                            className="text-sm min-h-[40px]"
                            rows={1}
                            placeholder="Optional notes..."
                          />
                        </div>

                        <div className="flex justify-end">
                          <Button size="sm" onClick={() => setEditingIndex(null)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Done Editing
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* JSON Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileJson className="h-5 w-5 text-primary" /> JSON Recipe Import
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <input ref={jsonInputRef} type="file" accept=".json" className="hidden" onChange={handleJsonFile} />
            <FileJson className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              {jsonFileName ? jsonFileName : "Drop a JSON file or click to browse"}
            </p>
            <Button variant="outline" size="sm" onClick={() => jsonInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Select JSON File
            </Button>
          </div>

          {recipes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{recipes.length} recipe(s) loaded</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setRecipes([]); setJsonFileName(""); setImportResults([]); }}>
                    <Trash2 className="h-4 w-4 mr-1" /> Clear
                  </Button>
                  <Button size="sm" onClick={importRecipes} disabled={importing}>
                    {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    Import {recipes.length} Recipes
                  </Button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 text-xs border rounded-lg p-3 bg-muted/30">
                {recipes.slice(0, 20).map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-muted-foreground w-6 text-right">{i + 1}.</span>
                    <span className="font-medium">{r.title}</span>
                    {r.calories && <Badge variant="secondary" className="text-[10px]">{r.calories} cal</Badge>}
                    {r.image_filename && <Badge variant="outline" className="text-[10px]">📷 {r.image_filename}</Badge>}
                  </div>
                ))}
                {recipes.length > 20 && <p className="text-muted-foreground pl-8">...and {recipes.length - 20} more</p>}
              </div>

              {importing && (
                <div className="space-y-2">
                  <Progress value={importProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">{importProgress}% complete</p>
                </div>
              )}

              {importResults.length > 0 && !importing && (
                <div className="space-y-2">
                  <div className="flex gap-3 text-sm">
                    {successCount > 0 && (
                      <span className="flex items-center gap-1 text-primary"><CheckCircle2 className="h-4 w-4" /> {successCount} imported</span>
                    )}
                    {errorCount > 0 && (
                      <span className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" /> {errorCount} failed</span>
                    )}
                  </div>
                  {errorCount > 0 && (
                    <div className="max-h-32 overflow-y-auto text-xs space-y-1 border rounded p-2">
                      {importResults.filter((r) => r.status === "error").map((r, i) => (
                        <div key={i} className="flex items-start gap-2 text-destructive">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span><strong>{r.title}:</strong> {r.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Expected JSON format</summary>
            <pre className="mt-2 p-3 bg-muted rounded-lg overflow-x-auto">
{`[
  {
    "title": "Grilled Chicken Bowl",
    "description": "High protein chicken with quinoa",
    "calories": 520,
    "protein": 45,
    "carbs": 48,
    "fats": 14,
    "prep_time": 15,
    "cook_time": 20,
    "servings": 1,
    "tags": ["high-protein", "meal-prep"],
    "diet_tags": ["gluten-free"],
    "category": "lunch",
    "cuisine": "american",
    "ingredients": ["2 chicken breasts", "1 cup quinoa"],
    "instructions": ["Season chicken", "Grill 6min per side"],
    "image_filename": "grilled-chicken.jpg",
    "is_public": true
  }
]`}
            </pre>
          </details>
        </CardContent>
      </Card>

      {/* Image Batch Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImagePlus className="h-5 w-5 text-primary" /> Batch Image Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Upload images that match the <code className="bg-muted px-1 rounded">image_filename</code> field in your recipes.
          </p>

          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageFiles} />
            <ImagePlus className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              {imageFiles.length > 0 ? `${imageFiles.length} image(s) selected` : "Select multiple images"}
            </p>
            <Button variant="outline" size="sm" onClick={() => imageInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Select Images
            </Button>
          </div>

          {imageFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{imageFiles.length} image(s) ready</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setImageFiles([]); setImageResults([]); }}>
                    <Trash2 className="h-4 w-4 mr-1" /> Clear
                  </Button>
                  <Button size="sm" onClick={uploadImages} disabled={uploadingImages}>
                    {uploadingImages ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    Upload {imageFiles.length} Images
                  </Button>
                </div>
              </div>

              <div className="max-h-32 overflow-y-auto text-xs space-y-1 border rounded-lg p-3 bg-muted/30">
                {imageFiles.slice(0, 20).map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-muted-foreground w-6 text-right">{i + 1}.</span>
                    <span>{f.name}</span>
                    <span className="text-muted-foreground">({(f.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ))}
                {imageFiles.length > 20 && <p className="text-muted-foreground pl-8">...and {imageFiles.length - 20} more</p>}
              </div>

              {uploadingImages && (
                <div className="space-y-2">
                  <Progress value={imageProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">{imageProgress}% complete</p>
                </div>
              )}

              {imageResults.length > 0 && !uploadingImages && (
                <div className="flex gap-3 text-sm">
                  {imgSuccessCount > 0 && (
                    <span className="flex items-center gap-1 text-primary"><CheckCircle2 className="h-4 w-4" /> {imgSuccessCount} uploaded</span>
                  )}
                  {imgErrorCount > 0 && (
                    <span className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" /> {imgErrorCount} failed</span>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
