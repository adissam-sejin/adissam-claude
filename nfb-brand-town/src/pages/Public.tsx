import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Building } from '../lib/types'
import { BuildingView } from '../components/Building'
import { BuildingInfo } from '../components/BuildingInfo'
import { Loading } from '../components/ui'

// 로그인 없이 누구나 보는 공개 건물
export default function PublicPage() {
  const { key } = useParams()
  const [state, setState] = useState<{ b: Building | null } | 'loading'>('loading')

  useEffect(() => {
    api.publicBuilding(key!).then((b) => setState({ b })).catch(() => setState({ b: null }))
  }, [key])

  useEffect(() => {
    if (state !== 'loading' && state.b) {
      document.title = `${state.b.profile.brand_name || state.b.profile.nickname} · NFb 브랜드 타운`
    }
  }, [state])

  if (state === 'loading') return <Loading />
  const b = state.b
  if (!b) {
    return (
      <div className="start">
        <h1>NFb 브랜드 타운</h1>
        <div className="card center stack">
          <p>이 건물은 지금 닫혀 있어요.</p>
          <a className="btn primary" href="/">마을 입구로 가기</a>
        </div>
      </div>
    )
  }
  const p = b.profile
  return (
    <>
      <header className="topbar"><a href="/" className="logo"><b>NFb</b> 브랜드 타운</a></header>
      <div className="split">
        <div className="sticky"><BuildingView b={b} /></div>
        <div className="stack">
          <section className="card stack">
            <h1>{p.brand_name || `${p.nickname}님의 건물`}</h1>
            <p className="muted">{p.nickname}님{p.tagline ? ` · ${p.tagline}` : ''}</p>
            <div className="kv">
              <span>도장 {b.stamps}개</span>
              <span>기록 {b.records}개</span>
              <span>모은 별 {b.stars_earned}개</span>
            </div>
          </section>
          <BuildingInfo b={b} />
        </div>
      </div>
      <p className="pub-foot">배우고, 만들고, 세상에 내놓을수록 건물이 자라는 곳<br /><a href="/">NFb 브랜드 타운</a> · 아디쌤과 함께</p>
    </>
  )
}
