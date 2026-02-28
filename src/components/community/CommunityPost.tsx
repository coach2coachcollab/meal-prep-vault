import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessageCircle, MoreHorizontal, Pencil, Trash2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const reactions = ["💪", "❤️", "🎉", "🔥", "👏"];

export interface PostData {
  id: string;
  user_id: string;
  channel: string;
  text: string;
  image_url: string | null;
  created_at: string;
  user_name?: string;
  avatar_url?: string;
  reaction_counts: Record<string, number>;
  user_reactions: string[];
  comment_count: number;
}

interface CommunityPostProps {
  post: PostData;
  currentUserId: string;
  onToggleReaction: (postId: string, type: string) => void;
  onOpenComments: (postId: string) => void;
  onDeletePost: (postId: string) => void;
  onEditPost: (postId: string, newText: string) => void;
}

export function CommunityPost({ post, currentUserId, onToggleReaction, onOpenComments, onDeletePost, onEditPost }: CommunityPostProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.text);

  const isOwner = post.user_id === currentUserId;

  const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== post.text) {
      onEditPost(post.id, editText.trim());
    }
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(post.text);
    setEditing(false);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9">
            {post.avatar_url && <AvatarImage src={post.avatar_url} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials(post.user_name || "U")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{post.user_name || "User"}</span>
                <span className="text-[11px] text-muted-foreground">{timeAgo(post.created_at)}</span>
              </div>
              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditText(post.text); setEditing(true); }}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => onDeletePost(post.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {editing ? (
              <div className="mt-2 space-y-2">
                <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} className="text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                    <X className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit}>
                    <Check className="h-3 w-3 mr-1" /> Save
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm mt-1 whitespace-pre-wrap">{post.text}</p>
            )}

            {/* Image */}
            {post.image_url && (
              <div className="mt-2 rounded-lg overflow-hidden">
                <img src={post.image_url} alt="Post" className="w-full max-h-72 object-cover rounded-lg" />
              </div>
            )}

            {/* Reactions + comments */}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {reactions.map((r) => {
                const count = post.reaction_counts[r] || 0;
                const active = post.user_reactions.includes(r);
                return (
                  <button
                    key={r}
                    onClick={() => onToggleReaction(post.id, r)}
                    className={cn(
                      "flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors",
                      active ? "bg-primary/10 border-primary/30" : "border-transparent hover:bg-muted"
                    )}
                  >
                    {r} {count > 0 && <span className="font-medium">{count}</span>}
                  </button>
                );
              })}
              <button
                onClick={() => onOpenComments(post.id)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-auto px-2 py-1"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{post.comment_count} {post.comment_count === 1 ? "comment" : "comments"}</span>
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
