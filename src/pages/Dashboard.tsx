import { useState } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { useTheme } from "@/hooks/useTheme";
import { HomeDashboard } from "@/components/sections/HomeDashboard";
import { MacroCalculator } from "@/components/sections/MacroCalculator";
import { MealVault } from "@/components/sections/MealVault";
import { NutritionToday } from "@/components/sections/NutritionToday";
import { ExerciseLibrary } from "@/components/sections/ExerciseLibrary";
import { WorkoutLogger } from "@/components/sections/WorkoutLogger";
import { WorkoutTemplates } from "@/components/sections/WorkoutTemplates";
import { CommunityHub } from "@/components/sections/CommunityHub";
import { UserProfile } from "@/components/sections/UserProfile";
import { PartnerHub } from "@/components/sections/PartnerHub";
import { ProgressTracker } from "@/components/sections/ProgressTracker";
import { NotificationsPage } from "@/components/sections/NotificationsPage";
import { StreakDetails } from "@/components/sections/StreakDetails";
import { NotificationBell } from "@/components/community/NotificationBell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { User, Zap, Moon, Sun } from "lucide-react";
import { useStreak } from "@/hooks/useStreak";

export default function Dashboard() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const { streak, justIncreased } = useStreak();
  const [activeTab, setActiveTab] = useState("home");
  const [nutritionSub, setNutritionSub] = useState("today");
  const [fitnessSub, setFitnessSub] = useState("workouts");
  const [profileSub, setProfileSub] = useState("profile");
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);
  const [autoOpenLog, setAutoOpenLog] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

  const navigateToPost = (postId: string) => {
    setHighlightPostId(postId);
    setActiveTab("community");
  };

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return (
          <ErrorBoundary fallbackMessage="Dashboard failed to load.">
            <HomeDashboard onNavigate={(tab) => {
              if (tab.startsWith("nutrition:")) {
                const sub = tab.split(":")[1];
                setActiveTab("nutrition");
                setNutritionSub(sub);
              } else {
                setActiveTab(tab);
              }
            }} />
          </ErrorBoundary>
        );
      case "nutrition":
        return (
          <ErrorBoundary fallbackMessage="Nutrition section failed to load.">
            <Tabs value={nutritionSub} onValueChange={setNutritionSub}>
              <TabsList className="w-full grid grid-cols-3 mb-4">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="vault">Vault</TabsTrigger>
                <TabsTrigger value="macros">Macros</TabsTrigger>
              </TabsList>
              <TabsContent value="today"><NutritionToday autoOpenLog={autoOpenLog} /></TabsContent>
              <TabsContent value="vault"><MealVault /></TabsContent>
              <TabsContent value="macros">
                <MacroCalculator onNavigateToMealVault={() => setNutritionSub("vault")} />
              </TabsContent>
            </Tabs>
          </ErrorBoundary>
        );
      case "fitness":
        return (
          <ErrorBoundary fallbackMessage="Fitness section failed to load.">
            <Tabs value={fitnessSub} onValueChange={setFitnessSub}>
              <TabsList className="w-full grid grid-cols-3 mb-4">
                <TabsTrigger value="workouts">Workouts</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
                <TabsTrigger value="exercises">Exercises</TabsTrigger>
              </TabsList>
              <TabsContent value="workouts">
                <WorkoutLogger 
                  pendingTemplateId={pendingTemplateId} 
                  onTemplateLoaded={() => setPendingTemplateId(null)} 
                />
              </TabsContent>
              <TabsContent value="templates">
                <WorkoutTemplates onStartFromTemplate={(templateId) => {
                  setPendingTemplateId(templateId);
                  setFitnessSub("workouts");
                }} />
              </TabsContent>
              <TabsContent value="exercises"><ExerciseLibrary /></TabsContent>
            </Tabs>
          </ErrorBoundary>
        );
      case "community":
        return (
          <ErrorBoundary fallbackMessage="Community failed to load.">
            <CommunityHub highlightPostId={highlightPostId} onHighlightHandled={() => setHighlightPostId(null)} />
          </ErrorBoundary>
        );
      case "notifications":
        return (
          <ErrorBoundary fallbackMessage="Notifications failed to load.">
            <NotificationsPage onNavigateToPost={navigateToPost} />
          </ErrorBoundary>
        );
      case "streak":
        return (
          <ErrorBoundary fallbackMessage="Streak details failed to load.">
            <StreakDetails onBack={() => setActiveTab("home")} streak={streak} />
          </ErrorBoundary>
        );
      case "profile":
        return (
          <ErrorBoundary fallbackMessage="Profile section failed to load.">
            <Tabs value={profileSub} onValueChange={setProfileSub}>
              <TabsList className="w-full grid grid-cols-3 mb-4">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="progress">Progress</TabsTrigger>
                <TabsTrigger value="perks">Perks</TabsTrigger>
              </TabsList>
              <TabsContent value="profile"><UserProfile /></TabsContent>
              <TabsContent value="progress"><ProgressTracker /></TabsContent>
              <TabsContent value="perks"><PartnerHub /></TabsContent>
            </Tabs>
          </ErrorBoundary>
        );
      default:
        return (
          <ErrorBoundary fallbackMessage="Dashboard failed to load.">
            <HomeDashboard onNavigate={(tab) => {
              if (tab.startsWith("nutrition:")) {
                const sub = tab.split(":")[1];
                setActiveTab("nutrition");
                setNutritionSub(sub);
              } else {
                setActiveTab(tab);
              }
            }} />
          </ErrorBoundary>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <header className="shrink-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b safe-area-top">
        <div className="max-w-4xl mx-auto px-4 md:px-6 h-12 flex items-center justify-between">
          <button
            onClick={() => setActiveTab("streak")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary border border-primary/50 shadow-[0_0_10px_hsl(var(--primary)/0.3)] transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_0_16px_hsl(var(--primary)/0.4)] active:scale-95 ${justIncreased ? "animate-pulse ring-2 ring-primary ring-offset-2 ring-offset-background scale-110" : ""}`}
          >
            <Zap className={`h-4 w-4 text-primary-foreground transition-transform duration-300 ${justIncreased ? "scale-125" : ""}`} />
            <span className="text-sm font-extrabold text-primary-foreground">{streak}🔥</span>
          </button>
          <div className="flex items-center gap-1">
            <NotificationBell
              onNavigateToCommunity={() => setActiveTab("community")}
              onViewAll={() => setActiveTab("notifications")}
              onNavigateToPost={navigateToPost}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => setActiveTab("profile")}
              aria-label="Profile"
            >
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
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
            if (sub === "today") setAutoOpenLog(true);
          }
          if (tab === "fitness") setFitnessSub(sub);
        }}
      />
    </div>
  );
}
