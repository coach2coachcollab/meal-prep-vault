import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, LogOut, Moon, Sun, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "sonner";

export function UserProfile() {
  const { user, signOut } = useAuth();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [useMetric, setUseMetric] = useState(true);
  const { isDark: darkMode, toggle: toggleDarkMode } = useTheme();
  const [profileData, setProfileData] = useState<{
    goal?: string;
    activity_level?: string;
    diet_prefs?: string[];
    allergies?: string[];
    age?: number;
    height_cm?: number;
    weight_kg?: number;
  }>({});
  const [loading, setLoading] = useState(false);

  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weight, setWeight] = useState("");

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  useEffect(() => {
    if (profileData.height_cm != null) {
      if (useMetric) {
        setHeight(String(profileData.height_cm));
      } else {
        const totalIn = profileData.height_cm / 2.54;
        setHeightFt(String(Math.floor(totalIn / 12)));
        setHeightIn(String(Math.round(totalIn % 12)));
      }
    }
    if (profileData.weight_kg != null) {
      setWeight(useMetric ? String(profileData.weight_kg) : String(Math.round(profileData.weight_kg * 2.20462)));
    }
  }, [useMetric, profileData.height_cm, profileData.weight_kg]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("name, avatar_url, goal, activity_level, diet_prefs, allergies, age, height_cm, weight_kg")
      .eq("user_id", user.id)
      .single();
    if (data) {
      if (data.name) setName(data.name);
      if (data.avatar_url) setAvatarUrl(data.avatar_url);
      if (data.age) setAge(String(data.age));
      const savedUnits = localStorage.getItem(`preferred_units_${user.id}`);
      if (savedUnits) setUseMetric(savedUnits === "metric");
      setProfileData(data);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("recipe-images")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      toast.error("Failed to upload avatar");
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from("profiles").update({ avatar_url: newUrl }).eq("user_id", user.id);
    setAvatarUrl(newUrl);
    setUploadingAvatar(false);
    toast.success("Avatar updated!");
  };

  const saveProfile = async () => {
    if (!user) return;
    setLoading(true);

    let height_cm = profileData.height_cm;
    let weight_kg = profileData.weight_kg;

    if (useMetric) {
      if (height) height_cm = parseFloat(height);
      if (weight) weight_kg = parseFloat(weight);
    } else {
      if (heightFt || heightIn) height_cm = Math.round(((parseFloat(heightFt) || 0) * 12 + (parseFloat(heightIn) || 0)) * 2.54);
      if (weight) weight_kg = Math.round(parseFloat(weight) / 2.20462 * 10) / 10;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        name,
        age: parseInt(age) || null,
        height_cm: height_cm || null,
        weight_kg: weight_kg || null,
        preferred_units: useMetric ? "metric" : "imperial",
      } as any)
      .eq("user_id", user.id);
    if (user) localStorage.setItem(`preferred_units_${user.id}`, useMetric ? "metric" : "imperial");
    setLoading(false);
    if (error) toast.error("Failed to save");
    else {
      toast.success("Profile updated!");
      setProfileData((prev) => ({ ...prev, age: parseInt(age) || undefined, height_cm: height_cm || undefined, weight_kg: weight_kg || undefined }));
    }
  };

  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-16 w-16">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="h-5 w-5 text-white" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div>
              <p className="font-medium">{name || "Set your name"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <button
                onClick={() => fileRef.current?.click()}
                className="text-xs text-primary hover:underline mt-0.5"
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? "Uploading..." : "Change photo"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Units</Label>
            <div className="flex gap-1 bg-muted rounded-lg p-0.5 text-xs">
              <button onClick={() => setUseMetric(true)} className={`px-3 py-1 rounded-md transition-colors ${useMetric ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>kg / cm</button>
              <button onClick={() => setUseMetric(false)} className={`px-3 py-1 rounded-md transition-colors ${!useMetric ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>lbs / ft</button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Theme</Label>
            <div className="flex gap-1 bg-muted rounded-lg p-0.5 text-xs">
              <button onClick={() => { if (darkMode) toggleDarkMode(); }} className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${!darkMode ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
                <Sun className="h-3 w-3" /> Light
              </button>
              <button onClick={() => { if (!darkMode) toggleDarkMode(); }} className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${darkMode ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
                <Moon className="h-3 w-3" /> Dark
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Age</Label>
              <Input type="number" placeholder="25" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            {useMetric ? (
              <div className="space-y-1">
                <Label className="text-xs">Height (cm)</Label>
                <Input type="number" placeholder="170" value={height} onChange={(e) => setHeight(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Height (ft/in)</Label>
                <div className="flex gap-1">
                  <Input type="number" placeholder="5" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} className="w-1/2" />
                  <Input type="number" placeholder="7" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} className="w-1/2" />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Weight ({useMetric ? "kg" : "lbs"})</Label>
              <Input type="number" placeholder={useMetric ? "70" : "154"} value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
          </div>

          <Button onClick={saveProfile} disabled={loading} className="w-full">
            <Save className="h-4 w-4 mr-1" />
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {profileData.goal && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-section-label font-semibold">Your Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-section-label">Goal</span>
              <span className="font-medium">{profileData.goal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Activity</span>
              <span className="font-medium capitalize">{profileData.activity_level}</span>
            </div>
            {profileData.age && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stats</span>
                <span className="font-medium">
                  {profileData.age}yr · {useMetric
                    ? `${profileData.height_cm}cm · ${profileData.weight_kg}kg`
                    : `${Math.floor((profileData.height_cm || 0) / 2.54 / 12)}′${Math.round((profileData.height_cm || 0) / 2.54 % 12)}″ · ${Math.round((profileData.weight_kg || 0) * 2.20462)}lbs`
                  }
                </span>
              </div>
            )}
            {profileData.diet_prefs && profileData.diet_prefs.length > 0 && (
              <div>
                <span className="text-muted-foreground text-xs">Diet Preferences</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profileData.diet_prefs.map((d) => <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Button variant="outline" className="w-full" onClick={signOut}>
        <LogOut className="h-4 w-4 mr-1" /> Sign Out
      </Button>
    </div>
  );
}
