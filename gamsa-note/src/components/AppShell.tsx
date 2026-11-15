"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Persimmon } from "./Art3D";
import { useAuth } from "./AuthProvider";

const sv = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">{d}</svg>
);
const I = {
  write: sv(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>),
  calendar: sv(<><rect x="3" y="4.5" width="18" height="16.5" rx="3" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /><circle cx="12" cy="15.5" r="1.6" fill="currentColor" /></>),
  gallery: sv(<><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>),
  feed: sv(<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />),
  farm: sv(<><path d="M12 22v-7" /><path d="M8 15h8a4 4 0 0 0 1.7-7.6A5 5 0 0 0 7.1 6.2 4.5 4.5 0 0 0 8 15Z" /><path d="M7 22h10" /></>),
};

const NAV = [
  { href: "/write", label: "기록", icon: I.write },
  { href: "/calendar", label: "달력", icon: I.calendar },
  { href: "/gallery", label: "갤러리", icon: I.gallery },
  { href: "/feed", label: "피드", icon: I.feed },
  { href: "/farm", label: "감농장", icon: I.farm },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { profile } = useAuth();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 bg-cream/85 backdrop-blur-md shadow-[0_6px_20px_-14px_rgba(120,72,30,.45)]">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-3">
          <Link href="/calendar" className="flex items-center gap-2 shrink-0">
            <Persimmon className="w-8 h-8" />
            <span className="font-display text-xl text-[#4a2c17]">감사노트</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-6">
            {NAV.map((n) => {
              const on = path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href}
                  className={`font-display flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[15px] ${on ? "bg-white text-gam-dark shadow-sm" : "text-ink/60 hover:bg-white/70"}`}>
                  <span className="w-4 h-4">{n.icon}</span>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {profile?.is_admin && (
              <Link href="/admin" className="font-display text-xs px-3 py-1.5 rounded-full shadow-sm bg-white">관리자</Link>
            )}
            <Link href="/settings" aria-label="내 설정"
              className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full rounded-full shadow-sm bg-white ${path.startsWith("/settings") ? "bg-gam-light" : ""}`}>
              <Avatar url={profile?.avatar_url} name={profile?.nickname} size={26} />
              <span className="text-sm font-medium max-w-24 truncate">{profile?.nickname ?? "…"}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto max-w-5xl px-4 pt-4 pb-28 md:pb-12">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md rounded-t-3xl shadow-[0_-8px_24px_-14px_rgba(120,72,30,.45)]" style={{ paddingBottom: "var(--safe-bottom)" }}>
        <div className="grid grid-cols-5">
          {NAV.map((n) => {
            const on = path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-1 py-2 ${on ? "text-gam-dark" : "text-ink/45"}`}>
                <span className={`w-6 h-6 transition-transform ${on ? "-translate-y-0.5 scale-110" : ""}`}>{n.icon}</span>
                <span className="font-display text-[12px]">{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function Avatar({ url, name, size = 32 }: { url?: string | null; name?: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="rounded-full object-cover bg-gam-light shrink-0" style={{ width: size, height: size }} referrerPolicy="no-referrer" />;
  }
  return (
    <span className="rounded-full bg-gam-light flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <Persimmon className="w-3/5 h-3/5" title={name ?? undefined} />
    </span>
  );
}
