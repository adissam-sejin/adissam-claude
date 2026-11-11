// 온라인 전시관 Edge Function: 작품 업로드/삭제, 전시회 삭제
// 인증은 함수 내부에서 수강생 코드 또는 관리자 세션 토큰으로 직접 확인합니다.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const BUCKET = "artworks";
const MAX_IMAGE = 6 * 1024 * 1024;
const MAX_THUMB = 1024 * 1024;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const normCode = (v: unknown) => String(v ?? "").replace(/\s/g, "").toUpperCase();

async function isAdmin(token: unknown) {
  if (typeof token !== "string" || !/^[0-9a-f-]{36}$/i.test(token)) return false;
  const { data } = await db.from("admin_sessions").select("token")
    .eq("token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  return !!data;
}

async function findStudent(code: string) {
  if (!code) return null;
  const { data } = await db.from("student_codes")
    .select("id, student_name, exhibition_id, exhibitions(id, max_per_student)")
    .eq("code", code).maybeSingle();
  return data as any;
}

async function removeFiles(paths: string[]) {
  const list = paths.filter(Boolean);
  if (list.length) await db.storage.from(BUCKET).remove(list);
}

async function upload(form: FormData) {
  const student = await findStudent(normCode(form.get("code")));
  if (!student) return json({ error: "not_found" }, 403);
  const ex = student.exhibitions;
  const { data: state } = await db.rpc("_exhibition_state", { p_id: student.exhibition_id });
  if (!ex || state !== "active") return json({ error: "ended" }, 403);

  const { count } = await db.from("artworks").select("id", { count: "exact", head: true })
    .eq("student_code_id", student.id);
  if ((count ?? 0) >= ex.max_per_student) return json({ error: "limit", max: ex.max_per_student }, 400);

  const image = form.get("image");
  const thumb = form.get("thumb");
  if (!(image instanceof File) || !(thumb instanceof File)) return json({ error: "no_file" }, 400);
  if (image.type !== "image/jpeg" || thumb.type !== "image/jpeg") return json({ error: "bad_type" }, 400);
  if (image.size > MAX_IMAGE || thumb.size > MAX_THUMB) return json({ error: "too_large" }, 400);

  const id = crypto.randomUUID();
  const imagePath = `${ex.id}/${id}.jpg`;
  const thumbPath = `${ex.id}/${id}_t.jpg`;
  const opts = { contentType: "image/jpeg", cacheControl: "31536000" };
  const up1 = await db.storage.from(BUCKET).upload(imagePath, image, opts);
  if (up1.error) return json({ error: "storage", detail: up1.error.message }, 500);
  const up2 = await db.storage.from(BUCKET).upload(thumbPath, thumb, opts);
  if (up2.error) {
    await removeFiles([imagePath]);
    return json({ error: "storage", detail: up2.error.message }, 500);
  }

  const clampInt = (v: unknown) => Math.max(1, Math.min(10000, Math.round(Number(v) || 1)));
  const author = String(form.get("author") ?? "").trim().slice(0, 30) || student.student_name || "";
  const title = String(form.get("title") ?? "").trim().slice(0, 60);
  const { error } = await db.from("artworks").insert({
    id, exhibition_id: ex.id, student_code_id: student.id, title, author_name: author,
    image_path: imagePath, thumb_path: thumbPath,
    width: clampInt(form.get("w")), height: clampInt(form.get("h")),
  });
  if (error) {
    await removeFiles([imagePath, thumbPath]);
    return json({ error: "db", detail: error.message }, 500);
  }
  // 수강생 이름이 비어 있으면 처음 입력한 이름을 코드에 기록
  if (!student.student_name && author) {
    await db.from("student_codes").update({ student_name: author }).eq("id", student.id);
  }
  return json({ ok: true, id });
}

// 관리자: 전시회 포스터 이미지 등록
async function setPoster(form: FormData) {
  if (!(await isAdmin(form.get("token")))) return json({ error: "forbidden" }, 403);
  const id = String(form.get("exhibition_id") ?? "");
  const image = form.get("image");
  if (!(image instanceof File) || image.type !== "image/jpeg") return json({ error: "bad_type" }, 400);
  if (image.size > 2 * 1024 * 1024) return json({ error: "too_large" }, 400);
  const { data: ex } = await db.from("exhibitions").select("id, poster_path").eq("id", id).maybeSingle();
  if (!ex) return json({ error: "not_found" }, 404);
  const path = `posters/${id}-${crypto.randomUUID().slice(0, 8)}.jpg`;
  const up = await db.storage.from(BUCKET).upload(path, image, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (up.error) return json({ error: "storage", detail: up.error.message }, 500);
  const { error } = await db.from("exhibitions").update({ poster_path: path }).eq("id", id);
  if (error) {
    await removeFiles([path]);
    return json({ error: "db", detail: error.message }, 500);
  }
  if (ex.poster_path) await removeFiles([ex.poster_path]);
  return json({ ok: true, poster: path });
}

async function deleteArtwork(body: any) {
  const { data: art } = await db.from("artworks")
    .select("id, student_code_id, image_path, thumb_path").eq("id", String(body.artwork_id ?? "")).maybeSingle();
  if (!art) return json({ error: "not_found" }, 404);
  let allowed = await isAdmin(body.token);
  if (!allowed) {
    const student = await findStudent(normCode(body.code));
    allowed = !!student && student.id === art.student_code_id;
  }
  if (!allowed) return json({ error: "forbidden" }, 403);
  const { error } = await db.from("artworks").delete().eq("id", art.id);
  if (error) return json({ error: "db", detail: error.message }, 500);
  await removeFiles([art.image_path, art.thumb_path]);
  return json({ ok: true });
}

async function deleteExhibition(body: any) {
  if (!(await isAdmin(body.token))) return json({ error: "forbidden" }, 403);
  const id = String(body.exhibition_id ?? "");
  const { data: arts } = await db.from("artworks").select("image_path, thumb_path").eq("exhibition_id", id);
  const { data: exRow } = await db.from("exhibitions").select("poster_path").eq("id", id).maybeSingle();
  const { error } = await db.from("exhibitions").delete().eq("id", id);
  if (error) return json({ error: "db", detail: error.message }, 500);
  const paths = (arts ?? []).flatMap((a: any) => [a.image_path, a.thumb_path]);
  if (exRow?.poster_path) paths.push(exRow.poster_path);
  for (let i = 0; i < paths.length; i += 100) await removeFiles(paths.slice(i, i + 100));
  return json({ ok: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const type = req.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      return form.get("action") === "poster" ? await setPoster(form) : await upload(form);
    }
    const body = await req.json();
    if (body.action === "delete_artwork") return await deleteArtwork(body);
    if (body.action === "delete_exhibition") return await deleteExhibition(body);
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: "server", detail: String((e as Error)?.message ?? e) }, 500);
  }
});
