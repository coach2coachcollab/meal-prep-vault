import { Bell, Check, MessageCircle, Heart, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications, Notification } from "@/hooks/useNotifications";

const typeConfig: Record<string, { icon: typeof Bell; label: string }> = {
  reaction: { icon: Heart, label: "reacted to your post" },
  comment: { icon: MessageCircle, label: "commented on your post" },
  reply: { icon: Reply, label: "replied to your comment" },
  comment_like: { icon: Heart, label: "liked your comment" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

function NotificationItem({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  const config = typeConfig[n.type] || { icon: Bell, label: "sent you a notification" };
  const Icon = config.icon;

  return (
    <button
      onClick={() => !n.is_read && onRead(n.id)}
      className={cn(
        "w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors",
        n.is_read ? "opacity-60" : "bg-primary/5 hover:bg-primary/10"
      )}
    >
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
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
      {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />}
    </button>
  );
}

interface NotificationBellProps {
  onNavigateToCommunity?: () => void;
}

export function NotificationBell({ onNavigateToCommunity }: NotificationBellProps) {
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <Check className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="p-1 space-y-0.5">
              {notifications.map((n) => (
                <NotificationItem key={n.id} n={n} onRead={markOneRead} />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
