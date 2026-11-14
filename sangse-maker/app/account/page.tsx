"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { supabaseBrowser } from "@/lib/supabase/client";
import { deleteProject, listProjects, type ProjectSummary } from "@/lib/store";
import { useMe } from "@/lib/useMe";

interface Ledger { id: number; delta: number; balance: number; reason: string; created_at: string }
interface Payment { order_id: string; amount: number; credits: number; status: string; method: string | null; created_at: string }

export default function AccountPage() {
  const { me } = useMe();
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [pw, setPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  useEffect(() => {
    if (me && !me.user) window.location.href = "/login?next=/account";
    if (!me?.user) return;
    const sb = supabaseBrowser();
    sb.from("credit_ledger").select("id, delta, balance, reason, created_at").order("created_at", { ascending: false }).limit(30).then(({ data }) => setLedger(data ?? []));
    sb.from("payments").select("order_id, amount, credits, status, method, created_at").eq("status", "done").order("created_at", { ascending: false }).limit(20).then(({ data }) => setPayments(data ?? []));
    listProjects().then(setProjects);
  }, [me]);

  if (!me?.user) return <TopBar />;
  const fmt = (s: string) => new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });

  return (
    <>
      <TopBar />
      <main className="wizard" style={{ maxWidth: 960 }}>
        <div className="row between" style={{ marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26 }}>내 정보</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>{me.user.email}</p>
          </div>
          <div className="card row" style={{ padding: "14px 18px" }}>
            <div>
              <div className="muted" style={{ fontSize: 13 }}>보유 크레딧</div>
              <b style={{ fontSize: 26 }}>{me.credits?.toLocaleString()}</b>
            </div>
            <Link href="/pricing" className="btn btn-primary">충전하기</Link>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row between" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>내 상세페이지 ({projects.length})</h3>
            <Link href="/create" className="btn btn-sm btn-dark">+ 새로 만들기</Link>
          </div>
          {projects.length === 0 ? (
            <p className="muted">아직 만든 상세페이지가 없어요.</p>
          ) : (
            <div className="proj-grid">
              {projects.map((p) => (
                <div key={p.id} className="proj-card">
                  <a href={`/create?id=${p.id}`} className="th" style={{ display: "block" }}>{p.thumbnail && <img src={p.thumbnail} alt="" />}</a>
                  <div className="meta">
                    <div className="row between" style={{ flexWrap: "nowrap" }}>
                      <a href={`/create?id=${p.id}`} style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</a>
                      <button className="icon-btn" title="삭제" onClick={async () => { if (!confirm("삭제할까요?")) return; await deleteProject(p.id); setProjects((x) => x.filter((y) => y.id !== p.id)); }}>✕</button>
                    </div>
                    <span className="muted">{p.status} · {new Date(p.updatedAt).toLocaleDateString("ko-KR")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid2" style={{ alignItems: "start" }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>크레딧 내역</h3>
            <table className="list-table">
              <thead><tr><th>일시</th><th>내용</th><th style={{ textAlign: "right" }}>변동</th><th style={{ textAlign: "right" }}>잔액</th></tr></thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id}>
                    <td className="muted">{fmt(l.created_at)}</td>
                    <td>{l.reason}</td>
                    <td style={{ textAlign: "right" }} className={l.delta > 0 ? "plus-num" : "minus-num"}>{l.delta > 0 ? "+" : ""}{l.delta}</td>
                    <td style={{ textAlign: "right" }}>{l.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="stack">
            <div className="card">
              <h3 style={{ marginTop: 0 }}>결제 내역</h3>
              {payments.length === 0 ? <p className="muted" style={{ margin: 0 }}>결제 내역이 없어요.</p> : (
                <table className="list-table">
                  <thead><tr><th>일시</th><th>크레딧</th><th style={{ textAlign: "right" }}>금액</th></tr></thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.order_id}><td className="muted">{fmt(p.created_at)}</td><td>{p.credits}</td><td style={{ textAlign: "right" }}>{p.amount.toLocaleString()}원</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <form
              className="card stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
                setPwMsg(error ? error.message : "비밀번호를 변경했어요.");
                setPw("");
              }}
            >
              <h3 style={{ margin: 0 }}>비밀번호 변경</h3>
              <input className="input" type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="새 비밀번호 (6자 이상)" />
              {pwMsg && <div className="muted" style={{ fontSize: 13 }}>{pwMsg}</div>}
              <button className="btn btn-sm">변경</button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
