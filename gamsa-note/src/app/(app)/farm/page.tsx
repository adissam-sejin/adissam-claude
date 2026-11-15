"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import FarmTree, { TreeDetail, type FarmTreeData } from "@/components/FarmTree";
import { Persimmon } from "@/components/Art3D";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";

export default function FarmPage() {
  const { user } = useAuth();
  const [trees, setTrees] = useState<FarmTreeData[] | null>(null);
  const [open, setOpen] = useState<FarmTreeData | null>(null);
  const [filter, setFilter] = useState<"all" | "mine">("all");

  useEffect(() => {
    if (!user) return;
    supabase().rpc("farm_stats").then(({ data }) => setTrees((data ?? []) as FarmTreeData[]));
  }, [user]);

  const list = (trees ?? []).filter((t) => filter === "all" || t.is_member);
  const totalFruits = (trees ?? []).reduce((a, t) => a + t.note_count, 0);

  return (
    <div className="-mx-4 -mt-4">
      <section className="farm-sky relative overflow-hidden px-4 pt-6 pb-2">
        <div className="sun absolute right-6 top-5 w-14 h-14" />
        <div className="cloud floaty left-6 top-8 w-24 h-7" />
        <div className="cloud floaty left-[55%] top-16 w-16 h-5" style={{ animationDelay: "1.5s" }} />
        <div className="relative text-center">
          <h1 className="font-display text-3xl text-white drop-shadow-[0_2px_8px_rgba(30,90,150,.35)]">감 농장</h1>
          <p className="text-[13px] font-medium mt-1 text-white/95">감사한 만큼 감이 열리는 우리들의 농장</p>
          <p className="mt-2 inline-flex items-center gap-1.5 font-display text-xs bg-white/80 rounded-full shadow-sm px-3 py-1">
            <Persimmon small className="w-5 h-5" /> 농장 전체 감사 {totalFruits}개 · 감나무 {trees?.length ?? 0}그루
          </p>
        </div>
        <div className="flex justify-center gap-2 mt-3">
          {(["all", "mine"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`btn3d px-4 py-1.5 text-sm ${filter === f ? "btn-gam" : "btn-white"}`}>
              {f === "all" ? "전체 감나무" : "내 감나무"}
            </button>
          ))}
        </div>
      </section>
      <section className="farm-ground min-h-[60dvh] px-3 py-6">
        {trees === null ? (
          <div className="flex justify-center py-20"><Persimmon className="w-10 h-10 animate-bounce" /></div>
        ) : list.length === 0 ? (
          <div className="max-w-sm mx-auto card p-5 text-center">
            <p className="font-bold">{filter === "mine" ? "아직 참여한 감나무가 없어요" : "아직 심어진 감나무가 없어요"}</p>
            <p className="text-sm text-ink/60 mt-1">관리자에게 받은 감나무 코드를 입력하면<br />내 감사노트가 감나무에 반영돼요.</p>
            <Link href="/settings#tree" className="btn3d inline-block mt-4 px-4 py-2 btn-gam text-sm">감나무 코드 입력하기</Link>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-8">
            {list.map((t) => <FarmTree key={t.id} t={t} onClick={() => setOpen(t)} />)}
          </div>
        )}
        {trees && trees.length > 0 && (
          <p className="text-center mt-10">
            <Link href="/settings#tree" className="font-display text-xs bg-white/85 rounded-full shadow-sm px-2 py-1">＋ 감나무 코드 입력하기</Link>
          </p>
        )}
      </section>
      {open && <TreeDetail t={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
