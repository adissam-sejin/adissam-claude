import { useState } from 'react'
import { supabase, devLogin } from '../lib/supabase'
import { useApp } from '../ctx'
import { BuildingView } from '../components/Building'
import type { Building } from '../lib/types'

// 시작 화면에 보여주는 예시 건물 (실제 회원 자료가 아니다)
const item = (id: string, name: string, slot: 'floor' | 'wall', size: number) =>
  ({ id, name, emoji: null, image_url: `/art/items/${id}.webp`, slot, size })
const SAMPLE: Building = {
  profile: { id: 'sample', nickname: '', brand_name: '나의 브랜드', tagline: '', brand_color: '#B5403A', plot_no: 0, is_public: false, public_key: null, weekly_goal: 3, created_at: '' },
  floors: [
    { id: 's0', kind: 'lobby', channel_type: null, channel_name: '', channel_url: '', position: 0, wall_color: null, record_count: 0, recent_records: [], placements: [] },
    { id: 's3', kind: 'sns', channel_type: 'blog', channel_name: '블로그', channel_url: '', position: 10, wall_color: '#F3C9A5', record_count: 16, recent_records: [],
      placements: [
        { slot_key: 'f1', inventory_id: 'a', item: item('sofa', '소파', 'floor', 0.85) },
        { slot_key: 'f2', inventory_id: 'b', item: item('cat', '고양이', 'floor', 0.5) },
        { slot_key: 'f4', inventory_id: 'e', item: item('tree', '나무', 'floor', 1.3) },
        { slot_key: 'w1', inventory_id: 'c', item: item('frame', '액자', 'wall', 0.9) },
      ] },
    { id: 's9', kind: 'rooftop', channel_type: null, channel_name: '', channel_url: '', position: 1000, wall_color: null, record_count: 0, recent_records: [],
      placements: [
        { slot_key: 'f2', inventory_id: 'd', item: item('parasol', '파라솔', 'floor', 1.35) },
        { slot_key: 'f4', inventory_id: 'f', item: item('bouquet', '꽃다발', 'floor', 0.65) },
      ] },
  ],
  stars_earned: 24, stamps: 0, records: 0, week: { start: '', count: 0, goal: 3, stamped: false },
  courses: [], completions: [], readings: [],
  taste: ['커피', '고양이', '꽃', '책 읽기', '음악'].map((label, i) => ({ id: `t${i}`, kind: 'pick' as const, shape: 'object' as const, label, emoji: null, photo_path: null })),
  news: [], my_books: [], cheers: 0,
}

export default function Start() {
  const { fail, toast } = useApp()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  const kakao = async () => {
    setBusy(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setBusy(false)
      toast('카카오로 들어가지 못했어요. 잠시 뒤에 다시 눌러 주세요.')
    }
  }

  const dev = async (signUp: boolean) => {
    setBusy(true)
    const { error } = signUp
      ? await supabase.auth.signUp({ email, password: pw })
      : await supabase.auth.signInWithPassword({ email, password: pw })
    setBusy(false)
    if (error) fail(error)
  }

  return (
    <div className="start">
      <h1>NFb 브랜드 타운</h1>
      <p className="lead">배우고, 만들고, 세상에 내놓을수록<br />내 브랜드 건물이 자랍니다.</p>
      <BuildingView b={SAMPLE} />
      <button className="btn kakao big" onClick={kakao} disabled={busy}>카카오로 시작하기</button>
      {devLogin && (
        <div className="card stack">
          <p className="muted small">이메일로 들어가기 (카카오 연결 전까지 쓰는 임시 방법이에요)</p>
          <input className="input" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <input className="input" placeholder="비밀번호" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
          <div className="row">
            <button className="btn grow" onClick={() => dev(false)} disabled={busy}>들어가기</button>
            <button className="btn ghost grow" onClick={() => dev(true)} disabled={busy}>새로 만들기</button>
          </div>
        </div>
      )}
    </div>
  )
}
