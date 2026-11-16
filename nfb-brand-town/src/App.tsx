import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useApp } from './ctx'
import { configured } from './lib/supabase'
import { Loading, Stars, TabBar } from './components/ui'
import Start from './pages/Start'
import Onboard from './pages/Onboard'
import TodayPage from './pages/Today'
import MyBuilding from './pages/MyBuilding'
import FloorPage from './pages/FloorPage'
import TownPage from './pages/Town'
import Visit from './pages/Visit'
import PublicPage from './pages/Public'
import Admin from './pages/Admin'
import Place from './pages/Place'

export default function App() {
  const { status, today, isAdmin, reload } = useApp()
  const loc = useLocation()

  // 공개 건물은 로그인과 상관없이 열린다.
  if (loc.pathname.startsWith('/b/')) {
    return (
      <div className="app">
        <Routes>
          <Route path="/b/:key" element={<PublicPage />} />
        </Routes>
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="app">
        <div className="start">
          <h1>NFb 브랜드 타운</h1>
          <div className="card">아직 데이터베이스가 연결되지 않았어요. 관리자에게 알려 주세요.</div>
        </div>
      </div>
    )
  }
  if (status === 'loading') return <div className="app"><Loading /></div>
  if (status === 'signedOut') return <div className="app"><Start /></div>
  if (status === 'needJoin') return <div className="app"><Onboard /></div>
  if (status === 'error') {
    return (
      <div className="app">
        <div className="start">
          <div className="card stack center">
            <p>건물을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.</p>
            <button className="btn primary" onClick={() => void reload()}>다시 불러오기</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="logo"><b>NFb</b> 브랜드 타운</Link>
        <div className="row">
          <TabBar admin={isAdmin} />
          <Stars n={today?.balance ?? 0} />
        </div>
      </header>
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/building" element={<MyBuilding />} />
        <Route path="/floor/:id" element={<FloorPage />} />
        <Route path="/town" element={<TownPage />} />
        <Route path="/visit/:id" element={<Visit />} />
        <Route path="/place/:kind" element={<Place />} />
        <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
