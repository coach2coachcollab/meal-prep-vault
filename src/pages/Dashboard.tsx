import { useState, lazy, Suspense } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { useTheme } from "@/hooks/useTheme";
import { NotificationBell } from "@/components/community/NotificationBell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { User, Zap, Moon, Sun } from "lucide-react";
import { useStreak } from "@/hooks/useStreak";
import { useSeo } from "@/hooks/useSeo";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";

// Lazy-load heavy tab sections so recharts/jspdf/confetti/embla stay out of the
// initial bundle. Each section is only fetched when the user opens its tab.
const HomeDashboard = lazy(() => import("@/components/sections/HomeDashboard").then(m => ({ default: m.HomeDashboard })));
const MacroCalculator = lazy(() => import("@/components/sections/MacroCalculator").then(m => ({ default: m.MacroCalculator })));
const MealVault = lazy(() => import("@/components/sections/MealVault").then(m => ({ default: m.MealVault })));
const NutritionToday = lazy(() => import("@/components/sections/NutritionToday").then(m => ({ default: m.NutritionToday })));
const ExerciseLibrary = lazy(() => import("@/components/sections/ExerciseLibrary").then(m => ({ default: m.ExerciseLibrary })));
const WorkoutLogger = lazy(() => import("@/components/sections/WorkoutLogger").then(m => ({ default: m.WorkoutLogger })));
const WorkoutTemplates = lazy(() => import("@/components/sections/WorkoutTemplates").then(m => ({ default: m.WorkoutTemplates })));
const CommunityHub = lazy(() => import("@/components/sections/CommunityHub").then(m => ({ default: m.CommunityHub })));
const UserProfile = lazy(() => import("@/components/sections/UserProfile").then(m => ({ default: m.UserProfile })));
const PartnerHub = lazy(() => import("@/components/sections/PartnerHub").then(m => ({ default: m.PartnerHub })));
const ProgressTracker = lazy(() => import("@/components/sections/ProgressTracker").then(m => ({ default: m.ProgressTracker })));
const NotificationsPage = lazy(() => import("@/components/sections/NotificationsPage").then(m => ({ default: m.NotificationsPage })));
const StreakDetails = lazy(() => import("@/components/sections/StreakDetails").then(m => ({ default: m.StreakDetails })));

const SectionFallback = () => <DashboardSkeleton />;


const TAB_SEO: Record<string, { title: string; description: string }> = {
  home: { title: "Home — NutriCoach", description: "Your nutrition overview, streak, macros, and daily progress." },
  nutrition: { title: "Nutrition — NutriCoach", description: "Log meals, browse your vault, and tune your macro targets." },
  fitness: { title: "Fitness — NutriCoach", description: "Track workouts, follow templates, and explore the exercise library." },
  community: { title: "Community — NutriCoach", description: "Share progress and connect with other NutriCoach members." },
  notifications: { title: "Notifications — NutriCoach", description: "Catch up on reactions, comments, and replies." },
  streak: { title: "Streak — NutriCoach", description: "See your current streak and milestone history." },
  profile: { title: "Profile — NutriCoach", description: "Manage your profile, progress, and partner perks." },
};

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

  const seo = TAB_SEO[activeTab] || TAB_SEO.home;
  useSeo({ title: seo.title, description: seo.description, canonicalPath: "/" });

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
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <Suspense fallback={<SectionFallback />}>
            {renderContent()}
          </Suspense>
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
