"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}

export const PHOTO_BUCKET = "photos";

/** photo_path 목록 → 서명 URL 맵 (1시간 유효) */
export async function signedUrls(paths: (string | null | undefined)[]) {
  const uniq = Array.from(new Set(paths.filter(Boolean) as string[]));
  const map: Record<string, string> = {};
  if (!uniq.length) return map;
  const { data } = await supabase().storage.from(PHOTO_BUCKET).createSignedUrls(uniq, 3600);
  data?.forEach((d) => {
    if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
  });
  return map;
}
