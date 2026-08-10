import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Heart, MessageCircle, Bookmark, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { CommunityPost, PostData, InlineComment } from "@/components/community/CommunityPost";
import { CreatePostDialog } from "@/components/community/CreatePostDialog";

const channels = [
  { id: "wins", label: "Highlights" },
  { id: "meals", label: "Meals" },
  { id: "announcements", label: "Workouts" },
  { id: "questions", label: "Wins" },
  { id: "saved", label: "Saved" },
];

interface CommunityHubProps {
  highlightPostId?: string | null;
  onHighlightHandled?: () => void;
}

const PAGE_SIZE = 20;

export function CommunityHub({ highlightPostId, onHighlightHandled }: CommunityHubProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeChannel, setActiveChannel] = useState("wins");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Saved post IDs query
  const { data: savedPostIds = new Set<string>() } = useQuery({
    queryKey: queryKeys.savedPostIds(user?.id),
    queryFn: async () => {
      if (!user) return new Set<string>();
      const { data } = await supabase.from("saved_posts").select("post_id").eq("user_id", user.id);
      return new Set((data || []).map((d) => d.post_id));
    },
    enabled: !!user,
  });

  // Infinite query for posts
  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKeys.communityPosts(user?.id, activeChannel),
    queryFn: async ({ pageParam = 0 }) => {
      if (!user) return { posts: [] as PostData[], nextOffset: null };

      let postData: any[] | null = null;
      let hasMore = false;

      if (activeChannel === "saved") {
        const { data: savedData } = await supabase.from("saved_posts").select("post_id").eq("user_id", user.id).order("saved_at", { ascending: false });
        if (!savedData || savedData.length === 0) return { posts: [] as PostData[], nextOffset: null };
        const ids = savedData.map((s) => s.post_id);
        const { data } = await supabase.from("community_posts").select("*").in("id", ids);
        postData = ids.map((id) => data?.find((p) => p.id === id)).filter(Boolean);
        hasMore = false;
      } else {
        const { data } = await supabase.from("community_posts").select("*").eq("channel", activeChannel).order("created_at", { ascending: false }).range(pageParam, pageParam + PAGE_SIZE - 1);
        postData = data;
        hasMore = (data?.length || 0) === PAGE_SIZE;
      }
      if (!postData) return { posts: [] as PostData[], nextOffset: null };

      const userIds = [...new Set(postData.map((p) => p.user_id))];
      const { data: profiles } = await supabase.from("public_profiles").select("user_id, name, avatar_url").in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));

      const postIds = postData.map((p) => p.id);
      const { data: allReactions } = await supabase.from("post_reactions").select("post_id, reaction_type, user_id").in("post_id", postIds);
      const { data: commentCounts } = await supabase.from("post_comments").select("post_id").in("post_id", postIds);

      // Get current saved ids from cache
      const currentSaved = queryClient.getQueryData<Set<string>>(queryKeys.savedPostIds(user.id)) || new Set<string>();

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
          is_saved: currentSaved.has(p.id),
        };
      });

      return {
        posts: enriched,
        nextOffset: hasMore ? pageParam + PAGE_SIZE : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    enabled: !!user,
  });

  const posts = useMemo(() => postsData?.pages.flatMap((p) => p.posts) || [], [postsData]);

  // Handle deep link to a specific post
  useEffect(() => {
    if (!highlightPostId || !user) return;
    const navigateToPost = async () => {
      const { data: post } = await supabase.from("community_posts").select("channel").eq("id", highlightPostId).single();
      if (post && post.channel !== activeChannel) {
        setActiveChannel(post.channel);
      }
      setTimeout(() => {
        const el = document.getElementById(`post-${highlightPostId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-primary", "ring-offset-2");
          setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 3000);
        }
        onHighlightHandled?.();
      }, 500);
    };
    navigateToPost();
  }, [highlightPostId, user]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("community-posts")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.communityPosts(user?.id, activeChannel) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeChannel, user?.id, queryClient]);

  const invalidatePosts = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.communityPosts(user?.id, activeChannel) });
  };

  const notify = async (targetUserId: string, type: string, postId?: string, commentId?: string) => {
    if (!user || targetUserId === user.id) return;
    const insert: any = { user_id: targetUserId, actor_id: user.id, type };
    if (postId) insert.post_id = postId;
    if (commentId) insert.comment_id = commentId;
    await supabase.from("notifications").insert(insert);
  };

  const toggleReaction = async (postId: string, type: string) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (post?.user_reactions.includes(type)) {
      await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", user.id).eq("reaction_type", type);
    } else {
      await supabase.from("post_reactions").insert({ post_id: postId, user_id: user.id, reaction_type: type });
      if (post) notify(post.user_id, "reaction", postId);
    }
    invalidatePosts();
  };

  const toggleSave = async (postId: string) => {
    if (!user) return;
    const isSaved = savedPostIds.has(postId);
    if (isSaved) {
      await supabase.from("saved_posts").delete().eq("post_id", postId).eq("user_id", user.id);
      toast.success("Removed from favourites");
    } else {
      await supabase.from("saved_posts").insert({ post_id: postId, user_id: user.id });
      toast.success("Added to favourites!");
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.savedPostIds(user.id) });
    invalidatePosts();
  };

  const deletePost = async (id: string) => {
    await supabase.from("community_posts").delete().eq("id", id);
    invalidatePosts();
    toast.success("Post deleted");
  };

  const editPost = async (postId: string, newText: string) => {
    await supabase.from("community_posts").update({ text: newText }).eq("id", postId);
    invalidatePosts();
    toast.success("Post updated");
  };

  const loadComments = async (postId: string): Promise<InlineComment[]> => {
    if (!user) return [];
    const { data } = await supabase.from("post_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    if (!data) return [];
    const uids = [...new Set(data.map((c) => c.user_id))];
    const { data: profiles } = await supabase.from("public_profiles").select("user_id, name").in("user_id", uids);
    const nm = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.name || "User"]));
    const commentIds = data.map((c) => c.id);
    const { data: allLikes } = commentIds.length > 0
      ? await supabase.from("comment_likes").select("comment_id, user_id, reaction_type").in("comment_id", commentIds)
      : { data: [] };
    return data.map((c) => {
      const likes = (allLikes || []).filter((l) => l.comment_id === c.id);
      const reactionCounts: Record<string, number> = {};
      likes.forEach((l) => {
        const rt = (l as any).reaction_type || "👍";
        reactionCounts[rt] = (reactionCounts[rt] || 0) + 1;
      });
      const userLike = likes.find((l) => l.user_id === user!.id);
      return {
        ...c,
        parent_id: (c as any).parent_id || null,
        user_name: nm[c.user_id],
        like_count: likes.length,
        is_liked: !!userLike,
        user_reaction: userLike ? ((userLike as any).reaction_type || "👍") : null,
        reaction_counts: reactionCounts,
      };
    });
  };

  const addComment = async (postId: string, text: string, parentId?: string) => {
    if (!user) return;
    const insert: any = { post_id: postId, user_id: user.id, text };
    if (parentId) insert.parent_id = parentId;
    const { data: inserted } = await supabase.from("post_comments").insert(insert).select("id").single();
    invalidatePosts();

    if (parentId) {
      const { data: parentComment } = await supabase.from("post_comments").select("user_id").eq("id", parentId).single();
      if (parentComment) notify(parentComment.user_id, "reply", postId, inserted?.id);
    } else {
      const post = posts.find((p) => p.id === postId);
      if (post) notify(post.user_id, "comment", postId, inserted?.id);
    }
  };

  const editComment = async (commentId: string, newText: string) => {
    await supabase.from("post_comments").update({ text: newText }).eq("id", commentId);
    toast.success("Comment updated");
  };

  const deleteComment = async (commentId: string, postId: string) => {
    await supabase.from("post_comments").delete().eq("id", commentId);
    invalidatePosts();
    toast.success("Comment deleted");
  };

  const toggleCommentLike = async (commentId: string, postId: string, reactionType: string = "👍") => {
    if (!user) return;
    const { data: existing } = await supabase.from("comment_likes").select("id, reaction_type").eq("comment_id", commentId).eq("user_id", user.id).maybeSingle();
    if (existing) {
      if ((existing as any).reaction_type === reactionType) {
        await supabase.from("comment_likes").delete().eq("id", existing.id);
      } else {
        await supabase.from("comment_likes").update({ reaction_type: reactionType } as any).eq("id", existing.id);
      }
    } else {
      await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: user.id, reaction_type: reactionType } as any);
      const { data: comment } = await supabase.from("post_comments").select("user_id").eq("id", commentId).single();
      if (comment) notify(comment.user_id, "comment_like", postId, commentId);
    }
  };

  const featuredPost = posts[0] || null;
  const feedPosts = posts.slice(1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-heading font-black text-foreground">Community</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Real people, real progress, real inspiration. 💪</p>
      </div>

      {/* Pill tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setActiveChannel(ch.id)}
            className={cn(
              "shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all",
              activeChannel === ch.id
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {ch.label}
          </button>
        ))}
        <button
          onClick={() => setActiveChannel("saved")}
          className={cn(
            "shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all",
            activeChannel === "saved"
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Saved
        </button>
      </div>

      {/* Create post button */}
      <Button size="sm" className="w-full rounded-full" onClick={() => setDialogOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" /> Share something
      </Button>

      <div className="space-y-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && posts.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              {activeChannel === "saved" ? (
                <>
                  <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center mx-auto mb-2">
                    <Bookmark className="h-7 w-7 text-primary" />
                  </div>
                  <p className="text-foreground font-medium">No favourites yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Tap the bookmark icon on posts to save them here</p>
                </>
              ) : (
                <>
                  <p className="text-3xl mb-2">💬</p>
                  <p className="text-foreground font-medium">No posts yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Be the first to share something!</p>
                  <Button size="sm" className="mt-4 rounded-full" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Create Post
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Featured / highlight post */}
        {!isLoading && featuredPost && (
          <div id={`post-${featuredPost.id}`} className="rounded-2xl overflow-hidden border border-border bg-card transition-all duration-300">
            {/* Hero image */}
            <div className="relative">
              {featuredPost.image_url ? (
                <img src={featuredPost.image_url} alt="" className="w-full h-56 object-cover" />
              ) : (
                <div className="w-full h-44 bg-gradient-to-br from-primary/20 via-primary/10 to-accent flex items-center justify-center">
                  <span className="text-5xl">💬</span>
                </div>
              )}
              {/* COMMUNITY HIGHLIGHT badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-foreground/85 backdrop-blur-sm text-background text-[11px] font-bold px-3 py-1.5 rounded-full">
                <Star className="h-3 w-3 fill-current" />
                <span>COMMUNITY HIGHLIGHT</span>
              </div>
              {/* Author overlay at bottom of image */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-8">
                <div className="flex items-center gap-2.5">
                  {featuredPost.avatar_url ? (
                    <img src={featuredPost.avatar_url} alt={featuredPost.user_name} className="h-9 w-9 rounded-full border-2 border-white object-cover shrink-0" />
                  ) : (
                    <div className="h-9 w-9 rounded-full border-2 border-white bg-primary flex items-center justify-center shrink-0">
                      <span className="text-white text-sm font-bold">{featuredPost.user_name?.[0]?.toUpperCase() || "U"}</span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1">
                      <p className="text-white text-sm font-bold leading-tight drop-shadow">{featuredPost.user_name}</p>
                      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary shrink-0">
                        <span className="text-white text-[9px] font-bold">✓</span>
                      </span>
                    </div>
                    <p className="text-white/80 text-[11px] leading-tight capitalize">
                      {featuredPost.channel?.replace("_", " ")} · {(() => {
                        const diff = Math.floor((Date.now() - new Date(featuredPost.created_at).getTime()) / 3600000);
                        return diff < 24 ? `${diff}h` : `${Math.floor(diff / 24)}d`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Post body */}
            <div className="p-4">
              {featuredPost.text && (
                <>
                  <p className="text-base font-bold text-foreground leading-snug mb-1">
                    {featuredPost.text.split(".")[0]}.
                  </p>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                      {featuredPost.text.split(".").slice(1).join(".").trim()}
                    </p>
                    <button className="shrink-0 border border-border rounded-lg px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors whitespace-nowrap">
                      View Comments
                    </button>
                  </div>
                </>
              )}
              <div className="flex items-center gap-5">
                <button
                  onClick={() => toggleReaction(featuredPost.id, "❤️")}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Heart className={cn("h-4 w-4", featuredPost.user_reactions?.includes("❤️") && "fill-red-500 text-red-500")} />
                  <span>{featuredPost.reaction_counts?.["❤️"] || 0}</span>
                </button>
                <button className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MessageCircle className="h-4 w-4" />
                  <span>{featuredPost.comment_count || 0}</span>
                </button>
                <button
                  onClick={() => toggleSave(featuredPost.id)}
                  className={cn("flex items-center gap-1.5 text-sm transition-colors", featuredPost.is_saved ? "text-primary" : "text-muted-foreground hover:text-primary")}
                >
                  <Bookmark className={cn("h-4 w-4", featuredPost.is_saved && "fill-current")} />
                  <span>Save</span>
                </button>
                <button className="ml-auto flex items-center gap-1 text-sm font-semibold text-primary">
                  Join Challenge <span>›</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feed posts */}
        {feedPosts.map((p) => (
          <div key={p.id} id={`post-${p.id}`} className="transition-all duration-300">
            <CommunityPost
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
          </div>
        ))}

        {hasNextPage && posts.length > 0 && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" size="sm" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
              {isFetchingNextPage ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Loading...</> : "Load More"}
            </Button>
          </div>
        )}
      </div>

      {user && (
        <CreatePostDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          userId={user.id}
          onCreated={invalidatePosts}
        />
      )}
    </div>
  );
}
