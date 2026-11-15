"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/AppShell";
import { SignBoard, periodState } from "@/components/FarmTree";
import { useAuth } from "@/components/AuthProvider";
import { supabase, signedUrls } from "@/lib/supabase";
import { koShort, monthEnd, pad } from "@/lib/date";

type MyTree = { id: string; name: string; start_date: string; end_date: string; joined_at: string };

function Section({ id, title, desc, children }: { id?: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="px-box p-4 scroll-mt-20">
      <h2 className="pixel font-bold">{title}</h2>
      {desc && <p className="text-xs text-ink/60 mt-0.5">{desc}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { user, profile, refresh, signOut } = useAuth();
  const [nickname, setNickname] = useState("");
  const [nickMsg, setNickMsg] = useState("");
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [trees, setTrees] = useState<MyTree[]>([]);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const [from, setFrom] = useState(thisMonth);
  const [to, setTo] = useState(thisMonth);
  const [pdfState, setPdfState] = useState("");

  useEffect(() => { if (profile) setNickname(profile.nickname); }, [profile]);

  const loadTrees = useCallback(async () => {
    const { data } = await supabase().rpc("my_trees");
    setTrees((data ?? []) as MyTree[]);
  }, []);
  useEffect(() => { if (user) loadTrees(); }, [user, loadTrees]);

  const saveNick = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = nickname.trim();
    if (n.length < 1 || n.length > 20) { setNickMsg("닉네임은 1~20자로 정해주세요."); return; }
    const { error } = await supabase().from("profiles").update({ nickname: n }).eq("id", user!.id);
    setNickMsg(error ? "저장하지 못했어요." : "닉네임이 바뀌었어요!");
    if (!error) refresh();
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    const { data, error } = await supabase().rpc("join_tree", { p_code: code.trim() });
    if (error) setCodeMsg({ ok: false, text: error.message || "코드를 확인해주세요." });
    else { setCodeMsg({ ok: true, text: `‘${data}’ 감나무에 참여했어요! 🌳` }); setCode(""); loadTrees(); }
  };

  const leave = async (t: MyTree) => {
    if (!confirm(`‘${t.name}’ 감나무에서 나갈까요? 내 감사 개수가 이 감나무에서 빠져요.`)) return;
    await supabase().from("tree_members").delete().eq("tree_id", t.id).eq("user_id", user!.id);
    loadTrees();
  };

  const exportPdf = async () => {
    if (!user || !profile) return;
    if (from > to) { setPdfState("시작 달이 끝 달보다 늦어요."); return; }
    setPdfState("감사노트를 모으는 중…");
    const { data, error } = await supabase().from("notes")
      .select("note_date,content,photo_path").eq("user_id", user.id)
      .gte("note_date", `${from}-01`).lte("note_date", monthEnd(to)).order("note_date");
    if (error) { setPdfState("불러오지 못했어요."); return; }
    if (!data?.length) { setPdfState("선택한 기간에 작성한 감사노트가 없어요."); return; }
    const urls = await signedUrls(data.map((d) => d.photo_path));
    const { exportNotesPdf } = await import("@/lib/pdf");
    try {
      await exportNotesPdf({
        notes: data.map((d) => ({ ...d, photoUrl: d.photo_path ? urls[d.photo_path] : null })),
        nickname: profile.nickname, from, to,
        onProgress: (d, t) => setPdfState(`PDF 만드는 중… ${d}/${t}`),
      });
      setPdfState("PDF 저장 완료!");
    } catch {
      setPdfState("PDF를 만들지 못했어요. 다시 시도해주세요.");
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Avatar url={profile?.avatar_url} name={profile?.nickname} size={56} />
        <div>
          <p className="text-lg font-bold">{profile?.nickname}</p>
          <p className="text-xs text-ink/60">카카오 계정: {profile?.kakao_name ?? "-"}</p>
        </div>
      </div>

      <Section title="닉네임" desc="카카오 이름 대신 감사노트에서 보여질 이름이에요.">
        <form onSubmit={saveNick} className="flex gap-2">
          <input value={nickname} onChange={(e) => { setNickname(e.target.value); setNickMsg(""); }} maxLength={20}
            className="flex-1 min-w-0 border-2 border-ink rounded px-3 py-2 text-base" placeholder="닉네임 (1~20자)" />
          <button className="px-btn px-4 bg-gam text-white">저장</button>
        </form>
        {nickMsg && <p className="text-sm mt-2">{nickMsg}</p>}
      </Section>

      <Section id="tree" title="감나무 코드" desc="관리자에게 받은 코드를 입력하면 감농장에 내 감사노트 개수가 반영돼요. 내용은 공유되지 않아요.">
        <form onSubmit={join} className="flex gap-2">
          <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeMsg(null); }}
            className="flex-1 min-w-0 border-2 border-ink rounded px-3 py-2 pixel tracking-widest uppercase text-base" placeholder="예: GAM2026" maxLength={16} />
          <button className="px-btn px-4 bg-leaf text-white">참여</button>
        </form>
        {codeMsg && <p className={`text-sm mt-2 ${codeMsg.ok ? "text-leaf" : "text-red-600"}`}>{codeMsg.text}</p>}
        {trees.length > 0 && (
          <ul className="mt-4 space-y-2">
            {trees.map((t) => (
              <li key={t.id} className="flex items-center gap-3 border-2 border-ink/20 rounded p-2 bg-cream">
                <SignBoard name={t.name} small />
                <div className="flex-1 min-w-0 text-xs">
                  <p>{koShort(t.start_date)} ~ {koShort(t.end_date)}</p>
                  <p className="pixel text-[10px] text-ink/60">{periodState(t).label}</p>
                </div>
                <button onClick={() => leave(t)} className="text-xs underline text-ink/50">나가기</button>
              </li>
            ))}
          </ul>
        )}
        <Link href="/farm" className="inline-block mt-3 text-sm underline">감농장 보러 가기 →</Link>
      </Section>

      <Section title="감사노트 PDF로 저장" desc="원하는 달부터 달까지 월 단위로 골라 PDF로 내려받아요.">
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={from} max={thisMonth} onChange={(e) => setFrom(e.target.value)} className="border-2 border-ink rounded px-2 py-1.5 bg-white" aria-label="시작 달" />
          <span>~</span>
          <input type="month" value={to} max={thisMonth} onChange={(e) => setTo(e.target.value)} className="border-2 border-ink rounded px-2 py-1.5 bg-white" aria-label="끝 달" />
        </div>
        <button onClick={exportPdf} disabled={pdfState.includes("중…")} className="px-btn w-full mt-3 py-2.5 bg-gam text-white">PDF 저장하기</button>
        {pdfState && <p className="text-sm mt-2">{pdfState}</p>}
      </Section>

      <Section title="계정">
        <div className="flex flex-wrap gap-2">
          {profile?.is_admin && <Link href="/admin" className="px-btn px-4 py-2 bg-white text-sm">관리자 페이지</Link>}
          <button onClick={signOut} className="px-btn px-4 py-2 bg-white text-sm">로그아웃</button>
        </div>
      </Section>
    </div>
  );
}
