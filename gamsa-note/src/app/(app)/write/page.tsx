"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Wongoji from "@/components/Wongoji";
import SquareCropper from "@/components/SquareCropper";
import { Persimmon } from "@/components/Illust";
import { useAuth } from "@/components/AuthProvider";
import { supabase, signedUrls, PHOTO_BUCKET } from "@/lib/supabase";
import { koDate, today } from "@/lib/date";

type Note = { id: string; content: string; photo_path: string | null; is_public: boolean };

function WriteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const date = params.get("date") && params.get("date")! <= today() ? params.get("date")! : today();

  const [note, setNote] = useState<Note | null>(null);
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null); // 화면 표시용
  const [newPhoto, setNewPhoto] = useState<Blob | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setNewPhoto(null); setRemovePhoto(false); setMsg(null);
      const { data } = await supabase().from("notes")
        .select("id,content,photo_path,is_public").eq("user_id", user.id).eq("note_date", date).maybeSingle();
      if (!alive) return;
      setNote(data);
      setContent(data?.content ?? "");
      setIsPublic(data?.is_public ?? false);
      if (data?.photo_path) {
        const m = await signedUrls([data.photo_path]);
        if (alive) setPhotoUrl(m[data.photo_path] ?? null);
      } else setPhotoUrl(null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, date]);

  const hasPhoto = !!photoUrl;

  const save = async () => {
    if (!user) return;
    if (!content.trim()) { setMsg("감사한 내용을 적어주세요."); return; }
    setSaving(true); setMsg(null);
    try {
      const sb = supabase();
      let photo_path = removePhoto ? null : note?.photo_path ?? null;
      const oldPath = note?.photo_path ?? null;
      if (newPhoto) {
        const path = `${user.id}/${date}-${crypto.randomUUID().slice(0, 8)}.jpg`;
        const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, newPhoto, { contentType: "image/jpeg" });
        if (error) throw error;
        photo_path = path;
      }
      const row = {
        user_id: user.id, note_date: date, content: content.trim(),
        photo_path, is_public: !!photo_path && isPublic, updated_at: new Date().toISOString(),
      };
      const { error } = await sb.from("notes").upsert(row, { onConflict: "user_id,note_date" });
      if (error) throw error;
      if (oldPath && oldPath !== photo_path) await sb.storage.from(PHOTO_BUCKET).remove([oldPath]);
      router.push(`/calendar?saved=${date}`);
    } catch (e) {
      setMsg("저장하지 못했어요. 잠시 후 다시 시도해주세요. " + (e instanceof Error ? e.message : ""));
      setSaving(false);
    }
  };

  const del = async () => {
    if (!note || !confirm("이 날의 감사노트를 삭제할까요?")) return;
    const sb = supabase();
    await sb.from("notes").delete().eq("id", note.id);
    if (note.photo_path) await sb.storage.from(PHOTO_BUCKET).remove([note.photo_path]);
    router.push("/calendar");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          <p className="font-display text-xs text-gam-dark">오늘의 감사</p>
          <h1 className="text-xl font-bold">{koDate(date)}</h1>
        </div>
        <input
          type="date" value={date} max={today()}
          onChange={(e) => e.target.value && router.replace(`/write?date=${e.target.value}`)}
          className="field px-2 py-1 bg-white text-sm"
          aria-label="날짜 선택"
        />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Persimmon className="w-10 h-10 animate-bounce" /></div>
      ) : (
        <>
          <Wongoji value={content} onChange={setContent} placeholder="원고지를 눌러 오늘 감사한 일을 적어보세요." />

          <section className="mt-5">
            <p className="font-display text-sm font-bold mb-2">사진 한 장 <span className="font-normal text-ink/50">(선택)</span></p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropFile(f); e.target.value = ""; }} />
            {photoUrl ? (
              <div className="relative w-full max-w-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="오늘의 사진" className="w-full aspect-square object-cover rounded-2xl shadow-md" />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => fileRef.current?.click()} className="btn3d px-3 py-1.5 text-sm btn-white">바꾸기</button>
                  <button onClick={() => { setPhotoUrl(null); setNewPhoto(null); setRemovePhoto(true); setIsPublic(false); }} className="btn3d px-3 py-1.5 text-sm btn-white">지우기</button>
                </div>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-40 aspect-square border-2 border-dashed border-gam/40 rounded-2xl flex flex-col items-center justify-center gap-2 text-ink/60 bg-white hover:bg-gam-light/40">
                <span className="text-3xl leading-none">＋</span>
                <span className="font-display text-xs">정사각형 사진 올리기</span>
              </button>
            )}
          </section>

          <label className={`mt-5 flex items-start gap-3 p-3 border-2 rounded ${hasPhoto ? "border-line bg-white" : "border-line/20 bg-ink/5 text-ink/50"}`}>
            <input type="checkbox" checked={isPublic && hasPhoto} disabled={!hasPhoto}
              onChange={(e) => setIsPublic(e.target.checked)} className="mt-1 w-5 h-5 accent-[#f28c28]" />
            <span>
              <span className="font-bold">피드에 공개하기</span>
              <span className="block text-xs mt-0.5">
                {hasPhoto ? "공개하면 사진과 감사 내용이 피드에 함께 보이고, 좋아요·댓글을 받을 수 있어요." : "공개는 사진이 있을 때만 할 수 있어요. 기본은 비공개예요."}
              </span>
            </span>
          </label>

          {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}

          <div className="mt-5 flex gap-2">
            {note && <button onClick={del} className="btn3d px-4 py-3 btn-white text-sm">삭제</button>}
            <button onClick={save} disabled={saving} className="btn3d flex-1 py-3 btn-gam text-lg">
              {saving ? "저장 중…" : note ? "수정하기" : "감사 심기"}
            </button>
          </div>
        </>
      )}

      {cropFile && (
        <SquareCropper file={cropFile} onCancel={() => setCropFile(null)}
          onDone={(blob, url) => { setNewPhoto(blob); setPhotoUrl(url); setRemovePhoto(false); setCropFile(null); }} />
      )}
    </div>
  );
}

export default function WritePage() {
  return <Suspense><WriteInner /></Suspense>;
}
