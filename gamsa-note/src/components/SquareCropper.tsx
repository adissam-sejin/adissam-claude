"use client";
import { useEffect, useRef, useState } from "react";

const OUT = 1080;

type Props = {
  file: File;
  onCancel: () => void;
  onDone: (blob: Blob, previewUrl: string) => void;
};

/** 사진을 드래그/확대해서 정사각형으로 자르기 */
export default function SquareCropper({ file, onCancel, onDone }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 }); // 중심 기준 이동(박스 비율 단위)
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => setImg(im);
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // 박스(1x1) 안에서 이미지가 덮는 크기
  const dims = () => {
    if (!img) return { w: 1, h: 1 };
    const r = img.naturalWidth / img.naturalHeight;
    const base = r >= 1 ? { w: r, h: 1 } : { w: 1, h: 1 / r };
    return { w: base.w * zoom, h: base.h * zoom };
  };
  const clamp = (o: { x: number; y: number }, z = zoom) => {
    if (!img) return o;
    const r = img.naturalWidth / img.naturalHeight;
    const w = (r >= 1 ? r : 1) * z, h = (r >= 1 ? 1 : 1 / r) * z;
    const mx = (w - 1) / 2, my = (h - 1) / 2;
    return { x: Math.max(-mx, Math.min(mx, o.x)), y: Math.max(-my, Math.min(my, o.y)) };
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !box.current) return;
    const s = box.current.clientWidth;
    setOff(clamp({ x: drag.current.ox + (e.clientX - drag.current.x) / s, y: drag.current.oy + (e.clientY - drag.current.y) / s }));
  };
  const onUp = () => { drag.current = null; };

  const done = () => {
    if (!img) return;
    const { w, h } = dims();
    // 박스 좌상단이 이미지 상에서 어디인지 (이미지 좌표 비율)
    const left = (w - 1) / 2 - off.x;
    const top = (h - 1) / 2 - off.y;
    const scale = img.naturalWidth / w; // 박스단위 → 원본 픽셀
    const c = document.createElement("canvas");
    c.width = OUT; c.height = OUT;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, left * scale, top * scale, scale, scale, 0, 0, OUT, OUT);
    c.toBlob((b) => { if (b) onDone(b, c.toDataURL("image/jpeg", 0.8)); }, "image/jpeg", 0.86);
  };

  const { w, h } = dims();

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-4 bg-cream">
        <p className="font-display font-bold mb-3">사진 자리 잡기</p>
        <div
          ref={box}
          className="relative w-full aspect-square overflow-hidden bg-ink/10 touch-none select-none rounded-full shadow-sm"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        >
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img.src} alt="" draggable={false}
              className="absolute max-w-none pointer-events-none"
              style={{
                width: `${w * 100}%`, height: `${h * 100}%`,
                left: `${(0.5 - w / 2 + off.x) * 100}%`, top: `${(0.5 - h / 2 + off.y) * 100}%`,
              }}
            />
          )}
          <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, i) => <div key={i} className="border border-white/30" />)}
          </div>
        </div>
        <label className="flex items-center gap-3 mt-3 text-sm">
          <span className="font-display">확대</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={(e) => { const z = Number(e.target.value); setZoom(z); setOff((o) => clamp(o, z)); }}
            className="flex-1 accent-[#f28c28]" />
        </label>
        <p className="text-xs text-ink/60 mt-1">드래그해서 위치를 옮길 수 있어요.</p>
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="btn3d flex-1 py-2 btn-white">취소</button>
          <button onClick={done} disabled={!img} className="btn3d flex-1 py-2 btn-gam">이 사진으로</button>
        </div>
      </div>
    </div>
  );
}
