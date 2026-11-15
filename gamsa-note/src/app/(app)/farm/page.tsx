"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import FarmTree, { TreeDetail, type FarmTreeData } from "@/components/FarmTree";
import { Persimmon } from "@/components/Illust";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";

export default function FarmPage() {
  const { user } = useAuth();
  const [trees, setTrees] = useState<FarmTreeData[] | null>(null);
  const [open, setOpen] = useState<FarmTreeData | null>(null);
  const [filter, setFilter] = useState<"all" | "mine">("mine");

  useEffect(() => {
    if (!user) return;
    supabase().rpc("farm_stats").then(({ data }) => setTrees((data ?? []) as FarmTreeData[]));
  }, [user]);

  const list = (trees ?? []).filter((t) => filter === "all" || t.is_member);
  const totalFruits = (trees ?? []).reduce((a, t) => a + t.note_count, 0);
  const mineList = (trees ?? []).filter((t) => t.is_member);
  const mineFruits = mineList.reduce((a, t) => a + t.note_count, 0);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[20px] font-extrabold">감 농장</h1>
          <p className="text-[13px] text-sub mt-0.5">감사한 만큼 감이 열리는 우리들의 농장</p>
        </div>
        <Link href="/settings#tree" className="text-[12px] font-semibold text-gam bg-gam-light rounded-full px-2.5 py-1 shrink-0">코드 입력</Link>
      </div>
      <div className="mt-4 rounded-2xl bg-peach px-4 py-3 flex items-center gap-3">
        <Persimmon className="w-9 h-9" />
        {filter === "mine" ? (
          <p className="text-[13px] leading-snug">내 감나무에 모인 감사 <b className="text-gam">{mineFruits}개</b><br /><span className="text-sub">내가 함께 키우는 감나무 {mineList.length}그루</span></p>
        ) : (
          <p className="text-[13px] leading-snug">농장 전체 감사 <b className="text-gam">{totalFruits}개</b><br /><span className="text-sub">감나무 {trees?.length ?? 0}그루가 자라고 있어요</span></p>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        {(["mine", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold border ${filter === f ? "bg-gam border-gam text-white" : "bg-white border-line text-sub"}`}>
            {f === "all" ? "전체" : "내 감나무"}
          </button>
        ))}
      </div>
      <section className="mt-4">
        {trees === null ? (
          <div className="flex justify-center py-20"><Persimmon className="w-10 h-10 animate-bounce" /></div>
        ) : list.length === 0 ? (
          <div className="card p-6 text-center">
            <Persimmon className="w-14 h-14 mx-auto" />
            <p className="mt-3 font-bold">{filter === "mine" ? "아직 참여한 감나무가 없어요" : "아직 심어진 감나무가 없어요"}</p>
            <p className="text-[13px] text-sub mt-1">관리자에게 받은 감나무 코드를 입력하면<br />내 감사노트가 감나무에 반영돼요.</p>
            <Link href="/settings#tree" className="btn3d btn-gam block mt-4 px-5 py-3 text-sm">감나무 코드 입력하기</Link>
            {filter === "mine" && (trees?.length ?? 0) > 0 && (
              <button onClick={() => setFilter("all")} className="btn3d btn-soft w-full mt-2 py-3 text-sm">다른 감나무 구경하기</button>
            )}
          </div>
        ) : (
          filter === "mine" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-10 gap-x-6">
              {list.map((t) => <FarmTree key={t.id} t={t} size="lg" onClick={() => setOpen(t)} />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-2 gap-y-5">
              {list.map((t) => <FarmTree key={t.id} t={t} size="sm" onClick={() => setOpen(t)} />)}
            </div>
          )
        )}
      </section>
      {open && <TreeDetail t={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
