// 인증사진: 지금 건물(또는 한 층)의 모습을 4:5 그림 한 장으로 만든다.
// 화면을 찍는 방식은 휴대폰마다 결과가 달라서, 같은 그림 조각을 캔버스에 직접 그린다.
import type { Building, Floor } from './types'
import { LOBBY, ROOMS, artUrl, maskUrl, roomArt, roomUrl, tasteArt } from './rooms'
import { sharedUrl } from './supabase'
import { floorNumber, floorTitle, seeded, shade } from './util'

const W = 1080
const H = 1350
const MEMO_HUES = [0, -28, 60, 150, 200, 300, 95, 0, 240]

const cache = new Map<string, Promise<HTMLImageElement | null>>()
function load(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  let p = cache.get(src)
  if (!p) {
    p = new Promise((resolve) => {
      const im = new Image()
      im.crossOrigin = 'anonymous'
      im.onload = () => resolve(im)
      im.onerror = () => resolve(null)
      im.src = src
    })
    cache.set(src, p)
  }
  return p
}

type Ctx = CanvasRenderingContext2D

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
}

// 그림을 상자 아래쪽에 맞춰, 높이 기준으로 그린다.
function drawStanding(c: Ctx, im: HTMLImageElement | null, cx: number, bottom: number, h: number, maxW = Infinity) {
  if (!im) return
  let w = (im.naturalWidth / im.naturalHeight) * h
  if (w > maxW) {
    h *= maxW / w
    w = maxW
  }
  c.drawImage(im, cx - w / 2, bottom - h, w, h)
}

