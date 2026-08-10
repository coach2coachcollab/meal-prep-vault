import { Home, Utensils, Plus, Users, User, UtensilsCrossed, CalendarDays, Dumbbell, MessageCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const tabs = [
  { id: "home", label: "Today", icon: Home },
  { id: "nutrition", label: "Nutrition", icon: Utensils },
  { id: "quick-add", label: "", icon: Plus, isCenter: true },
  { id: "community", label: "Community", icon: Users },
  { id: "profile", label: "You", icon: User },
];

const quickActions = [
  {
    id: "log-meal",
    label: "Log Meal",
    description: "Quickly log a meal and track your nutrition.",
    icon: UtensilsCrossed,
    tab: "nutrition",
    sub: "today",
  },
  {
    id: "build-plan",
    label: "Build Meal Plan",
    description: "Create a personalized plan to hit your goals.",
    icon: CalendarDays,
    tab: "nutrition",
    sub: "vault",
  },
  {
    id: "start-workout",
    label: "Start Workout",
    description: "Get moving with guided and custom workouts.",
    icon: Dumbbell,
    tab: "fitness",
    sub: "workouts",
  },
  {
    id: "post-update",
    label: "Post Update",
    description: "Share your progress and inspire the community.",
    icon: MessageCircle,
    tab: "community",
    sub: "",
  },
  {
    id: "add-progress",
    label: "Add Progress",
    description: "Track your wins and stay accountable.",
    icon: TrendingUp,
    tab: "profile",
    sub: "progress",
  },
];

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSubTabChange?: (tab: string, sub: string) => void;
}

export function BottomNav({ activeTab, onTabChange, onSubTabChange }: BottomNavProps) {
  const [quickOpen, setQuickOpen] = useState(false);

  const handleAction = (tab: string, sub: string) => {
    setQuickOpen(false);
    if (sub && onSubTabChange) {
      onSubTabChange(tab, sub);
    } else {
      onTabChange(tab);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {quickOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setQuickOpen(false)}
        />
      )}

      {/* Bottom sheet */}
      {quickOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          <div className="px-4 pb-8 safe-area-bottom">
            {quickActions.map((action, i) => (
              <button
                key={action.id}
                onClick={() => handleAction(action.tab, action.sub)}
                className={cn(
                  "flex items-center gap-4 w-full py-4 text-left transition-colors hover:bg-muted/50 rounded-xl px-2 -mx-2",
                  i < quickActions.length - 1 && "border-b border-border"
                )}
              >
                <div className="h-12 w-12 rounded-2xl bg-accent flex items-center justify-center shrink-0">
                  <action.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-foreground leading-tight">{action.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{action.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background safe-area-bottom">
        <div className="flex items-center justify-around h-16 max-w-4xl mx-auto">
          {tabs.map((tab) => {
            if ((tab as any).isCenter) {
              return (
                <button
                  key={tab.id}
                  onClick={() => setQuickOpen((o) => !o)}
                  aria-label={quickOpen ? "Close quick actions" : "Open quick actions"}
                  aria-expanded={quickOpen}
                  className={cn(
                    "flex items-center justify-center h-14 w-14 -mt-6 rounded-full bg-primary text-white shadow-lg shadow-primary/40 transition-all hover:scale-105 active:scale-95",
                    quickOpen && "rotate-45"
                  )}
                >
                  <Plus className="h-7 w-7 transition-transform duration-200" />
                </button>
              );
            }
            return (
              <button
                key={tab.id}
                onClick={() => { setQuickOpen(false); onTabChange(tab.id); }}
                aria-label={tab.label}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 transition-all duration-200 min-w-[56px]",
                  activeTab === tab.id
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <tab.icon className={cn(
                  "h-5 w-5 transition-all duration-200",
                  activeTab === tab.id ? "stroke-[2.5]" : "stroke-[1.5]"
                )} />
                <span className={cn(
                  "text-[10px] transition-all duration-200",
                  activeTab === tab.id ? "font-bold" : "font-medium"
                )}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
