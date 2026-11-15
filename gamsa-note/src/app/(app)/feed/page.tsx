"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/AppShell";
import { Persimmon } from "@/components/Art3D";
import { useAuth } from "@/components/AuthProvider";
import { supabase, signedUrls } from "@/lib/supabase";
import { koDate, timeAgo } from "@/lib/date";

const PAGE = 10;

type Post = {
  id: string;
  user_id: string;
  note_date: string;
  content: string;
  photo_path: string;
  created_at: string;
  profiles: { nickname: string; avatar_url: string | null } | null;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  photoUrl?: string;
};

type Comment = { id: string; user_id: string; content: string; created_at: string; profiles: { nickname: string; avatar_url: string | null } | null };

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user || loading || done) return;
    setLoading(true);
    const sb = supabase();
    let q = sb.from("notes")
      .select("id,user_id,note_date,content,photo_path,created_at,profiles(nickname,avatar_url),likes(count),comments(count)")
      .eq("is_public", true).order("created_at", { ascending: false }).limit(PAGE);
    const last = posts[posts.length - 1];
    if (last) q = q.lt("created_at", last.created_at);
    const { data } = await q;
    const rows = (data ?? []) as unknown as (Omit<Post, "likeCount" | "commentCount" | "liked"> & { likes: { count: number }[]; comments: { count: number }[] })[];
    const ids = rows.map((r) => r.id);
    const [urls, mine] = await Promise.all([
      signedUrls(rows.map((r) => r.photo_path)),
      ids.length ? sb.from("likes").select("note_id").eq("user_id", user.id).in("note_id", ids) : Promise.resolve({ data: [] as { note_id: string }[] }),
    ]);
    const likedSet = new Set((mine.data ?? []).map((l) => l.note_id));
    setPosts((prev) => [...prev, ...rows.map((r) => ({
      ...r,
      likeCount: r.likes?.[0]?.count ?? 0,
      commentCount: r.comments?.[0]?.count ?? 0,
      liked: likedSet.has(r.id),
      photoUrl: urls[r.photo_path],
    }))]);
    if (rows.length < PAGE) setDone(true);
    setLoading(false);
  }, [user, loading, done, posts]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && load(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  const update = (id: string, patch: Partial<Post>) =>
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold">감사 피드</h1>
        <p className="text-sm text-ink/60">공개로 나눈 감사들이에요. 좋아요와 댓글로 응원해요.</p>
      </div>
      <div className="space-y-6">
        {posts.map((p) => <PostCard key={p.id} post={p} me={user!.id} onChange={(patch) => update(p.id, patch)} />)}
      </div>
      <div ref={sentinel} className="h-10" />
      {loading && <div className="flex justify-center py-6"><Persimmon className="w-8 h-8 animate-bounce" /></div>}
      {done && posts.length === 0 && (
        <div className="text-center py-16 text-ink/60">
          <Persimmon className="w-14 h-14 mx-auto opacity-60" />
          <p className="mt-3">아직 공개된 감사가 없어요.<br />사진과 함께 기록하고 ‘공개’를 체크해보세요.</p>
        </div>
      )}
    </div>
  );
}

function PostCard({ post, me, onChange }: { post: Post; me: string; onChange: (p: Partial<Post>) => void }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const toggleLike = async () => {
    const sb = supabase();
    const liked = !post.liked;
    onChange({ liked, likeCount: post.likeCount + (liked ? 1 : -1) });
    const { error } = liked
      ? await sb.from("likes").insert({ note_id: post.id, user_id: me })
      : await sb.from("likes").delete().eq("note_id", post.id).eq("user_id", me);
    if (error) onChange({ liked: post.liked, likeCount: post.likeCount });
  };

  const loadComments = async () => {
    const { data } = await supabase().from("comments")
      .select("id,user_id,content,created_at,profiles(nickname,avatar_url)")
      .eq("note_id", post.id).order("created_at");
    setComments((data ?? []) as unknown as Comment[]);
  };

  const toggleComments = () => {
    setShowComments((s) => !s);
    if (!comments) loadComments();
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = text.trim();
    if (!c || busy) return;
    setBusy(true);
    const { error } = await supabase().from("comments").insert({ note_id: post.id, user_id: me, content: c });
    setBusy(false);
    if (!error) {
      setText("");
      onChange({ commentCount: post.commentCount + 1 });
      loadComments();
    }
  };

  const removeComment = async (id: string) => {
    if (!confirm("댓글을 삭제할까요?")) return;
    await supabase().from("comments").delete().eq("id", id);
    onChange({ commentCount: Math.max(0, post.commentCount - 1) });
    loadComments();
  };

  const long = post.content.length > 120;

  return (
    <article className="card bg-white">
      <header className="flex items-center gap-2 p-3">
        <Avatar url={post.profiles?.avatar_url} name={post.profiles?.nickname} size={34} />
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{post.profiles?.nickname ?? "감사러"}</p>
          <p className="text-[11px] text-ink/50">{koDate(post.note_date)} · {timeAgo(post.created_at)}</p>
        </div>
      </header>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={post.photoUrl} alt="" loading="lazy" className="w-full aspect-square object-cover  bg-gam-light" />
      <div className="p-3">
        <div className="flex items-center gap-4">
          <button onClick={toggleLike} className="flex items-center gap-1.5" aria-pressed={post.liked} aria-label="좋아요">
            <Persimmon className={`w-7 h-7 transition ${post.liked ? "" : "grayscale opacity-40"}`} />
            <span className="font-display text-sm">{post.likeCount}</span>
          </button>
          <button onClick={toggleComments} className="flex items-center gap-1.5 text-sm" aria-label="댓글">
            <span className="text-xl leading-none">💬</span>
            <span className="font-display">{post.commentCount}</span>
          </button>
        </div>
        <p style={{ fontFamily: "'Gowun Batang', serif" }} className={`mt-2 whitespace-pre-wrap leading-relaxed ${!expanded && long ? "line-clamp-3" : ""}`}>{post.content}</p>
        {long && !expanded && <button onClick={() => setExpanded(true)} className="text-xs text-ink/50 mt-1">더 보기</button>}

        {showComments && (
          <div className="mt-3 border-t-2 border-dashed border-line/20 pt-3">
            {comments === null ? (
              <p className="text-xs text-ink/50">불러오는 중…</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-ink/50">첫 댓글로 응원을 남겨보세요.</p>
            ) : (
              <ul className="space-y-2">
                {comments.map((c) => (
                  <li key={c.id} className="flex gap-2 text-sm">
                    <Avatar url={c.profiles?.avatar_url} name={c.profiles?.nickname} size={24} />
                    <div className="flex-1 min-w-0">
                      <span className="font-bold mr-1.5">{c.profiles?.nickname ?? "감사러"}</span>
                      <span className="break-words">{c.content}</span>
                      <div className="text-[11px] text-ink/40">
                        {timeAgo(c.created_at)}
                        {(c.user_id === me || post.user_id === me) && (
                          <button onClick={() => removeComment(c.id)} className="ml-2 underline">삭제</button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={send} className="flex gap-2 mt-3">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="따뜻한 댓글 남기기"
                className="flex-1 min-w-0 field px-2 py-1.5 text-base sm:text-sm" />
              <button disabled={busy || !text.trim()} className="btn3d px-3 btn-gam text-sm">등록</button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
