import KakaoLoginButton from "@/components/KakaoLoginButton";
import { GamTree, Persimmon } from "@/components/Art3D";

export default async function Landing({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="min-h-dvh flex flex-col max-w-md mx-auto overflow-hidden">
      <section className="relative pt-10 px-6 text-center flex-1 min-h-[52dvh] flex flex-col">
        <div className="flex justify-center items-center gap-2 text-white drop-shadow-[0_2px_8px_rgba(30,90,150,.35)]">
          <Persimmon small className="w-8 h-8" />
          <h1 className="font-display text-2xl">감사노트</h1>
        </div>
        <Persimmon small className="absolute left-8 top-28 w-10 h-10 floaty -rotate-12 opacity-90" />
        <Persimmon small className="absolute right-10 top-24 w-12 h-12 floaty rotate-12" />
        <Persimmon small className="absolute right-20 top-48 w-7 h-7 floaty opacity-80" />
        <div aria-hidden className="absolute left-1/2 -translate-x-1/2 bottom-[-60px] w-[220%] h-[200px] rounded-[50%] bg-gradient-to-b from-[#b4de86] to-[#9dd06f]" />
        <div className="relative flex-1 flex items-end justify-center">
          <GamTree count={150} seed={3} className="w-72 sm:w-80 drop-shadow-[0_24px_20px_rgba(40,90,40,.3)] floaty" />
        </div>
      </section>
      <section className="bg-white rounded-t-[36px] px-7 pt-8 pb-10 text-center shadow-[0_-10px_40px_-20px_rgba(30,70,40,.4)]">
        <h2 className="text-[28px] leading-tight text-ink">
          <span className="font-semibold">매일의 감사로</span><br />
          <span className="font-extrabold">감나무를 키워요</span>
        </h2>
        <p className="mt-3 text-[13px] text-ink/50 leading-relaxed">
          하루 한 가지 감사를 원고지에 적고 사진 한 장을 남겨요.<br />
          함께 감사하면 감나무에 주황빛 감이 주렁주렁 열려요.
        </p>
        <div className="mt-7 flex justify-center">
          <KakaoLoginButton next={sp.next} />
        </div>
        {sp.error && <p className="mt-3 text-sm text-red-600">로그인에 실패했어요. 다시 시도해주세요.</p>}
        <p className="mt-6 text-[11px] text-ink/40">가입하면 감사노트의 <b>이용약관</b> 및 <b>개인정보 처리방침</b>에 동의하게 됩니다.</p>
      </section>
    </main>
  );
}
