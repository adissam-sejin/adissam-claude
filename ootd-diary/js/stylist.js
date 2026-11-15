// 스타일리스트: 날씨를 가져오고, 기온·계절·착용 이력·색 조합으로 코디를 추천한다.

import { colorOf, ymd, daysBetween, seasonOfMonth } from './util.js';

export const DEFAULT_LOC = { name: '서울', lat: 37.5665, lon: 126.978 };

const WMO = [
  [[0], '맑음', '☀️'], [[1], '대체로 맑음', '🌤️'], [[2], '구름 조금', '⛅'], [[3], '흐림', '☁️'],
  [[45, 48], '안개', '🌫️'], [[51, 53, 55, 56, 57], '이슬비', '🌦️'],
  [[61, 63, 65, 66, 67, 80, 81, 82], '비', '🌧️'], [[71, 73, 75, 77, 85, 86], '눈', '❄️'],
  [[95, 96, 99], '뇌우', '⛈️'],
];
export function describe(code) {
  const hit = WMO.find(([codes]) => codes.includes(code));
  return hit ? { text: hit[1], icon: hit[2] } : { text: '—', icon: '🌡️' };
}
const isRain = (code) => [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code);
const isSnow = (code) => [71, 73, 75, 77, 85, 86].includes(code);

export async function fetchWeather(loc) {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${loc.lat}&longitude=${loc.lon}`
    + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m'
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code'
    + '&timezone=auto&forecast_days=1';
  const res = await fetch(url);
  if (!res.ok) throw new Error('날씨 응답 오류');
  const j = await res.json();
  return {
    ts: Date.now(),
    date: ymd(),
    temp: j.current.temperature_2m,
    feels: j.current.apparent_temperature,
    code: j.current.weather_code,
    wind: j.current.wind_speed_10m,
    tmax: j.daily.temperature_2m_max[0],
    tmin: j.daily.temperature_2m_min[0],
    pop: j.daily.precipitation_probability_max[0],
    dayCode: j.daily.weather_code[0],
  };
}

export async function searchCity(q) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=ko&format=json`);
  if (!res.ok) throw new Error('검색 오류');
  const j = await res.json();
  return (j.results || []).map((r) => ({
    name: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

// 기온별 옷차림 기준
const BANDS = [
  { min: 28, target: 1, outer: 'none', tip: '민소매, 반팔, 반바지, 린넨', mood: '한여름 더위엔 가볍고 시원하게 입으세요.' },
  { min: 23, target: 1.5, outer: 'none', tip: '반팔, 얇은 셔츠, 반바지, 면바지', mood: '반팔 한 장이면 충분한 날이에요.' },
  { min: 20, target: 2, outer: 'optional', outerTarget: 2, tip: '긴팔 티, 얇은 가디건, 면바지, 청바지', mood: '긴팔 한 장이 딱 좋은 날씨예요.' },
  { min: 17, target: 2.5, outer: 'optional', outerTarget: 3, tip: '얇은 니트, 맨투맨, 가디건, 청바지', mood: '가볍게 걸칠 것 하나 있으면 든든해요.' },
  { min: 12, target: 3, outer: 'required', outerTarget: 3, tip: '자켓, 가디건, 야상, 맨투맨, 니트', mood: '겉옷이 꼭 필요한 선선한 날이에요.' },
  { min: 9, target: 3.5, outer: 'required', outerTarget: 3.5, tip: '트렌치코트, 야상, 점퍼, 니트', mood: '제법 쌀쌀해요. 레이어드로 보온을 챙기세요.' },
  { min: 5, target: 4, outer: 'required', outerTarget: 4, tip: '코트, 가죽 자켓, 니트, 기모 바지', mood: '코트가 필요한 추위예요.' },
  { min: -99, target: 4.5, outer: 'required', outerTarget: 5, tip: '패딩, 두꺼운 코트, 목도리, 기모 제품', mood: '한겨울 추위, 보온이 최우선이에요.' },
];
export const bandFor = (t) => BANDS.find((b) => t >= b.min);

// 날씨 → 추천 기준 컨텍스트
export function contextFrom(weather, manualTemp) {
  const today = ymd();
  const month = new Date().getMonth() + 1;
  let t, rain = false, snow = false, swing = 0;
  if (manualTemp != null) {
    t = manualTemp;
  } else if (weather) {
    // 낮 활동 시간 기준 체감: 최고·최저의 가중 평균에 현재 체감을 섞는다
    const day = weather.tmax * 0.6 + weather.tmin * 0.4;
    t = (day * 2 + weather.feels) / 3;
    rain = isRain(weather.dayCode) || isRain(weather.code) || weather.pop >= 60;
    snow = isSnow(weather.dayCode) || isSnow(weather.code);
    swing = weather.tmax - weather.tmin;
  } else {
    t = { 봄: 15, 여름: 27, 가을: 16, 겨울: 2 }[seasonOfMonth(month)];
  }
  const season = t >= 23 ? '여름' : t < 9 ? '겨울' : (month >= 2 && month <= 7 ? '봄' : '가을');
  const band = bandFor(t);
  const notes = [];
  if (rain) notes.push('비 소식이 있어요. 우산을 챙기고 밝은 색 신발은 피하는 게 좋아요.');
  if (snow) notes.push('눈 예보가 있어요. 미끄럽지 않은 신발을 고르세요.');
  if (swing >= 10) notes.push(`일교차가 ${Math.round(swing)}°C로 커요. 입고 벗기 쉬운 겉옷을 추천해요.`);
  return { t, season, band, rain, snow, swing, notes, today };
}

function scoreItem(it, ctx, stats, target) {
  const light = ['shoes', 'bag', 'acc'].includes(it.category);
  let s = -Math.abs((it.warmth || 3) - target) * (light ? 1 : 3);
  if (it.seasons && it.seasons.length) s += it.seasons.includes(ctx.season) ? 2 : -4;
  const st = stats.get(it.id);
  if (!st) s += 1.5; // 아직 안 입은 옷은 개시 기회를 준다
  else {
    const days = daysBetween(st.last, ctx.today);
    if (days <= 2) s -= 3; else if (days <= 7) s -= 1; else if (days > 30) s += 1;
  }
  if (ctx.rain || ctx.snow) {
    if (it.category === 'shoes' && (/스웨이드|캔버스|샌들|슬리퍼/.test(it.name) || it.color === 'white')) s -= 2.5;
    if (it.category === 'bottom' && it.color === 'white') s -= 1;
  }
  return s + (Math.random() * 3 - 1.5);
}

function harmony(items) {
  const colors = items.map((i) => colorOf(i.color));
  const accents = new Set(colors.filter((c) => !c.neutral).map((c) => c.id));
  let s = accents.size <= 1 ? 2 : accents.size === 2 ? -1 : -4;
  if (accents.has('multi') && accents.size > 1) s -= 1.5;
  return s;
}

const topN = (list, n) => list.sort((a, b) => b.s - a.s).slice(0, n);

// 코디 추천: 최대 count개의 룩을 돌려준다
export function recommend(items, stats, ctx, count = 3) {
  const { band } = ctx;
  const pool = (cat, target, n) => topN(
    items.filter((i) => i.category === cat).map((it) => ({ it, s: scoreItem(it, ctx, stats, target) })), n);

  const tops = pool('top', band.target, 7);
  const bottoms = pool('bottom', Math.max(2, band.target), 6);
  const dresses = pool('dress', band.target, 3);
  const outers = band.outer === 'none' ? [] : pool('outer', band.outerTarget, 4);
  const shoes = pool('shoes', band.target, 4);
  const bags = pool('bag', 3, 3);
  const accs = items.filter((i) => i.category === 'acc' && (
    (ctx.t < 9 && /목도리|머플러|장갑|비니|스카프/.test(i.name)) ||
    (ctx.t >= 23 && !ctx.rain && /모자|캡|버킷|선글라스/.test(i.name))
  ));

  const missing = [];
  if (!tops.length && !dresses.length) missing.push('상의');
  if (!bottoms.length && !dresses.length) missing.push('하의');
  if (missing.length) return { looks: [], missing };

  const bases = [];
  for (const t of tops) for (const b of bottoms) bases.push({ parts: [t, b], s: t.s + b.s });
  for (const d of dresses) bases.push({ parts: [d], s: d.s * 2 });

  const outerOpts = band.outer === 'required' && outers.length ? outers
    : band.outer === 'optional' ? [null, ...outers.map((o) => ({ ...o, s: o.s - 1 }))]
    : [null];
  const shoeOpts = shoes.length ? shoes : [null];

  const combos = [];
  for (const base of bases) for (const o of outerOpts) for (const sh of shoeOpts) {
    const parts = [...base.parts, o, sh].filter(Boolean);
    const core = parts.filter((p) => p.it.category !== 'shoes').map((p) => p.it);
    combos.push({
      items: parts.map((p) => p.it),
      s: base.s + (o ? o.s : 0) + (sh ? sh.s * 0.6 : 0) + harmony(core),
    });
  }

  const looks = [];
  const weight = { top: 5, bottom: 4, dress: 6, outer: 2.5, shoes: 1 };
  while (looks.length < count && combos.length) {
    let best = null;
    for (const c of combos) {
      let pen = 0;
      for (const l of looks) for (const it of c.items) if (l.items.includes(it)) pen += weight[it.category] || 1;
      const v = c.s - pen;
      if (!best || v > best.v) best = { c, v };
    }
    combos.splice(combos.indexOf(best.c), 1);
    const dup = looks.some((l) => l.items.length === best.c.items.length && l.items.every((i) => best.c.items.includes(i)));
    if (dup) continue;
    const extras = [];
    if (bags.length) extras.push(bags[looks.length % bags.length].it);
    if (accs.length) extras.push(accs[looks.length % accs.length]);
    const lookItems = [...best.c.items, ...extras];
    looks.push({ items: lookItems, comment: commentFor(lookItems, stats, ctx, outers.length) });
  }
  return { looks, missing };
}

function commentFor(items, stats, ctx, hasOuterPool) {
  const lines = [];
  const core = items.filter((i) => ['top', 'bottom', 'dress', 'outer'].includes(i.category));
  const fresh = core.find((i) => !stats.get(i.id));
  const old = core
    .map((i) => ({ i, d: stats.get(i.id) ? daysBetween(stats.get(i.id).last, ctx.today) : 0 }))
    .filter((x) => x.d > 30).sort((a, b) => b.d - a.d)[0];
  if (fresh) lines.push(`아직 한 번도 안 입은 ‘${fresh.name}’, 오늘 개시해 보세요.`);
  else if (old) lines.push(`${old.d}일 만에 꺼내는 ‘${old.i.name}’로 기분 전환 어때요?`);

  const cs = core.map((i) => colorOf(i.color));
  const accents = [...new Set(cs.filter((c) => !c.neutral).map((c) => c.id))];
  const top = core.find((i) => i.category === 'top');
  const bottom = core.find((i) => i.category === 'bottom');
  if (top && bottom && top.color === bottom.color && colorOf(top.color).neutral) {
    lines.push(`${colorOf(top.color).ko} 톤온톤으로 길고 정돈된 실루엣을 만들어요.`);
  } else if (accents.length === 0) {
    lines.push('뉴트럴 톤으로 차분하게 정리한, 실패 없는 조합이에요.');
  } else if (accents.length === 1) {
    lines.push(`${colorOf(accents[0]).ko} 포인트 하나로 생기를 더했어요.`);
  } else {
    lines.push('색이 여러 개라 신발과 가방은 무채색으로 눌러 주세요.');
  }
  if (ctx.band.outer === 'required' && !core.some((i) => i.category === 'outer')) {
    lines.push(hasOuterPool ? '' : '이 날씨엔 겉옷이 필요한데, 옷장에 등록된 아우터가 없어요.');
  }
  return lines.filter(Boolean).join(' ');
}
