import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Heart, ArrowLeft, Clock, Users, Star, ShoppingCart, MessageCircle, Share2, Send, MoreHorizontal, Pencil, Trash2, X, Check, ImagePlus, Instagram, Globe, Download, Loader2, Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useRef } from "react";
import { generateStoryCard } from "@/lib/story-card-generator";

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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("ingredients");
  const [userRating, setUserRating] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [selectedIngredients, setSelectedIngredients] = useState<Set<number>>(new Set());
  const [addingToList, setAddingToList] = useState(false);
  const [isPublic, setIsPublic] = useState(!!meal.is_public);

  // Community state
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [shareText, setShareText] = useState("");
  const [sharing, setSharing] = useState(false);
  const [showShareForm, setShowShareForm] = useState(false);
  const [shareMode, setShareMode] = useState<"community" | "social">("community");
  const [sharePhoto, setSharePhoto] = useState<File | null>(null);
  const [sharePhotoPreview, setSharePhotoPreview] = useState<string | null>(null);
  const shareFileRef = useRef<HTMLInputElement>(null);
  const [storyCardBlob, setStoryCardBlob] = useState<Blob | null>(null);
  const [storyCardUrl, setStoryCardUrl] = useState<string | null>(null);
  const [generatingCard, setGeneratingCard] = useState(false);

  const ingredientsList: string[] = Array.isArray(meal.ingredients) ? meal.ingredients : [];
  const instructionsList: string[] = Array.isArray(meal.instructions) ? meal.instructions : [];
  const totalTime = (meal.prep_time || 0) + (meal.cook_time || 0);

  const allTags = [
    ...(meal.tags || []),
    ...(meal.diet_tags || []),
    ...(meal.health_tags || []),
  ];

  useEffect(() => {
    loadRatings();
    loadComments();
  }, [meal.id, user]);

  const loadRatings = async () => {
    // Load average rating
    const { data: allRatings } = await supabase
      .from("meal_ratings")
      .select("rating")
      .eq("meal_id", meal.id);

    if (allRatings && allRatings.length > 0) {
      const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
      setAvgRating(Math.round(avg * 10) / 10);
      setRatingCount(allRatings.length);
    }

    // Load user's rating
    if (user) {
      const { data: myRating } = await supabase
        .from("meal_ratings")
        .select("rating")
        .eq("meal_id", meal.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (myRating) setUserRating(myRating.rating);
    }
  };

  // Community functions
  const loadComments = async () => {
    const { data } = await supabase
      .from("post_comments")
      .select("*, profiles:profiles!post_comments_user_id_fkey1(name)")
      .eq("post_id", meal.id)
      .order("created_at", { ascending: true });

    // Fallback: load comments from posts that reference this recipe
    const { data: recipePosts } = await supabase
      .from("community_posts")
      .select("id")
      .eq("recipe_id", meal.id);

    if (recipePosts && recipePosts.length > 0) {
      const postIds = recipePosts.map((p) => p.id);
      const { data: postComments } = await supabase
        .from("post_comments")
        .select("*")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });

      // Get user names for comments
      if (postComments && postComments.length > 0) {
        const userIds = [...new Set(postComments.map((c) => c.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, name")
          .in("user_id", userIds);

        const nameMap = new Map(profiles?.map((p) => [p.user_id, p.name]) || []);
        setComments(
          postComments.map((c) => ({
            ...c,
            user_name: nameMap.get(c.user_id) || "User",
          }))
        );
        return;
      }
    }
    setComments([]);
  };

  const handleAddComment = async () => {
    if (!user || !newComment.trim()) return;

    // Find or create a community post for this recipe
    let { data: existingPost } = await supabase
      .from("community_posts")
      .select("id")
      .eq("recipe_id", meal.id)
      .limit(1)
      .maybeSingle();

    if (!existingPost) {
      const { data: newPost, error: postErr } = await supabase
        .from("community_posts")
        .insert({
          user_id: user.id,
          channel: "meals",
          text: `💬 Discussion on "${meal.title}"`,
          recipe_id: meal.id,
          image_url: meal.image_url,
        })
        .select("id")
        .single();
      if (postErr) {
        toast.error("Failed to add comment");
        return;
      }
      existingPost = newPost;
    }

    const { error } = await supabase.from("post_comments").insert({
      post_id: existingPost!.id,
      user_id: user.id,
      text: newComment.trim(),
    });

    if (error) {
      toast.error("Failed to add comment");
    } else {
      setNewComment("");
      loadComments();
    }
  };

  const handleEditComment = async (commentId: string, text: string) => {
    const { error } = await supabase
      .from("post_comments")
      .update({ text })
      .eq("id", commentId);
    if (!error) loadComments();
    setEditingId(null);
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from("post_comments")
      .delete()
      .eq("id", commentId);
    if (!error) loadComments();
  };

  const handleSharePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setSharePhoto(file);
    setSharePhotoPreview(URL.createObjectURL(file));
  };

  const removeSharePhoto = () => {
    setSharePhoto(null);
    setSharePhotoPreview(null);
    if (shareFileRef.current) shareFileRef.current.value = "";
  };

  const handleShareToCommunity = async () => {
    if (!user || !shareText.trim()) return;
    setSharing(true);

    let imageUrl = meal.image_url;

    // Upload optional photo
    if (sharePhoto) {
      const ext = sharePhoto.name.split(".").pop();
      const path = `community/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("recipe-images")
        .upload(path, sharePhoto, { contentType: sharePhoto.type });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from("community_posts").insert({
      user_id: user.id,
      channel: "meals",
      text: shareText.trim(),
      recipe_id: meal.id,
      image_url: imageUrl,
    });
    if (error) {
      toast.error("Failed to share");
    } else {
      toast.success("Shared to community!");
      setShareText("");
      removeSharePhoto();
      setShowShareForm(false);
      loadComments();
    }
    setSharing(false);
  };

  const handleGenerateStoryCard = async () => {
    setGeneratingCard(true);
    try {
      const blob = await generateStoryCard({
        title: meal.title,
        imageUrl: sharePhoto ? sharePhotoPreview : meal.image_url,
        calories: meal.calories || 0,
        protein: meal.protein || 0,
        carbs: meal.carbs || 0,
        fats: meal.fats || 0,
        prepTime: (meal.prep_time || 0) + (meal.cook_time || 0),
        servings: meal.servings || 1,
        caption: shareText.trim() || undefined,
      });
      setStoryCardBlob(blob);
      setStoryCardUrl(URL.createObjectURL(blob));
    } catch {
      toast.error("Failed to generate story card");
    }
    setGeneratingCard(false);
  };

  const handleDownloadStoryCard = () => {
    if (!storyCardUrl) return;
    const a = document.createElement("a");
    a.href = storyCardUrl;
    a.download = `${meal.title.replace(/\s+/g, "-").toLowerCase()}-story.png`;
    a.click();
    toast.success("Story card downloaded!");
  };

  const handleShareToSocial = async () => {
    // Generate story card first if not already generated
    let blob = storyCardBlob;
    if (!blob) {
      setGeneratingCard(true);
      try {
        blob = await generateStoryCard({
          title: meal.title,
          imageUrl: sharePhoto ? sharePhotoPreview : meal.image_url,
          calories: meal.calories || 0,
          protein: meal.protein || 0,
          carbs: meal.carbs || 0,
          fats: meal.fats || 0,
          prepTime: (meal.prep_time || 0) + (meal.cook_time || 0),
          servings: meal.servings || 1,
          caption: shareText.trim() || undefined,
        });
      } catch {
        toast.error("Failed to generate story card");
        setGeneratingCard(false);
        return;
      }
      setGeneratingCard(false);
    }

    const file = new File([blob], "recipe-story.png", { type: "image/png" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: meal.title,
          text: shareText.trim() || `Check out this recipe: "${meal.title}" 🍽️`,
        });
        toast.success("Shared!");
        setShareText("");
        removeSharePhoto();
        setStoryCardBlob(null);
        setStoryCardUrl(null);
        setShowShareForm(false);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          // Fallback to download
          handleDownloadStoryCard();
        }
      }
    } else {
      // Fallback: download the story card
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${meal.title.replace(/\s+/g, "-").toLowerCase()}-story.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Story card downloaded! Share it to your favorite platform.");
      setShowShareForm(false);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleRate = async (rating: number) => {
    if (!user) {
      toast.error("Please log in to rate recipes");
      return;
    }

    const prev = userRating;
    setUserRating(rating);

    const { error } = await supabase
      .from("meal_ratings")
      .upsert(
        { meal_id: meal.id, user_id: user.id, rating },
        { onConflict: "meal_id,user_id" }
      );

    if (error) {
      setUserRating(prev);
      toast.error("Failed to save rating");
    } else {
      toast.success(`Rated ${rating} star${rating > 1 ? "s" : ""}`);
      loadRatings();
    }
  };

  const toggleIngredient = (index: number) => {
    setSelectedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAllIngredients = () => {
    if (selectedIngredients.size === ingredientsList.length) {
      setSelectedIngredients(new Set());
    } else {
      setSelectedIngredients(new Set(ingredientsList.map((_, i) => i)));
    }
  };

  const addToShoppingList = async () => {
    if (!user || selectedIngredients.size === 0) return;
    setAddingToList(true);
    try {
      let { data: list } = await supabase
        .from("grocery_lists")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!list) {
        const { data: newList, error } = await supabase
          .from("grocery_lists")
          .insert({ user_id: user.id, name: "My Grocery List" })
          .select("id")
          .single();
        if (error) throw error;
        list = newList;
      }

      const items = Array.from(selectedIngredients).map((i) => ({
        grocery_list_id: list!.id,
        ingredient: ingredientsList[i],
        is_checked: false,
      }));

      const { error } = await supabase.from("grocery_list_items").insert(items);
      if (error) throw error;

      toast.success(`Added ${items.length} item${items.length > 1 ? "s" : ""} to shopping list`);
      setSelectedIngredients(new Set());
    } catch (e) {
      toast.error("Failed to add items");
    } finally {
      setAddingToList(false);
    }
  };

  return (
    <div className="space-y-4 animate-in slide-in-from-right-5 duration-300">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to Meals
      </Button>

      {/* Hero: Image + Nutrition side by side */}
      <Card>
        <CardContent className="p-0">
          <div className="flex">
            {/* Image */}
            <div className="w-2/5 shrink-0">
              {meal.image_url ? (
                <img
                  src={meal.image_url}
                  alt={meal.title}
                  className="h-full w-full object-cover rounded-l-lg min-h-[180px]"
                />
              ) : (
                <div className="h-full w-full min-h-[180px] bg-muted rounded-l-lg flex items-center justify-center">
                  <span className="text-muted-foreground text-xs">No image</span>
                </div>
              )}
            </div>

            {/* Right: title + macros */}
            <div className="flex-1 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-bold leading-tight">{meal.title}</h2>
                  <Button variant="ghost" size="icon" className="shrink-0 -mt-1 -mr-2 h-8 w-8" onClick={onToggleFavorite}>
                    <Heart className={`h-4 w-4 ${isFavorite ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                  </Button>
                </div>
                {meal.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{meal.description}</p>
                )}
              </div>

              {/* Macro grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3">
                <div>
                  <p className="text-base font-bold">{meal.calories || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Calories</p>
                </div>
                <div>
                  <p className="text-base font-bold">{meal.protein || 0}g</p>
                  <p className="text-[10px] text-muted-foreground">Protein</p>
                </div>
                <div>
                  <p className="text-base font-bold">{meal.carbs || 0}g</p>
                  <p className="text-[10px] text-muted-foreground">Carbs</p>
                </div>
                <div>
                  <p className="text-base font-bold">{meal.fats || 0}g</p>
                  <p className="text-[10px] text-muted-foreground">Fats</p>
                </div>
              </div>

              {/* Star rating */}
              <div className="flex items-center gap-1 mt-3">
                <div className="flex gap-0.5" onMouseLeave={() => setHoveredStar(0)}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleRate(s)}
                      onMouseEnter={() => setHoveredStar(s)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-4 w-4 transition-colors ${
                          s <= (hoveredStar || userRating)
                            ? "fill-primary text-primary"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {ratingCount > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-1">
                    {avgRating} ({ratingCount})
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recipe Details: Prep Time, Servings, Visibility, Tags */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">{totalTime > 0 ? `${totalTime} min` : "—"}</p>
                <p className="text-[10px] text-muted-foreground">Total Time</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">{meal.servings || 1}</p>
                <p className="text-[10px] text-muted-foreground">Servings</p>
              </div>
            </div>
            {meal.user_id === user?.id && (
              <div className="flex items-center gap-1.5 ml-auto">
                {isPublic ? <Globe className="h-3.5 w-3.5 text-primary" /> : <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                <p className="text-[10px] text-muted-foreground">{isPublic ? "Public" : "Private"}</p>
              </div>
            )}
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {allTags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs: Ingredients / Instructions / Grocery List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="ingredients" className="text-xs">Ingredients</TabsTrigger>
          <TabsTrigger value="instructions" className="text-xs">Steps</TabsTrigger>
          <TabsTrigger value="grocery" className="text-xs">Grocery</TabsTrigger>
          <TabsTrigger value="community" className="text-xs gap-1">
            <MessageCircle className="h-3 w-3" /> Chat
          </TabsTrigger>
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
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">
                  {meal.servings || 1} serving{(meal.servings || 1) > 1 ? "s" : ""} · {selectedIngredients.size} selected
                </p>
                {ingredientsList.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAllIngredients}>
                    {selectedIngredients.size === ingredientsList.length ? "Deselect all" : "Select all"}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {ingredientsList.length > 0 ? ingredientsList.map((item, i) => (
                  <label key={i} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={selectedIngredients.has(i)}
                      onCheckedChange={() => toggleIngredient(i)}
                    />
                    <span className="text-sm">{item}</span>
                  </label>
                )) : (
                  <p className="text-sm text-muted-foreground">No items</p>
                )}
              </div>
              {ingredientsList.length > 0 && (
                <Button
                  className="w-full mt-4 gap-2"
                  variant="default"
                  disabled={selectedIngredients.size === 0 || addingToList}
                  onClick={addToShoppingList}
                >
                  <ShoppingCart className="h-4 w-4" />
                  {addingToList ? "Adding..." : `Add ${selectedIngredients.size > 0 ? selectedIngredients.size : ""} to Shopping List`}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Community Tab */}
        <TabsContent value="community">
          <Card>
            <CardContent className="pt-5 space-y-4">
              {/* Comments Header + Share icon */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  Comments ({comments.length})
                </p>
                <div className="flex items-center gap-1">
                  {!showShareForm && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setShowShareForm(true);
                        setShareText(`Check out this recipe: "${meal.title}" 🍽️`);
                      }}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Share form (expandable) */}
              {showShareForm && (
                <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
                  {/* Share mode toggle */}
                  <div className="flex gap-2">
                    <Button
                      variant={shareMode === "community" ? "default" : "outline"}
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => setShareMode("community")}
                    >
                      <Globe className="h-3 w-3" /> Community
                    </Button>
                    <Button
                      variant={shareMode === "social" ? "default" : "outline"}
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => { setShareMode("social"); setStoryCardBlob(null); setStoryCardUrl(null); }}
                    >
                      <Instagram className="h-3 w-3" /> Social Story
                    </Button>
                  </div>

                  <Textarea
                    value={shareText}
                    onChange={(e) => { setShareText(e.target.value); setStoryCardBlob(null); setStoryCardUrl(null); }}
                    rows={2}
                    placeholder={shareMode === "community" ? "Say something about this recipe..." : "Add a caption for your story card..."}
                    className="text-sm"
                  />

                  {/* Photo upload preview */}
                  {sharePhotoPreview && (
                    <div className="relative">
                      <img src={sharePhotoPreview} alt="Preview" className="w-full max-h-32 object-cover rounded-lg" />
                      <Button size="icon" variant="secondary" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => { removeSharePhoto(); setStoryCardBlob(null); setStoryCardUrl(null); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {/* Story card preview */}
                  {shareMode === "social" && storyCardUrl && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Story Card Preview</p>
                      <img src={storyCardUrl} alt="Story card preview" className="w-full max-h-64 object-contain rounded-lg border border-border" />
                    </div>
                  )}

                  <input ref={shareFileRef} type="file" accept="image/*" className="hidden" onChange={handleSharePhoto} />

                  <div className="flex gap-2 flex-wrap">
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => shareFileRef.current?.click()}>
                      <ImagePlus className="h-3 w-3" /> Photo
                    </Button>


                    {shareMode === "social" && storyCardUrl && (
                      <Button variant="outline" size="sm" className="gap-1" onClick={handleDownloadStoryCard}>
                        <Download className="h-3 w-3" /> Save
                      </Button>
                    )}

                    <div className="flex-1" />
                    <Button variant="ghost" size="sm" onClick={() => { setShowShareForm(false); removeSharePhoto(); setStoryCardBlob(null); setStoryCardUrl(null); }}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={shareMode === "community" ? handleShareToCommunity : handleShareToSocial}
                      disabled={sharing || generatingCard || (shareMode === "community" && !shareText.trim())}
                    >
                      {shareMode === "community" ? <Share2 className="h-3 w-3" /> : <Instagram className="h-3 w-3" />}
                      {sharing ? "Sharing..." : shareMode === "community" ? "Share" : "Share Story"}
                    </Button>
                  </div>
                </div>
              )}

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2 group">
                      <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                        <AvatarFallback className="text-[10px] bg-icon-bg font-medium">
                          {initials(c.user_name || "U")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="bg-muted/50 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{c.user_name}</span>
                            <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                            {c.user_id === user?.id && editingId !== c.id && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setEditingId(c.id); setEditText(c.text); }}>
                                    <Pencil className="h-3 w-3 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteComment(c.id)}>
                                    <Trash2 className="h-3 w-3 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          {editingId === c.id ? (
                            <div className="flex gap-1 mt-1">
                              <Input value={editText} onChange={(e) => setEditText(e.target.value)} className="h-7 text-sm" onKeyDown={(e) => e.key === "Enter" && handleEditComment(c.id, editText)} />
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                              <Button size="icon" className="h-7 w-7" onClick={() => handleEditComment(c.id, editText)}><Check className="h-3 w-3" /></Button>
                            </div>
                          ) : (
                            <p className="text-sm">{c.text}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <div className="text-center py-6">
                      <MessageCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No comments yet. Be the first!</p>
                    </div>
                  )}
                </div>

                {/* Add Comment Input */}
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    className="flex-1"
                  />
                  <Button size="icon" onClick={handleAddComment} disabled={!newComment.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
