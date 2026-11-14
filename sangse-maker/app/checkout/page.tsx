"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadTossPayments, type TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { TopBar } from "@/components/TopBar";
import { findPackage } from "@/lib/pricing";

interface Order { orderId: string; amount: number; orderName: string; customerKey: string; customerEmail?: string }

export default function CheckoutPage() {
  const [pkgId, setPkgId] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const id = new URLSearchParams(window.location.search).get("package") ?? "";
    setPkgId(id);
    (async () => {
      try {
        const res = await fetch("/api/payments/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageId: id }) });
        const data = await res.json();
        if (res.status === 401) return (window.location.href = `/login?next=${encodeURIComponent(`/checkout?package=${id}`)}`);
        if (!res.ok) throw new Error(data.error);
        setOrder(data);
        const toss = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
        const widgets = toss.widgets({ customerKey: data.customerKey });
        widgetsRef.current = widgets;
        await widgets.setAmount({ currency: "KRW", value: data.amount });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
          widgets.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
        ]);
        setReady(true);
      } catch (e) {
        setError((e as Error).message || "결제창을 불러오지 못했어요.");
      }
    })();
  }, []);

  const pkg = findPackage(pkgId);

  return (
    <>
      <TopBar />
      <main className="wizard" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>크레딧 충전</h1>
        {pkg && (
          <div className="card row between" style={{ margin: "16px 0" }}>
            <div>
              <b>{pkg.name}</b> <span className="muted">· {pkg.credits.toLocaleString()} 크레딧</span>
            </div>
            <b style={{ fontSize: 20 }}>{pkg.price.toLocaleString()}원</b>
          </div>
        )}
        {error && (
          <div className="error-box" style={{ marginBottom: 12 }}>
            {error} <Link href="/pricing" style={{ textDecoration: "underline" }}>요금제로 돌아가기</Link>
          </div>
        )}
        <div id="payment-method" />
        <div id="agreement" />
        <button
          className="btn btn-primary btn-lg"
          style={{ width: "100%", marginTop: 12 }}
          disabled={!ready || !order}
          onClick={async () => {
            if (!order || !widgetsRef.current) return;
            try {
              await widgetsRef.current.requestPayment({
                orderId: order.orderId,
                orderName: order.orderName,
                customerEmail: order.customerEmail,
                successUrl: `${window.location.origin}/payments/success`,
                failUrl: `${window.location.origin}/payments/fail`,
              });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {ready ? `${order?.amount.toLocaleString()}원 결제하기` : "결제창 불러오는 중…"}
        </button>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>결제는 토스페이먼츠를 통해 안전하게 처리돼요. 충전한 크레딧은 바로 사용할 수 있어요.</p>
      </main>
    </>
  );
}
