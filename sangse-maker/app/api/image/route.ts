import { requireUser, withCredits } from "@/lib/auth";
import { COSTS } from "@/lib/pricing";
import { GenerationError } from "@/lib/claude";
import { generateSceneImage, isImageEnabled, SCENE_PRESETS } from "@/lib/gemini";
import { fetchImageBase64 } from "@/lib/remote-image";
import { handle } from "@/lib/route-helpers";

export const maxDuration = 120;

/** 상품 사진으로 AI 연출 컷 생성 → Storage 저장 → URL 반환 (5크레딧) */
export async function POST(req: Request) {
  const body = (await req.json()) as { sourceUrl: string; scene: string; custom?: string; aspectRatio?: string; projectId: string };
  return handle(async () => {
    const { user, supabase } = await requireUser();
    if (!isImageEnabled()) throw new GenerationError("AI 이미지 생성이 아직 설정되지 않았어요. (관리자: GEMINI_API_KEY 필요)", 503);
    if (!SCENE_PRESETS[body.scene]) throw new GenerationError("장면을 선택해 주세요.", 400);
    const ratio = (["1:1", "4:5", "3:4", "16:9", "4:3"].includes(body.aspectRatio ?? "") ? body.aspectRatio : "1:1") as "1:1";
    const src = await fetchImageBase64(body.sourceUrl);

    return withCredits(user.id, COSTS.image, "AI 연출 이미지", async () => {
      const img = await generateSceneImage({ image: src, scene: body.scene, custom: body.custom?.slice(0, 300), aspectRatio: ratio });
      const ext = img.mimeType.includes("png") ? "png" : img.mimeType.includes("webp") ? "webp" : "jpg";
      const path = `${user.id}/${(body.projectId || "misc").replace(/[^a-z0-9]/gi, "")}/ai-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("images").upload(path, img.data, { contentType: img.mimeType, upsert: false });
      if (error) throw new GenerationError(`이미지 저장 실패: ${error.message}`, 500);
      const { data } = supabase.storage.from("images").getPublicUrl(path);
      return { url: data.publicUrl };
    });
  });
}
