import { useEffect, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn ghost small" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="stars-pill" aria-label={`별 ${n}개`}>
      <span aria-hidden>⭐</span> {n}
    </span>
  )
}

export function TabBar({ admin }: { admin: boolean }) {
  return (
    <nav className="tabbar" aria-label="주요 화면">
      <NavLink to="/" end>
        <span aria-hidden>☀️</span>오늘
      </NavLink>
      <NavLink to="/building">
        <span aria-hidden>🏠</span>내 건물
      </NavLink>
      <NavLink to="/town">
        <span aria-hidden>🗺️</span>우리 마을
      </NavLink>
      {admin && (
        <NavLink to="/admin">
          <span aria-hidden>🛠️</span>관리
        </NavLink>
      )}
    </nav>
  )
}

export function Sprite({ emoji, image, label }: { emoji?: string | null; image?: string | null; label?: string }) {
  if (image) return <img className="spr-img" src={image} alt={label ?? ''} draggable={false} />
  return (
    <span className="spr-emoji" role="img" aria-label={label}>
      {emoji ?? '📦'}
    </span>
  )
}

export function Loading({ text = '불러오는 중이에요' }: { text?: string }) {
  return <p className="loading">{text}…</p>
}

// 좋은 일이 생겼을 때 화면 가운데에 크게 보여준다 (도장, 별, 증축 등)
export function Celebrate({ icon, title, lines, onDone }: { icon: string; title: string; lines: string[]; onDone: () => void }) {
  return (
    <div className="celebrate" onClick={onDone} role="dialog" aria-modal="true" aria-label={title}>
      <div className="celebrate-card" onClick={(e) => e.stopPropagation()}>
        <div className="celebrate-icon" aria-hidden>
          {icon}
        </div>
        <h2>{title}</h2>
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
        <button className="btn primary big" onClick={onDone} autoFocus>
          좋아요
        </button>
      </div>
    </div>
  )
}
