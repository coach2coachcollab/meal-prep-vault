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
import { NotificationBell } from "@/components/community/NotificationBell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("home");
  const [nutritionSub, setNutritionSub] = useState("journal");
  const [planSub, setPlanSub] = useState("plans");
  const [profileSub, setProfileSub] = useState("profile");

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return <HomeDashboard onNavigate={setActiveTab} />;
      case "nutrition":
        return (
          <Tabs value={nutritionSub} onValueChange={setNutritionSub}>
            <TabsList className="w-full grid grid-cols-4 mb-4">
              <TabsTrigger value="journal">Journal</TabsTrigger>
              <TabsTrigger value="water">Wellness</TabsTrigger>
              <TabsTrigger value="habits">Habits</TabsTrigger>
              <TabsTrigger value="vault">Vault</TabsTrigger>
            </TabsList>
            <TabsContent value="journal"><MealJournal /></TabsContent>
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
        return <CommunityHub />;
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
        return <HomeDashboard onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-end">
          <NotificationBell onNavigateToCommunity={() => setActiveTab("community")} />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        {renderContent()}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
