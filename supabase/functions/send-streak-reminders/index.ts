import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const today = new Date().toISOString().split("T")[0];

    // Get all users with enabled reminders who haven't been reminded today
    const { data: reminders, error: remindersError } = await supabase
      .from("streak_reminders")
      .select("user_id, reminder_time")
      .eq("enabled", true)
      .or(`last_reminder_sent.is.null,last_reminder_sent.neq.${today}`);

    if (remindersError) {
      throw new Error(`Failed to fetch reminders: ${remindersError.message}`);
    }

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: "No reminders to send", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;

    for (const reminder of reminders) {
      // Check if user has logged activity today
      const [{ data: journalToday }, { data: habitsToday }] = await Promise.all([
        supabase
          .from("journal_entries")
          .select("id")
          .eq("user_id", reminder.user_id)
          .eq("date", today)
          .limit(1),
        supabase
          .from("habit_logs")
          .select("id")
          .eq("user_id", reminder.user_id)
          .eq("date", today)
          .eq("completed", true)
          .limit(1),
      ]);

      const hasActivity =
        (journalToday && journalToday.length > 0) ||
        (habitsToday && habitsToday.length > 0);

      if (hasActivity) continue;

      // Get user email and streak info
      const { data: userData } = await supabase.auth.admin.getUserById(
        reminder.user_id
      );

      if (!userData?.user?.email) continue;

      // Get user name
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", reminder.user_id)
        .single();

      const name = profile?.name || "there";

      // Calculate current streak
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const sinceStr = since.toISOString().split("T")[0];

      const [{ data: journalDates }, { data: habitDates }] = await Promise.all([
        supabase
          .from("journal_entries")
          .select("date")
          .eq("user_id", reminder.user_id)
          .gte("date", sinceStr),
        supabase
          .from("habit_logs")
          .select("date")
          .eq("user_id", reminder.user_id)
          .eq("completed", true)
          .gte("date", sinceStr),
      ]);

      const activeDays = new Set<string>();
      journalDates?.forEach((j: { date: string }) => activeDays.add(j.date));
      habitDates?.forEach((h: { date: string }) => activeDays.add(h.date));

      let streak = 0;
      const d = new Date();
      d.setDate(d.getDate() - 1); // Check from yesterday since today has no activity
      while (activeDays.has(d.toISOString().split("T")[0])) {
        streak++;
        d.setDate(d.getDate() - 1);
      }

      // Send email via Resend
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "NutriCoach <onboarding@resend.dev>",
          to: [userData.user.email],
          subject: `🔥 Don't break your ${streak > 0 ? streak + "-day " : ""}streak!`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f7f7f5;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; background: #84cc16; color: #1a1a1a; font-size: 32px; width: 60px; height: 60px; line-height: 60px; border-radius: 50%; margin-bottom: 12px;">🔥</div>
                <h1 style="font-size: 22px; color: #1a1a1a; margin: 0;">Hey ${name}!</h1>
              </div>
              
              <div style="background: white; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 16px;">
                ${streak > 0 
                  ? `<p style="font-size: 16px; color: #333; margin: 0 0 8px;">You have a <strong>${streak}-day streak</strong> going!</p>
                     <p style="font-size: 14px; color: #666; margin: 0;">Don't let it slip — log a meal or complete a habit today to keep it alive.</p>`
                  : `<p style="font-size: 16px; color: #333; margin: 0 0 8px;">Ready to start a new streak?</p>
                     <p style="font-size: 14px; color: #666; margin: 0;">Log a meal or complete a habit today to get started!</p>`
                }
              </div>
              
              <div style="text-align: center; margin-top: 16px;">
                <p style="font-size: 12px; color: #999; margin: 0;">NutriCoach · Your Personal Nutrition Coach</p>
                <p style="font-size: 11px; color: #bbb; margin: 4px 0 0;">You're receiving this because you enabled streak reminders.</p>
              </div>
            </div>
          `,
        }),
      });

      const emailBody = await emailRes.text();
      if (!emailRes.ok) {
        console.error(`Failed to send email to ${userData.user.email}: [${emailRes.status}] ${emailBody}`);
        continue;
      }

      // Update last_reminder_sent
      await supabase
        .from("streak_reminders")
        .update({ last_reminder_sent: today })
        .eq("user_id", reminder.user_id);

      sentCount++;
    }

    return new Response(
      JSON.stringify({ message: `Sent ${sentCount} reminder(s)`, sent: sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in streak reminders:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
