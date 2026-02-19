import { useState } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { MacroCalculator } from "@/components/sections/MacroCalculator";
import { MealVault } from "@/components/sections/MealVault";
import { MealPlans } from "@/components/sections/MealPlans";
import { GroceryList } from "@/components/sections/GroceryList";
import { RecipePlanner } from "@/components/sections/RecipePlanner";
import { UserProfile } from "@/components/sections/UserProfile";

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("macro-calc");

  const renderSection = () => {
    switch (activeSection) {
      case "macro-calc": return <MacroCalculator />;
      case "meal-vault": return <MealVault />;
      case "meal-plans": return <MealPlans />;
      case "grocery-list": return <GroceryList />;
      case "recipe-planner": return <RecipePlanner />;
      case "profile": return <UserProfile />;
      default: return <MacroCalculator />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <SidebarInset>
          <header className="flex h-14 items-center border-b px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-6">
            {renderSection()}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
