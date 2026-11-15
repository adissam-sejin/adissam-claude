import { gridRects, PERSIMMON, treeGrid, TREE_W, TREE_H, type Grid } from "@/lib/pixel";

export function PixelArt({ rows, className, title }: { rows: string[] | Grid; className?: string; title?: string }) {
  const h = rows.length;
  const w = typeof rows[0] === "string" ? (rows[0] as string).length : (rows[0] as string[]).length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} shapeRendering="crispEdges" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {gridRects(rows).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </svg>
  );
}

export function Persimmon({ className = "w-6 h-6", title }: { className?: string; title?: string }) {
  return <PixelArt rows={PERSIMMON} className={className} title={title} />;
}

export function PixelTree({ count, seed = 1, className }: { count: number; seed?: number; className?: string }) {
  const { grid } = treeGrid(count, seed);
  return <PixelArt rows={grid} className={className} />;
}
export { TREE_W, TREE_H };
