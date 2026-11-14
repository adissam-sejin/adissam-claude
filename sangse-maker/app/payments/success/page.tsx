"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { useMe } from "@/lib/useMe";

export default function PaymentSuccess() {
  const [state, setState] = useState<{ status: "loading" | "ok" | "error"; msg?: string; added?: number; credits?: number }>({ status: "loading" });
  const done = useRef(false);
  const { setCredits } = useMe();

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const q = new URLSearchParams(window.location.search);
    fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey: q.get("paymentKey"), orderId: q.get("orderId"), amount: Number(q.get("amount")) }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setState({ status: "ok", added: d.added, credits: d.credits });
        setCredits(d.credits);
      })
      .catch((e) => setState({ status: "error", msg: e.message }));
  }, [setCredits]);

  return (
    <>
      <TopBar />
      <main className="wizard" style={{ maxWidth: 520, textAlign: "center" }}>
        {state.status === "loading" && (
          <div className="card loading-card">
            <div className="spinner dark big-spin" />
            <h2>결제를 확인하고 있어요</h2>
          </div>
        )}
        {state.status === "ok" && (
          <div className="card stack" style={{ alignItems: "center", padding: 40 }}>
            <div style={{ fontSize: 44 }}>✓</div>
            <h2 style={{ margin: 0 }}>충전 완료!</h2>
            <p className="muted" style={{ margin: 0 }}>
              {state.added?.toLocaleString()} 크레딧이 충전되어 잔액은 <b>{state.credits?.toLocaleString()}</b> 크레딧이에요.
            </p>
            <Link href="/create" className="btn btn-primary btn-lg">상세페이지 만들러 가기</Link>
          </div>
        )}
        {state.status === "error" && (
          <div className="card stack" style={{ padding: 32 }}>
            <h2 style={{ margin: 0 }}>결제를 완료하지 못했어요</h2>
            <div className="error-box">{state.msg}</div>
            <Link href="/pricing" className="btn">요금제로 돌아가기</Link>
          </div>
        )}
      </main>
    </>
  );
}
