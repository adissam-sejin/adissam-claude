// 서버 기능 시험: 로그인, 권한, 주보 저장/공개 — node --experimental-strip-types --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../netlify/lib/app.mts";
import type { KV } from "../netlify/lib/app.mts";

function memoryKV(): KV {
  const json = new Map<string, string>(), bin = new Map<string, { data: ArrayBuffer; type: string }>();
  return {
    getJSON: async (k) => (json.has(k) ? JSON.parse(json.get(k)!) : null),
    setJSON: async (k, v) => { json.set(k, JSON.stringify(v)); },
    remove: async (k) => { json.delete(k); bin.delete(k); },
    getBinary: async (k) => bin.get(k) || null,
    setBinary: async (k, data, type) => { bin.set(k, { data, type }); },
  };
}
const env = { adminId: "admin", adminPassword: "correct horse", offeringPassword: "1234 5678" };
const call = (kv: KV, method: string, path: string, body?: unknown, token?: string, e = env) =>
  handle(new Request("http://x/api" + path, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: token ? { authorization: "Bearer " + token } : {},
  }), kv, e);
const login = async (kv: KV) => (await (await call(kv, "POST", "/login", { id: "admin", password: "correct horse" })).json()).token as string;

test("로그인: 틀린 비밀번호는 거절, 맞으면 토큰", async () => {
  const kv = memoryKV();
  assert.equal((await call(kv, "POST", "/login", { id: "admin", password: "nope" })).status, 401);
  assert.equal((await call(kv, "POST", "/login", { id: "other", password: "correct horse" })).status, 401);
  assert.match(await login(kv), /^\d{13}\./);
});

test("비밀번호가 설정되지 않으면 아무도 로그인할 수 없다", async () => {
  const none = { adminId: "admin", adminPassword: "", offeringPassword: "" };
  assert.equal((await call(memoryKV(), "POST", "/login", { id: "admin", password: "" }, undefined, none)).status, 503);
});

test("쓰기는 로그인해야만 가능", async () => {
  const kv = memoryKV();
  const body = { issue: "제1호", published: true, content: { sermon: {} } };
  assert.equal((await call(kv, "PUT", "/bulletins/2026-11-22", body)).status, 401);
  assert.equal((await call(kv, "PUT", "/bulletins/2026-11-22", body, "9999999999999." + "a".repeat(43))).status, 401);
  assert.equal((await call(kv, "PUT", "/settings", {})).status, 401);
  assert.equal((await call(kv, "POST", "/roster", { rows: [] })).status, 401);
  assert.equal((await call(kv, "DELETE", "/bulletins/2026-11-22")).status, 401);
  const token = await login(kv);
  assert.equal((await call(kv, "PUT", "/bulletins/2026-11-22", body, token)).status, 200);
  assert.equal((await call(kv, "PUT", "/bulletins/2026-11-22", body, token + "x")).status, 401);
});

test("공개 전 주보는 방문자에게 보이지 않는다", async () => {
  const kv = memoryKV(), token = await login(kv);
  await call(kv, "PUT", "/bulletins/2026-11-22", { issue: "A", published: true, content: { n: 1 } }, token);
  await call(kv, "PUT", "/bulletins/2026-11-29", { issue: "B", published: false, content: { n: 2 } }, token);
  assert.deepEqual((await (await call(kv, "GET", "/bulletins")).json()).map((r: any) => r.date), ["2026-11-22"]);
  assert.deepEqual((await (await call(kv, "GET", "/bulletins", undefined, token)).json()).map((r: any) => r.date), ["2026-11-29", "2026-11-22"]);
  assert.equal(await (await call(kv, "GET", "/bulletins/2026-11-29")).json(), null);
  const view = await (await call(kv, "GET", "/view")).json();
  assert.equal(view.bulletin.date, "2026-11-22");
  assert.equal(view.list.length, 1);
  assert.equal((await (await call(kv, "GET", "/view?d=2026-11-29")).json()).bulletin, null);
});

test("명단: 저장·삭제하고, 주보와 함께 8주치가 내려온다", async () => {
  const kv = memoryKV(), token = await login(kv);
  await call(kv, "PUT", "/bulletins/2026-11-22", { published: true, content: {} }, token);
  await call(kv, "POST", "/roster", { rows: [{ date: "2026-11-22", prayer1: "가" }, { date: "2026-11-29", prayer1: "나" }, { date: "2027-03-07", prayer1: "다" }, { date: "bad" }] }, token);
  const view = await (await call(kv, "GET", "/view")).json();
  assert.deepEqual(view.roster.map((r: any) => r.prayer1), ["가", "나"]);
  await call(kv, "POST", "/roster", { rows: [], deleted: ["2026-11-29"] }, token);
  assert.equal((await (await call(kv, "GET", "/roster")).json()).length, 2);
});

