import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useStreakReminder() {
  const { user } = useAuth();
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTimeState] = useState("18:00");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadSettings();
      checkTodayActivity();
    }
  }, [user]);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    
    // Load from database
    const { data } = await supabase
      .from("streak_reminders")
      .select("enabled, reminder_time")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (data) {
      setReminderEnabled(data.enabled);
      setReminderTimeState(data.reminder_time?.slice(0, 5) || "18:00");
    }
    
    setIsLoading(false);
  }, [user]);

  const saveSettings = useCallback(async (enabled: boolean, time: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from("streak_reminders")
      .upsert({
        user_id: user.id,
        enabled,
        reminder_time: time + ":00",
      }, { onConflict: "user_id" });
    
    if (error) {
      console.error("Failed to save reminder settings:", error);
      toast.error("Failed to save settings");
      return;
    }
    
    setReminderEnabled(enabled);
    setReminderTimeState(time);
  }, [user]);

  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      toast.error("Browser doesn't support notifications");
      return false;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    
    if (permission === "granted") {
      toast.success("Notifications enabled!");
      return true;
    } else {
      toast.error("Notification permission denied");
      return false;
    }
  }, []);

  const checkTodayActivity = useCallback(async () => {
    if (!user) return;
    
    const today = new Date().toISOString().split("T")[0];
    const lastReminder = localStorage.getItem(`streak_reminder_shown_${user.id}_${today}`);
    
    if (lastReminder) return; // Already reminded today

    // Check if reminders are enabled in database
    const { data: settings } = await supabase
      .from("streak_reminders")
      .select("enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (!settings?.enabled) return;

    // Check if user has logged anything today
    const [{ data: journalToday }, { data: habitsToday }] = await Promise.all([
      supabase
        .from("journal_entries")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .limit(1),
      supabase
        .from("habit_logs")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .eq("completed", true)
        .limit(1),
    ]);

    const hasActivity = (journalToday && journalToday.length > 0) || (habitsToday && habitsToday.length > 0);

    if (!hasActivity) {
      // Show in-app reminder
      setTimeout(() => {
        toast("🔥 Keep your streak alive!", {
          description: "Don't forget to log a meal or complete a habit today!",
          duration: 8000,
          action: {
            label: "Got it",
            onClick: () => {},
          },
        });
        
        // Also show browser notification if permitted
        if (Notification.permission === "granted") {
          new Notification("🔥 Streak Reminder", {
            body: "Don't forget to log a meal or complete a habit today!",
            icon: "/favicon.ico",
            tag: "streak-reminder",
          });
        }
        
        localStorage.setItem(`streak_reminder_shown_${user.id}_${today}`, "true");
      }, 3000);
    }
  }, [user]);

  const enableReminder = useCallback(async (time: string) => {
    const hasPermission = notificationPermission === "granted" || await requestNotificationPermission();
    // Enable even without browser notification permission - we'll send emails
    await saveSettings(true, time);
    toast.success("Daily reminders enabled! You'll receive email reminders too.");
  }, [notificationPermission, requestNotificationPermission, saveSettings]);

  const disableReminder = useCallback(async () => {
    await saveSettings(false, reminderTime);
    toast("Daily reminders disabled");
  }, [reminderTime, saveSettings]);

  return {
    reminderEnabled,
    reminderTime,
    notificationPermission,
    isLoading,
    enableReminder,
    disableReminder,
    setReminderTime: (time: string) => saveSettings(reminderEnabled, time),
  };
}