async function drawRoom(c: Ctx, b: Building, f: Floor, x: number, y: number, w: number) {
  const art = roomArt(f)
  const L = ROOMS[art]
  const h = w / L.ratio
  const px = (p: number) => x + (w * p) / 100
  const py = (p: number) => y + (h * p) / 100
  const ph = (p: number) => (h * p) / 100
  const pw = (p: number) => (w * p) / 100

  const room = await load(roomUrl(art))
  if (room) c.drawImage(room, x, y, w, h)

  if (f.wall_color && f.kind !== 'rooftop') {
    c.save()
    c.globalCompositeOperation = 'multiply'
    c.globalAlpha = 0.85
    c.fillStyle = f.wall_color
    c.fillRect(x, y, w, h * 0.81)
    c.restore()
  }
  if (L.tinted) {
    const mask = await load(maskUrl(art))
    if (mask) {
      const off = document.createElement('canvas')
      off.width = Math.ceil(w)
      off.height = Math.ceil(h)
      const o = off.getContext('2d')!
      o.drawImage(mask, 0, 0, off.width, off.height)
      o.globalCompositeOperation = 'source-in'
      o.fillStyle = b.profile.brand_color
      o.fillRect(0, 0, off.width, off.height)
      c.save()
      c.globalCompositeOperation = 'multiply'
      c.drawImage(off, x, y, w, h)
      c.restore()
    }
  }

  // 그림 위에 얹는 것
  if (f.kind === 'sns' && L.board && L.plank) {
    const memo = await load(artUrl('taste/memo.webp'))
    const [bx, by, bw, bh] = L.board
    const loose = f.record_count % 10
    for (let i = 0; i < loose; i++) {
      const cw = pw(bw) / 5, ch = ph(bh) / 2
      const cx = px(bx) + cw * (i % 5) + cw / 2, cy = py(by) + ch * Math.floor(i / 5) + ch / 2
      c.save()
      c.filter = `hue-rotate(${MEMO_HUES[i % MEMO_HUES.length]}deg)`
      drawStanding(c, memo, cx, cy + ch * 0.41, ch * 0.82, cw)
      c.restore()
    }
    const albums = Math.min(Math.floor(f.record_count / 10), 4)
    const album = albums ? await load(artUrl('taste/scrapbook.webp')) : null
    const [lx, ly, lw] = L.plank
    for (let i = 0; i < albums; i++) drawStanding(c, album, px(lx) + ph(17) * 0.45 + i * ph(17) * 0.85, py(ly), ph(17), pw(lw) / 3.4)
  }
  if (f.kind === 'classroom' && L.chalk) {
    const stamps = Math.min(b.courses.reduce((n, cs) => n + cs.stamps.length, 0), 14)
    const [cx0, cy0, cw, ch] = L.chalk
    const d = pw(6.3), gap = pw(1.4), perRow = Math.max(1, Math.floor((pw(cw) - gap) / (d + gap)))
    const rows = Math.ceil(stamps / perRow)
    for (let i = 0; i < stamps; i++) {
      const row = Math.floor(i / perRow), inRow = Math.min(perRow, stamps - row * perRow)
      const sx = px(cx0) + pw(cw) / 2 - (inRow * (d + gap) - gap) / 2 + (i % perRow) * (d + gap) + d / 2
      const sy = py(cy0) + ph(ch) / 2 - (rows * (d + gap) - gap) / 2 + row * (d + gap) + d / 2
      c.fillStyle = '#fff3e6'
      c.beginPath(); c.arc(sx, sy, d / 2, 0, Math.PI * 2); c.fill()
      c.strokeStyle = b.profile.brand_color
      c.lineWidth = d * 0.11
      c.beginPath(); c.arc(sx, sy, d / 2 - c.lineWidth / 2, 0, Math.PI * 2); c.stroke()
      c.lineWidth = d * 0.07
      c.beginPath(); c.arc(sx, sy, d * 0.3, 0, Math.PI * 2); c.stroke()
    }
  }
  if (f.kind === 'library' && L.shelves) {
    const r = seeded(f.id, 40)
    const perRow = 13
    for (let row = 0; row < L.shelves.length; row++) {
      const [sx, bottom, sw] = L.shelves[row]
      const list = b.readings.slice(row * perRow, (row + 1) * perRow)
      let cx = px(sx) + pw(1)
      for (let i = 0; i < list.length; i++) {
        const im = await load(artUrl(`books/book${((row * perRow + i) % 10) + 1}.webp`))
        if (!im) continue
        const bh = ph(23) * (0.74 + r[row * perRow + i] * 0.26)
        const bw = Math.min((im.naturalWidth / im.naturalHeight) * bh, pw(sw) * 0.072)
        c.drawImage(im, cx, py(bottom) - bh, bw, bh)
        cx += bw + pw(sw) * 0.006
      }
    }
  }
  if (f.kind === 'lobby') {
    const [sx, sy, sw, sh] = LOBBY.sign
    const text = b.profile.brand_name || b.profile.nickname
    const chars = [...text]
    const lines = chars.length > 6 ? [chars.slice(0, Math.ceil(chars.length / 2)).join(''), chars.slice(Math.ceil(chars.length / 2)).join('')] : [text]
    let size = ph(sh) / lines.length * 0.86
    c.font = `${size}px Jua, sans-serif`
    const widest = Math.max(...lines.map((l) => c.measureText(l).width))
    if (widest > pw(sw) * 0.94) size *= (pw(sw) * 0.94) / widest
    c.font = `${size}px Jua, sans-serif`
    c.fillStyle = '#4a2f1c'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    lines.forEach((l, i) => c.fillText(l, px(sx + sw / 2), py(sy + sh / 2) + (i - (lines.length - 1) / 2) * size * 1.08))

    const [wx, wy, ww] = LOBBY.windowBooks
    const books = b.my_books.slice(0, 3)
    for (let i = 0; i < books.length; i++) {
      const im = await load(books[i].cover_url ? sharedUrl(books[i].cover_url) : artUrl('taste/book.webp'))
      c.save()
      c.globalAlpha = { plan: 0.35, toc: 0.55, draft: 0.8, cover: 1, published: 1 }[books[i].stage]
      drawStanding(c, im, px(wx) + pw(ww) * ((i + 0.5) / books.length), py(wy), ph(20))
      c.restore()
    }
    const taste = b.taste.slice(-8)
    for (let k = 0; k < LOBBY.cubbies.length; k++) {
      const [cx0, bottom, cw] = LOBBY.cubbies[k]
      const pair = taste.slice(k * 2, k * 2 + 2)
      for (let i = 0; i < pair.length; i++) {
        const t = pair[i]
        const im = await load(t.kind === 'photo' ? sharedUrl(t.photo_path) : tasteArt(t))
        const cx = px(cx0) + pw(cw) * (pair.length === 1 ? 0.5 : 0.27 + i * 0.46)
        if (im) drawStanding(c, im, cx, py(bottom), ph(16.5), pw(cw) * 0.46)
        else if (t.emoji) {
          c.font = `${ph(12)}px sans-serif`
          c.textAlign = 'center'
          c.textBaseline = 'bottom'
          c.fillText(t.emoji, cx, py(bottom))
        }
      }
    }
  }

  // 놓은 물건
  for (const p of f.placements) {
    const wall = p.slot_key[0] === 'w'
    const idx = Number(p.slot_key.slice(1)) - 1
    const size = (p.item.size ?? 1) * (L.scale ?? 1)
    const im = await load(sharedUrl(p.item.image_url))
    if (wall) {
      const pos = L.wall[idx]
      if (!pos) continue
      const ih = ph(size * 30)
      if (im) drawStanding(c, im, px(pos[0]), py(pos[1]) + ih / 2, ih)
    } else {
      const cx = L.floor[idx]
      if (cx === undefined) continue
      const ih = ph(size * 36)
      if (im) drawStanding(c, im, px(cx), y + h - ph(L.floorY), ih)
      else if (p.item.emoji) {
        c.font = `${ih * 0.8}px sans-serif`
        c.textAlign = 'center'
        c.textBaseline = 'bottom'
        c.fillText(p.item.emoji, px(cx), y + h - ph(L.floorY))
      }
    }
  }
  return h
}

