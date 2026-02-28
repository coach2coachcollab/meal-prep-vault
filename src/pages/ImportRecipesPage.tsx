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
  ArrowLeft, AlertTriangle, Trash2,
} from "lucide-react";
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

export default function ImportRecipesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [recipes, setRecipes] = useState<RecipeJson[]>([]);
  const [jsonFileName, setJsonFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importProgress, setImportProgress] = useState(0);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageResults, setImageResults] = useState<ImageUploadResult[]>([]);
  const [imageProgress, setImageProgress] = useState(0);

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
        const ext = file.name.split(".").pop();
        const path = `${file.name}`;
        const { error } = await supabase.storage
          .from("recipe-images")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw error;

        const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);

        // Update any meal with matching image_filename
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

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Import Recipes</h1>
          <p className="text-sm text-muted-foreground">Bulk import recipes via JSON and upload images</p>
        </div>
      </div>

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

              {/* Preview */}
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

              {/* Progress */}
              {importing && (
                <div className="space-y-2">
                  <Progress value={importProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">{importProgress}% complete</p>
                </div>
              )}

              {/* Results */}
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

          {/* JSON format reference */}
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
            Upload images that match the <code className="bg-muted px-1 rounded">image_filename</code> field in your recipes. Matching meals will be auto-linked.
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
  );
}
