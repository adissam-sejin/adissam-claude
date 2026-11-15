import KakaoLoginButton from "@/components/KakaoLoginButton";
import { GamTree, Persimmon } from "@/components/Art3D";

export default async function Landing({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="min-h-dvh flex flex-col">
      <section className="farm-sky pt-12 px-6 text-center relative overflow-hidden">
        <div className="sun absolute -right-4 -top-4 w-20 h-20" />
        <div className="cloud floaty left-5 top-10 w-24 h-7" />
        <div className="cloud floaty right-[30%] top-28 w-14 h-5" style={{ animationDelay: "1.2s" }} />
        <div className="relative flex justify-center items-center gap-2">
          <Persimmon className="w-14 h-14 drop-shadow-lg" />
          <h1 className="font-display text-5xl text-[#4a2c17] drop-shadow-[0_3px_0_#fff]">감사노트</h1>
        </div>
        <p className="relative mt-3 text-ink/80 leading-relaxed">
          하루 한 가지 감사를 원고지에 적고<br />사진 한 장으로 오늘을 남겨요.
        </p>
        <div className="relative mt-4 flex justify-center items-end -mb-6">
          <GamTree count={30} className="w-24 sm:w-36 -mr-6" />
          <GamTree count={160} seed={3} className="w-56 sm:w-80 z-10" />
          <GamTree count={80} className="w-28 sm:w-40 -ml-6" />
        </div>
      </section>
      <section className="farm-ground flex-1 px-5 pt-12 pb-10 flex flex-col items-center">
        <div className="card p-6 w-full max-w-sm">
          <ul className="space-y-3 text-[15px]">
            {[
              "원고지에 쓰는 오늘의 감사 한 줄",
              "감사한 날마다 달력에 감이 하나씩",
              "함께 키우는 감나무, 101번째 감사부터 감이 주렁주렁",
              "기본은 비공개, 원할 때만 피드에 나눠요",
            ].map((t) => (
              <li key={t} className="flex gap-2.5 items-start"><Persimmon small className="w-6 h-6 shrink-0" /> {t}</li>
            ))}
          </ul>
          <div className="mt-6 flex justify-center">
            <KakaoLoginButton next={sp.next} />
          </div>
          {sp.error && <p className="mt-3 text-center text-sm text-red-600">로그인에 실패했어요. 다시 시도해주세요.</p>}
          <p className="mt-3 text-center text-[11px] text-ink/50">카카오 계정으로 간편하게 가입해요.</p>
        </div>
      </section>
    </main>
  );
}
