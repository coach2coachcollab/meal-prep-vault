import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Use service role to fetch data
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Calculate date range (last 7 days)
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const startDate = weekAgo.toISOString().split("T")[0];
    const endDate = today.toISOString().split("T")[0];

    // Fetch all data in parallel
    const [dailyNotes, journalEntries, waterLogs, habitLogs] = await Promise.all([
      supabase
        .from("journal_daily_notes")
        .select("date, energy_level, mood_emoji, notes")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date"),
      supabase
        .from("journal_entries")
        .select("date, calories, protein_g, carbs_g, fat_g, food_name, meal_type")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date"),
      supabase
        .from("water_logs")
        .select("date, glasses, goal")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date"),
      supabase
        .from("habit_logs")
        .select("date, completed")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date"),
    ]);

    // Build day-by-day summary
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const daySummaries: string[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = dayNames[d.getDay()];

      const note = (dailyNotes.data || []).find((n: any) => n.date === dateStr);
      const meals = (journalEntries.data || []).filter((e: any) => e.date === dateStr);
      const water = (waterLogs.data || []).find((w: any) => w.date === dateStr);
      const habits = (habitLogs.data || []).filter((h: any) => h.date === dateStr);

      const totalCal = meals.reduce((s: number, m: any) => s + (Number(m.calories) || 0), 0);
      const totalProtein = meals.reduce((s: number, m: any) => s + (Number(m.protein_g) || 0), 0);
      const totalCarbs = meals.reduce((s: number, m: any) => s + (Number(m.carbs_g) || 0), 0);
      const totalFat = meals.reduce((s: number, m: any) => s + (Number(m.fat_g) || 0), 0);
      const habitsCompleted = habits.filter((h: any) => h.completed).length;
      const habitsTotal = habits.length;

      let line = `${dayName} (${dateStr}): ${totalCal} cal, P:${totalProtein}g C:${totalCarbs}g F:${totalFat}g`;
      if (water) line += `, water: ${water.glasses}/${water.goal}`;
      if (note?.mood_emoji) line += `, mood: ${note.mood_emoji}`;
      if (note?.energy_level) line += `, energy: ${note.energy_level}/5`;
      if (habitsTotal > 0) line += `, habits: ${habitsCompleted}/${habitsTotal}`;
      if (note?.notes) line += `, note: "${note.notes}"`;

      daySummaries.push(line);
    }

    // Check if there's any data at all
    const hasData = daySummaries.some(
      (s) => !s.includes("0 cal, P:0g C:0g F:0g") || s.includes("mood:") || s.includes("water:")
    );

    if (!hasData) {
      return new Response(
        JSON.stringify({
          insights: ["Not enough data yet. Log some meals, water, or mood this week to get personalized insights!"],
          takeaway: "Start tracking today and check back at the end of the week. 💪",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a friendly wellness coach analyzing a user's weekly health data. Generate exactly 3-4 short, specific, actionable insights based on patterns you see in their mood, energy, nutrition, water intake, and habits. Then provide one short encouraging takeaway sentence.

Be specific — reference actual days, numbers, or patterns. Don't be generic. If data is sparse on some days, note it gently. Keep each insight to 1-2 sentences max.`;

    const userPrompt = `Here is my wellness data for the past 7 days:\n\n${daySummaries.join("\n")}\n\nAnalyze this and give me insights.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "weekly_insights",
              description: "Return structured weekly wellness insights",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-4 specific insight bullet points",
                  },
                  takeaway: {
                    type: "string",
                    description: "One short encouraging closing sentence",
                  },
                },
                required: ["insights", "takeaway"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "weekly_insights" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let result;
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: parse from content
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        insights: ["Could not generate insights. Please try again."],
        takeaway: "Keep tracking your wellness data! 💪",
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-weekly-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
