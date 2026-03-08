

# Revised Full App Audit: NutriCoach

---

## 1. App Overview

NutriCoach is a mobile-first nutrition coaching platform with authentication, onboarding, macro tracking, meal planning, community features, and progress tracking. React + Vite + Tailwind, Lovable Cloud backend.

---

## 2. Feature Inventory

### Authentication & Onboarding
| Feature | Status | Notes |
|---------|--------|-------|
| Email/password sign up & login | Done | Email confirmation required |
| Google OAuth | Done | |
| Forgot/reset password flow | Done | Dedicated pages |
| 5-step onboarding wizard | Done | Goal, activity, diet, allergies, body stats |
| Role-based access (admin/coach/user) | Done | `user_roles` table + `AdminRoute` component |

### Home Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| Personalized greeting | Done | Time-based with user name |
| Daily calorie ring + macro summary | Done | |
| Habits done / Water glasses widgets | Done | Clickable, navigate to sub-tabs |
| Weekly/monthly progress summary card | Done | Weight & waist change |
| Daily tip rotation | Done | Static tip array |
| Milestone toasts | Done | 10/50/100 meals, goal weight reached |

### Nutrition Tab (4 sub-tabs)
| Feature | Status | Notes |
|---------|--------|-------|
| **Meal Journal** — log food by date | Done | Manual entry or pick from vault |
| Journal — photo upload with AI extraction | Done | Edge function |
| Journal — mood/energy/notes per day | Done | |
| Journal — edit & delete entries (... menu) | Done | Recently added |
| Journal — save-to-vault toggle | Done | |
| **Water Tracker** — glasses +/- per day | Done | With goal setting |
| Water — mood/energy tracking | Done | Shared daily notes |
| Water — weekly summary charts | Done | |
| Water — AI weekly insights | Done | Edge function, includes Mood-Nutrition scatter chart |
| **Habit Tracker** — daily check-off | Done | Auto-seeds defaults based on goal |
| Habits — streak per habit | Done | N+1 query issue (see Technical Debt) |
| Habits — weekly grid view | Done | |
| Habits — add/delete custom habits | Done | |
| **Meal Vault** — recipe library | Done | User's own + public meals |
| Vault — create/edit/delete recipes | Done | With image upload |
| Vault — favorites | Done | Uses `favorite_meals` table |
| Vault — ratings & comments | Done | |
| Vault — category/cuisine filters | Done | |
| Vault — meal detail + plan views | Done | |

### Plan Tab (3 sub-tabs)
| Feature | Status | Notes |
|---------|--------|-------|
| **Add Recipe** — manual recipe form | Done | With image upload |
| **Shopping/Grocery List** — CRUD items | Done | Check/uncheck, copy, share |
| **Macro Calculator** — BMR/TDEE calc | Done | Saves to `user_macros` |
| Macro Calculator — metric/imperial toggle | Done | |

### Community Tab
| Feature | Status | Notes |
|---------|--------|-------|
| Channel-based posts | Done | announcements, wins, meals, questions |
| Create post with image | Done | |
| Reactions, comments, nested replies | Done | |
| Comment likes | Done | |
| Save/bookmark posts | Done | |
| Deep-link to specific post | Done | Via notifications |

### Profile Tab (3 sub-tabs)
| Feature | Status | Notes |
|---------|--------|-------|
| Edit name, avatar, body stats | Done | |
| Diet prefs, allergies, goal editing | Done | |
| Metric/imperial + dark/light theme | Done | |
| **Progress Tracker** — weight/measurements log | Done | Multi-angle photos, line charts |
| Progress — before/after comparison | Done | |
| Progress — PDF export | Done | jsPDF |
| **Partner Hub (Deals)** — partner listings | Done | Category filter, promo codes |

### Global Features
| Feature | Status | Notes |
|---------|--------|-------|
| Streak counter in header | Done | |
| Streak details page with milestones | Done | Confetti |
| Streak email reminders | Done | Via Resend |
| Notification bell with realtime | Done | Postgres realtime subscription |
| Bottom nav with quick-add FAB | Done | |
| Dark/light theme | Done | |
| Loading skeletons | Done | |
| Admin recipe import page | Done | |

