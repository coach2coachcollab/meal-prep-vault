import { Home, Utensils, Plus, Dumbbell, Users, UtensilsCrossed, Droplets, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "nutrition", label: "Nutrition", icon: Utensils },
  { id: "quick-add", label: "", icon: Plus, isCenter: true },
  { id: "fitness", label: "Fitness", icon: Dumbbell },
  { id: "community", label: "Community", icon: Users },
];

const quickActions = [
  { id: "log-food", label: "Log Food", icon: UtensilsCrossed, tab: "nutrition", sub: "today" },
  { id: "log-water", label: "Log Water", icon: Droplets, tab: "nutrition", sub: "today" },
  { id: "start-workout", label: "Start Workout", icon: Dumbbell, tab: "fitness", sub: "workouts" },
  { id: "add-habit", label: "Add Habit", icon: CheckSquare, tab: "nutrition", sub: "today" },
];

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSubTabChange?: (tab: string, sub: string) => void;
}

export function BottomNav({ activeTab, onTabChange, onSubTabChange }: BottomNavProps) {
  const [quickOpen, setQuickOpen] = useState(false);

  return (
    <>
      {/* Backdrop */}
      {quickOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setQuickOpen(false)}
        />
      )}

      {/* Quick action buttons */}
      {quickOpen && (
        <div className="fixed bottom-20 left-0 right-0 z-50 flex justify-center gap-4 px-4 animate-in slide-in-from-bottom-4 fade-in duration-200">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => {
                setQuickOpen(false);
                if (onSubTabChange) {
                  onSubTabChange(action.tab, action.sub);
                } else {
                  onTabChange(action.tab);
                }
              }}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border shadow-lg hover:bg-accent transition-colors min-w-[72px]"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <action.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-[10px] font-medium text-foreground">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-bottom">
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
                    "flex items-center justify-center h-12 w-12 -mt-5 rounded-full bg-center-btn text-center-btn-foreground shadow-[0_0_14px_hsl(var(--center-btn)/0.4)] transition-all hover:scale-105 hover:shadow-[0_0_20px_hsl(var(--center-btn)/0.55)] active:scale-95",
                    quickOpen && "rotate-45"
                  )}
                >
                  <Plus className="h-6 w-6 transition-transform duration-200" />
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
                  "relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px]",
                  activeTab === tab.id
                    ? "text-nav-active"
                    : "text-nav-inactive hover:text-foreground"
                )}
              >
                {/* Active indicator dot */}
                {activeTab === tab.id && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-1 w-6 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.4)] animate-scale-in" />
                )}
                <tab.icon className={cn(
                  "h-5 w-5 transition-all duration-200",
                  activeTab === tab.id ? "stroke-[2.5] text-nav-active scale-110" : ""
                )} />
                <span className={cn(
                  "text-[10px] transition-all duration-200",
                  activeTab === tab.id ? "font-bold text-nav-active" : "font-medium"
                )}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
