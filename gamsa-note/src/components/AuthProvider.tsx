"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type Profile = {
  id: string;
  kakao_name: string | null;
  nickname: string;
  avatar_url: string | null;
  is_admin: boolean;
};

type Ctx = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  user: null, profile: null, loading: true,
  refresh: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (u: User | null) => {
    setUser(u);
    if (!u) { setProfile(null); setLoading(false); return; }
    const { data } = await supabase().from("profiles").select("id,kakao_name,nickname,avatar_url,is_admin").eq("id", u.id).maybeSingle();
    setProfile(data as Profile | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") load(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => { await load(user); }, [load, user]);
  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    window.location.href = "/";
  }, []);

  return <AuthCtx.Provider value={{ user, profile, loading, refresh, signOut }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
