import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Bookmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CommunityPost, PostData, InlineComment } from "@/components/community/CommunityPost";
import { CreatePostDialog } from "@/components/community/CreatePostDialog";

const channels = [
  { id: "announcements", label: "📣 Announcements" },
  { id: "wins", label: "🏆 Wins & Progress" },
  { id: "meals", label: "🥗 Meal Sharing" },
  { id: "questions", label: "❓ Questions" },
  { id: "saved", label: "⭐ Favourites" },
];

export function CommunityHub() {
  const { user } = useAuth();
  const [activeChannel, setActiveChannel] = useState("wins");
  const [posts, setPosts] = useState<PostData[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadSavedIds();
      loadPosts();
    }
  }, [user, activeChannel]);

  useEffect(() => {
    const channel = supabase
      .channel("community-posts")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => loadPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeChannel]);

  const loadSavedIds = async () => {
    if (!user) return;
    const { data } = await supabase.from("saved_posts").select("post_id").eq("user_id", user.id);
    if (data) setSavedPostIds(new Set(data.map((d) => d.post_id)));
  };

  const loadPosts = async () => {
    if (!user) return;
    let postData: any[] | null = null;

    if (activeChannel === "saved") {
      const { data: savedData } = await supabase.from("saved_posts").select("post_id").eq("user_id", user.id).order("saved_at", { ascending: false });
      if (!savedData || savedData.length === 0) { setPosts([]); return; }
      const ids = savedData.map((s) => s.post_id);
      const { data } = await supabase.from("community_posts").select("*").in("id", ids);
      postData = ids.map((id) => data?.find((p) => p.id === id)).filter(Boolean);
    } else {
      const { data } = await supabase.from("community_posts").select("*").eq("channel", activeChannel).order("created_at", { ascending: false }).limit(50);
      postData = data;
    }
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
        is_saved: savedPostIds.has(p.id),
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

  const toggleSave = async (postId: string) => {
    if (!user) return;
    const isSaved = savedPostIds.has(postId);
    if (isSaved) {
      await supabase.from("saved_posts").delete().eq("post_id", postId).eq("user_id", user.id);
      setSavedPostIds((prev) => { const n = new Set(prev); n.delete(postId); return n; });
      toast.success("Removed from favourites");
    } else {
      await supabase.from("saved_posts").insert({ post_id: postId, user_id: user.id });
      setSavedPostIds((prev) => new Set(prev).add(postId));
      toast.success("Added to favourites!");
    }
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_saved: !isSaved } : p));
    if (activeChannel === "saved" && isSaved) loadPosts();
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

  const loadComments = async (postId: string): Promise<InlineComment[]> => {
    if (!user) return [];
    const { data } = await supabase.from("post_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    if (!data) return [];
    const uids = [...new Set(data.map((c) => c.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, name").in("user_id", uids);
    const nm = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.name || "User"]));
    const commentIds = data.map((c) => c.id);
    const { data: allLikes } = commentIds.length > 0
      ? await supabase.from("comment_likes").select("comment_id, user_id").in("comment_id", commentIds)
      : { data: [] };
    return data.map((c) => {
      const likes = (allLikes || []).filter((l) => l.comment_id === c.id);
      return {
        ...c,
        parent_id: (c as any).parent_id || null,
        user_name: nm[c.user_id],
        like_count: likes.length,
        is_liked: likes.some((l) => l.user_id === user!.id),
      };
    });
  };

  const addComment = async (postId: string, text: string, parentId?: string) => {
    if (!user) return;
    const insert: any = { post_id: postId, user_id: user.id, text };
    if (parentId) insert.parent_id = parentId;
    await supabase.from("post_comments").insert(insert);
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p));
  };

  const editComment = async (commentId: string, newText: string) => {
    await supabase.from("post_comments").update({ text: newText }).eq("id", commentId);
    toast.success("Comment updated");
  };

  const deleteComment = async (commentId: string, postId: string) => {
    await supabase.from("post_comments").delete().eq("id", commentId);
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p));
    toast.success("Comment deleted");
  };

  const toggleCommentLike = async (commentId: string, postId: string) => {
    if (!user) return;
    const { data: existing } = await supabase.from("comment_likes").select("id").eq("comment_id", commentId).eq("user_id", user.id).maybeSingle();
    if (existing) {
      await supabase.from("comment_likes").delete().eq("id", existing.id);
    } else {
      await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: user.id });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Community</h2>
          <p className="text-xs text-muted-foreground">
            {activeChannel === "saved" ? `${posts.length} favourites` : `${posts.length} posts in this channel`}
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Post
        </Button>
      </div>

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

      <div className="space-y-3">
        {posts.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              {activeChannel === "saved" ? (
                 <>
                   <Bookmark className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                   <p className="text-muted-foreground font-medium">No favourites yet</p>
                   <p className="text-sm text-muted-foreground mt-1">Tap the bookmark icon on posts to add them here</p>
                 </>
              ) : (
                <>
                  <p className="text-3xl mb-2">💬</p>
                  <p className="text-muted-foreground font-medium">No posts yet in this channel</p>
                  <p className="text-sm text-muted-foreground mt-1">Be the first to share something!</p>
                  <Button size="sm" className="mt-4" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Create Post
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
        {posts.map((p) => (
          <CommunityPost
            key={p.id}
            post={p}
            currentUserId={user?.id || ""}
            onToggleReaction={toggleReaction}
            onDeletePost={deletePost}
            onEditPost={editPost}
            onToggleSave={toggleSave}
            onLoadComments={loadComments}
            onAddComment={addComment}
            onEditComment={editComment}
            onDeleteComment={deleteComment}
            onToggleCommentLike={toggleCommentLike}
          />
        ))}
      </div>

      {user && (
        <CreatePostDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          userId={user.id}
          onCreated={loadPosts}
        />
      )}
    </div>
  );
}
