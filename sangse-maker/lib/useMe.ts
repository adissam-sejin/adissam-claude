"use client";

import { useCallback, useEffect, useState } from "react";

export interface Me {
  user: { id: string; email: string } | null;
  credits?: number;
  features: { ai: boolean; image: boolean; payments: boolean };
}

type Listener = (m: Me) => void;
const listeners = new Set<Listener>();
let cache: Me | null = null;

/** 로그인 상태/크레딧을 앱 전체에서 공유 */
export function useMe() {
  const [me, setMe] = useState<Me | null>(cache);
  const refresh = useCallback(async () => {
    const res = await fetch("/api/me", { cache: "no-store" });
    const data = (await res.json()) as Me;
    cache = data;
    listeners.forEach((l) => l(data));
    return data;
  }, []);
  useEffect(() => {
    listeners.add(setMe);
    if (!cache) refresh();
    return () => {
      listeners.delete(setMe);
    };
  }, [refresh]);
  const setCredits = useCallback((credits: number) => {
    if (!cache) return;
    cache = { ...cache, credits };
    listeners.forEach((l) => l(cache!));
  }, []);
  return { me, refresh, setCredits };
}
