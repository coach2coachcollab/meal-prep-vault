import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- Mocks ---
const insertMock = vi.fn().mockResolvedValue({ error: null });
const fromMock: any = vi.fn(() => ({ insert: insertMock }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (name: string) => fromMock(name) },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-home-1" }, session: null, loading: false, signOut: vi.fn() }),
}));

vi.mock("@/hooks/useStreak", () => ({ useStreak: () => ({ streak: 3 }) }));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const recentMeal = {
  food_name: "Chicken Bowl",
  meal_type: "Dinner",
  calories: 610,
  protein_g: 48,
  carbs_g: 55,
  fat_g: 20,
  recipe_id: "recipe-xyz",
  servings: 2,
  image_url: null,
  date: "2026-07-20",
  logged_at: "2026-07-20T18:00:00Z",
};

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<any>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (opts: any) => {
      const key = Array.isArray(opts.queryKey) ? opts.queryKey[0] : opts.queryKey;
      if (key === "dashboard") {
        return {
          data: {
            profileName: "Sam",
            macros: { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 70 },
            todayJournal: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            loggedMealTypes: new Set<string>(),
            habitsToday: { done: 0, total: 0 },
            waterToday: { glasses: 0, goal: 8 },
            recentMeals: [recentMeal],
            hasLoggedToday: false,
            hasWorkedOutToday: false,
            lastTemplateName: null,
            lastTemplateCategory: null,
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    },
  };
});

import { HomeDashboard } from "@/components/sections/HomeDashboard";

function renderWithClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <HomeDashboard onNavigate={() => {}} />
    </QueryClientProvider>
  );
}

describe("HomeDashboard recent-meals strip → one-tap relog", () => {
  beforeEach(() => {
    insertMock.mockClear().mockResolvedValue({ error: null });
    fromMock.mockClear();
  });

  it("renders the recent meal card with name, calories and meal_type", () => {
    renderWithClient();
    expect(screen.getByText("Chicken Bowl")).toBeInTheDocument();
    expect(screen.getByText(/610 kcal · Dinner/)).toBeInTheDocument();
  });

  it("inserts into journal_entries with the previous meal_type and servings on tap", async () => {
    renderWithClient();
    fireEvent.click(screen.getByText("Chicken Bowl").closest("button")!);

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(fromMock).toHaveBeenCalledWith("journal_entries");

    const payload = insertMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      user_id: "user-home-1",
      food_name: "Chicken Bowl",
      meal_type: "Dinner",
      servings: 2,
      calories: 610,
      protein_g: 48,
      carbs_g: 55,
      fat_g: 20,
      recipe_id: "recipe-xyz",
      image_url: null,
    });
    // date is today's ISO date
    expect(payload.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
