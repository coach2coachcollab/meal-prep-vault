import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Save, LogOut, Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function UserProfile() {
  const { user, signOut } = useAuth();
  const [name, setName] = useState("");
  const [useMetric, setUseMetric] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") return document.documentElement.classList.contains("dark");
    return false;
  });
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

  // Editable body stats
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weight, setWeight] = useState("");

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  useEffect(() => {
    // When toggling units, convert displayed values
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
      .select("name, goal, activity_level, diet_prefs, allergies, age, height_cm, weight_kg")
      .eq("user_id", user.id)
      .single();
    if (data) {
      if (data.name) setName(data.name);
      if (data.age) setAge(String(data.age));
      // Load preferred units from localStorage (faster) or could be from DB
      const savedUnits = localStorage.getItem(`preferred_units_${user.id}`);
      if (savedUnits) setUseMetric(savedUnits === "metric");
      setProfileData(data);
    }
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
    // Also persist locally for instant load
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
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{name || "Set your name"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>

          {/* Unit toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Units</Label>
            <div className="flex gap-1 bg-muted rounded-lg p-0.5 text-xs">
              <button onClick={() => setUseMetric(true)} className={`px-3 py-1 rounded-md transition-colors ${useMetric ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>kg / cm</button>
              <button onClick={() => setUseMetric(false)} className={`px-3 py-1 rounded-md transition-colors ${!useMetric ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>lbs / ft</button>
            </div>
          </div>

          {/* Dark mode toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Theme</Label>
            <div className="flex gap-1 bg-muted rounded-lg p-0.5 text-xs">
              <button onClick={() => { setDarkMode(false); document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light"); }} className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${!darkMode ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
                <Sun className="h-3 w-3" /> Light
              </button>
              <button onClick={() => { setDarkMode(true); document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark"); }} className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${darkMode ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
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

      {/* Profile summary */}
      {profileData.goal && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Your Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Goal</span>
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
