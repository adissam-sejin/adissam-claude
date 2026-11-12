"use client";

import { DetailPage } from "./DetailPage";
import { demoPage } from "@/lib/demo";
import { emptyInput } from "@/lib/schema";
import { SAMPLE_SETS } from "@/lib/sample-images";
import type { Theme } from "@/lib/schema";

const THEMES: Theme[] = [
  { primary: "#2f6f5e", accent: "#e6f0ec", background: "#ffffff", style: "clean" },
  { primary: "#c9a86a", accent: "#2a2622", background: "#141210", style: "premium" },
  { primary: "#ff5a36", accent: "#fff1ec", background: "#fffaf6", style: "vivid" },
];

/** 랜딩 히어로의 스크롤 미리보기 (샘플 결과물 3종) */
export function Showcase() {
  return (
    <div className="showcase">
      {THEMES.map((theme, i) => {
        const page = { ...demoPage({ ...emptyInput, productName: "데일리 텀블러 500ml" }, 3), theme };
        return (
          <div key={i} className="phone">
            <div className="scaler">
              <DetailPage page={page} images={SAMPLE_SETS[i].images} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
