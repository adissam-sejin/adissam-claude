// 핵심 규칙 검사 (로컬 Supabase 대상). 실행: node scripts/check-rules.mjs
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.SUPABASE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
const results = []
const ok = (name, cond, extra = '') => { results.push([cond ? '통과' : '실패', name, extra]); if (!cond) process.exitCode = 1 }
const client = () => createClient(URL, KEY, { auth: { persistSession: false } })
const stamp = Date.now()

async function signup(tag) {
  const c = client()
  const { data, error } = await c.auth.signUp({ email: `${tag}-${stamp}@test.local`, password: 'test-pass-1234' })
  if (error) throw error
  return { c, id: data.user.id }
}
const errOf = async (p) => (await p).error?.message ?? null

const a = await signup('a'), b = await signup('b'), adm = await signup('adm'), anon = client()

// 가입
ok('초대 코드가 틀리면 가입 불가', (await errOf(a.c.rpc('join_town', { p_code: 'WRONG', p_nickname: '가', p_brand_name: '', p_brand_color: '#B5403A' }))) === 'BAD_CODE')
ok('가입 전에는 다른 회원 정보를 볼 수 없다', ((await a.c.from('profiles').select('id')).data ?? []).length === 0)
ok('가입(회원 A)', !(await errOf(a.c.rpc('join_town', { p_code: 'nfb2026', p_nickname: '회원A', p_brand_name: '에이 공방', p_brand_color: '#2F6F8F', p_channel_type: 'blog', p_channel_name: '블로그', p_channel_url: 'https://blog.naver.com/a' }))))
ok('가입(회원 B)', !(await errOf(b.c.rpc('join_town', { p_code: 'NFB2026', p_nickname: '회원B', p_brand_name: '비 서재', p_brand_color: '#B5403A', p_channel_type: 'instagram' }))))
ok('가입(관리자)', !(await errOf(adm.c.rpc('join_town', { p_code: 'ADMIN-LOCAL', p_nickname: '아디쌤', p_brand_name: '아는디자이너', p_brand_color: '#14907F' }))))
ok('두 번 가입 불가', (await errOf(a.c.rpc('join_town', { p_code: 'NFB2026', p_nickname: 'x', p_brand_name: '', p_brand_color: '#B5403A' }))) === 'ALREADY_JOINED')

const bA = (await a.c.rpc('get_building', { p_user_id: a.id })).data
const blog = bA.floors.find(f => f.kind === 'sns')
ok('건물에 로비·강의실·서재·채널층·옥상이 생긴다', bA.floors.map(f => f.kind).join() === 'lobby,classroom,library,sns,rooftop')
let today = (await a.c.rpc('get_today')).data
ok('환영 별 5개', today.balance === 5)

// 기록 → 별 → 도장
const rec = (p) => a.c.rpc('add_record', { p_floor_id: blog.id, ...p })
let r1 = await rec({ p_input_type: 'url', p_url: 'https://blog.naver.com/a/1', p_note: '첫 글' })
ok('기록 1건: 별 1개', r1.data?.stars === 1 && r1.data?.week_count === 1 && !r1.data?.stamped)
ok('같은 주소는 다시 못 올린다', (await errOf(rec({ p_input_type: 'url', p_url: 'https://blog.naver.com/a/1' }))) === 'DUPLICATE_URL')
ok('주소 형식이 아니면 거절', (await errOf(rec({ p_input_type: 'url', p_url: '그냥글자' }))) === 'BAD_URL')
let r2 = await rec({ p_input_type: 'check', p_note: '했어요' })
ok('같은 층 같은 날 두 번째 기록: 집계는 되지만 별은 없다(하루 상한)', r2.data?.stars === 0 && r2.data?.week_count === 2)
let r3 = await rec({ p_input_type: 'photo', p_photo_path: `${a.id}/x.jpg` })
ok('세 가지 방식 모두 1건으로 집계, 3건째에 도장 + 별 5개', r3.data?.week_count === 3 && r3.data?.stamped && r3.data?.bonus === 5)
let r4 = await rec({ p_input_type: 'check' })
ok('도장은 한 주에 한 번만', r4.data?.stamped === false && r4.data?.bonus === 0)
today = (await a.c.rpc('get_today')).data
ok('잔액 = 5 + 1 + 5 = 11', today.balance === 11, `잔액 ${today.balance}`)