function drawSky(c: Ctx, b: Building) {
  const g = c.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#1b2247')
  g.addColorStop(0.55, '#2c3568')
  g.addColorStop(1, '#5b4a7d')
  c.fillStyle = g
  c.fillRect(0, 0, W, H)
  // 모은 별만큼 별이 뜬다
  const n = Math.min(b.stars_earned, 90)
  const r = seeded(b.profile.id, n * 3)
  c.fillStyle = '#ffe9a8'
  for (let i = 0; i < n; i++) {
    const x = 40 + r[i * 3] * (W - 80), y = 30 + r[i * 3 + 1] * 520, s = 5 + r[i * 3 + 2] * 7
    if (y < 200 && x > 220 && x < 860) continue // 제목 글자 위에는 별을 그리지 않는다
    c.beginPath()
    for (let k = 0; k < 10; k++) {
      const a = (Math.PI / 5) * k - Math.PI / 2, rad = k % 2 ? s * 0.45 : s
      c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad)
    }
    c.closePath()
    c.fill()
  }
  c.save()
  c.shadowColor = 'rgba(255,243,196,0.7)'
  c.shadowBlur = 50
  c.fillStyle = '#fff3c4'
  c.beginPath(); c.arc(W - 150, 150, 46, 0, Math.PI * 2); c.fill()
  c.restore()
}

function header(c: Ctx, title: string, sub: string) {
  c.textAlign = 'center'
  c.textBaseline = 'alphabetic'
  c.fillStyle = '#fdf3e0'
  let size = 76
  c.font = `${size}px Jua, sans-serif`
  const w = c.measureText(title).width
  if (w > W - 160) size *= (W - 160) / w
  c.font = `${size}px Jua, sans-serif`
  c.fillText(title, W / 2, 118)
  c.fillStyle = '#cfc7e0'
  c.font = `600 34px "Pretendard Variable", Pretendard, sans-serif`
  c.fillText(sub, W / 2, 172)
}

function footer(c: Ctx, line: string) {
  c.textAlign = 'center'
  c.fillStyle = '#fdf3e0'
  c.font = `700 36px "Pretendard Variable", Pretendard, sans-serif`
  c.fillText(line, W / 2, H - 104)
  const d = new Date(Date.now() + 9 * 3600 * 1000)
  const day = `${d.getUTCFullYear()}.${d.getUTCMonth() + 1}.${d.getUTCDate()}`
  c.font = `34px Jua, sans-serif`
  c.fillStyle = '#f2b63d'
  const brand = 'NFb 브랜드 타운'
  c.fillText(`${brand}  ·  ${day}`, W / 2, H - 46)
}

