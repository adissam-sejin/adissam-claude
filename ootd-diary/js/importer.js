// 구매내역 가져오기: 붙여넣은 텍스트 / CSV / JSON을 옷장 아이템 후보로 변환하고
// 상품명에서 카테고리·계절·두께·색상을 추정한다.

const CAT_RULES = [
  ['outer', /패딩|코트|자켓|재킷|점퍼|블루종|가디건|카디건|야상|바람막이|후리스|플리스|무스탕|트렌치|블레이저|집업|파카|베스트|조끼|아우터|윈드브레이커|jacket|coat|padding|cardigan|blazer|parka|puffer/i],
  ['dress', /원피스|드레스|점프수트|점프슈트|dress|jumpsuit/i],
  ['shoes', /스니커즈|운동화|구두|로퍼|부츠|샌들|슬리퍼|슈즈|힐|플랫|뮬|러닝화|워커|shoes|sneakers?|boots|loafers?|sandals?/i],
  ['bag', /가방|백팩|토트|숄더백|크로스백|에코백|클러치|메신저백|호보백|\bbag\b|backpack|tote/i],
  ['acc', /모자|볼캡|버킷햇|비니|머플러|목도리|스카프|벨트|양말|삭스|장갑|안경|선글라스|목걸이|귀걸이|반지|시계|넥타이|\bcap\b|beanie|scarf|belt|socks/i],
  ['bottom', /바지|팬츠|슬랙스|청바지|스커트|치마|쇼츠|반바지|레깅스|조거|데님 ?진|진스|pants|jeans|skirt|shorts|slacks|trousers/i],
  ['top', /./],
];

const COLOR_RULES = [
  ['multi', /스트라이프|체크|플로럴|패턴|도트|페이즐리|카모|stripe|check|floral/i],
  ['black', /블랙|검정|black/i],
  ['white', /화이트|아이보리|크림|오프화이트|흰색|white|ivory|cream/i],
  ['gray', /그레이|회색|차콜|멜란지|gr[ae]y|charcoal/i],
  ['navy', /네이비|남색|navy/i],
  ['beige', /베이지|샌드|오트밀|beige|oatmeal/i],
  ['brown', /브라운|카멜|초코|모카|brown|camel/i],
  ['khaki', /카키|올리브|khaki|olive/i],
  ['denim', /데님|청바지|인디고|중청|연청|흑청|denim|indigo/i],
  ['blue', /블루|스카이|소라|blue/i],
  ['green', /그린|민트|초록|green|mint/i],
  ['yellow', /옐로|노랑|머스타드|레몬|yellow|mustard/i],
  ['orange', /오렌지|주황|orange/i],
  ['red', /레드|버건디|와인|빨강|red|burgundy|wine/i],
  ['pink', /핑크|분홍|pink/i],
  ['purple', /퍼플|보라|라벤더|purple|lavender/i],
];

const ALL = ['봄', '여름', '가을', '겨울'];

// 상품명 → 카테고리 / 계절 / 두께(1~5) / 색상 추정
export function guess(name = '') {
  const category = CAT_RULES.find(([, re]) => re.test(name))[0];
  const colorHit = COLOR_RULES.find(([, re]) => re.test(name));
  let warmth, seasons;
  if (/패딩|다운|무스탕|퍼 |기모|롱코트|울 ?코트|목도리|머플러|장갑|어그|히트텍|헤비|덕다운|구스|puffer|padding/i.test(name)) {
    warmth = 5; seasons = ['겨울'];
  } else if (/코트|니트|스웨터|울|후리스|플리스|코듀로이|골덴|가죽|레더|부츠|터틀넥|목폴라|비니|knit|sweater|wool|fleece|leather|coat/i.test(name)) {
    warmth = 4; seasons = ['가을', '겨울'];
  } else if (/반팔|반바지|쇼츠|민소매|나시|린넨|샌들|슬리퍼|썸머|시어서커|숏슬리브|하프|슬리브리스|메쉬|쿨|short sleeve|shorts|linen|sandal|sleeveless/i.test(name)) {
    warmth = 1; seasons = ['여름'];
  } else if (/맨투맨|후드|스웨트|야상|블루종|자켓|재킷|블레이저|트렌치|집업|점퍼|sweatshirt|hood|jacket|blazer|trench/i.test(name)) {
    warmth = 3; seasons = ['봄', '가을'];
  } else if (/셔츠|블라우스|긴팔|롱슬리브|가디건|카디건|바람막이|shirt|blouse|cardigan|long sleeve/i.test(name)) {
    warmth = 2; seasons = ['봄', '가을'];
  } else if (category === 'top' || category === 'dress') {
    warmth = 2; seasons = ['봄', '여름', '가을'];
  } else if (category === 'outer') {
    warmth = 3; seasons = ['봄', '가을'];
  } else {
    warmth = 3; seasons = [...ALL];
  }
  if (category === 'top' && /티셔츠|\btee\b|t-?shirt/i.test(name) && warmth === 2 && !/긴팔|롱슬리브/.test(name)) {
    seasons = ['봄', '여름', '가을'];
  }
  return { category, seasons, warmth, color: colorHit ? colorHit[0] : 'gray' };
}

