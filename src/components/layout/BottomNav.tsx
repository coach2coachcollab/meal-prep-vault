import { Home, Utensils, Plus, Calendar, Users, X, UtensilsCrossed, BookOpen, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "nutrition", label: "Nutrition", icon: Utensils },
  { id: "quick-add", label: "", icon: Plus, isCenter: true },
  { id: "plan", label: "Plan", icon: Calendar },
  { id: "community", label: "Community", icon: Users },
];

const quickActions = [
  { id: "log-meal", label: "Log Meal", icon: UtensilsCrossed, tab: "nutrition", sub: "journal" },
  { id: "add-recipe", label: "Add Recipe", icon: BookOpen, tab: "plan", sub: "recipe" },
  { id: "log-water", label: "Log Water", icon: Droplets, tab: "nutrition", sub: "water" },
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
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {tabs.map((tab) => {
            if ((tab as any).isCenter) {
              return (
                <button
                  key={tab.id}
                  onClick={() => setQuickOpen((o) => !o)}
                  className={cn(
                    "flex items-center justify-center h-12 w-12 -mt-5 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95",
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
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px]",
                  activeTab === tab.id
                    ? "bg-primary/20 text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className={cn("h-5 w-5", activeTab === tab.id ? "stroke-[2.5] text-primary-foreground" : "")} />
                <span className={cn("text-[10px]", activeTab === tab.id ? "font-semibold text-primary-foreground" : "font-medium")}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
