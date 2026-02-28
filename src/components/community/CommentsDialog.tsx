import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Send, MoreHorizontal, Pencil, Trash2, X, Check } from "lucide-react";

export interface CommentData {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  user_name?: string;
}

interface CommentsDialogProps {
  open: boolean;
  onClose: () => void;
  comments: CommentData[];
  currentUserId: string;
  onAddComment: (text: string) => void;
  onEditComment: (commentId: string, newText: string) => void;
  onDeleteComment: (commentId: string) => void;
}

export function CommentsDialog({ open, onClose, comments, currentUserId, onAddComment, onEditComment, onDeleteComment }: CommentsDialogProps) {
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleAdd = () => {
    if (!newComment.trim()) return;
    onAddComment(newComment.trim());
    setNewComment("");
  };

  const startEdit = (c: CommentData) => {
    setEditingId(c.id);
    setEditText(c.text);
  };

  const saveEdit = () => {
    if (editingId && editText.trim()) {
      onEditComment(editingId, editText.trim());
    }
    setEditingId(null);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Comments ({comments.length})</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 group">
              <Avatar className="h-7 w-7 mt-0.5">
                <AvatarFallback className="text-[10px] bg-muted font-medium">{initials(c.user_name || "U")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{c.user_name}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                  {c.user_id === currentUserId && editingId !== c.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startEdit(c)}>
                          <Pencil className="h-3 w-3 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => onDeleteComment(c.id)}>
                          <Trash2 className="h-3 w-3 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {editingId === c.id ? (
                  <div className="flex gap-1 mt-1">
                    <Input value={editText} onChange={(e) => setEditText(e.target.value)} className="h-7 text-sm" onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                    <Button size="icon" className="h-7 w-7" onClick={saveEdit}><Check className="h-3 w-3" /></Button>
                  </div>
                ) : (
                  <p className="text-sm">{c.text}</p>
                )}
              </div>
            </div>
          ))}
          {comments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Be the first!</p>}
        </div>
        <div className="flex gap-2 mt-1">
          <Input
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1"
          />
          <Button size="icon" onClick={handleAdd} disabled={!newComment.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
