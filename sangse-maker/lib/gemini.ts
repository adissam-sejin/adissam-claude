import { GoogleGenAI } from "@google/genai";
import { GenerationError } from "./claude";

export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";

export const isImageEnabled = () => !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

/** 연출 컷 프리셋 — 상품 원본을 유지한 채 장면만 바꾼다 */
export const SCENE_PRESETS: Record<string, { label: string; prompt: string }> = {
  lifestyle: { label: "라이프스타일 사용 장면", prompt: "Place this exact product in a bright, natural lifestyle scene where it is being used in everyday life. Soft daylight, realistic home or cafe environment, shallow depth of field." },
  studio: { label: "스튜디오 배경", prompt: "Place this exact product on a clean seamless studio backdrop in a soft pastel color that complements the product. Professional e-commerce product photography, soft shadows, centered composition." },
  detail: { label: "디테일 클로즈업", prompt: "Create a macro close-up shot of this exact product highlighting its material, texture and finishing details. Professional product photography lighting." },
  outdoor: { label: "야외·자연광", prompt: "Place this exact product outdoors in a natural setting with warm golden-hour sunlight, lush but uncluttered background, lifestyle advertising photo." },
  premium: { label: "프리미엄 무드", prompt: "Place this exact product in a luxurious, dark premium setting with dramatic rim lighting, reflective surface, high-end advertising campaign look." },
  flatlay: { label: "플랫레이", prompt: "Create a top-down flat lay composition with this exact product at the center, surrounded by a few tasteful related props on a neutral textured surface." },
};

const RULES =
  "Keep the product itself identical to the reference photo: same shape, color, logo, label text and proportions. Do not add any new text, watermark or logos. Photorealistic, high quality, suitable for a Korean online shopping detail page.";

/** 상품 사진 + 장면 설명 → 연출 이미지 (PNG/JPEG bytes) */
export async function generateSceneImage(opts: {
  image: { data: string; mimeType: string };
  scene: string;
  custom?: string;
  aspectRatio: "1:1" | "4:5" | "3:4" | "16:9" | "4:3";
}): Promise<{ data: Buffer; mimeType: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });
  const preset = SCENE_PRESETS[opts.scene] ?? SCENE_PRESETS.studio;
  const text = [preset.prompt, opts.custom ? `Additional direction from the seller (may be Korean): ${opts.custom}` : "", RULES].filter(Boolean).join("\n");
  try {
    const interaction = await ai.interactions.create({
      model: IMAGE_MODEL,
      input: [
        { type: "text", text },
        { type: "image", mime_type: opts.image.mimeType, data: opts.image.data },
      ],
      response_format: { type: "image", aspect_ratio: opts.aspectRatio, image_size: "1K" },
      stream: false,
    } as Parameters<typeof ai.interactions.create>[0]);
    if (!("output_image" in interaction)) throw new GenerationError("이미지 응답 형식 오류", 502);
    const out = interaction.output_image;
    if (!out?.data) throw new GenerationError("이미지가 생성되지 않았어요. 다른 장면이나 사진으로 다시 시도해 주세요.", 502);
    return { data: Buffer.from(out.data, "base64"), mimeType: (out as { mime_type?: string }).mime_type || "image/png" };
  } catch (err) {
    if (err instanceof GenerationError) throw err;
    console.error("gemini error", err);
    throw new GenerationError(`이미지 생성 실패: ${(err as Error).message?.slice(0, 200)}`, 502);
  }
}
