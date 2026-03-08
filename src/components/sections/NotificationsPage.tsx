import { useState } from "react";
import { Bell, Check, MessageCircle, Heart, Reply, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useNotifications, Notification } from "@/hooks/useNotifications";

const typeConfig: Record<string, { icon: typeof Bell; label: string; filterLabel: string }> = {
  reaction: { icon: Heart, label: "reacted to your post", filterLabel: "Reactions" },
  comment: { icon: MessageCircle, label: "commented on your post", filterLabel: "Comments" },
  reply: { icon: Reply, label: "replied to your comment", filterLabel: "Replies" },
  comment_like: { icon: Heart, label: "liked your comment", filterLabel: "Comment Likes" },
};

const filterOptions = [
  { id: "all", label: "All" },
  { id: "reaction", label: "💪 Reactions" },
  { id: "comment", label: "💬 Comments" },
  { id: "reply", label: "↩️ Replies" },
  { id: "comment_like", label: "❤️ Likes" },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function groupByDate(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, Notification[]> = { Today: [], Yesterday: [], "This Week": [], Earlier: [] };

  notifications.forEach((n) => {
    const d = new Date(n.created_at);
    if (d >= today) groups["Today"].push(n);
    else if (d >= yesterday) groups["Yesterday"].push(n);
    else if (d >= weekAgo) groups["This Week"].push(n);
    else groups["Earlier"].push(n);
  });

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

interface NotificationsPageProps {
  onNavigateToPost?: (postId: string) => void;
}

export function NotificationsPage({ onNavigateToPost }: NotificationsPageProps) {
  const { notifications, unreadCount, markAllRead, markOneRead, deleteOne, deleteAll } = useNotifications();
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered = activeFilter === "all"
    ? notifications
    : notifications.filter((n) => n.type === activeFilter);

  const grouped = groupByDate(filtered);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading">Notifications</h2>
          <p className="text-xs text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={markAllRead}>
              <Check className="h-3.5 w-3.5 mr-1" /> Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={deleteAll}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {filterOptions.map((f) => (
          <Badge
            key={f.id}
            variant={activeFilter === f.id ? "default" : "outline"}
            className={cn(
              "cursor-pointer whitespace-nowrap px-3 py-1.5 transition-colors",
              activeFilter === f.id && "bg-primary text-primary-foreground"
            )}
            onClick={() => setActiveFilter(f.id)}
          >
            {f.label}
          </Badge>
        ))}
      </div>

      {/* Notification groups */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground font-medium">
              {activeFilter === "all" ? "No notifications yet" : "No notifications of this type"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {activeFilter === "all"
                ? "Interact with posts to start receiving notifications"
                : "Try a different filter"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((n) => {
                  const config = typeConfig[n.type] || { icon: Bell, label: "sent you a notification" };
                  const Icon = config.icon;
                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.is_read) markOneRead(n.id);
                        if (n.post_id && onNavigateToPost) onNavigateToPost(n.post_id);
                      }}
                      className={cn(
                        "w-full text-left flex items-start gap-3 px-3 py-3 rounded-xl transition-colors cursor-pointer group",
                        n.is_read ? "opacity-60 hover:opacity-80" : "bg-primary/5 hover:bg-primary/10"
                      )}
                    >
                      <div className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        n.is_read ? "bg-muted" : "bg-primary/10"
                      )}>
                        <Icon className={cn("h-4 w-4", n.is_read ? "text-muted-foreground" : "text-primary")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-semibold">{n.actor_name}</span>{" "}
                          <span className="text-muted-foreground">{config.label}</span>
                        </p>
                        {n.post_text && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">"{n.post_text}"</p>
                        )}
                        <span className="text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                      </div>
                      {!n.is_read && <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0 mt-2.5" />}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteOne(n.id); }}
                        className="shrink-0 mt-1 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete notification"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