// 되돌리기
await a.c.rpc('undo_record', { p_record_id: r4.data.record_id })
await a.c.rpc('undo_record', { p_record_id: r3.data.record_id })
today = (await a.c.rpc('get_today')).data
ok('기록을 되돌려 목표 아래로 내려가면 도장과 별도 되돌아간다', today.balance === 6 && today.stamp_weeks.length === 0, `잔액 ${today.balance}`)
ok('남의 기록은 되돌릴 수 없다', (await errOf(b.c.rpc('undo_record', { p_record_id: r1.data.record_id }))) === 'NOT_YOURS')
ok('남의 층에 기록할 수 없다', (await errOf(b.c.rpc('add_record', { p_floor_id: blog.id, p_input_type: 'check' }))) === 'NOT_YOURS')

// 직접 고치기 차단
ok('별 원장을 직접 넣을 수 없다', !!(await errOf(a.c.from('star_ledger').insert({ user_id: a.id, amount: 999, reason: 'x', ref: 'x' }))))
ok('내 역할을 관리자로 바꿀 수 없다', !!(await errOf(a.c.from('profiles').update({ role: 'admin' }).eq('id', a.id))))
ok('남의 별 원장은 보이지 않는다', ((await b.c.from('star_ledger').select('id').eq('user_id', a.id)).data ?? []).length === 0)
ok('브랜드 색은 본인이 바꿀 수 있다', !(await errOf(a.c.from('profiles').update({ brand_color: '#6B4FA0' }).eq('id', a.id))))
ok('남의 프로필은 못 바꾼다', ((await b.c.from('profiles').update({ nickname: '해킹' }).eq('id', a.id).select()).data ?? []).length === 0)

// 가게 · 배치
const items = (await a.c.from('items').select('*')).data
const pot = items.find(i => i.name === '작은 화분'), piano = items.find(i => i.name === '피아노')
const frame = items.find(i => i.name === '액자'), medal = items.find(i => i.name === '수료 메달')
const buy = await a.c.rpc('buy_item', { p_item_id: pot.id })
ok('별 3개로 화분 사기', buy.data?.balance === 3)
ok('별이 모자라면 못 산다', (await errOf(a.c.rpc('buy_item', { p_item_id: piano.id }))) === 'NOT_ENOUGH_STARS')
ok('얻는 물건(수료 메달)은 살 수 없다', (await errOf(a.c.rpc('buy_item', { p_item_id: medal.id }))) === 'NOT_FOR_SALE')
ok('바닥 물건은 벽 자리에 못 놓는다', (await errOf(a.c.rpc('place_item', { p_inventory_id: buy.data.inventory_id, p_floor_id: blog.id, p_slot_key: 'w1' }))) === 'WRONG_SLOT')
ok('바닥 자리에 놓기', !(await errOf(a.c.rpc('place_item', { p_inventory_id: buy.data.inventory_id, p_floor_id: blog.id, p_slot_key: 'f2' }))))
ok('남의 물건은 못 놓는다', (await errOf(b.c.rpc('place_item', { p_inventory_id: buy.data.inventory_id, p_floor_id: blog.id, p_slot_key: 'f3' }))) === 'NOT_YOURS')
let again = (await a.c.rpc('get_building', { p_user_id: a.id })).data
ok('놓은 물건이 다시 불러와도 남아 있다', again.floors.find(f => f.id === blog.id).placements[0]?.slot_key === 'f2')
await a.c.rpc('unplace_item', { p_inventory_id: buy.data.inventory_id })
ok('치운 물건은 보관함에 남는다', ((await a.c.from('inventory').select('id').eq('user_id', a.id)).data ?? []).length === 1)

// 응원
const ch1 = await b.c.rpc('cheer', { p_to_user: a.id })
const ch2 = await b.c.rpc('cheer', { p_to_user: a.id })
ok('응원: 첫 번째는 전달 + 별 1개', ch1.data?.sent === true && ch1.data?.stars === 1)
ok('같은 사람에게 하루 여러 번 눌러도 한 번', ch2.data?.sent === false && ch2.data?.stars === 0)
ok('자기 자신은 응원 불가', (await errOf(a.c.rpc('cheer', { p_to_user: a.id }))) === 'SELF')

