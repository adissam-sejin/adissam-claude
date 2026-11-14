import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { serverSecret } from "./auth";
import { GenerationError } from "./claude";

/** 생성 이용권: 크레딧을 한 번 차감한 뒤, 섹션 묶음별 병렬 생성 요청에 쓰는 서명 토큰 */
interface Payload {
  id: string;
  u: string; // user id
  exp: number; // ms
}

const sign = (body: string) => createHmac("sha256", serverSecret()).update(body).digest("base64url");

export function issueGenToken(userId: string, ttlMs = 20 * 60 * 1000): string {
  const body = Buffer.from(JSON.stringify({ id: randomUUID(), u: userId, exp: Date.now() + ttlMs } satisfies Payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyGenToken(token: string, userId: string): Payload {
  const [body, sig] = (token || "").split(".");
  if (!body || !sig) throw new GenerationError("생성 이용권이 없어요. 다시 시도해 주세요.", 403);
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new GenerationError("생성 이용권이 올바르지 않아요.", 403);
  const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
  if (p.u !== userId) throw new GenerationError("다른 계정의 이용권이에요.", 403);
  if (Date.now() > p.exp) throw new GenerationError("생성 이용권이 만료되었어요. 다시 생성해 주세요.", 403);
  return p;
}
