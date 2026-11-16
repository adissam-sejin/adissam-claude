// 홈 화면에 앱으로 저장하기 (PWA 설치)
// 브라우저는 사이트가 스스로 설치하는 것을 허락하지 않는다. 할 수 있는 일은 안내를 띄우고,
// 지원하는 브라우저(안드로이드 크롬 등)에서는 버튼 한 번으로 설치 창을 여는 것까지다.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const UNTIL = 'bt_install_until'   // 이 시각 전에는 안내를 다시 띄우지 않는다
const DONE = 'bt_install_done'     // 설치를 마쳤다
export const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000

let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
const tell = () => listeners.forEach((f) => f())

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* 저장을 막아 둔 브라우저 */ } },
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
    tell()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    store.set(DONE, '1')
    tell()
  })
}

export function registerServiceWorker() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => {}) })
  }
}

export const onInstallChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }
export const canPrompt = () => deferred !== null

// 이미 앱으로 열려 있는지
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export const isInstalled = () => isStandalone() || store.get(DONE) === '1'

export type Platform = 'kakao' | 'inapp-android' | 'inapp-ios' | 'ios-safari' | 'ios-other' | 'android' | 'desktop'

export function platform(): Platform {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const android = /Android/.test(ua)
  if (!ios && !android) return 'desktop'
  if (/KAKAOTALK/i.test(ua)) return 'kakao'
  // 다른 앱 안에서 열린 화면(네이버·인스타그램·페이스북·라인·밴드 등)에서는 저장할 수 없다
  if (/NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|BAND\//i.test(ua)) return ios ? 'inapp-ios' : 'inapp-android'
  if (ios) return /CriOS|FxiOS|EdgiOS|Whale/.test(ua) ? 'ios-other' : 'ios-safari'
  return 'android'
}

// 처음 들어왔거나, 지난 안내로부터 2주가 지났으면 안내를 띄운다.
export const shouldAutoShow = () => !isInstalled() && platform() !== 'desktop' && Date.now() >= Number(store.get(UNTIL) ?? 0)
export const snooze = () => store.set(UNTIL, String(Date.now() + TWO_WEEKS))

// 설치 창 열기 (안드로이드 크롬 등). 설치했으면 true.
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const e = deferred
  deferred = null
  await e.prompt()
  const { outcome } = await e.userChoice
  if (outcome === 'accepted') store.set(DONE, '1')
  tell()
  return outcome === 'accepted'
}

// 카카오톡 안에서 열렸을 때: 바깥 인터넷 앱으로 다시 연다.
export const openOutsideKakao = () => { window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.origin + '/')}` }
// 안드로이드의 다른 앱 안에서 열렸을 때: 크롬으로 다시 연다.
export const openInChrome = () => { window.location.href = `intent://${window.location.host}/#Intent;scheme=https;package=com.android.chrome;end` }

// 화면 어디서든 안내를 다시 열 때 쓴다.
export const showInstallGuide = () => window.dispatchEvent(new Event('bt-install-guide'))
