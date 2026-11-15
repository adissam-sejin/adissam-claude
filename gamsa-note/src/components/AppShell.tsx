"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PixelArt, Persimmon } from "./Pixel";
import { useAuth } from "./AuthProvider";

const I = {
  write: [
    "........KK",
    ".......KOK",
    "......KOK.",
    ".....KOK..",
    "....KOK...",
    "...KOK....",
    "..KOK.....",
    ".KKK......",
    ".KK.......",
    "KKKKKKKKKK",
  ],
  calendar: [
    ".K....K...",
    "KKKKKKKKKK",
    "KOOOOOOOOK",
    "KKKKKKKKKK",
    "K........K",
    "K.KK..KK.K",
    "K........K",
    "K.KK..KK.K",
    "K........K",
    "KKKKKKKKKK",
  ],
  gallery: [
    "KKKKKKKKKK",
    "K........K",
    "K.....OO.K",
    "K.....OO.K",
    "K........K",
    "K..K.....K",
    "K.KKK..K.K",
    "KKKKKKKKKK",
    "KKKKKKKKKK",
    "..........",
  ],
  feed: [
    "..........",
    ".KK....KK.",
    "KOOK..KOOK",
    "KOOOKKOOOK",
    "KOOOOOOOOK",
    ".KOOOOOOK.",
    "..KOOOOK..",
    "...KOOK...",
    "....KK....",
    "..........",
  ],
  farm: [
    "...KKKK...",
    "..KGGGGK..",
    ".KGOGGGGK.",
    "KGGGGGOGGK",
    "KGOGGGGGGK",
    ".KGGGOGGK.",
    "..KKBBKK..",
    "....BB....",
    "....BB....",
    "..KKKKKK..",
  ],
};

const NAV = [
  { href: "/write", label: "기록", icon: I.write },
  { href: "/calendar", label: "달력", icon: I.calendar },
  { href: "/gallery", label: "갤러리", icon: I.gallery },
  { href: "/feed", label: "피드", icon: I.feed },
  { href: "/farm", label: "감농장", icon: I.farm },
];

function tint(rows: string[], active: boolean) {
  return active ? rows : rows.map((r) => r.replace(/[OGB]/g, (c) => (c === "O" ? "." : c === "G" ? "." : "K")));
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { profile } = useAuth();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur border-b-[3px] border-ink">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-3">
          <Link href="/calendar" className="flex items-center gap-2 shrink-0">
            <Persimmon className="w-7 h-7" />
            <span className="pixel font-bold text-lg tracking-tight">감사노트</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-6">
            {NAV.map((n) => {
              const on = path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href}
                  className={`pixel flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm ${on ? "bg-gam-light text-ink font-bold" : "text-ink/70 hover:bg-white"}`}>
                  <PixelArt rows={tint(n.icon, on)} className="w-4 h-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {profile?.is_admin && (
              <Link href="/admin" className="pixel text-xs px-2 py-1 border-2 border-ink rounded bg-white">관리자</Link>
            )}
            <Link href="/settings" aria-label="내 설정"
              className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border-2 border-ink bg-white ${path.startsWith("/settings") ? "bg-gam-light" : ""}`}>
              <Avatar url={profile?.avatar_url} name={profile?.nickname} size={26} />
              <span className="text-sm font-medium max-w-24 truncate">{profile?.nickname ?? "…"}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto max-w-5xl px-4 pt-4 pb-28 md:pb-12">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t-[3px] border-ink" style={{ paddingBottom: "var(--safe-bottom)" }}>
        <div className="grid grid-cols-5">
          {NAV.map((n) => {
            const on = path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-1 py-2 ${on ? "text-gam-dark" : "text-ink/60"}`}>
                <PixelArt rows={tint(n.icon, on)} className="w-6 h-6" />
                <span className={`pixel text-[11px] ${on ? "font-bold" : ""}`}>{n.label}</span>
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
