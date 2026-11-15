import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const TITLE = "감사노트 · 감 농장";
const DESC = "매일 감사한 한 가지를 원고지에 적고, 사진 한 장을 남겨요. 함께 감사하면 감나무에 주황빛 감이 주렁주렁 열려요.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: "%s · 감사노트" },
  description: DESC,
  applicationName: "감사노트",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "감사노트", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE,
    siteName: "감사노트",
    title: TITLE,
    description: DESC,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "감사노트 · 감 농장" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og-image.png"] },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#6eb6f0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body className="min-h-dvh antialiased"><div className="app-bg" aria-hidden />{children}</body>
    </html>
  );
}