---

## 3. Backend Functions

| Function | Purpose | Auth Strategy |
|----------|---------|---------------|
| `generate-meal-plan` | AI 7-day meal plan | **None — open** |
| `extract-recipe-from-image` | AI recipe from photo | **None — open** |
| `generate-weekly-summary` | AI weekly insights | JWT verified in code |
| `send-streak-reminders` | Email via Resend | **Cron-style — needs secret/header check** |

Note: `verify_jwt = false` in config means the gateway doesn't reject requests, but it doesn't mean the function validates tokens either. `generate-meal-plan` and `extract-recipe-from-image` do **zero** auth checks in their code. `send-streak-reminders` is legitimately serverless-cron and can't use a user JWT — it needs a shared secret header instead.

---

## 4. Security & Stability Issues (Priority Order)

### P0 — Secure edge functions
The two AI functions (`generate-meal-plan`, `extract-recipe-from-image`) have no authentication at all. Anyone with the function URL can call them and burn AI credits. A single abuse script could generate thousands of requests.

**Cost exposure estimate**: Each AI call costs roughly $0.01–0.05. An automated attacker doing 10k calls in an hour = $100–500 in credits, with no rate limiting in place.

**Fix**: Add `getClaims()` JWT validation in both functions. For `send-streak-reminders`, add a shared secret header check since it's invoked by a scheduler, not a user.

### P1 — Fix profiles RLS for community
Current policy: users can only read their own profile. This means community posts, comments, and notifications cannot resolve author names or avatars for other users. The `useNotifications` hook queries profiles with `.in("user_id", actorIds)` which silently returns empty for other users.

**Fix**: Add a SELECT policy allowing authenticated users to read `name` and `avatar_url` columns (or all columns if acceptable).

### P2 — Error boundaries
No React error boundaries exist. A crash in any component (e.g., a null reference in `MoodNutritionChart`) takes down the entire page. Add at minimum a top-level boundary and per-tab boundaries.

### P3 — Pagination
All list views (`community_posts`, `meals`, `journal_entries`) load without pagination. Supabase has a 1000-row default limit, but more importantly, loading everything into memory on the client degrades performance and increases bandwidth costs as data grows.

---

## 5. Technical Debt

### Dead schema: `user_favorites` table
Both `favorite_meals` and `user_favorites` tables exist. Only `favorite_meals` is used in code. `user_favorites` is dead schema and should be dropped.

### Dead feature: `challenges` table
Table exists with data schema but zero frontend code references it. Either build the UI or drop the table.

### No test coverage
The project has `vitest` configured with a single placeholder test (`example.test.ts` that asserts `true === true`). For a health/nutrition app where macro calculations, streak logic, and calorie tracking directly affect user outcomes, this is a significant gap. Key areas needing tests:
- Macro calculator (BMR/TDEE formulas)
- Streak calculation logic
- Journal entry CRUD
- Edge function response parsing

### No React Query adoption
`@tanstack/react-query` is installed but virtually unused. All data fetching uses raw `useEffect` + `supabase` calls with manual loading/error state. This means no caching, no background refetch, no optimistic updates, and duplicated loading patterns across every component.

### Large components
`ProgressTracker.tsx` (891 lines), `MealJournal.tsx` (526 lines), `MealVault.tsx` (514 lines) should be decomposed.

### Habit streak N+1 queries
HabitTracker makes one query per habit to calculate streaks. With 10+ habits, this is 10+ sequential queries on every load.

### Form validation
`react-hook-form` + `zod` are installed but forms use manual validation throughout.

---

## 6. Missing Capabilities

