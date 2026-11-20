// Netlify 환경(저장소, 환경 변수)을 app.mts 가 쓰는 모양으로 연결합니다.
import { getStore } from "@netlify/blobs";
import type { Env, KV } from "./app.mts";

export function netlifyEnv(): Env {
  return {
    adminId: Netlify.env.get("ADMIN_ID") || "admin",
    adminPassword: Netlify.env.get("ADMIN_PASSWORD") || "",
    offeringPassword: Netlify.env.get("OFFERING_PASSWORD") || "",
  };
}

// 사이트 전체가 함께 쓰는 저장소. 저장 직후 바로 보이도록 strong 일관성을 씁니다.
export function netlifyKV(): KV {
  const store = getStore({ name: "sunglim", consistency: "strong" });
  return {
    getJSON: (key) => store.get(key, { type: "json" }),
    setJSON: async (key, value) => { await store.setJSON(key, value); },
    remove: (key) => store.delete(key),
    getBinary: async (key) => {
      const entry = await store.getWithMetadata(key, { type: "arrayBuffer" });
      if (entry === null) return null;
      return { data: entry.data, type: String(entry.metadata?.type || "image/png") };
    },
    setBinary: async (key, data, type) => { await store.set(key, data, { metadata: { type } }); },
  };
}
