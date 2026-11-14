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

function client() {
  const baseUrl = process.env.GOOGLE_GEMINI_BASE_URL; // Netlify AI Gateway 등 프록시 사용 시
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  });
}

type Out = { data: Buffer; mimeType: string };

/** 신규 Interactions API */
async function viaInteractions(ai: GoogleGenAI, text: string, image: { data: string; mimeType: string }, ratio: string): Promise<Out | null> {
  const interaction = await ai.interactions.create({
    model: IMAGE_MODEL,
    input: [
      { type: "text", text },
      { type: "image", mime_type: image.mimeType, data: image.data },
    ],
    response_format: { type: "image", aspect_ratio: ratio, image_size: "1K" },
    stream: false,
  } as Parameters<typeof ai.interactions.create>[0]);
  if (!("output_image" in interaction) || !interaction.output_image?.data) return null;
  const out = interaction.output_image;
  return { data: Buffer.from(out.data!, "base64"), mimeType: (out as { mime_type?: string }).mime_type || "image/png" };
}

/** 기존 generateContent API (게이트웨이가 Interactions 를 지원하지 않을 때 대비) */
async function viaGenerateContent(ai: GoogleGenAI, text: string, image: { data: string; mimeType: string }, ratio: string): Promise<Out | null> {
  const res = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [{ role: "user", parts: [{ text }, { inlineData: { mimeType: image.mimeType, data: image.data } }] }],
    config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ratio } },
  });
  for (const part of res.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) return { data: Buffer.from(part.inlineData.data, "base64"), mimeType: part.inlineData.mimeType || "image/png" };
  }
  return null;
}

/** 상품 사진 + 장면 설명 → 연출 이미지 */
export async function generateSceneImage(opts: {
  image: { data: string; mimeType: string };
  scene: string;
  custom?: string;
  aspectRatio: "1:1" | "4:5" | "3:4" | "16:9" | "4:3";
}): Promise<Out> {
  const ai = client();
  const preset = SCENE_PRESETS[opts.scene] ?? SCENE_PRESETS.studio;
  const text = [preset.prompt, opts.custom ? `Additional direction from the seller (may be Korean): ${opts.custom}` : "", RULES].filter(Boolean).join("\n");
  const errors: string[] = [];
  for (const fn of [viaInteractions, viaGenerateContent]) {
    try {
      const out = await fn(ai, text, opts.image, opts.aspectRatio);
      if (out) return out;
      errors.push(`${fn.name}: no image`);
    } catch (err) {
      console.error(`gemini ${fn.name} error`, err);
      errors.push(`${fn.name}: ${(err as Error).message?.slice(0, 150)}`);
    }
  }
  throw new GenerationError(`이미지 생성에 실패했어요. 다른 장면이나 사진으로 다시 시도해 주세요. (${errors.join(" / ").slice(0, 300)})`, 502);
}