test("헌금 명단은 주보에 섞여 나가지 않고, 열람 비밀번호가 있어야만 보인다", async () => {
  const kv = memoryKV(), token = await login(kv);
  const offerings = [{ category: "십일조", names: "홍길동 김철수" }];
  await call(kv, "PUT", "/bulletins/2026-11-22", { published: true, content: { n: 1 }, offerings }, token);
  // 예전 방식(주보 내용 안에 명단)으로 저장해도 따로 떼어 보관
  await call(kv, "PUT", "/bulletins/2026-11-29", { published: false, content: { n: 2, offerings: [{ category: "감사", names: "이영희" }] } }, token);

  for (const path of ["/view", "/bulletins/latest", "/bulletins/2026-11-22", "/bulletins"]) {
    const text = await (await call(kv, "GET", path)).text();
    assert.ok(!text.includes("홍길동") && !text.includes("이영희"), path + " 에 명단이 새어 나감");
  }
  assert.equal((await call(kv, "GET", "/offerings")).status, 401);
  assert.equal((await call(kv, "POST", "/offerings/login", { password: "0000" })).status, 401);
  const viewer = (await (await call(kv, "POST", "/offerings/login", { password: "1234 5678" })).json()).token;
  const seen = await (await call(kv, "GET", "/offerings", undefined, viewer)).json();
  assert.deepEqual(seen.offerings, offerings);
  assert.equal(seen.date, "2026-11-22");
  // 공개 전 주보의 명단은 열람자에게도 보이지 않음
  assert.equal((await (await call(kv, "GET", "/offerings?d=2026-11-29", undefined, viewer)).json()).date, null);
  // 열람 토큰으로는 고칠 수 없고, 관리자 토큰은 명단을 함께 받는다
  assert.equal((await call(kv, "PUT", "/settings", {}, viewer)).status, 401);
  assert.deepEqual((await (await call(kv, "GET", "/bulletins/2026-11-29", undefined, token)).json()).offerings, [{ category: "감사", names: "이영희" }]);
});

test("생일 명단 전체는 관리자만 볼 수 있다", async () => {
  const kv = memoryKV(), token = await login(kv);
  assert.equal((await call(kv, "GET", "/birthdays")).status, 401);
  assert.equal((await call(kv, "PUT", "/birthdays", [])).status, 401);
  await call(kv, "PUT", "/birthdays", [{ name: "나", month: 12, day: 6, lunar: true }, { name: "가", month: 3, day: 1 }, { name: "", month: 1, day: 1 }, { name: "잘못", month: 13, day: 1 }], token);
  assert.deepEqual(await (await call(kv, "GET", "/birthdays", undefined, token)).json(), [{ name: "가", month: 3, day: 1, lunar: false }, { name: "나", month: 12, day: 6, lunar: true }]);
  const viewer = (await (await call(kv, "POST", "/offerings/login", { password: "1234 5678" })).json()).token;
  assert.equal((await call(kv, "GET", "/birthdays", undefined, viewer)).status, 401);
});

test("교회 일정: 누구나 보고 관리자만 고친다. 주보와 함께 앞으로의 일정이 내려온다", async () => {
  const kv = memoryKV(), token = await login(kv);
  const events = [
    { id: "b", date: "2026-12-13", title: "김장", series: "" },
    { id: "a", date: "2026-11-29", title: "성림 에하드", time: "오후 2시" },
    { id: "c", date: "2026-08-01", endDate: "2026-08-03", title: "여름 수련회" },
    { id: "d", date: "2027-06-01", title: "먼 훗날" },
    { id: "a", date: "2026-11-30", title: "같은 id 는 한 번만" },
    { id: "x", date: "bad", title: "날짜 오류" },
  ];
  assert.equal((await call(kv, "PUT", "/events", events)).status, 401);
  assert.equal((await call(kv, "PUT", "/events", events, token)).status, 200);
  const all = await (await call(kv, "GET", "/events")).json();
  assert.deepEqual(all.map((e: any) => e.id), ["c", "a", "b", "d"]);
  assert.equal(all[0].endDate, "2026-08-03");
  await call(kv, "PUT", "/bulletins/2026-11-22", { published: true, content: {} }, token);
  const view = await (await call(kv, "GET", "/view")).json();
  assert.deepEqual(view.events.map((e: any) => e.title), ["성림 에하드", "김장"]);
});
