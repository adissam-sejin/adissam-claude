import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "상세메이트 — AI 상세페이지 제작",
  description: "상품 사진과 장점만 넣으면 AI가 기획·카피·디자인까지 상세페이지를 만들어 드립니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
