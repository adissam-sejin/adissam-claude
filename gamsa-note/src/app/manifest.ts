import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "감사노트 · 감 농장",
    short_name: "감사노트",
    description: "매일 감사 한 줄과 사진 한 장, 함께 키우는 감나무",
    start_url: "/calendar",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff8ee",
    theme_color: "#ff7a1a",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
