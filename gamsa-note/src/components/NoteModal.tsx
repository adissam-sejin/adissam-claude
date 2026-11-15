"use client";
import Link from "next/link";
import { useEffect } from "react";
import Wongoji from "./Wongoji";
import { koDate } from "@/lib/date";

export type ViewNote = {
  id: string;
  note_date: string;
  content: string;
  photo_path: string | null;
  is_public: boolean;
  photoUrl?: string | null;
};

export default function NoteModal({ note, onClose, editable = true }: { note: ViewNote; onClose: () => void; editable?: boolean }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", f); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-cream w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto border-t-[3px] sm:border-[3px] border-ink sm:shadow-[6px_6px_0_#3b2a1e] p-4 pb-8 sm:pb-4"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold">{koDate(note.note_date)}</h2>
            <span className={`pixel text-[11px] ${note.is_public ? "text-leaf" : "text-ink/50"}`}>{note.is_public ? "● 공개" : "● 비공개"}</span>
          </div>
          <button onClick={onClose} aria-label="닫기" className="w-9 h-9 border-2 border-ink rounded bg-white text-lg leading-none">×</button>
        </div>
        {note.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={note.photoUrl} alt="" className="w-full aspect-square object-cover border-[3px] border-ink mb-3" />
        )}
        <Wongoji value={note.content} readOnly minRows={3} />
        {editable && (
          <Link href={`/write?date=${note.note_date}`} className="px-btn block text-center mt-4 py-2.5 bg-gam text-white">수정하기</Link>
        )}
      </div>
    </div>
  );
}
