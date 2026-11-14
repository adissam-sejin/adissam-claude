import { NextResponse } from "next/server";
import { GenerationError } from "./claude";

export async function handle<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof GenerationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api error]", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 300) : String(err).slice(0, 300);
    return NextResponse.json({ error: `알 수 없는 오류가 발생했어요. (${detail})` }, { status: 500 });
  }
}

export const demoDelay = (ms = 900) => new Promise((r) => setTimeout(r, ms));
