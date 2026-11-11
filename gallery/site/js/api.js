import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 } },
});

export async function rpc(name, args = {}) {
  const { data, error } = await sb.rpc(name, args);
  if (error) throw new Error(error.message || 'request failed');
  return data;
}

export const imageUrl = (path) => `${SUPABASE_URL}/storage/v1/object/public/artworks/${path}`;

const FN_URL = `${SUPABASE_URL}/functions/v1/gallery`;
const fnHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// 작품 삭제/전시회 삭제 등 JSON 요청
export async function fn(body) {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: { ...fnHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ error: 'server' }));
}

// 작품 업로드 (multipart)
export async function fnUpload(form) {
  const res = await fetch(FN_URL, { method: 'POST', headers: fnHeaders, body: form });
  return res.json().catch(() => ({ error: 'server' }));
}
