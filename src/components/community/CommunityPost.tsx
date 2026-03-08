import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PinchZoomImage } from "@/components/community/PinchZoomImage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessageCircle, MoreHorizontal, Pencil, Trash2, X, Check, Bookmark, Send, ChevronDown, ChevronUp, Heart, Reply } from "lucide-react";
import { cn } from "@/lib/utils";

const reactions = ["💪", "❤️", "🎉", "🔥", "👏"];
const commentReactions = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

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
  is_saved: boolean;
}

export interface InlineComment {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  user_name?: string;
  like_count: number;
  is_liked: boolean;
  user_reaction: string | null;
  reaction_counts: Record<string, number>;
  parent_id: string | null;
  replies?: InlineComment[];
}

interface CommunityPostProps {
  post: PostData;
  currentUserId: string;
  onToggleReaction: (postId: string, type: string) => void;
  onDeletePost: (postId: string) => void;
  onEditPost: (postId: string, newText: string) => void;
  onToggleSave: (postId: string) => void;
  onLoadComments: (postId: string) => Promise<InlineComment[]>;
  onAddComment: (postId: string, text: string, parentId?: string) => Promise<void>;
  onEditComment: (commentId: string, newText: string) => Promise<void>;
  onDeleteComment: (commentId: string, postId: string) => Promise<void>;
  onToggleCommentLike: (commentId: string, postId: string, reactionType: string) => Promise<void>;
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
};

const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

