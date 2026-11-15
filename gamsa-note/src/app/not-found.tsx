import Link from "next/link";
import { Persimmon } from "@/components/Art3D";

export default function NotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
      <Persimmon className="w-16 h-16" />
      <h1 className="font-display text-2xl font-bold mt-4">404</h1>
      <p className="mt-2 text-ink/60">찾으시는 페이지가 없어요.</p>
      <Link href="/" className="btn3d mt-6 px-5 py-2 btn-gam">처음으로</Link>
    </main>
  );
}