export async function makePhoto(b: Building, floorId?: string): Promise<Blob> {
  await Promise.all([document.fonts.load('40px Jua'), document.fonts.load('700 36px "Pretendard Variable"')]).catch(() => undefined)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!
  drawSky(c, b)
  const p = b.profile
  const name = p.brand_name || `${p.nickname}님의 건물`

  if (floorId) {
    // 한 층만 크게
    const f = b.floors.find((x) => x.id === floorId)!
    const label = f.kind === 'rooftop' ? '옥상' : `${floorNumber(b.floors, f)} · ${floorTitle(f)}`
    header(c, name, label)
    const rw = W - 80
    const rh = rw / ROOMS[roomArt(f)].ratio
    const ry = 230 + (H - 230 - 190 - rh) / 2 - 70
    c.save()
    if (f.kind !== 'rooftop') {
      c.shadowColor = 'rgba(8,10,30,0.5)'
      c.shadowBlur = 40
      c.shadowOffsetY = 18
      roundRect(c, 40, ry, rw, rh, 28)
      c.fillStyle = '#f4e4c8'
      c.fill()
      c.shadowColor = 'transparent'
      roundRect(c, 40, ry, rw, rh, 28)
      c.clip()
    }
    await drawRoom(c, b, f, 40, ry, rw)
    c.restore()
    const quote =
      f.kind === 'sns' ? f.recent_records.find((r) => r.note)?.note
      : f.kind === 'library' ? b.readings.at(-1)?.note || b.readings.at(-1)?.title
      : f.kind === 'classroom' ? b.courses.find((cs) => cs.stamps.length)?.title
      : p.tagline
    if (quote) {
      c.textAlign = 'center'
      c.fillStyle = '#fdf3e0'
      c.font = `44px Jua, sans-serif`
      const chars = [...`“${quote}”`]
      const lines: string[] = []
      let cur = ''
      for (const ch of chars) {
        if (c.measureText(cur + ch).width > W - 200 && lines.length < 2) { lines.push(cur); cur = '' }
        cur += ch
      }
      lines.push(cur)
      lines.slice(0, 3).forEach((l, i) => c.fillText(l, W / 2, ry + rh + 110 + i * 60))
    }
    const line =
      f.kind === 'sns' ? `기록 ${f.record_count}개를 쌓았어요`
      : f.kind === 'classroom' ? `강의 도장 ${b.courses.reduce((n, cs) => n + cs.stamps.length, 0)}개 · 수료 ${b.completions.filter((x) => x.status === 'approved').length}개`
      : f.kind === 'library' ? `읽은 책 ${b.readings.length}권`
      : f.kind === 'lobby' ? `좋아하는 것 ${b.taste.length}개로 채운 로비`
      : `모은 별 ${b.stars_earned}개가 뜬 옥상`
    footer(c, line)
  } else {
    header(c, name, p.tagline || `${p.nickname}님의 브랜드 건물`)
    const floors = [...b.floors].sort((x, y) => y.position - x.position)
    // 건물 높이 ÷ 폭 을 먼저 구해서, 자리에 맞게 폭을 정한다.
    const rel = floors.reduce((s, f) => s + (f.kind === 'rooftop' ? 0.97 / ROOMS.rooftop.ratio + 0.02 : 0.88 / 2.5), 0) + 0.05
    const top = 215, bottom = H - 165
    const bw = Math.min(900, (bottom - top) / rel)
    const bx = (W - bw) / 2
    let y = bottom - bw * rel
    for (const f of floors) {
      if (f.kind === 'rooftop') {
        const h = await drawRoom(c, b, f, bx + bw * 0.015, y, bw * 0.97)
        y += h
        const g = c.createLinearGradient(0, y - bw * 0.008, 0, y + bw * 0.028)
        g.addColorStop(0, shade(p.brand_color, 0.16))
        g.addColorStop(0.45, p.brand_color)
        g.addColorStop(1, shade(p.brand_color, -0.14))
        c.fillStyle = g
        roundRect(c, bx - bw * 0.026, y - bw * 0.008, bw * 1.052, bw * 0.036, bw * 0.016)
        c.fill()
        y += bw * 0.02
        continue
      }
      const rh = (bw * 0.88) / 2.5
      // 양쪽 기둥과 불 켜진 창
      for (const side of [0, 1]) {
        const pxl = side ? bx + bw * 0.94 : bx
        const g = c.createLinearGradient(pxl, 0, pxl + bw * 0.06, 0)
        g.addColorStop(side ? 1 : 0, '#d9c3a0')
        g.addColorStop(0.5, '#f7e9cd')
        g.addColorStop(side ? 0 : 1, '#efdcba')
        c.fillStyle = g
        c.fillRect(pxl, y, bw * 0.06, rh)
        const wx = pxl + bw * 0.012, wy = y + rh * 0.22, ww = bw * 0.036, wh = rh * 0.46
        c.save()
        c.shadowColor = 'rgba(255,196,84,0.85)'
        c.shadowBlur = bw * 0.03
        c.fillStyle = '#f7b84e'
        roundRect(c, wx, wy, ww, wh, [ww / 2, ww / 2, 3, 3] as unknown as number)
        c.fill()
        c.restore()
        c.strokeStyle = shade(p.brand_color, -0.14)
        c.lineWidth = bw * 0.005
        roundRect(c, wx, wy, ww, wh, [ww / 2, ww / 2, 3, 3] as unknown as number)
        c.stroke()
      }
      await drawRoom(c, b, f, bx + bw * 0.06, y, bw * 0.88)
      y += rh
      // 층 사이 바닥 띠
      const g = c.createLinearGradient(0, y - bw * 0.011, 0, y + bw * 0.011)
      g.addColorStop(0, '#fbefd9')
      g.addColorStop(1, '#dcc39a')
      c.fillStyle = g
      roundRect(c, bx - bw * 0.014, y - bw * 0.011, bw * 1.028, bw * 0.022, bw * 0.009)
      c.fill()
    }
    const g = c.createLinearGradient(0, y, 0, y + bw * 0.045)
    g.addColorStop(0, '#9a8f86')
    g.addColorStop(1, '#776d66')
    c.fillStyle = g
    roundRect(c, bx - bw * 0.04, y + bw * 0.004, bw * 1.08, bw * 0.04, bw * 0.014)
    c.fill()
    footer(c, `도장 ${b.stamps}개 · 기록 ${b.records}개 · 모은 별 ${b.stars_earned}개`)
  }

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('photo'))), 'image/jpeg', 0.92))
}
