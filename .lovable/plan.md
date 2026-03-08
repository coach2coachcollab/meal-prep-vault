

## Recommendation: Set a Default/Preferred View (Calendar or List)

The best option for your use case is **remembering your preferred view** (Calendar vs List). Here's why:

- You already have both Calendar and List views built — this just lets you pick which one loads by default
- It's lightweight: saves your preference to `localStorage` so it persists across sessions
- No extra database work needed
- Feels natural — once you find the view you like, it just stays that way

### Plan

1. **Save view preference to localStorage** in `MealPlanView.tsx`
   - When the user toggles between Calendar/List, persist the choice to `localStorage` under a key like `"mealPlanPreferredView"`
   - On component mount, read the saved preference and use it as the initial `viewMode` state (defaulting to `"calendar"` if none saved)

2. **Update the view toggle buttons** to include a subtle visual hint (e.g., a small "Default" badge or filled star) on the currently preferred view, so the user knows which is saved

That's it — a small, clean change with immediate usability improvement.

