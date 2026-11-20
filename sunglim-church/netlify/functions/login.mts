// /api/login (관리자), /api/offerings/login (헌금명단 열람)
// 비밀번호를 마구 시도하지 못하게 1분에 10번으로 제한합니다.
import type { Config } from "@netlify/functions";
import { handleLogin, handleOfferingLogin } from "../lib/app.mts";
import { netlifyEnv } from "../lib/netlify-env.mts";

export default async (req: Request) =>
  new URL(req.url).pathname === "/api/offerings/login" ? handleOfferingLogin(req, netlifyEnv()) : handleLogin(req, netlifyEnv());

export const config: Config = {
  path: ["/api/login", "/api/offerings/login"],
  method: "POST",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["ip", "domain"],
    windowSize: 60,
    windowLimit: 10,
  },
};