// 강의실: 도장은 듣는 강의·무료특강만, 수료는 관리자 확인
const courses = (await a.c.from('courses').select('*')).data
const paid = courses.find(c => c.kind === 'course'), free = courses.find(c => c.kind === 'free')
ok('듣지 않는 강의에는 도장 불가', (await errOf(a.c.rpc('stamp_lecture', { p_course_id: paid.id, p_session_no: 1 }))) === 'NOT_ENROLLED')
await a.c.rpc('set_enrollment', { p_course_id: paid.id, p_on: true })
const st = await a.c.rpc('stamp_lecture', { p_course_id: paid.id, p_session_no: 1, p_note: '배운 점' })
ok('듣는 강의 도장 + 별 2개', st.data?.stars === 2)
ok('같은 회차 두 번 도장 불가', (await errOf(a.c.rpc('stamp_lecture', { p_course_id: paid.id, p_session_no: 1 }))) === 'ALREADY_STAMPED')
ok('무료특강 도장', !(await errOf(a.c.rpc('stamp_lecture', { p_course_id: free.id }))))
await a.c.rpc('request_completion', { p_course_id: paid.id, p_completed_on: '2025-05-01' })
again = (await a.c.rpc('get_building', { p_user_id: a.id })).data
ok('수료 신청은 확인 전까지 "확인 중"', again.completions[0]?.status === 'requested')
const reqId = again.completions[0].id
ok('일반 회원은 수료를 승인할 수 없다', (await errOf(a.c.rpc('admin_decide_completion', { p_id: reqId, p_approve: true }))) === 'NOT_ADMIN')
ok('관리자가 수료 승인', !(await errOf(adm.c.rpc('admin_decide_completion', { p_id: reqId, p_approve: true }))))
again = (await a.c.rpc('get_building', { p_user_id: a.id })).data
const inv = (await a.c.from('inventory').select('id, source, items(name)').eq('user_id', a.id)).data
ok('승인되면 수료 아이템이 생기고 예전 날짜가 남는다', again.completions[0]?.status === 'approved' && again.completions[0]?.completed_on === '2025-05-01' && inv.some(v => v.items.name === '수료 메달'))
ok('한꺼번에 수료 처리(소급)', (await adm.c.rpc('admin_grant_completions', { p_course_id: paid.id, p_user_ids: [b.id], p_completed_on: '2024-11-11' })).data === 1)

// 서재 · 취향 · 소식
const book = (await a.c.from('books').select('*')).data[0]
ok('북클럽 기록 + 별 3개', (await a.c.rpc('add_reading', { p_book_id: book.id, p_note: '좋았다', p_attended: true })).data?.stars === 3)
ok('취향 넣기(별 없이)', !(await errOf(a.c.rpc('add_taste', { p_kind: 'pick', p_shape: 'object', p_label: '고양이', p_emoji: '🐈' }))))
const nw = await a.c.rpc('post_news', { p_kind: 'first_lecture', p_note: '처음으로 강의를 했어요!', p_consent: false })
ok('좋은 소식 알리기', !!nw.data?.news_id)
ok('동의하지 않은 소식은 소개할 수 없다', (await errOf(adm.c.rpc('admin_feature_news', { p_id: nw.data.news_id, p_on: true }))) === 'NO_CONSENT')
await a.c.rpc('update_news', { p_id: nw.data.news_id, p_consent: true, p_name_display: 'nick', p_hidden: false })
ok('동의하면 소개 가능', !(await errOf(adm.c.rpc('admin_feature_news', { p_id: nw.data.news_id, p_on: true }))))

// 마을 · 공개 건물
const town = (await b.c.rpc('get_town')).data
ok('마을 지도에 세 건물, 현수막 보임', town.buildings.length >= 3 && town.buildings.some(x => x.banner))
const key = (await a.c.from('profiles').select('public_key').eq('id', a.id).single()).data.public_key
ok('비공개 건물은 로그인 없이 열리지 않는다', (await anon.rpc('get_public_building', { p_key: key })).data === null)
await a.c.from('profiles').update({ is_public: true }).eq('id', a.id)
const pub = (await anon.rpc('get_public_building', { p_key: key })).data
ok('공개하면 로그인 없이 열린다', pub?.profile?.nickname === '회원A')
ok('공개 건물에 공개키·동의 정보가 노출되지 않는다', pub.profile.public_key === null && pub.news[0].consent === null)
ok('로그인 없이는 표를 읽을 수 없다', ((await anon.from('profiles').select('id')).data ?? []).length === 0)
ok('로그인 없이는 회원 동작을 부를 수 없다', !!(await errOf(anon.rpc('get_town'))))
ok('월요일 요약은 관리자만', (await errOf(a.c.rpc('admin_summary'))) === 'NOT_ADMIN' && !!(await adm.c.rpc('admin_summary')).data)

for (const [s, n, e] of results) console.log(`${s}  ${n}${e ? '  (' + e + ')' : ''}`)
console.log(`\n${results.filter(r => r[0] === '통과').length} / ${results.length} 통과`)
