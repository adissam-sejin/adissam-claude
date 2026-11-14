"use client";

import Link from "next/link";
import { useMe } from "@/lib/useMe";
import { supabaseBrowser } from "@/lib/supabase/client";

export function UserMenu() {
  const { me, refresh } = useMe();
  if (!me) return <span style={{ width: 120 }} />;
  if (!me.user)
    return (
      <>
        <Link className="btn btn-sm btn-ghost" href="/login">로그인</Link>
        <Link className="btn btn-primary btn-sm" href="/login?mode=signup">무료로 시작하기</Link>
      </>
    );
  return (
    <>
      <Link href="/pricing" className="credit-pill" title="크레딧 충전">
        <span className="coin">C</span>
        {me.credits?.toLocaleString() ?? 0}
        <span className="plus">충전</span>
      </Link>
      <Link className="btn btn-sm btn-ghost" href="/account">내 정보</Link>
      <button
        className="btn btn-sm btn-ghost"
        onClick={async () => {
          await supabaseBrowser().auth.signOut();
          await refresh();
          window.location.href = "/";
        }}
      >
        로그아웃
      </button>
    </>
  );
}

export function TopBar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div className="container topbar-in">
        <Link href="/" className="logo">
          <span className="logo-mark">상</span>상세메이트
        </Link>
        <nav className="nav">
          {right ?? (
            <>
              <a className="navlink" href="/#how">이용 방법</a>
              <a className="navlink" href="/pricing">요금제</a>
              <a className="navlink" href="/create">만들기</a>
              <UserMenu />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
