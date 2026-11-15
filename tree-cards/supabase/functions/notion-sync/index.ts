// 메시지 나무 → 노션 복사 (Supabase Edge Function)
// Supabase 에 쌓인 나무·카드를 노션 DB 로 옮겨 적는다. 10초마다 DB 가 깨운다.
//
// 시크릿: NOTION_TOKEN (노션 통합 시크릿)
// 선택:   NOTION_TREES_DB, NOTION_CARDS_DB, NOTION_API_BASE

const NOTION = Deno.env.get("NOTION_API_BASE") ?? "https://api.notion.com/v1";
const TREES_DB = Deno.env.get("NOTION_TREES_DB") ?? "419039e8f1838122ae9dfa2d77a471fc";
const CARDS_DB = Deno.env.get("NOTION_CARDS_DB") ?? "419039e8f18381b6a512ffe61a7a1f7f";
const THEME_LABEL: Record<string, string> = {
  christmas: "크리스마스 트리", persimmon: "감사 감나무", cherry: "벚꽃나무",
};
const BUDGET_MS = 25_000; // 한 번 깨어났을 때 일하는 시간
const GAP_MS = 340;       // 노션은 초당 3건 정도만 받는다

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const text = (s: string) => [{ text: { content: s } }];

async function notion(path: string, method: string, body?: unknown) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(NOTION + path, {
      method,
      headers: {
        Authorization: "Bearer " + Deno.env.get("NOTION_TOKEN"),
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 && attempt < 4) {
      await sleep(Math.min(Number(res.headers.get("retry-after")) || 1, 5) * 1000);
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Notion ${res.status} ${data.code ?? ""} ${data.message ?? ""}`);
    await sleep(GAP_MS);
    return data;
  }
}

async function rpc(fn: string, args: Record<string, unknown> = {}) {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: "Bearer " + key },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

// deno-lint-ignore no-explicit-any
function treeProps(t: any) {
  return {
    "나무 이름": { title: text(t.name) },
    "코드": { rich_text: text(t.code) },
    "콘셉트": { select: { name: THEME_LABEL[t.theme] } },
    "작성 시작": { date: t.start_at ? { start: t.start_at } : null },
    "작성 종료": { date: t.end_at ? { start: t.end_at } : null },
  };
}

async function run() {
  const done = { trees: 0, cards: 0, archived: 0 };
  const deadline = Date.now() + BUDGET_MS;
  while (Date.now() < deadline) {
    const p = await rpc("mt_sync_pending");
    const total = p.trees_upsert.length + p.cards_create.length + p.cards_archive.length + p.trees_archive.length;
    if (!total) break;

    for (const t of p.trees_upsert) {
      if (Date.now() > deadline) return done;
      const page = t.notion_page_id
        ? await notion(`/pages/${t.notion_page_id}`, "PATCH", { properties: treeProps(t) })
        : await notion("/pages", "POST", { parent: { database_id: TREES_DB }, properties: treeProps(t) });
      await rpc("mt_sync_tree_done", { p_id: t.id, p_page_id: page.id });
      done.trees++;
    }
    for (const c of p.cards_create) {
      if (Date.now() > deadline) return done;
      const page = await notion("/pages", "POST", {
        parent: { database_id: CARDS_DB },
        properties: {
          "이름": { title: text(c.author) },
          "내용": { rich_text: text(c.body) },
          "나무": { relation: [{ id: c.tree_page_id }] },
        },
      });
      await rpc("mt_sync_card_done", { p_id: c.id, p_page_id: page.id });
      done.cards++;
    }
    for (const c of p.cards_archive) {
      if (Date.now() > deadline) return done;
      await notion(`/pages/${c.notion_page_id}`, "PATCH", { archived: true });
      await rpc("mt_sync_card_purged", { p_id: c.id });
      done.archived++;
    }
    for (const t of p.trees_archive) {
      if (Date.now() > deadline) return done;
      await notion(`/pages/${t.notion_page_id}`, "PATCH", { archived: true });
      await rpc("mt_sync_tree_purged", { p_id: t.id });
      done.archived++;
    }
  }
  return done;
}

Deno.serve(async (req) => {
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

  // 호출 암호는 DB 가 만들어 보관하고, 여기서는 DB 에 맞는지 물어본다
  const secret = req.headers.get("x-sync-secret") ?? "";
  if (secret.length < 20) return json({ error: "forbidden" }, 401);
  if (!Deno.env.get("NOTION_TOKEN")) return json({ skipped: "NOTION_TOKEN 이 아직 없습니다" });
  if (!(await rpc("mt_sync_begin", { p_secret: secret }))) return json({ skipped: "암호가 다르거나 이미 실행 중" });
  try {
    return json({ ok: true, ...(await run()) });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: String(e) }, 500);
  } finally {
    await rpc("mt_sync_end");
  }
});
