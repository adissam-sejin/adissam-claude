"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import NoteModal, { type ViewNote } from "@/components/NoteModal";
import { Persimmon } from "@/components/Art3D";
import { useAuth } from "@/components/AuthProvider";
import { supabase, signedUrls } from "@/lib/supabase";
import { koShort } from "@/lib/date";

const PAGE = 30;

export default function GalleryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ViewNote[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<ViewNote | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user || loading || done) return;
    setLoading(true);
    const { data } = await supabase().from("notes")
      .select("id,note_date,content,photo_path,is_public")
      .eq("user_id", user.id).not("photo_path", "is", null)
      .order("note_date", { ascending: false })
      .range(items.length, items.length + PAGE - 1);
    const rows = data ?? [];
    const urls = await signedUrls(rows.map((r) => r.photo_path));
    setItems((prev) => [...prev, ...rows.map((r) => ({ ...r, photoUrl: urls[r.photo_path!] }))]);
    if (rows.length < PAGE) setDone(true);
    setLoading(false);
  }, [user, loading, done, items.length]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && load(), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold">감사 갤러리</h1>
        <p className="text-sm text-ink/60">사진을 누르면 그날의 감사가 보여요.</p>
      </div>

      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {items.map((n) => (
          <button key={n.id} onClick={() => setOpen(n)} className="relative aspect-square overflow-hidden bg-gam-light group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={n.photoUrl ?? ""} alt={koShort(n.note_date)} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            <span className="absolute left-1 bottom-1 font-display text-[10px] sm:text-xs bg-black/50 text-white px-1 rounded">{koShort(n.note_date).slice(2)}</span>
          </button>
        ))}
      </div>

      <div ref={sentinel} className="h-10" />
      {loading && <div className="flex justify-center py-6"><Persimmon className="w-8 h-8 animate-bounce" /></div>}
      {done && items.length === 0 && (
        <div className="text-center py-16">
          <Persimmon className="w-14 h-14 mx-auto opacity-60" />
          <p className="mt-3 text-ink/60">아직 사진이 있는 감사노트가 없어요.</p>
          <Link href="/write" className="btn3d inline-block mt-4 px-5 py-2 btn-gam">첫 사진 올리기</Link>
        </div>
      )}

      {open && <NoteModal note={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
