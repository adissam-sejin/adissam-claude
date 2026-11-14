import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type * as z from "zod/v4";

export const MODEL = "claude-opus-5-5";

const hasAIKey = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

/**
 * 데모 모드: DEMO_MODE=1 이거나, 로컬 개발 중 키가 없을 때만.
 * 운영(production)에서는 키가 잠시 안 보여도 가짜 결과를 주지 않고 오류를 낸다.
 */
export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE === "1") return true;
  return process.env.NODE_ENV !== "production" && !hasAIKey();
}

/** 운영에서 AI 키가 없으면 (크레딧 차감 전에) 재시도 안내 오류 */
export function requireAI(): void {
  if (!isDemoMode() && !hasAIKey()) throw new GenerationError("AI 서버 연결이 잠시 불안정해요. 잠시 후 다시 시도해 주세요. (크레딧은 차감되지 않았어요)", 503);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic(); // ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL 을 환경에서 읽음
  return client;
}

/** data:image/jpeg;base64,... 형태의 이미지를 Claude 이미지 블록으로 변환 */
export function imageBlocks(dataUrls: string[]): BetaContentBlockParam[] {
  const blocks: BetaContentBlockParam[] = [];
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  dataUrls.slice(0, 10).forEach((url, i) => {
    const m = url.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
    if (m) {
      blocks.push({ type: "text", text: `[사진 ${i}]` });
      blocks.push({ type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg", data: m[2] } });
    } else if (base && url.startsWith(`${base}/storage/v1/object/public/images/`)) {
      blocks.push({ type: "text", text: `[사진 ${i}]` });
      blocks.push({ type: "image", source: { type: "url", url } });
    }
  });
  return blocks;
}

export class GenerationError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

/**
 * 구조화 출력(JSON 스키마)으로 Claude 를 호출하고 검증된 객체를 돌려준다.
 * 정책상 거절되면 서버 측 fallback 이 다른 모델로 재시도한다.
 */
export async function callStructured<S extends z.ZodType>(opts: {
  system: string;
  content: BetaContentBlockParam[];
  schema: S;
  effort: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  try {
    const stream = getClient().beta.messages.stream({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
      output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      throw new GenerationError("요청을 처리할 수 없는 내용이 포함되어 있어요. 입력을 확인해 주세요.", 422);
    }
    if (message.stop_reason === "max_tokens") {
      throw new GenerationError("결과가 너무 길어 중간에 끊겼어요. 섹션 수를 줄여 다시 시도해 주세요.", 500);
    }
    const parsed = message.parsed_output;
    if (!parsed) throw new GenerationError("AI 응답을 해석하지 못했어요. 다시 시도해 주세요.", 502);
    return parsed as z.infer<S>;
  } catch (err) {
    if (err instanceof GenerationError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new GenerationError("API 키가 올바르지 않아요. .env.local 의 ANTHROPIC_API_KEY 를 확인해 주세요.", 401);
    if (err instanceof Anthropic.RateLimitError) throw new GenerationError("요청이 많아 잠시 후 다시 시도해 주세요.", 429);
    if (err instanceof Anthropic.BadRequestError) throw new GenerationError(`요청 형식 오류: ${err.message}`, 400);
    if (err instanceof Anthropic.APIError) throw new GenerationError(`AI 서버 오류가 발생했어요. (${err.status ?? "network"})`, 502);
    throw err;
  }
}
