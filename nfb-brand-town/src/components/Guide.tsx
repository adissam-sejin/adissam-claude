import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Sheet } from './ui'

// 별과 도장을 어떻게 받는지 알려 주는 안내. 숫자는 관리 → 설정에서 정한 값을 그대로 읽어 온다.
const DEFAULTS: Record<string, number> = {
  star_welcome: 5, star_per_record: 1, record_star_daily_cap: 1, star_weekly_bonus: 5, star_lecture_stamp: 2,
  star_reading: 3, star_cheer: 1, star_news: 2, star_featured: 10, star_completion: 5,
}

export function Guide({ goal, onClose }: { goal: number; onClose: () => void }) {
  const [v, setV] = useState(DEFAULTS)
  useEffect(() => {
    supabase.from('settings').select('key,value').then(({ data }) => {
      if (!data) return
      const next = { ...DEFAULTS }
      for (const r of data) if (r.key in next && Number.isFinite(Number(r.value))) next[r.key] = Number(r.value)
      setV(next)
    })
  }, [])

  const stars: [string, string, string, number][] = [
    ['✍️', 'SNS에 올린 글을 기록하기', `「오늘」의 [기록 남기기] · 한 층에서 하루 ${v.record_star_daily_cap}개까지`, v.star_per_record],
    ['🎯', '일주일 목표 채우기', `일주일에 기록 ${goal}개 · 도장도 함께 받아요`, v.star_weekly_bonus],
    ['🎓', '강의 듣고 강의 도장 찍기', '2층 강의실 · 강의 하나에 한 번', v.star_lecture_stamp],
    ['📚', '북클럽 책 읽고 기록하기', '3층 서재', v.star_reading],
    ['💐', '이웃 건물에 응원 보내기', '「우리 마을」 · 하루에 첫 응원만', v.star_cheer],
    ['🎉', '좋은 소식 알리기', '1층 로비 · 일주일에 한 번만', v.star_news],
    ['📣', '아디쌤이 내 소식을 소개했을 때', '소개에 동의한 소식만', v.star_featured],
    ['🏅', '강의 수료가 확인됐을 때', '수료 기념품과 수료증도 받아요', v.star_completion],
    ['🏠', '처음 건물을 지었을 때', '가입할 때 한 번', v.star_welcome],
  ]

  return (
    <Sheet title="별과 도장, 이렇게 받아요" onClose={onClose}>
      <div className="stack guide">
        <section className="guide-box">
          <h3><span aria-hidden>⭐</span> 별은 가게에서 쓰는 돈이에요</h3>
          <p className="muted">모은 별로 방에 놓을 물건과 벽 색을 사요. 아래 일을 하면 별을 받아요.</p>
          <ul className="guide-list">
            {stars.map(([ico, what, where, n]) => (
              <li key={what}>
                <span className="ico" aria-hidden>{ico}</span>
                <span className="txt"><b>{what}</b>{where}</span>
                <span className="guide-n">별 {n}개</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="guide-box">
          <h3><span aria-hidden>💮</span> 도장은 꾸준히 한 표시예요</h3>
          <p className="muted">도장은 쓰는 것이 아니라 차곡차곡 쌓이는 기록이에요. 두 가지가 있어요.</p>
          <ul className="guide-list">
            <li>
              <span className="ico" aria-hidden>🗓️</span>
              <span className="txt"><b>주간 도장 — 「오늘」의 도장판</b>월요일부터 일요일까지 기록을 {goal}개 남기면 그 주에 도장 1개가 찍혀요. 일주일에 하나만 받을 수 있어요.</span>
            </li>
            <li>
              <span className="ico" aria-hidden>🎓</span>
              <span className="txt"><b>강의 도장 — 2층 강의실 칠판</b>강의 하나에 도장 하나예요. 듣는 강의나 참여한 무료특강에 직접 찍어요. 찍을 때 별도 함께 받아요.</span>
            </li>
          </ul>
        </section>

        <p className="muted small">기록을 여러 개 남겨도 괜찮아요. 다만 별은 한 층에서 하루 {v.record_star_daily_cap}개까지만 받아요. 매일 조금씩 하는 것이 가장 많이 모여요.</p>
        <button className="btn primary wide" onClick={onClose}>알겠어요</button>
      </div>
    </Sheet>
  )
}
