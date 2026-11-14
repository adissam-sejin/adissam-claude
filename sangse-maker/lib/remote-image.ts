import { GenerationError } from "./claude";

/** 우리 Supabase Storage 의 이미지 URL 인지 확인 (임의 URL 요청 방지) */
export function isOurImageUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!base && url.startsWith(`${base}/storage/v1/object/public/images/`);
}

export async function fetchImageBase64(url: string): Promise<{ data: string; mimeType: string }> {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!m) throw new GenerationError("이미지 형식 오류", 400);
    return { mimeType: m[1], data: m[2] };
  }
  if (!isOurImageUrl(url)) throw new GenerationError("허용되지 않은 이미지 주소예요.", 400);
  const res = await fetch(url);
  if (!res.ok) throw new GenerationError("이미지를 불러오지 못했어요.", 400);
  const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  return { mimeType, data: Buffer.from(await res.arrayBuffer()).toString("base64") };
}
