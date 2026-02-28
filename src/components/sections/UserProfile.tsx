import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Save, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function UserProfile() {
  const { user, signOut } = useAuth();
  const [name, setName] = useState("");
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

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("name, goal, activity_level, diet_prefs, allergies, age, height_cm, weight_kg")
      .eq("user_id", user.id)
      .single();
    if (data) {
      if (data.name) setName(data.name);
      setProfileData(data);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name })
      .eq("user_id", user.id);
    setLoading(false);
    if (error) toast.error("Failed to save");
    else toast.success("Profile updated!");
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
                <span className="font-medium">{profileData.age}yr · {profileData.height_cm}cm · {profileData.weight_kg}kg</span>
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
