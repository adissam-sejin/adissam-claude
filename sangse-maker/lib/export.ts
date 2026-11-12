import { toCanvas } from "html-to-image";
import JSZip from "jszip";
import { BASE_WIDTH } from "./channels";

export type ExportFormat = "jpg" | "png";

/** 각 섹션을 채널 폭에 맞게 이미지로 굽고, 섹션별 조각 + 한 장짜리 전체 이미지를 zip 으로 만든다 */
export async function exportPage(opts: {
  root: HTMLElement;
  width: number;
  format: ExportFormat;
  fileBase: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<Blob> {
  const { root, width, format, fileBase, onProgress } = opts;
  const ratio = width / BASE_WIDTH;
  const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-export-section]"));
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const zip = new JSZip();
  const canvases: HTMLCanvasElement[] = [];

  root.classList.add("exporting");
  try {
    // 페이지 전체를 한 번에 그려야 테마 변수/스타일 템플릿이 그대로 유지된다
    onProgress?.(0, sections.length + 1);
    const full = await toCanvas(root, { pixelRatio: ratio, cacheBust: true, backgroundColor: getComputedStyle(root).backgroundColor });
    onProgress?.(1, sections.length + 1);

    // 섹션 경계에서 잘라 조각 이미지 만들기
    // offsetTop 은 CSS zoom 영향을 받지 않음 (.dp 가 position:relative 라서 기준이 루트)
    for (let i = 0; i < sections.length; i++) {
      const y = Math.round(sections[i].offsetTop * ratio);
      const h = Math.min(full.height - y, Math.round(sections[i].offsetHeight * ratio));
      if (h <= 0) continue;
      const c = document.createElement("canvas");
      c.width = full.width;
      c.height = h;
      c.getContext("2d")!.drawImage(full, 0, y, full.width, h, 0, 0, full.width, h);
      canvases.push(c);
      zip.file(`${fileBase}_${String(i + 1).padStart(2, "0")}.${format}`, await canvasToBlob(c, mime));
      onProgress?.(i + 2, sections.length + 1);
    }
    zip.file(`${fileBase}_전체.${format}`, await canvasToBlob(full, mime));
  } finally {
    root.classList.remove("exporting");
  }
  return zip.generateAsync({ type: "blob" });
}

function canvasToBlob(c: HTMLCanvasElement, mime: string): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))), mime, 0.92));
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
