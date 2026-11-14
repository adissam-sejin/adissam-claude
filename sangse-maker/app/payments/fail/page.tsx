"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";

export default function PaymentFail() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    setMsg(code === "PAY_PROCESS_CANCELED" ? "결제를 취소하셨어요." : q.get("message") || "결제에 실패했어요.");
  }, []);
  return (
    <>
      <TopBar />
      <main className="wizard" style={{ maxWidth: 520, textAlign: "center" }}>
        <div className="card stack" style={{ padding: 32 }}>
          <h2 style={{ margin: 0 }}>결제가 완료되지 않았어요</h2>
          <p className="muted" style={{ margin: 0 }}>{msg}</p>
          <Link href="/pricing" className="btn btn-primary">다시 시도하기</Link>
        </div>
      </main>
    </>
  );
}
