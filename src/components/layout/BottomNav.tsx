import { Home, Utensils, Plus, Users, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "nutrition", label: "Nutrition", icon: Utensils },
  { id: "plan", label: "Plan", icon: Plus, isCenter: true },
  { id: "community", label: "Community", icon: Users },
  { id: "profile", label: "Profile", icon: Calendar },
];

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) =>
          (tab as any).isCenter ? (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center justify-center h-12 w-12 -mt-5 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95",
                activeTab === tab.id && "ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
              )}
            >
              <tab.icon className="h-6 w-6" />
            </button>
          ) : (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className={cn("h-5 w-5", activeTab === tab.id && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          )
        )}
      </div>
    </nav>
  );
}
