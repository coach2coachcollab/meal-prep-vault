import { useState } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { HomeDashboard } from "@/components/sections/HomeDashboard";
import { MacroCalculator } from "@/components/sections/MacroCalculator";
import { MealVault } from "@/components/sections/MealVault";
import { MealJournal } from "@/components/sections/MealJournal";
import { MealPlans } from "@/components/sections/MealPlans";
import { GroceryList } from "@/components/sections/GroceryList";
import { RecipePlanner } from "@/components/sections/RecipePlanner";
import { CommunityHub } from "@/components/sections/CommunityHub";
import { UserProfile } from "@/components/sections/UserProfile";
import { HabitTracker } from "@/components/sections/HabitTracker";
import { PartnerHub } from "@/components/sections/PartnerHub";
import { WaterTracker } from "@/components/sections/WaterTracker";
import { ProgressTracker } from "@/components/sections/ProgressTracker";
import { NotificationsPage } from "@/components/sections/NotificationsPage";
import { NotificationBell } from "@/components/community/NotificationBell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { User, Zap } from "lucide-react";
import { useStreak } from "@/hooks/useStreak";

export default function Dashboard() {
  const streak = useStreak();
  const [activeTab, setActiveTab] = useState("home");
  const [nutritionSub, setNutritionSub] = useState("journal");
  const [planSub, setPlanSub] = useState("plans");
  const [profileSub, setProfileSub] = useState("profile");
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);
  const [autoOpenLog, setAutoOpenLog] = useState(false);

  const navigateToPost = (postId: string) => {
    setHighlightPostId(postId);
    setActiveTab("community");
  };

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return <HomeDashboard onNavigate={(tab) => {
          if (tab.startsWith("nutrition:")) {
            const sub = tab.split(":")[1];
            setActiveTab("nutrition");
            setNutritionSub(sub);
          } else {
            setActiveTab(tab);
          }
        }} />;
      case "nutrition":
        return (
          <Tabs value={nutritionSub} onValueChange={setNutritionSub}>
            <TabsList className="w-full grid grid-cols-4 mb-4">
              <TabsTrigger value="journal">Journal</TabsTrigger>
              <TabsTrigger value="water">Wellness</TabsTrigger>
              <TabsTrigger value="habits">Habits</TabsTrigger>
              <TabsTrigger value="vault">Vault</TabsTrigger>
            </TabsList>
            <TabsContent value="journal"><MealJournal autoOpenLog={autoOpenLog} /></TabsContent>
            <TabsContent value="water"><WaterTracker /></TabsContent>
            <TabsContent value="habits"><HabitTracker /></TabsContent>
            <TabsContent value="vault"><MealVault /></TabsContent>
          </Tabs>
        );
      case "plan":
        return (
          <Tabs value={planSub} onValueChange={setPlanSub}>
            <TabsList className="w-full grid grid-cols-4 mb-4">
              <TabsTrigger value="plans">Meal Plans</TabsTrigger>
              <TabsTrigger value="recipe">Add Recipe</TabsTrigger>
              <TabsTrigger value="grocery">Shopping</TabsTrigger>
              <TabsTrigger value="macros">Macros</TabsTrigger>
            </TabsList>
            <TabsContent value="plans"><MealPlans /></TabsContent>
            <TabsContent value="recipe"><RecipePlanner /></TabsContent>
            <TabsContent value="grocery"><GroceryList /></TabsContent>
            <TabsContent value="macros"><MacroCalculator /></TabsContent>
          </Tabs>
        );
      case "community":
        return <CommunityHub highlightPostId={highlightPostId} onHighlightHandled={() => setHighlightPostId(null)} />;
      case "notifications":
        return <NotificationsPage onNavigateToPost={navigateToPost} />;
      case "profile":
        return (
          <Tabs value={profileSub} onValueChange={setProfileSub}>
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="partners">Deals</TabsTrigger>
            </TabsList>
            <TabsContent value="profile"><UserProfile /></TabsContent>
            <TabsContent value="progress"><ProgressTracker /></TabsContent>
            <TabsContent value="partners"><PartnerHub /></TabsContent>
          </Tabs>
        );
      default:
        return <HomeDashboard onNavigate={(tab) => {
          if (tab.startsWith("nutrition:")) {
            const sub = tab.split(":")[1];
            setActiveTab("nutrition");
            setNutritionSub(sub);
          } else {
            setActiveTab(tab);
          }
        }} />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">
          {streak > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold text-foreground">{streak}🔥</span>
            </div>
          ) : <div />}
          <div className="flex items-center gap-2">
            <NotificationBell
              onNavigateToCommunity={() => setActiveTab("community")}
              onViewAll={() => setActiveTab("notifications")}
              onNavigateToPost={navigateToPost}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => setActiveTab("profile")}
            >
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        {renderContent()}
      </main>
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSubTabChange={(tab, sub) => {
          setAutoOpenLog(false);
          setActiveTab(tab);
          if (tab === "nutrition") {
            setNutritionSub(sub);
            if (sub === "journal") setAutoOpenLog(true);
          }
          if (tab === "plan") setPlanSub(sub);
        }}
      />
    </div>
  );
}
