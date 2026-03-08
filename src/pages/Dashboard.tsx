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
import { StreakDetails } from "@/components/sections/StreakDetails";
import { NotificationBell } from "@/components/community/NotificationBell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { User, Zap } from "lucide-react";
import { useStreak } from "@/hooks/useStreak";

export default function Dashboard() {
  const { streak, justIncreased } = useStreak();
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
      case "streak":
        return <StreakDetails onBack={() => setActiveTab("home")} streak={streak} />;
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
      <header className="shrink-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b safe-area-top">
        <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 md:px-6 h-12 flex items-center justify-between">
          <button
            onClick={() => setActiveTab("streak")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 transition-all duration-300 hover:bg-primary/20 active:scale-95 ${justIncreased ? "animate-pulse ring-2 ring-primary ring-offset-2 ring-offset-background scale-110" : ""}`}
          >
            <Zap className={`h-3.5 w-3.5 text-primary transition-transform duration-300 ${justIncreased ? "scale-125" : ""}`} />
            <span className="text-xs font-bold text-foreground">{streak}🔥</span>
          </button>
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
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 md:px-6 py-6">
          {renderContent()}
        </div>
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
