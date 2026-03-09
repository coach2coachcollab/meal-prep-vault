

# NutriCoach Roadmap — Feasibility Assessment

I've reviewed your roadmap document against the current codebase. Here's a breakdown of what's already done, what's straightforward to build, and what requires significant effort.

---

## Already Done ✅

| Roadmap Item | Status |
|-------------|--------|
| **Secure edge functions with JWT** | ✅ Both `generate-meal-plan` and `extract-recipe-from-image` already validate JWT tokens |
| **ErrorBoundary on all tabs** | ✅ Already implemented — every tab in Dashboard.tsx is wrapped |
| **MoodNutritionChart wired or deleted** | ✅ Already wired into WeeklyInsightsCard |
| **favorite_meals vs user_favorites audit** | ✅ Only `favorite_meals` exists — no duplicate table |
| **Unit tests for macro calculations** | ✅ `calculations.test.ts` covers BMR, TDEE, macros, and streak |

---

## Straightforward to Implement (Phase 1 items)

| Task | Effort | Notes |
|------|--------|-------|
| **Fix profiles RLS for community author names** | S | Add read policy for name + avatar_url on profiles table |
| **Add pagination to community feed** | M | Add `.range(0, 49)` + "Load more" button to CommunityHub |
| **Add pagination to meal vault** | M | Same pattern — MealVault already uses React Query |
| **Fix streak N+1 query** | S | Refactor HabitTracker to group habit_logs by habit_id in a single query |
| **send-streak-reminders secret header check** | S | Add `x-cron-secret` header validation |

---

## Medium Effort (Phase 2/3 items — doable incrementally)

| Task | Effort | Complexity |
|------|--------|------------|
| **Create workout tables (exercises, workout_logs, workout_sets)** | M | Database migrations + RLS policies |
| **Seed exercise library (300+ exercises)** | M | JSON seed file + migration |
| **Exercise Library screen** | M | Search + filter UI, already have similar patterns in MealVault |
| **Fitness tab in bottom nav** | S | Add 6th tab or replace existing |
| **Workout Logger screen (timer, sets table)** | L | Most complex new UI — active timer, dynamic form inputs |
| **Auto-generate shopping list from meal plan** | M | Link meal_plan_entries → grocery_list_items |
| **Workout history charts in Progress Tracker** | M | Recharts already in use |

---

## Higher Effort (Phase 3/4 — requires more planning)

| Task | Effort | Why it's complex |
|------|--------|------------------|
| **Active Workout Logger with rest timer** | L | Real-time timer, haptic alerts, complex state management |
| **Workout templates / programs system** | L | JSONB schema, public/private templates, "start program" flow |
| **Challenges UI + Leaderboard** | L | Wire existing challenges table, add workout_challenges, social leaderboard |
| **Meal Prep Planner** | L | Batch scaling recipes, auto-generate prep order + grocery list |
| **Barcode scanner for food logging** | L | External API integration (OpenFoodFacts), camera access |
| **PWA manifest + service worker** | M | Requires Vite plugin setup, offline caching strategy |
| **Complete React Query migration** | L | Already started — needs systematic refactor of remaining screens |

---

## Summary: What's Doable Today

**Immediately actionable (1-2 sessions each):**
1. Fix profiles RLS policy for community names
2. Add pagination to Community + Meal Vault
3. Fix streak N+1 query
4. Secure send-streak-reminders with cron secret

**Next sprint (Medium effort):**
5. Create workout database schema (exercises, workout_logs, workout_sets)
6. Build Exercise Library screen
7. Add Fitness tab to navigation
8. Build basic Workout Logger (without rest timer/haptics)

**Longer-term:**
- Templates/Programs system
- Challenges + Leaderboard
- Meal Prep Planner
- Barcode scanner
- PWA offline support

---

## Technical Notes

- **React Query**: Already in use (useQuery/useMutation) — no migration needed for new features
- **Recharts**: Already integrated — workout charts will follow existing patterns
- **jsPDF**: Already in use — PDF export for workouts is trivial
- **Folder restructure**: The doc recommends `src/features/*` structure. This is optional cleanup — current structure works fine

**Bottom line:** Phase 1 is essentially complete. Phase 2 (Fitness features) is the next logical focus, starting with the database schema and Exercise Library UI.

