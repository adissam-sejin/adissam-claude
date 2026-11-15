"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Persimmon, PixelTree } from "@/components/Pixel";
import { periodState, seedOf } from "@/components/FarmTree";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { koShort, today } from "@/lib/date";

type AdminTree = { id: string; name: string; code: string; start_date: string; end_date: string; member_count: number; note_count: number };
type Member = { user_id: string; nickname: string; kakao_name: string | null; joined_at: string; period_count: number; total_count: number };
type Form = { id?: string; name: string; code: string; start_date: string; end_date: string };

const randomCode = () => {
  const s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => s[Math.floor(Math.random() * s.length)]).join("");
};
const emptyForm = (): Form => {
  const t = today();
  const end = new Date(); end.setMonth(end.getMonth() + 3);
  return { name: "", code: randomCode(), start_date: t, end_date: end.toISOString().slice(0, 10) };
};

export default function AdminPage() {
  const { user, profile, loading } = useAuth();
  const [trees, setTrees] = useState<AdminTree[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [formMsg, setFormMsg] = useState("");
  const [selected, setSelected] = useState<AdminTree | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase().rpc("admin_trees");
    setTrees((data ?? []) as AdminTree[]);
  }, []);

  useEffect(() => { if (profile?.is_admin) load(); }, [profile, load]);

  const openMembers = async (t: AdminTree) => {
    setSelected(t);
    setMembers(null);
    const { data } = await supabase().rpc("admin_tree_members", { p_tree: t.id });
    setMembers((data ?? []) as Member[]);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const row = { name: form.name.trim(), code: form.code.trim().toUpperCase(), start_date: form.start_date, end_date: form.end_date };
    if (!row.name) return setFormMsg("감나무 이름을 입력해주세요.");
    if (!/^[A-Z0-9]{4,16}$/.test(row.code)) return setFormMsg("코드는 영문 대문자/숫자 4~16자예요.");
    if (row.end_date < row.start_date) return setFormMsg("종료일이 시작일보다 빨라요.");
    const sb = supabase();
    const { error } = form.id ? await sb.from("trees").update(row).eq("id", form.id) : await sb.from("trees").insert(row);
    if (error) return setFormMsg(error.code === "23505" ? "이미 사용 중인 코드예요." : `저장 실패: ${error.message}`);
    setForm(null); setFormMsg("");
    load();
  };

  const remove = async (t: AdminTree) => {
    if (!confirm(`‘${t.name}’ 감나무를 삭제할까요? 참여자 연결도 함께 사라져요. (각자의 감사노트는 그대로 남아요)`)) return;
    await supabase().from("trees").delete().eq("id", t.id);
    if (selected?.id === t.id) setSelected(null);
    load();
  };

  const kick = async (m: Member) => {
    if (!selected || !confirm(`${m.nickname}님을 이 감나무에서 내보낼까요?`)) return;
    await supabase().from("tree_members").delete().eq("tree_id", selected.id).eq("user_id", m.user_id);
    openMembers(selected);
    load();
  };

  if (loading) return <div className="min-h-dvh flex items-center justify-center"><Persimmon className="w-10 h-10 animate-bounce" /></div>;
  if (!user || !profile?.is_admin) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
        <Persimmon className="w-14 h-14" />
        <h1 className="pixel text-xl font-bold mt-4">관리자만 들어올 수 있어요</h1>
        <p className="text-sm text-ink/60 mt-2">{user ? "이 계정에는 관리자 권한이 없어요." : "먼저 카카오로 로그인해주세요."}</p>
        <Link href={user ? "/calendar" : "/?next=/admin"} className="px-btn mt-5 px-5 py-2 bg-gam text-white">{user ? "앱으로 돌아가기" : "로그인하러 가기"}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="bg-ink text-cream">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Persimmon className="w-7 h-7" />
          <span className="pixel font-bold">감농장 관리자</span>
          <Link href="/farm" className="ml-auto text-sm underline">앱으로 →</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_1fr] gap-6">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="pixel text-lg font-bold">감나무 목록 <span className="text-ink/50 text-sm">({trees.length})</span></h2>
            <button onClick={() => { setForm(emptyForm()); setFormMsg(""); }} className="px-btn px-3 py-1.5 bg-leaf text-white text-sm">＋ 새 감나무</button>
          </div>

          {form && (
            <form onSubmit={save} className="px-box p-4 mb-4 space-y-3 bg-gam-light/40">
              <p className="pixel font-bold">{form.id ? "감나무 수정" : "새 감나무 심기"}</p>
              <label className="block text-sm">이름 (감나무에 적혀요)
                <input value={form.name} maxLength={30} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full border-2 border-ink rounded px-3 py-2 bg-white" placeholder="예: 3기 감사 모임" />
              </label>
              <label className="block text-sm">참여 코드
                <div className="mt-1 flex gap-2">
                  <input value={form.code} maxLength={16} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="flex-1 min-w-0 border-2 border-ink rounded px-3 py-2 bg-white pixel tracking-widest" />
                  <button type="button" onClick={() => setForm({ ...form, code: randomCode() })} className="px-btn px-3 bg-white text-xs">자동 생성</button>
                </div>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">키우기 시작
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="mt-1 w-full border-2 border-ink rounded px-2 py-2 bg-white" />
                </label>
                <label className="block text-sm">키우기 끝
                  <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="mt-1 w-full border-2 border-ink rounded px-2 py-2 bg-white" />
                </label>
              </div>
              <p className="text-xs text-ink/60">기간 안에 쓴 감사노트만 이 감나무의 감으로 집계돼요.</p>
              {formMsg && <p className="text-sm text-red-600">{formMsg}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm(null)} className="px-btn flex-1 py-2 bg-white">취소</button>
                <button className="px-btn flex-1 py-2 bg-gam text-white">저장</button>
              </div>
            </form>
          )}

          <ul className="space-y-3">
            {trees.map((t) => (
              <li key={t.id} className={`px-box p-3 flex gap-3 ${selected?.id === t.id ? "bg-gam-light/50" : ""}`}>
                <PixelTree count={t.note_count} seed={seedOf(t.id)} className="w-16 h-[70px] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold truncate">{t.name}</p>
                    <span className="pixel text-[10px] px-1.5 border border-ink/40 bg-white">{periodState(t).label}</span>
                  </div>
                  <p className="pixel text-sm mt-0.5">코드 <span className="bg-ink text-cream px-1.5 tracking-widest select-all">{t.code}</span></p>
                  <p className="text-xs text-ink/60 mt-0.5">{koShort(t.start_date)} ~ {koShort(t.end_date)}</p>
                  <p className="text-xs mt-0.5">참여 {t.member_count}명 · 감사 {t.note_count}개</p>
                  <div className="flex gap-3 mt-2 text-xs">
                    <button onClick={() => openMembers(t)} className="underline font-bold">참여자 보기</button>
                    <button onClick={() => { setForm({ id: t.id, name: t.name, code: t.code, start_date: t.start_date, end_date: t.end_date }); setFormMsg(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="underline">수정</button>
                    <button onClick={() => remove(t)} className="underline text-red-600">삭제</button>
                  </div>
                </div>
              </li>
            ))}
            {trees.length === 0 && <li className="text-sm text-ink/60">아직 감나무가 없어요. ‘새 감나무’로 첫 그룹을 만들어보세요.</li>}
          </ul>
        </section>

        <section className="lg:sticky lg:top-6 self-start">
          <h2 className="pixel text-lg font-bold mb-3">참여자</h2>
          {!selected ? (
            <p className="px-box p-4 text-sm text-ink/60">왼쪽에서 감나무의 ‘참여자 보기’를 눌러주세요.</p>
          ) : (
            <div className="px-box p-4">
              <p className="font-bold">{selected.name} <span className="pixel text-xs text-ink/50">{selected.code}</span></p>
              <p className="text-xs text-ink/60 mb-3">감사노트 내용은 볼 수 없고, 개수만 보여요.</p>
              {members === null ? (
                <p className="text-sm">불러오는 중…</p>
              ) : members.length === 0 ? (
                <p className="text-sm text-ink/60">아직 참여한 사람이 없어요.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-ink text-left">
                        <th className="py-1.5 pr-2">#</th>
                        <th className="py-1.5 pr-2">닉네임</th>
                        <th className="py-1.5 pr-2 text-right">기간 내</th>
                        <th className="py-1.5 pr-2 text-right">전체</th>
                        <th className="py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m, i) => (
                        <tr key={m.user_id} className="border-b border-ink/10">
                          <td className="py-2 pr-2 pixel text-xs">{i + 1}</td>
                          <td className="py-2 pr-2">
                            <p className="font-medium">{m.nickname}</p>
                            <p className="text-[11px] text-ink/50">카카오: {m.kakao_name ?? "-"} · {koShort(m.joined_at.slice(0, 10))} 참여</p>
                          </td>
                          <td className="py-2 pr-2 text-right pixel">{m.period_count}</td>
                          <td className="py-2 pr-2 text-right pixel text-ink/60">{m.total_count}</td>
                          <td className="py-2 text-right"><button onClick={() => kick(m)} className="text-[11px] underline text-ink/50">내보내기</button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold">
                        <td colSpan={2} className="pt-2">합계 {members.length}명</td>
                        <td className="pt-2 pr-2 text-right pixel">{members.reduce((a, m) => a + m.period_count, 0)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