const KEY_ALIASES = {
  name: ['name', 'title', 'product', 'productname', 'item', '상품명', '상품', '제품명', '이름', '품명'],
  brand: ['brand', '브랜드', '판매자', 'seller'],
  price: ['price', 'amount', '가격', '금액', '결제금액', '구매가', '상품금액'],
  boughtAt: ['date', 'boughtat', 'orderdate', 'purchasedate', '구매일', '주문일', '주문일자', '결제일', '날짜'],
  img: ['image', 'img', 'imageurl', 'thumbnail', 'photo', '이미지', '이미지url', '사진'],
  shop: ['shop', 'store', 'mall', '구매처', '쇼핑몰', '스토어'],
  url: ['url', 'link', '링크', '상품링크'],
  category: ['category', '카테고리', '분류'],
};

const norm = (k) => String(k).toLowerCase().replace(/[\s_\-]/g, '');

function pick(obj, field) {
  const aliases = KEY_ALIASES[field];
  for (const [k, v] of Object.entries(obj)) {
    if (aliases.includes(norm(k)) && v !== '' && v != null) return v;
  }
  return '';
}

const DATE_RE = /(20\d{2})\s?[.\-\/년]\s?(\d{1,2})\s?[.\-\/월]\s?(\d{1,2})일?/;
const URL_RE = /https?:\/\/[^\s|,]+/i;
const PRICE_RE = /(?:₩|\\)?\s?(\d{1,3}(?:,\d{3})+|\d{4,8})\s?원?/;

const toDate = (s) => {
  const m = String(s || '').match(DATE_RE);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
};
const toPrice = (s) => {
  if (typeof s === 'number') return s;
  const m = String(s || '').match(PRICE_RE);
  return m ? Number(m[1].replace(/,/g, '')) : null;
};

function fromObject(o) {
  const name = String(pick(o, 'name')).trim();
  if (!name) return null;
  return {
    name,
    brand: String(pick(o, 'brand')).trim(),
    price: toPrice(pick(o, 'price')),
    boughtAt: toDate(pick(o, 'boughtAt')),
    img: String(pick(o, 'img')).trim(),
    shop: String(pick(o, 'shop')).trim(),
    url: String(pick(o, 'url')).trim(),
    categoryHint: String(pick(o, 'category')).trim(),
  };
}

// 한 줄 텍스트에서 날짜·이미지 URL·가격을 골라내고 나머지를 상품명/브랜드로 본다
function fromLine(line) {
  const parts = /\t|\|/.test(line) ? line.split(/\t|\|/).map((s) => s.trim()).filter(Boolean) : [line.trim()];
  const out = { name: '', brand: '', price: null, boughtAt: '', img: '', shop: '', url: '' };
  const rest = [];
  for (let part of parts) {
    const u = part.match(URL_RE);
    if (u) {
      if (/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u[0]) || !out.img && /image|img|cdn|thumb/i.test(u[0])) out.img = u[0];
      else out.url = u[0];
      part = part.replace(u[0], '').trim();
    }
    const d = part.match(DATE_RE);
    if (d) { out.boughtAt = toDate(d[0]); part = part.replace(d[0], '').trim(); }
    if (parts.length > 1 ? /^[₩\\]?\s?[\d,]+\s?원?$/.test(part) : PRICE_RE.test(part) && /원|₩|,\d{3}/.test(part)) {
      const p = part.match(PRICE_RE);
      out.price = toPrice(p[0]);
      part = part.replace(p[0], '').trim();
    }
    part = part.replace(/^[\s\-·,]+|[\s\-·,]+$/g, '');
    if (part) rest.push(part);
  }
  if (!rest.length) return null;
  out.name = rest[0];
  if (rest[1]) out.brand = rest[1];
  if (rest[2]) out.shop = rest[2];
  return out;
}

function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const CAT_KO = { 상의: 'top', 하의: 'bottom', 아우터: 'outer', 원피스: 'dress', 신발: 'shoes', 가방: 'bag', 액세서리: 'acc' };
const CAT_IDS = Object.values(CAT_KO);

// 텍스트(붙여넣기/파일 내용) → 아이템 후보 배열
export function parsePurchases(text, { shop = '' } = {}) {
  const src = String(text || '').replace(/^﻿/, '').trim();
  if (!src) return [];
  let raw = [];
  if (/^[\[{]/.test(src)) {
    try {
      const json = JSON.parse(src);
      const arr = Array.isArray(json) ? json : (json.items || json.orders || json.data || [json]);
      raw = arr.map(fromObject);
    } catch { raw = []; }
  }
  if (!raw.length) {
    const lines = src.split(/\r?\n/).filter((l) => l.trim());
    const head = lines[0].split(',').map(norm);
    const isCsv = head.length > 1 && head.some((h) => KEY_ALIASES.name.includes(h));
    if (isCsv) {
      const rows = parseCsv(src);
      const keys = rows[0];
      raw = rows.slice(1).map((r) => fromObject(Object.fromEntries(keys.map((k, i) => [k, r[i] ?? '']))));
    } else {
      raw = lines.map(fromLine);
    }
  }
  return raw.filter(Boolean).map((r) => {
    const g = guess(`${r.name} ${r.categoryHint || ''}`);
    const hinted = CAT_KO[r.categoryHint] || (CAT_IDS.includes(r.categoryHint) ? r.categoryHint : null);
    return {
      name: r.name.slice(0, 80),
      brand: r.brand || '',
      price: r.price,
      boughtAt: r.boughtAt || '',
      img: r.img || '',
      shop: r.shop || shop || '',
      url: r.url || '',
      ...g,
      category: hinted || g.category,
    };
  });
}
