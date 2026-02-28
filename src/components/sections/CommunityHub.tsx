import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CommunityPost, PostData } from "@/components/community/CommunityPost";
import { CommentsDialog, CommentData } from "@/components/community/CommentsDialog";
import { CreatePostDialog } from "@/components/community/CreatePostDialog";

const channels = [
  { id: "announcements", label: "📣 Announcements" },
  { id: "wins", label: "🏆 Wins & Progress" },
  { id: "meals", label: "🥗 Meal Sharing" },
  { id: "questions", label: "❓ Questions" },
];

export function CommunityHub() {
  const { user } = useAuth();
  const [activeChannel, setActiveChannel] = useState("wins");
  const [posts, setPosts] = useState<PostData[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);

  useEffect(() => {
    if (user) loadPosts();
  }, [user, activeChannel]);

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
    const { data: profiles } = await supabase.from("profiles").select("user_id, name, avatar_url").in("user_id", userIds);
    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));

    const postIds = postData.map((p) => p.id);
    const { data: allReactions } = await supabase.from("post_reactions").select("post_id, reaction_type, user_id").in("post_id", postIds);
    const { data: commentCounts } = await supabase.from("post_comments").select("post_id").in("post_id", postIds);

    const enriched: PostData[] = postData.map((p) => {
      const pReactions = (allReactions || []).filter((r) => r.post_id === p.id);
      const counts: Record<string, number> = {};
      pReactions.forEach((r) => { counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1; });
      const userR = pReactions.filter((r) => r.user_id === user!.id).map((r) => r.reaction_type);
      const profile = profileMap[p.user_id];
      return {
        ...p,
        user_name: profile?.name || "User",
        avatar_url: profile?.avatar_url || undefined,
        reaction_counts: counts,
        user_reactions: userR,
        comment_count: (commentCounts || []).filter((c) => c.post_id === p.id).length,
      };
    });
    setPosts(enriched);
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

  const editPost = async (postId: string, newText: string) => {
    await supabase.from("community_posts").update({ text: newText }).eq("id", postId);
    loadPosts();
    toast.success("Post updated");
  };

  const openComments = async (postId: string) => {
    setCommentPostId(postId);
    const { data } = await supabase.from("post_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    if (data) {
      const uids = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name").in("user_id", uids);
      const nm = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.name || "User"]));
      setComments(data.map((c) => ({ ...c, user_name: nm[c.user_id] })));
    }
  };

  const addComment = async (text: string) => {
    if (!user || !commentPostId) return;
    await supabase.from("post_comments").insert({ post_id: commentPostId, user_id: user.id, text });
    openComments(commentPostId);
    loadPosts();
  };

  const editComment = async (commentId: string, newText: string) => {
    await supabase.from("post_comments").update({ text: newText }).eq("id", commentId);
    if (commentPostId) openComments(commentPostId);
    toast.success("Comment updated");
  };

  const deleteComment = async (commentId: string) => {
    await supabase.from("post_comments").delete().eq("id", commentId);
    if (commentPostId) openComments(commentPostId);
    loadPosts();
    toast.success("Comment deleted");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Community</h2>
          <p className="text-xs text-muted-foreground">{posts.length} posts in this channel</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Post
        </Button>
      </div>

      {/* Channel tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {channels.map((ch) => (
          <Badge
            key={ch.id}
            variant={activeChannel === ch.id ? "default" : "outline"}
            className={cn(
              "cursor-pointer whitespace-nowrap px-3 py-1.5 transition-colors",
              activeChannel === ch.id && "bg-primary text-primary-foreground"
            )}
            onClick={() => setActiveChannel(ch.id)}
          >
            {ch.label}
          </Badge>
        ))}
      </div>

      {/* Posts */}
      <div className="space-y-3">
        {posts.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-muted-foreground font-medium">No posts yet in this channel</p>
              <p className="text-sm text-muted-foreground mt-1">Be the first to share something!</p>
              <Button size="sm" className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Create Post
              </Button>
            </CardContent>
          </Card>
        )}
        {posts.map((p) => (
          <CommunityPost
            key={p.id}
            post={p}
            currentUserId={user?.id || ""}
            onToggleReaction={toggleReaction}
            onOpenComments={openComments}
            onDeletePost={deletePost}
            onEditPost={editPost}
          />
        ))}
      </div>

      {/* Create post dialog */}
      {user && (
        <CreatePostDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          userId={user.id}
          onCreated={loadPosts}
        />
      )}

      {/* Comments dialog */}
      <CommentsDialog
        open={!!commentPostId}
        onClose={() => setCommentPostId(null)}
        comments={comments}
        currentUserId={user?.id || ""}
        onAddComment={addComment}
        onEditComment={editComment}
        onDeleteComment={deleteComment}
      />
    </div>
  );
}
