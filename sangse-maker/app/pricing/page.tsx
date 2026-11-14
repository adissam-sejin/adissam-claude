"use client";

import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { COSTS, PACKAGES, SIGNUP_BONUS } from "@/lib/pricing";
import { useMe } from "@/lib/useMe";

export default function PricingPage() {
  const { me } = useMe();
  return (
    <>
      <TopBar />
      <main>
        <section className="section">
          <div className="container">
            <span className="kicker">PRICING</span>
            <h2>쓴 만큼만, 크레딧 충전</h2>
            <p className="sub">구독 없이 필요한 만큼 충전하세요. 가입하면 {SIGNUP_BONUS} 크레딧을 무료로 드려요.</p>
            <div className="price-grid">
              {PACKAGES.map((p) => (
                <div key={p.id} className={`price-card ${"best" in p && p.best ? "best" : ""}`}>
                  {"best" in p && p.best && <span className="badge">가장 많이 선택</span>}
                  <b style={{ fontSize: 18 }}>{p.name}</b>
                  <div className="cr">{p.credits.toLocaleString()} 크레딧</div>
                  <div className="amount">{p.price.toLocaleString()}원</div>
                  <p className="muted" style={{ margin: 0, fontSize: 14 }}>{p.desc}</p>
                  <Link
                    href={me?.user ? `/checkout?package=${p.id}` : `/login?mode=signup&next=${encodeURIComponent(`/checkout?package=${p.id}`)}`}
                    className={`btn ${"best" in p && p.best ? "btn-primary" : "btn-dark"}`}
                    style={{ marginTop: 8 }}
                  >
                    충전하기
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="section alt">
          <div className="container">
            <h2>크레딧은 이렇게 쓰여요</h2>
            <p className="sub">사진 분석과 기획 초안은 몇 번이든 무료예요.</p>
            <table className="cost-table">
              <tbody>
                <tr><td>사진으로 자동 채우기</td><td>무료</td></tr>
                <tr><td>기획 초안 만들기 / 다시 만들기</td><td>무료</td></tr>
                <tr><td>상세페이지 생성</td><td>{COSTS.generate} 크레딧</td></tr>
                <tr><td>섹션 AI 수정 (1회)</td><td>{COSTS.revise} 크레딧</td></tr>
                <tr><td>AI 연출 이미지 (1장)</td><td>{COSTS.image} 크레딧</td></tr>
                <tr><td>직접 편집 · 내보내기</td><td>무료 · 무제한</td></tr>
              </tbody>
            </table>
            <p className="muted" style={{ textAlign: "center", fontSize: 13, marginTop: 16 }}>생성에 실패하면 차감된 크레딧은 자동으로 돌려드려요.</p>
          </div>
        </section>
      </main>
    </>
  );
}
