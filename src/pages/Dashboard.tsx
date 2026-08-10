import { useState, Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazy-retry";
import { BottomNav } from "@/components/layout/BottomNav";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/community/NotificationBell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Zap, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { EnvSwitcher } from "@/components/EnvSwitcher";
import { getActiveEnv } from "@/integrations/supabase/client";
import { useStreak } from "@/hooks/useStreak";
import { useSeo } from "@/hooks/useSeo";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";

// Lazy-load heavy tab sections so recharts/jspdf/confetti/embla stay out of the
// initial bundle. Each section is only fetched when the user opens its tab.
const HomeDashboard = lazyWithRetry(() => import("@/components/sections/HomeDashboard").then(m => ({ default: m.HomeDashboard })));
const MacroCalculator = lazyWithRetry(() => import("@/components/sections/MacroCalculator").then(m => ({ default: m.MacroCalculator })));
const MealVault = lazyWithRetry(() => import("@/components/sections/MealVault").then(m => ({ default: m.MealVault })));
const NutritionToday = lazyWithRetry(() => import("@/components/sections/NutritionToday").then(m => ({ default: m.NutritionToday })));
const ExerciseLibrary = lazyWithRetry(() => import("@/components/sections/ExerciseLibrary").then(m => ({ default: m.ExerciseLibrary })));
const WorkoutLogger = lazyWithRetry(() => import("@/components/sections/WorkoutLogger").then(m => ({ default: m.WorkoutLogger })));
const WorkoutTemplates = lazyWithRetry(() => import("@/components/sections/WorkoutTemplates").then(m => ({ default: m.WorkoutTemplates })));
const CommunityHub = lazyWithRetry(() => import("@/components/sections/CommunityHub").then(m => ({ default: m.CommunityHub })));
const UserProfile = lazyWithRetry(() => import("@/components/sections/UserProfile").then(m => ({ default: m.UserProfile })));
const PartnerHub = lazyWithRetry(() => import("@/components/sections/PartnerHub").then(m => ({ default: m.PartnerHub })));
const ProgressTracker = lazyWithRetry(() => import("@/components/sections/ProgressTracker").then(m => ({ default: m.ProgressTracker })));
const NotificationsPage = lazyWithRetry(() => import("@/components/sections/NotificationsPage").then(m => ({ default: m.NotificationsPage })));
const StreakDetails = lazyWithRetry(() => import("@/components/sections/StreakDetails").then(m => ({ default: m.StreakDetails })));

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
  const { isDemo } = useAuth();
  const [envOpen, setEnvOpen] = useState(false);
  const activeEnv = getActiveEnv();
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
            <div className="mb-4">
              <h2 className="text-2xl font-black text-foreground">Nutrition</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Fuel your goals. One meal at a time. 💪</p>
            </div>
            <Tabs value={nutritionSub} onValueChange={setNutritionSub}>
              <TabsList className="w-full grid grid-cols-3 mb-4">
                <TabsTrigger value="today">Macros</TabsTrigger>
                <TabsTrigger value="macros">Meal Plan</TabsTrigger>
                <TabsTrigger value="vault">Recipe Vault</TabsTrigger>
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
      <EnvSwitcher open={envOpen} onClose={() => setEnvOpen(false)} />
      <header className="shrink-0 z-40 bg-background border-b border-border safe-area-top">
        <div className="max-w-4xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => setActiveTab("home")} className="flex items-center">
            <span className="text-2xl font-black text-foreground tracking-tight">macro</span>
            <span className="text-2xl font-black text-primary tracking-tight">/.</span>
          </button>

          <div className="flex items-center gap-0.5">
            {/* Streak pill */}
            <button
              onClick={() => setActiveTab("streak")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold transition-all mr-1",
                justIncreased ? "bg-primary text-white scale-105" : "bg-muted text-foreground"
              )}
            >
              {streak}🔥
            </button>
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
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-9 w-9 rounded-full", activeEnv === "qa" && "text-warning")}
              onClick={() => setEnvOpen(true)}
              aria-label="Switch environment"
            >
              <FlaskConical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      {activeEnv === "qa" && (
        <div className="shrink-0 bg-warning/10 border-b border-warning/30 px-4 py-1.5 flex items-center gap-2">
          <FlaskConical className="h-3.5 w-3.5 text-warning shrink-0" />
          <p className="text-xs font-semibold text-warning">QA environment — test data only</p>
        </div>
      )}
      {isDemo && (
        <div className="shrink-0 bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="text-xs font-medium text-primary">Demo mode — data won't be saved</p>
          </div>
          <button
            className="text-xs font-semibold text-primary underline"
            onClick={() => { import("@/hooks/useAuth").then(m => m.exitDemo()); window.location.reload(); }}
          >
            Sign in
          </button>
        </div>
      )}
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
