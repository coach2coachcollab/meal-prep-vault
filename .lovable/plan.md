

## Plan: Move streak badge and profile button to the sticky header bar

**Goal:** Place the streak counter (🔥) and a profile avatar/button in the top header, on the same line as the notification bell. Order: streak → notification bell → profile button (left to right, right-aligned).

### Steps

1. **Lift streak data out of HomeDashboard into Dashboard**
   - Extract the `loadStreak` logic from `HomeDashboard.tsx` into the `Dashboard.tsx` component (or a small custom hook) so the streak value is available in the header at all times, not just on the home tab.
   - Remove the streak badge from the HomeDashboard header section (lines 258-263).

2. **Add profile button to the header in Dashboard.tsx**
   - Import `User` icon (or `Avatar` component).
   - Add a clickable profile button that sets `activeTab` to `"profile"` when clicked.

3. **Update the header layout in Dashboard.tsx**
   - Change the header `div` (line 91) to include three items in a row (right-aligned):
     - Streak badge (conditionally rendered when streak > 0)
     - NotificationBell (existing)
     - Profile button (new)
   - Use `flex items-center gap-2 justify-end`.

4. **Adjust HomeDashboard header**
   - Remove the streak badge from the top-right of HomeDashboard since it now lives in the global header.
   - The greeting text can span full width.

### Technical Details

- The streak logic (~40 lines in `loadStreak`) will be extracted. It queries `meal_journal` and `habit_completions` for distinct dates to compute consecutive days. This will run on mount in `Dashboard.tsx` using `useAuth` for the user context.
- The profile button will be a simple ghost `Button` with `User` icon, matching the `NotificationBell` style (`h-9 w-9`).

