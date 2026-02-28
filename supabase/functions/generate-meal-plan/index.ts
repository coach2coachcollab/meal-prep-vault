import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { meals, macros, dietPrefs, allergies } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const mealList = meals
      .map(
        (m: any) =>
          `ID:${m.id} "${m.title}" cal:${m.calories} P:${m.protein}g C:${m.carbs}g F:${m.fats}g tags:[${(m.tags || []).join(",")}]`
      )
      .join("\n");

    const systemPrompt = `You are a nutrition coach meal planner. Generate a 7-day meal plan using ONLY the provided recipes.

RULES:
- Each day must have exactly 4 meals: breakfast, lunch, dinner, snack
- Use recipe IDs from the provided list ONLY
- Daily totals should approximate the user's macro targets
- Respect diet preferences and allergies
- Vary meals across days — avoid repeating the same meal on consecutive days
- Return ONLY valid JSON, no markdown

User targets: ${macros.calories} kcal, ${macros.protein_g}g protein, ${macros.carbs_g}g carbs, ${macros.fat_g}g fat
Diet preferences: ${dietPrefs?.length ? dietPrefs.join(", ") : "none"}
Allergies: ${allergies?.length ? allergies.join(", ") : "none"}

Available recipes:
${mealList}`;

    const userPrompt = `Generate a 7-day meal plan. Return JSON with this exact structure:
{
  "days": [
    {
      "day": "Monday",
      "meals": {
        "breakfast": { "meal_id": "...", "title": "..." },
        "lunch": { "meal_id": "...", "title": "..." },
        "dinner": { "meal_id": "...", "title": "..." },
        "snack": { "meal_id": "...", "title": "..." }
      }
    }
  ]
}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
        }),
      }
    );

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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response (may be wrapped in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON in AI response");

    const plan = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(plan), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-meal-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
