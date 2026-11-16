import type { Building } from '../lib/types'
import { channelInfo, floorNumber, floorTitle, fmtDay, fmtFullDay, newsInfo } from '../lib/util'
import { TasteChip } from '../pages/floor/LobbyPanel'

// 남의 건물(마을 방문·공개 건물)에서 보여주는 소개
export function BuildingInfo({ b }: { b: Building }) {
  const sns = b.floors.filter((f) => f.kind === 'sns')
  const lines = sns
    .flatMap((f) => f.recent_records.filter((r) => r.note).map((r) => ({ ...r, floor: floorTitle(f), emoji: channelInfo(f.channel_type).emoji })))
    .sort((x, y) => (x.day < y.day ? 1 : -1))
    .slice(0, 8)
  const done = b.completions.filter((c) => c.status === 'approved')
  const books = b.my_books.filter((m) => m.stage === 'published')

  return (
    <>
      {b.news.length > 0 && (
        <section className="card stack">
          <h2>좋은 소식</h2>
          <ul className="list">
            {b.news.slice(0, 5).map((n) => (
              <li key={n.id}>
                <span className="ico" aria-hidden>{newsInfo(n.kind).emoji}</span>
                <span className="txt"><b>{newsInfo(n.kind).banner} · {fmtDay(n.created_at)}{n.featured ? ' · 🎀' : ''}</b>{n.note}</span>
                {n.url && <a className="btn ghost small" href={n.url} target="_blank" rel="noreferrer">보기</a>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {sns.length > 0 && (
        <section className="card stack">
          <h2>층별 안내판</h2>
          <ul className="list">
            {sns.map((f) => (
              <li key={f.id}>
                <span className="ico" aria-hidden>{channelInfo(f.channel_type).emoji}</span>
                <span className="txt"><b>{floorNumber(b.floors, f)} {floorTitle(f)}</b>기록 {f.record_count}개</span>
                {f.channel_url && <a className="btn small" href={f.channel_url} target="_blank" rel="noreferrer">채널 가기</a>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {books.length > 0 && (
        <section className="card stack">
          <h2>펴낸 책</h2>
          <ul className="list">
            {books.map((m) => (
              <li key={m.id}>
                <span className="ico" aria-hidden>📕</span>
                <span className="txt"><b>{m.title}</b>{m.isbn ? `ISBN ${m.isbn}` : ''}</span>
                {m.buy_url && <a className="btn small" href={m.buy_url} target="_blank" rel="noreferrer">책 보러 가기</a>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {lines.length > 0 && (
        <section className="card stack">
          <h2>남긴 한 줄</h2>
          <ul className="list">
            {lines.map((r) => (
              <li key={r.id}>
                <span className="ico" aria-hidden>{r.emoji}</span>
                <span className="txt"><b>{r.floor} · {fmtDay(r.day)}</b>{r.note}</span>
                {r.url && <a className="btn ghost small" href={r.url} target="_blank" rel="noreferrer">글 보기</a>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {b.taste.length > 0 && (
        <section className="card stack">
          <h2>좋아하는 것들</h2>
          <div className="taste-wall">{b.taste.map((t) => <TasteChip key={t.id} t={t} />)}</div>
        </section>
      )}
      {(done.length > 0 || b.readings.length > 0) && (
        <section className="card stack">
          <h2>배움의 흔적</h2>
          <ul className="list">
            {done.map((c) => (
              <li key={c.id}>
                <span className="ico" aria-hidden>{c.item?.emoji ?? '🎓'}</span>
                <span className="txt"><b>{c.title}</b>{fmtFullDay(c.completed_on)} 수료</span>
              </li>
            ))}
            {b.readings.map((r) => (
              <li key={r.id}>
                <span className="ico" aria-hidden>📗</span>
                <span className="txt"><b>{r.title}</b>{r.note || '읽었어요'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
