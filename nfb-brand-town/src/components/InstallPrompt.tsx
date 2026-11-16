import { useEffect, useState } from 'react'
import {
  canPrompt, isInstalled, isStandalone, onInstallChange, openInChrome, openOutsideKakao, platform, promptInstall,
  shouldAutoShow, snooze,
} from '../lib/install'

// iOS 의 공유 버튼 모양
const ShareIcon = () => (
  <svg className="ip-share" viewBox="0 0 24 24" aria-label="공유 버튼" role="img">
    <path d="M12 3v12M12 3l-4 4M12 3l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 10H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

// 처음 들어오면 "홈 화면에 앱으로 저장하기" 안내를 띄운다. 닫거나 그냥 지나가면 2주 뒤에 다시 보여 준다.
export function InstallPrompt() {
  const [open, setOpen] = useState(false)
  const [, bump] = useState(0)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => onInstallChange(() => bump((n) => n + 1)), [])
  useEffect(() => {
    // 저절로 띄우기: 화면이 자리 잡은 뒤 잠깐 있다가
    const t = window.setTimeout(() => {
      if (!shouldAutoShow()) return
      snooze() // 보여 준 순간부터 2주를 센다
      setOpen(true)
    }, 1800)
    // 「내 건물」의 버튼으로 다시 열기
    const again = () => { setDone(false); setOpen(true) }
    window.addEventListener('bt-install-guide', again)
    return () => { window.clearTimeout(t); window.removeEventListener('bt-install-guide', again) }
  }, [])

  if (!open) return null
  const p = platform()
  const close = () => setOpen(false)
  const install = async () => {
    setBusy(true)
    const ok = await promptInstall().catch(() => false)
    setBusy(false)
    if (ok) setDone(true)
    else close()
  }

  let body
  if (done || isStandalone()) {
    body = (
      <>
        <p>저장했어요. 이제 홈 화면의 <b>브랜드 타운</b> 아이콘을 누르면 바로 열려요.</p>
        <button className="btn primary wide" onClick={close}>알겠어요</button>
      </>
    )
  } else if (p === 'kakao') {
    body = (
      <>
        <p>카카오톡 안에서는 앱으로 저장할 수 없어요. 아래 버튼으로 <b>인터넷 앱</b>에서 연 다음, 거기서 다시 안내를 따라 주세요.</p>
        <button className="btn primary wide" onClick={openOutsideKakao}>인터넷 앱으로 열기</button>
        <button className="btn ghost wide" onClick={close}>나중에 할게요</button>
      </>
    )
  } else if (p === 'inapp-android' || p === 'inapp-ios') {
    body = (
      <>
        <p>지금은 다른 앱 안에서 열려 있어서 저장할 수 없어요. {p === 'inapp-ios' ? <>화면의 메뉴에서 <b>Safari로 열기</b>(다른 브라우저로 열기)를 누른 다음 저장해 주세요.</> : <>아래 버튼으로 <b>크롬</b>에서 연 다음 저장해 주세요.</>}</p>
        {p === 'inapp-android' && <button className="btn primary wide" onClick={openInChrome}>크롬으로 열기</button>}
        <button className="btn ghost wide" onClick={close}>{p === 'inapp-ios' ? '알겠어요' : '나중에 할게요'}</button>
      </>
    )
  } else if (p === 'ios-safari' || p === 'ios-other') {
    body = (
      <>
        <ol className="ip-steps">
          <li>{p === 'ios-safari' ? '화면 아래 가운데' : '주소창 오른쪽'}의 공유 버튼 <ShareIcon /> 을 눌러요.</li>
          <li>목록을 아래로 내려 <b>홈 화면에 추가</b>를 눌러요.</li>
          <li>오른쪽 위의 <b>추가</b>를 누르면 끝이에요.</li>
        </ol>
        <button className="btn primary wide" onClick={close}>알겠어요</button>
      </>
    )
  } else if (canPrompt()) {
    body = (
      <>
        <p>아래 버튼을 누르고, 이어서 나오는 창에서 <b>설치</b>를 한 번 더 눌러 주세요.</p>
        <button className="btn primary big" disabled={busy} onClick={() => void install()}>홈 화면에 저장하기</button>
        <button className="btn ghost wide" onClick={close}>나중에 할게요</button>
      </>
    )
  } else if (isInstalled()) {
    body = (
      <>
        <p>이미 홈 화면에 저장되어 있어요. 홈 화면에서 <b>브랜드 타운</b> 아이콘을 찾아 눌러 주세요.</p>
        <button className="btn primary wide" onClick={close}>알겠어요</button>
      </>
    )
  } else {
    body = (
      <>
        <ol className="ip-steps">
          <li>브라우저의 메뉴 버튼(<b>⋮</b> 또는 <b>≡</b>)을 눌러요.</li>
          <li><b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 눌러요.</li>
        </ol>
        <button className="btn primary wide" onClick={close}>알겠어요</button>
      </>
    )
  }

  return (
    <div className="ip" role="dialog" aria-label="홈 화면에 앱으로 저장하기">
      <div className="ip-head">
        <img src="/icon-192.png" alt="" />
        <div>
          <b>홈 화면에 앱으로 저장하기</b>
          <span>다음부터는 아이콘만 누르면 바로 열려요</span>
        </div>
        <button className="ip-x" onClick={close} aria-label="닫기">✕</button>
      </div>
      {body}
    </div>
  )
}