function buildCommentTree(comments: InlineComment[]): InlineComment[] {
  const map = new Map<string, InlineComment>();
  const roots: InlineComment[] = [];
  comments.forEach((c) => map.set(c.id, { ...c, replies: [] }));
  comments.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

interface CommentItemProps {
  comment: InlineComment;
  currentUserId: string;
  postId: string;
  depth: number;
  editingCommentId: string | null;
  editCommentText: string;
  replyingToId: string | null;
  replyText: string;
  onSetEditing: (id: string | null, text?: string) => void;
  onSaveEdit: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleLike: (commentId: string, reactionType: string) => void;
  onSetReplying: (id: string | null) => void;
  onReplyTextChange: (text: string) => void;
  onSubmitReply: () => Promise<void>;
  setEditCommentText: (text: string) => void;
}

// Renders comment text with @mentions bolded
function renderCommentText(text: string) {
  const parts = text.split(/(@\w[\w\s]*?\b)(?=\s|$)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-bold text-primary">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function CommentItem({
  comment: c, currentUserId, postId, depth,
  editingCommentId, editCommentText, replyingToId, replyText,
  onSetEditing, onSaveEdit, onDelete, onToggleLike,
  onSetReplying, onReplyTextChange, onSubmitReply, setEditCommentText,
}: CommentItemProps) {
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replyCount = c.replies?.length || 0;
  const shouldCollapse = depth === 0 && replyCount > 1;

  return (
    <div className={cn("flex gap-2", depth > 0 && "ml-6 mt-0.5")}>
      <Avatar className={cn("shrink-0 mt-0.5", depth > 0 ? "h-6 w-6" : "h-8 w-8")}>
        <AvatarFallback className="text-[10px] bg-muted font-semibold">
          {initials(c.user_name || "U")}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        {editingCommentId === c.id ? (
          <div className="flex gap-1">
            <Input
              value={editCommentText}
              onChange={(e) => setEditCommentText(e.target.value)}
              className="h-7 text-sm"
              onKeyDown={(e) => e.key === "Enter" && onSaveEdit()}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onSetEditing(null)}>
              <X className="h-3 w-3" />
            </Button>
            <Button size="icon" className="h-7 w-7 shrink-0" onClick={onSaveEdit}>
              <Check className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="bg-muted/60 rounded-2xl px-3 py-1.5 inline-block max-w-full">
            <span className="text-[13px] font-bold block leading-tight">{c.user_name}</span>
            <p className="text-sm leading-snug">{renderCommentText(c.text)}</p>
          </div>
        )}

        {/* Action row */}
        {editingCommentId !== c.id && (
          <div className="flex items-center gap-3 px-1 text-[11px] leading-none mt-0.5">
            <span className="text-muted-foreground">{timeAgo(c.created_at)}</span>
            
            {/* Facebook-style emoji reaction on Like */}
            <div className="relative group">
              <button
                className={cn(
                  "font-semibold select-none",
                  c.user_reaction ? "text-destructive" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => {
                  if (!emojiPickerOpen) onToggleLike(c.id, c.user_reaction || "👍");
                  setEmojiPickerOpen(false);
                }}
                onTouchStart={() => {
                  longPressTimer.current = setTimeout(() => setEmojiPickerOpen(true), 400);
                }}
                onTouchEnd={() => {
                  if (longPressTimer.current) clearTimeout(longPressTimer.current);
                }}
                onTouchMove={() => {
                  if (longPressTimer.current) clearTimeout(longPressTimer.current);
                }}
              >
                {c.user_reaction ? `${c.user_reaction} Like` : "Like"}
              </button>
              {/* Emoji picker - hover on desktop, long-press on mobile */}
              <div className={cn(
                "absolute bottom-full left-0 mb-1 items-center gap-0.5 bg-card border border-border rounded-full px-1.5 py-1 shadow-lg z-50 whitespace-nowrap",
                emojiPickerOpen ? "flex" : "hidden group-hover:flex"
              )}>
                {commentReactions.map((emoji) => (
                  <button
                    key={emoji}
                    className={cn(
                      "text-base hover:scale-125 active:scale-125 transition-transform px-0.5",
                      c.user_reaction === emoji && "scale-125"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLike(c.id, emoji);
                      setEmojiPickerOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {/* Backdrop to close picker on mobile */}
              {emojiPickerOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setEmojiPickerOpen(false)} />
              )}
            </div>

            {/* Show aggregated reaction emojis */}
            {Object.keys(c.reaction_counts).length > 0 && (
              <span className="flex items-center gap-0.5">
                {Object.entries(c.reaction_counts).map(([emoji, count]) => (
                  <span key={emoji} className="text-[11px]">{emoji}{count > 1 && count}</span>
                ))}
              </span>
            )}

            {depth < 2 && (
              <button
                className="font-semibold text-muted-foreground hover:text-foreground"
                onClick={() => onSetReplying(replyingToId === c.id ? null : c.id)}
              >
                Reply
              </button>
            )}
            {c.user_id === currentUserId && (
              <>
                <button
                  className="font-semibold text-muted-foreground hover:text-foreground"
                  onClick={() => onSetEditing(c.id, c.text)}
                >
                  Edit
                </button>
                <button
                  className="font-semibold text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(c.id)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}

        {/* Reply input */}
        {replyingToId === c.id && (
          <div className="flex gap-1.5 mt-1">
            <Input
              placeholder={`Reply to ${c.user_name}...`}
              value={replyText}
              onChange={(e) => onReplyTextChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmitReply()}
              className="flex-1 h-7 text-sm rounded-full"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onSetReplying(null)}>
              <X className="h-3 w-3" />
            </Button>
            <Button size="icon" className="h-7 w-7 shrink-0" onClick={onSubmitReply} disabled={!replyText.trim()}>
              <Send className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Nested replies */}
        {c.replies && replyCount > 0 && (
          <div className="mt-0.5">
            {shouldCollapse && !repliesExpanded ? (
              <button
                className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline ml-1 mt-1"
                onClick={() => setRepliesExpanded(true)}
              >
                <Reply className="h-3 w-3" />
                View {replyCount} {replyCount === 1 ? "reply" : "replies"}
              </button>
            ) : (
              <>
                {shouldCollapse && (
                  <button
                    className="flex items-center gap-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground ml-1 mt-1 mb-0.5"
                    onClick={() => setRepliesExpanded(false)}
                  >
                    <ChevronUp className="h-3 w-3" />
                    Hide replies
                  </button>
                )}
                {c.replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    currentUserId={currentUserId}
                    postId={postId}
                    depth={depth + 1}
                    editingCommentId={editingCommentId}
                    editCommentText={editCommentText}
                    replyingToId={replyingToId}
                    replyText={replyText}
                    onSetEditing={onSetEditing}
                    onSaveEdit={onSaveEdit}
                    onDelete={onDelete}
                    onToggleLike={onToggleLike}
                    onSetReplying={onSetReplying}
                    onReplyTextChange={onReplyTextChange}
                    onSubmitReply={onSubmitReply}
                    setEditCommentText={setEditCommentText}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommunityPost({
  post, currentUserId, onToggleReaction, onDeletePost, onEditPost,
  onToggleSave, onLoadComments, onAddComment, onEditComment, onDeleteComment, onToggleCommentLike,
}: CommunityPostProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.text);
  const [imageOpen, setImageOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<InlineComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const isOwner = post.user_id === currentUserId;

  const toggleComments = async () => {
    if (commentsOpen) { setCommentsOpen(false); return; }
    setLoadingComments(true);
    const data = await onLoadComments(post.id);
    setComments(data);
    setCommentsOpen(true);
    setLoadingComments(false);
  };

  const refreshComments = async () => {
    const data = await onLoadComments(post.id);
    setComments(data);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await onAddComment(post.id, newComment.trim());
    setNewComment("");
    await refreshComments();
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim() || !replyingToId) return;
    await onAddComment(post.id, replyText.trim(), replyingToId);
    setReplyText("");
    setReplyingToId(null);
    await refreshComments();
  };

  const handleSaveCommentEdit = async () => {
    if (editingCommentId && editCommentText.trim()) {
      await onEditComment(editingCommentId, editCommentText.trim());
      await refreshComments();
    }
    setEditingCommentId(null);
  };

  const handleDeleteComment = async (commentId: string) => {
    await onDeleteComment(commentId, post.id);
    await refreshComments();
  };

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== post.text) onEditPost(post.id, editText.trim());
    setEditing(false);
  };

  const commentTree = buildCommentTree(comments);

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
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{post.user_name || "User"}</span>
                <span className="text-[11px] text-muted-foreground">{timeAgo(post.created_at)}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggleSave(post.id)}>
                  <Bookmark className={cn("h-4 w-4", post.is_saved ? "text-primary fill-primary" : "text-muted-foreground")} />
                </Button>
                {isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
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
            </div>

            {/* Post body */}
            {editing ? (
              <div className="mt-2 space-y-2">
                <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} className="text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditText(post.text); setEditing(false); }}>
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

            {post.image_url && (
              <>
                <div
                  className="mt-2 -mx-3 sm:mx-0 sm:rounded-lg overflow-hidden aspect-square cursor-pointer"
                  onClick={() => setImageOpen(true)}
                >
                  <img src={post.image_url} alt="Post" className="w-full h-full object-cover sm:rounded-lg" />
                </div>
                <Dialog open={imageOpen} onOpenChange={setImageOpen}>
                  <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none [&>button]:text-white [&>button]:bg-black/50 [&>button]:rounded-full [&>button]:h-8 [&>button]:w-8">
                    <PinchZoomImage src={post.image_url} alt="Post full" />
                  </DialogContent>
                </Dialog>
              </>
            )}

            {/* Reactions */}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {reactions.map((r) => {
                const count = post.reaction_counts[r] || 0;
                const active = post.user_reactions.includes(r);
                return (
                  <button key={r} onClick={() => onToggleReaction(post.id, r)} className={cn(
                    "flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors",
                    active ? "bg-primary/10 border-primary/30" : "border-transparent hover:bg-muted"
                  )}>
                    {r} {count > 0 && <span className="font-medium">{count}</span>}
                  </button>
                );
              })}
              <button onClick={toggleComments} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-auto px-2 py-1">
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{post.comment_count}</span>
                {commentsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {/* Comments */}
            {commentsOpen && (
              <div className="mt-2 border-t pt-2 flex flex-col gap-2">
                {loadingComments ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Loading...</p>
                ) : (
                  <>
                    {commentTree.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-1">No comments yet</p>
                    )}
                    {commentTree.map((c) => (
                      <CommentItem
                        key={c.id}
                        comment={c}
                        currentUserId={currentUserId}
                        postId={post.id}
                        depth={0}
                        editingCommentId={editingCommentId}
                        editCommentText={editCommentText}
                        replyingToId={replyingToId}
                        replyText={replyText}
                        onSetEditing={(id, text) => { setEditingCommentId(id); if (text) setEditCommentText(text); }}
                        onSaveEdit={handleSaveCommentEdit}
                        onDelete={handleDeleteComment}
                        onToggleLike={async (commentId, reactionType) => { await onToggleCommentLike(commentId, post.id, reactionType); await refreshComments(); }}
                        onSetReplying={(id) => {
                          setReplyingToId(id);
                          if (id) {
                            const target = comments.find((cm) => cm.id === id);
                            if (target?.user_name) setReplyText(`@${target.user_name} `);
                            else setReplyText("");
                          }
                        }}
                        onReplyTextChange={setReplyText}
                        onSubmitReply={handleSubmitReply}
                        setEditCommentText={setEditCommentText}
                      />
                    ))}

                    {/* Top-level comment input */}
                    <div className="flex gap-2 pt-2 items-center">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-[10px] bg-muted font-semibold">You</AvatarFallback>
                      </Avatar>
                      <Input
                        placeholder="Write a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                        className="flex-1 h-9 text-sm rounded-full bg-muted/60"
                      />
                      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={handleAddComment} disabled={!newComment.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
