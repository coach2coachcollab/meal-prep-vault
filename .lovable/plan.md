

## Plan: AI-Powered Weekly Wellness Summary

**Best option: An AI weekly summary card** that analyzes your mood, energy, water, meals, and habits data together — and gives you a short, personalized insight like "You felt most energized on days you hit your protein target" or "Your mood dipped mid-week when water intake dropped."

This is the best because:
- You already track all the data (mood, energy, water, meals, habits) but nothing connects them today
- A weekly summary turns raw numbers into actionable insights without requiring you to analyze charts yourself
- It appears once a week (or on demand), keeping it lightweight and not noisy

### Steps

1. **Create a backend function `generate-weekly-summary`**
   - Queries the last 7 days of `journal_daily_notes`, `journal_entries`, `water_logs`, and `habit_logs` for the user
   - Builds a structured prompt with the data (e.g., "Monday: 2100 cal, 120g protein, mood 😊, energy 4/5, 8 glasses water, 3/4 habits done")
   - Calls Lovable AI (gemini-3-flash-preview) to generate 3-4 short bullet-point insights and one encouraging takeaway
   - Returns the summary text

2. **Add a "Weekly Insights" card to the Wellness tab (WaterTracker)**
   - Sits below `WeeklySummaryCharts`
   - Shows a "Generate Weekly Insights" button (or auto-generates on first visit each week)
   - Displays the AI-generated bullet points in a clean card with a sparkle/brain icon
   - Caches the result in `localStorage` with the week key so it doesn't re-generate unnecessarily

3. **UI design**
   - Card with gradient accent border, brain/sparkle icon header
   - Bullet points for insights, a motivational closing line
   - "Refresh" button to regenerate if the user wants

### Technical Details

- Edge function: `supabase/functions/generate-weekly-summary/index.ts`
  - Accepts `{ user_id }`, fetches last 7 days of data from 4 tables using service role
  - Uses Lovable AI gateway with tool calling to return structured `{ insights: string[], takeaway: string }`
- Frontend cache key: `weekly_summary_${userId}_${weekStart}` in localStorage
- No new database tables needed — reads existing data only

