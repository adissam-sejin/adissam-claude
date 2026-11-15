import KakaoLoginButton from "@/components/KakaoLoginButton";
import { GamTree, Persimmon } from "@/components/Illust";

export default async function Landing({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="min-h-dvh flex flex-col max-w-md mx-auto px-6 pt-12 pb-8">
      <p className="text-gam font-bold text-[14px]">Gratitude Note</p>
      <h1 className="mt-2 text-[28px] leading-[1.35] font-extrabold">
        매일 감사한 일을 적고<br />나만의 <span className="text-gam">감나무</span>를 키워요
      </h1>
      <p className="mt-3 text-[14px] text-sub leading-relaxed">
        원고지에 쓰는 하루 한 줄 감사, 사진 한 장.<br />함께 감사하면 감나무에 감이 주렁주렁 열려요.
      </p>

      <div className="relative mt-4">
        <GamTree count={150} className="w-full max-w-[360px] mx-auto" />
        <div className="-mt-1 flex justify-center gap-2">
          <span className="bg-gam text-white rounded-full px-3.5 py-1 text-[13px] font-bold">Lv.6 감나무</span>
          <span className="bg-white border border-line rounded-full px-3 py-1 text-[13px] font-bold">감 50개가 열렸어요</span>
        </div>
        <Persimmon className="absolute right-0 top-2 w-14 h-14 rotate-12 floaty" />
      </div>

      <div className="flex-1" />
      <div className="mt-8">
        <KakaoLoginButton next={sp.next} />
        {sp.error && <p className="mt-3 text-center text-sm text-red-600">로그인에 실패했어요. 다시 시도해주세요.</p>}
        <p className="mt-4 text-center text-[11px] text-sub">가입하면 이용약관 및 개인정보 처리방침에 동의하게 됩니다.</p>
      </div>
    </main>
  );
}
