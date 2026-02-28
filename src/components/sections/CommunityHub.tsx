import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Plus, Send, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const channels = [
  { id: "announcements", label: "📣 Announcements" },
  { id: "wins", label: "🏆 Wins & Progress" },
  { id: "meals", label: "🥗 Meal Sharing" },
  { id: "questions", label: "❓ Questions" },
];

const reactions = ["💪", "❤️", "🎉"];

interface Post {
  id: string;
  user_id: string;
  channel: string;
  text: string;
  created_at: string;
  user_name?: string;
  reaction_counts: Record<string, number>;
  user_reactions: string[];
  comment_count: number;
}

export function CommunityHub() {
  const { user } = useAuth();
  const [activeChannel, setActiveChannel] = useState("wins");
  const [posts, setPosts] = useState<Post[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newText, setNewText] = useState("");
  const [newChannel, setNewChannel] = useState("wins");
  const [commentDialogPost, setCommentDialogPost] = useState<string | null>(null);
  const [comments, setComments] = useState<{ id: string; user_id: string; text: string; created_at: string; user_name?: string }[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    if (user) loadPosts();
  }, [user, activeChannel]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("community-posts")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => loadPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeChannel]);

  const loadPosts = async () => {
    if (!user) return;
    const { data: postData } = await supabase
      .from("community_posts")
      .select("*")
      .eq("channel", activeChannel)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!postData) return;

    const userIds = [...new Set(postData.map((p) => p.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, name").in("user_id", userIds);
    const nameMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.name || "User"]));

    const postIds = postData.map((p) => p.id);
    const { data: allReactions } = await supabase.from("post_reactions").select("post_id, reaction_type, user_id").in("post_id", postIds);
    const { data: commentCounts } = await supabase.from("post_comments").select("post_id").in("post_id", postIds);

    const enriched: Post[] = postData.map((p) => {
      const pReactions = (allReactions || []).filter((r) => r.post_id === p.id);
      const counts: Record<string, number> = {};
      pReactions.forEach((r) => { counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1; });
      const userR = pReactions.filter((r) => r.user_id === user!.id).map((r) => r.reaction_type);
      return {
        ...p,
        user_name: nameMap[p.user_id],
        reaction_counts: counts,
        user_reactions: userR,
        comment_count: (commentCounts || []).filter((c) => c.post_id === p.id).length,
      };
    });
    setPosts(enriched);
  };

  const createPost = async () => {
    if (!user || !newText.trim()) return;
    await supabase.from("community_posts").insert({ user_id: user.id, channel: newChannel, text: newText });
    setNewText("");
    setDialogOpen(false);
    toast.success("Posted!");
  };

  const toggleReaction = async (postId: string, type: string) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (post?.user_reactions.includes(type)) {
      await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", user.id).eq("reaction_type", type);
    } else {
      await supabase.from("post_reactions").insert({ post_id: postId, user_id: user.id, reaction_type: type });
    }
    loadPosts();
  };

  const deletePost = async (id: string) => {
    await supabase.from("community_posts").delete().eq("id", id);
    loadPosts();
    toast.success("Post deleted");
  };

  const openComments = async (postId: string) => {
    setCommentDialogPost(postId);
    const { data } = await supabase.from("post_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    if (data) {
      const uids = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name").in("user_id", uids);
      const nm = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.name || "User"]));
      setComments(data.map((c) => ({ ...c, user_name: nm[c.user_id] })));
    }
  };

  const addComment = async () => {
    if (!user || !newComment.trim() || !commentDialogPost) return;
    await supabase.from("post_comments").insert({ post_id: commentDialogPost, user_id: user.id, text: newComment });
    setNewComment("");
    openComments(commentDialogPost);
    loadPosts();
  };

  const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Community</h2>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Post</Button>
      </div>

      {/* Channel tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {channels.map((ch) => (
          <Badge
            key={ch.id}
            variant={activeChannel === ch.id ? "default" : "outline"}
            className={cn("cursor-pointer whitespace-nowrap px-3 py-1.5", activeChannel === ch.id && "bg-primary text-primary-foreground")}
            onClick={() => setActiveChannel(ch.id)}
          >
            {ch.label}
          </Badge>
        ))}
      </div>

      {/* Posts */}
      <div className="space-y-3">
        {posts.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No posts yet. Be the first to share!</CardContent></Card>
        )}
        {posts.map((p) => (
          <Card key={p.id}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(p.user_name || "U")}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.user_name || "User"}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{p.text}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {reactions.map((r) => (
                      <button
                        key={r}
                        onClick={() => toggleReaction(p.id, r)}
                        className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", p.user_reactions.includes(r) ? "bg-primary/10" : "hover:bg-muted")}
                      >
                        {r} {(p.reaction_counts[r] || 0) > 0 && <span>{p.reaction_counts[r]}</span>}
                      </button>
                    ))}
                    <button onClick={() => openComments(p.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-auto">
                      <MessageCircle className="h-3.5 w-3.5" /> {p.comment_count}
                    </button>
                    {p.user_id === user?.id && (
                      <button onClick={() => deletePost(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New post dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Post</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Select value={newChannel} onValueChange={setNewChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {channels.filter((c) => c.id !== "announcements").map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea placeholder="Share something with the community..." value={newText} onChange={(e) => setNewText(e.target.value)} rows={3} />
            <Button className="w-full" onClick={createPost}><Send className="h-4 w-4 mr-1" /> Post</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comments dialog */}
      <Dialog open={!!commentDialogPost} onOpenChange={() => setCommentDialogPost(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Comments</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px] bg-muted">{initials(c.user_name || "U")}</AvatarFallback></Avatar>
                <div><p className="text-xs font-medium">{c.user_name}</p><p className="text-sm">{c.text}</p></div>
              </div>
            ))}
            {comments.length === 0 && <p className="text-sm text-muted-foreground text-center">No comments yet</p>}
          </div>
          <div className="flex gap-2 mt-2">
            <Input placeholder="Write a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComment()} className="flex-1" />
            <Button size="icon" onClick={addComment}><Send className="h-4 w-4" /></Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
