

## Update Quick Add Menu

Change the 4 quick actions in `BottomNav.tsx` from the current 3 (Log Meal, Add Recipe, Log Water) to the requested 4:

1. **Log Food** → Nutrition > Journal (auto-open log dialog) — same as current "Log Meal"
2. **Log Water** → Nutrition > Wellness
3. **Start Workout** → Fitness > Workouts (need to trigger workout start)
4. **Add Habit** → Nutrition > Habits

### Changes

**`src/components/layout/BottomNav.tsx`**
- Replace `quickActions` array with 4 items using appropriate icons (`UtensilsCrossed`, `Droplets`, `Dumbbell`, `CheckSquare`)
- Update tab/sub mappings:
  - Log Food: `tab: "nutrition", sub: "journal"`
  - Log Water: `tab: "nutrition", sub: "water"`
  - Start Workout: `tab: "fitness", sub: "workouts"`
  - Add Habit: `tab: "nutrition", sub: "habits"`