| Gap | Impact | Effort |
|-----|--------|--------|
| No search in Meal Journal | Users can't find past entries | Low |
| No barcode/food database lookup | Manual calorie entry only | High (API integration) |
| No meal plan calendar view | Plans are list-only, no date sync | Medium |
| No push notifications / PWA | No offline, no mobile install | Medium |
| No data export (beyond progress PDF) | Users can't back up their data | Low |
| No social follow system | Community is flat, no user connections | Medium |
| No grocery list auto-generation from meal plans | Grocery list is fully manual | Medium |

---

## 7. Accessibility & Responsiveness

### Accessibility (not audited, gaps likely)
- No evidence of `aria-label` usage on icon-only buttons (FAB, notification bell, theme toggle)
- Color contrast with dark/light theme toggle needs validation — especially for the muted-foreground colors used extensively
- Keyboard navigation for bottom nav, dialogs, and dropdown menus (Radix provides some of this, but custom components may not)
- Screen reader support for progress charts (Recharts doesn't output accessible markup by default)

### Responsiveness
- Bottom nav suggests mobile-first design, but no systematic testing at 375px / 414px / tablet breakpoints is documented
- Recent fix: responsive buttons in MealVault header (icon-only on small screens)
- `max-w-4xl` container may cause awkward whitespace on large screens
- Charts (Recharts) may overflow or compress poorly at narrow widths

---

## 8. App Flow

```text
/auth → /onboarding (5 steps) → / (Dashboard)
                                    │
        ┌───────────┬───────┬───────┴───────┬──────────┐
        Home     Nutrition  (+)FAB      Plan       Community
        │        │                      │           │
        Dashboard  ├─ Journal           ├─ Recipe   Channels
        (macros,   ├─ Water             ├─ Grocery  Posts
         habits,   ├─ Habits            └─ Macros   Comments
         water,    └─ Vault
         progress)
                                    Profile (via header)
                                    ├─ Profile
                                    ├─ Progress
                                    └─ Deals

Admin: /admin/import-recipes
```

---

## 9. Recommended Priority Order

| # | Task | Type | Why |
|---|------|------|-----|
| 1 | Secure AI edge functions with JWT validation | Security | Open credit burn risk |
| 2 | Fix profiles RLS for community reads | Broken functionality | Author names/avatars invisible |
| 3 | Add React error boundaries | Stability | Single crash kills entire app |
| 4 | Add pagination to lists | Performance/cost | Memory + bandwidth at scale |
| 5 | Adopt React Query for data fetching | Developer experience | Caching, loading states, reliability |
| 6 | Drop dead schema (`user_favorites`) | Cleanup | Confusion risk |
| 7 | Add unit tests for core logic | Quality | Macro/streak calculations affect health outcomes |
| 8 | Build Challenges UI | Feature | Existing table, no frontend |
| 9 | Auto-generate grocery list from meal plans | Feature | High user value |
| 10 | PWA support | Feature | Mobile install + offline |

---

## 10. Database Summary (22 tables, 1 dead)

| Table | Purpose | Status |
|-------|---------|--------|
| profiles | User data | Active, RLS needs community fix |
| user_roles | Role-based access | Active |
| user_macros | Macro targets | Active |
| user_habits / habit_logs | Habit definitions + daily logs | Active |
| journal_entries / journal_daily_notes | Food log + mood/energy | Active |
| meals | Recipe library | Active |
| meal_ratings | Star ratings | Active |
| favorite_meals | Favorited meals | Active |
| **user_favorites** | **Duplicate of favorite_meals** | **Dead — drop** |
| meal_plans / meal_plan_entries | Saved plans | Active |
| grocery_lists / grocery_list_items | Shopping lists | Active |
| shopping_lists | Alt shopping (JSON) | Active (may also be redundant) |
| water_logs | Daily water intake | Active |
| progress_logs / progress_photos | Weight/measurement tracking | Active |
| community_posts / post_comments / post_reactions | Social features | Active |
| comment_likes / saved_posts | Engagement | Active |
| notifications | In-app notifications | Active |
| partners / partner_clicks | Partner deals | Active |
| challenges | Challenge definitions | Active schema, no UI |
| streak_reminders | Email reminder prefs | Active |
| macro_calculations | Calculation history | Active |

