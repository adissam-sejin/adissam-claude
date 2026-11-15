import KakaoLoginButton from "@/components/KakaoLoginButton";
import { Persimmon, PixelTree } from "@/components/Pixel";

export default async function Landing({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="min-h-dvh flex flex-col">
      <section className="farm-sky pt-14 pb-0 px-6 text-center relative overflow-hidden">
        <div className="flex justify-center items-center gap-2">
          <Persimmon className="w-10 h-10" />
          <h1 className="pixel text-3xl font-bold">감사노트</h1>
        </div>
        <p className="mt-3 text-ink/80 leading-relaxed">
          하루 한 가지 감사를 원고지에 적고<br />사진 한 장으로 오늘을 남겨요.
        </p>
        <div className="mt-8 flex justify-center items-end gap-1 sm:gap-4">
          <PixelTree count={8} seed={11} className="w-16 sm:w-24 aspect-[40/44]" />
          <PixelTree count={60} seed={5} className="w-20 sm:w-28 aspect-[40/44]" />
          <PixelTree count={140} seed={3} className="w-32 sm:w-44 aspect-[40/44]" />
          <PixelTree count={95} seed={9} className="w-20 sm:w-28 aspect-[40/44]" />
        </div>
      </section>
      <div className="fence" />
      <section className="farm-ground flex-1 px-6 py-10 flex flex-col items-center">
        <div className="px-box p-5 w-full max-w-sm bg-cream">
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2"><Persimmon className="w-5 h-5 shrink-0" /> 원고지에 쓰는 오늘의 감사 한 줄</li>
            <li className="flex gap-2"><Persimmon className="w-5 h-5 shrink-0" /> 감사한 날마다 달력에 감이 하나씩</li>
            <li className="flex gap-2"><Persimmon className="w-5 h-5 shrink-0" /> 함께 키우는 감나무, 101번째 감사부터 감이 주렁주렁</li>
            <li className="flex gap-2"><Persimmon className="w-5 h-5 shrink-0" /> 기본은 비공개, 원할 때만 피드에 나눠요</li>
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
