// /api/* — 주보·명단·설정·이미지 읽기와 쓰기 (로그인은 login.mts)
import type { Config } from "@netlify/functions";
import { handle } from "../lib/app.mts";
import { netlifyEnv, netlifyKV } from "../lib/netlify-env.mts";

export default async (req: Request) => handle(req, netlifyKV(), netlifyEnv());

export const config: Config = {
  path: "/api/*",
  excludedPath: ["/api/login", "/api/offerings/login"],
};
