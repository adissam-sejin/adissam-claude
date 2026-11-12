import Link from "next/link";

export function TopBar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div className="container topbar-in" style={{ maxWidth: right ? "none" : undefined }}>
        <Link href="/" className="logo">
          <span className="logo-mark">상</span>상세메이트
        </Link>
        <nav className="nav">
          {right ?? (
            <>
              <a className="navlink" href="/#how">이용 방법</a>
              <a className="navlink" href="/#features">기능</a>
              <a className="navlink" href="/#faq">FAQ</a>
              <Link className="btn btn-primary btn-sm" href="/create">무료로 만들기</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
