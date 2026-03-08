

## Meal Vault Redesign + App-Wide Desktop Sizing Fix

Two issues to address:

### Problem 1: App is too narrow on desktop
The main content uses `max-w-2xl` (672px), which looks tiny on a 1920px screen. The bottom nav also stretches full-width with no constraint.

### Problem 2: Meal Vault cards feel cramped
Macro badges overflow/get cut off on image overlays. Cards are dense with small text. No-image cards look sparse compared to image cards.

---

### Changes

**1. Widen the desktop container (`Dashboard.tsx`)**
- Change `max-w-2xl` to `max-w-4xl` (896px) on both the header and main content area
- This gives ~30% more breathing room on desktop while still looking good on mobile
- Constrain the bottom nav to the same max width so it doesn't stretch edge-to-edge

**2. Redesign Meal Vault cards (`MealVault.tsx`)**
- **Grid**: Change from `sm:grid-cols-2 lg:grid-cols-3` to `grid-cols-1 sm:grid-cols-2` — fewer, larger cards that don't feel crammed
- **Image height**: Increase from `h-44` to `h-48` for more visual presence
- **Macro overlay on images**: Switch from horizontal badge row to a cleaner layout — calories prominent, macros on a second line with more spacing so they don't clip
- **No-image cards**: Add a subtle colored placeholder banner (gradient with a fork/knife icon) so they don't look empty
- **Card content padding**: Increase from `px-4 pb-3` to `p-4` for more breathing room
- **Title**: Bump from `text-sm` to `text-base`
- **Tags/metadata**: Give slightly more vertical spacing

**3. Bottom nav desktop constraint (`BottomNav.tsx`)**
- Wrap the nav contents in a `max-w-4xl mx-auto` to match the content width on desktop

### Technical details
- Files to edit: `Dashboard.tsx`, `MealVault.tsx`, `BottomNav.tsx`
- No database changes, no new dependencies
- Pure CSS/layout adjustments

