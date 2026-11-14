"use client";

import type { Page, Plan, ProductInput } from "./schema";
import { supabaseBrowser } from "./supabase/client";

/** 프로젝트는 로그인한 사용자의 Supabase DB 에 저장 (RLS 로 본인 것만 접근) */
export interface Project {
  id: string;
  updatedAt: number;
  input: ProductInput;
  images: string[];
  plan: Plan | null;
  page: Page | null;
}

export interface ProjectSummary {
  id: string;
  title: string;
  thumbnail: string | null;
  updatedAt: number;
  status: "완성" | "기획 중" | "입력 중";
}

export async function saveProject(p: Project): Promise<void> {
  const sb = supabaseBrowser();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return;
  await sb.from("projects").upsert({
    id: p.id,
    user_id: auth.user.id,
    title: p.input.productName || "이름 없는 상품",
    thumbnail: p.images[0] ?? null,
    data: { input: p.input, images: p.images, plan: p.plan, page: p.page },
    updated_at: new Date().toISOString(),
  });
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const { data } = await supabaseBrowser().from("projects").select("id, data, updated_at").eq("id", id).maybeSingle();
  if (!data) return undefined;
  const d = data.data as Omit<Project, "id" | "updatedAt">;
  return { id: data.id, updatedAt: Date.parse(data.updated_at), input: d.input, images: d.images ?? [], plan: d.plan ?? null, page: d.page ?? null };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const { data } = await supabaseBrowser()
    .from("projects")
    .select("id, title, thumbnail, updated_at, data->page, data->plan")
    .order("updated_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    thumbnail: r.thumbnail as string | null,
    updatedAt: Date.parse(r.updated_at as string),
    status: r.page ? "완성" : r.plan ? "기획 중" : "입력 중",
  }));
}

export async function deleteProject(id: string): Promise<void> {
  await supabaseBrowser().from("projects").delete().eq("id", id);
}

/** 리사이즈한 사진(data URL)을 Storage 에 올리고 공개 URL 반환 */
export async function uploadImage(dataUrl: string, projectId: string): Promise<string> {
  const sb = supabaseBrowser();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("로그인이 필요해요.");
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${auth.user.id}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const { error } = await sb.storage.from("images").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error(`사진 업로드 실패: ${error.message}`);
  return sb.storage.from("images").getPublicUrl(path).data.publicUrl;
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
