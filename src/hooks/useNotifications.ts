import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  post_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
  actor_name?: string;
  post_text?: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!data) return;

    const actorIds = [...new Set(data.map((n) => n.actor_id))];
    const postIds = [...new Set(data.map((n) => n.post_id).filter(Boolean))] as string[];

    const [{ data: profiles }, { data: posts }] = await Promise.all([
      supabase.from("profiles").select("user_id, name").in("user_id", actorIds),
      postIds.length > 0
        ? supabase.from("community_posts").select("id, text").in("id", postIds)
        : Promise.resolve({ data: [] }),
    ]);

    const nameMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.name || "User"]));
    const postMap = Object.fromEntries((posts || []).map((p) => [p.id, p.text]));

    const enriched: Notification[] = data.map((n) => ({
      ...n,
      actor_name: nameMap[n.actor_id] || "Someone",
      post_text: n.post_id ? (postMap[n.post_id] || "").slice(0, 60) : undefined,
    }));

    setNotifications(enriched);
    setUnreadCount(enriched.filter((n) => !n.is_read).length);
  }, [user]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [user]);

  const markOneRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const deleteOne = useCallback(async (id: string) => {
    const n = notifications.find((n) => n.id === id);
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (n && !n.is_read) setUnreadCount((c) => Math.max(0, c - 1));
  }, [notifications]);

  const deleteAll = useCallback(async () => {
    if (!user) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
    setNotifications([]);
    setUnreadCount(0);
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => loadNotifications()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadNotifications]);

  return { notifications, unreadCount, markAllRead, markOneRead, deleteOne, deleteAll, reload: loadNotifications };
}
