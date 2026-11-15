// 둘러보기용 샘플 옷장 (사진 없이 실루엣으로 표시된다)

import { uid, ymd } from './util.js';

const A = ['봄', '여름', '가을', '겨울'];
const SAMPLE = [
  ['화이트 반팔 티셔츠', 'top', 'white', 1, ['봄', '여름', '가을'], 19000],
  ['스트라이프 긴팔 티', 'top', 'multi', 2, ['봄', '가을'], 32000],
  ['옥스퍼드 셔츠', 'top', 'blue', 2, ['봄', '가을'], 49000],
  ['그레이 맨투맨', 'top', 'gray', 3, ['봄', '가을', '겨울'], 45000],
  ['아이보리 케이블 니트', 'top', 'white', 4, ['가을', '겨울'], 69000],
  ['블랙 터틀넥 니트', 'top', 'black', 4, ['가을', '겨울'], 59000],
  ['린넨 반팔 셔츠', 'top', 'beige', 1, ['여름'], 42000],
  ['중청 데님 팬츠', 'bottom', 'denim', 3, A, 79000],
  ['블랙 슬랙스', 'bottom', 'black', 3, A, 55000],
  ['베이지 치노 팬츠', 'bottom', 'beige', 3, ['봄', '가을'], 49000],
  ['코듀로이 팬츠', 'bottom', 'brown', 4, ['가을', '겨울'], 62000],
  ['네이비 반바지', 'bottom', 'navy', 1, ['여름'], 35000],
  ['네이비 블레이저', 'outer', 'navy', 3, ['봄', '가을'], 129000],
  ['베이지 트렌치코트', 'outer', 'beige', 3, ['봄', '가을'], 189000],
  ['카키 야상 자켓', 'outer', 'khaki', 3, ['봄', '가을'], 99000],
  ['그레이 울 코트', 'outer', 'gray', 4, ['가을', '겨울'], 239000],
  ['블랙 숏패딩', 'outer', 'black', 5, ['겨울'], 199000],
  ['플로럴 원피스', 'dress', 'multi', 2, ['봄', '여름'], 89000],
  ['화이트 스니커즈', 'shoes', 'white', 3, A, 89000],
  ['블랙 로퍼', 'shoes', 'black', 3, A, 119000],
  ['브라운 첼시 부츠', 'shoes', 'brown', 4, ['가을', '겨울'], 149000],
  ['캔버스 에코백', 'bag', 'white', 3, A, 15000],
  ['블랙 크로스백', 'bag', 'black', 3, A, 79000],
  ['울 머플러', 'acc', 'red', 5, ['겨울'], 39000],
  ['네이비 볼캡 모자', 'acc', 'navy', 1, ['봄', '여름', '가을'], 29000],
];

export function buildSample() {
  const items = SAMPLE.map(([name, category, color, warmth, seasons, price], i) => ({
    id: uid() + i,
    name, category, color, warmth, seasons, price,
    brand: '', shop: '', boughtAt: '', memo: '', img: '', thumb: '',
    createdAt: Date.now() - i * 1000,
    demo: true,
  }));
  const by = (n) => items.find((x) => x.name === n).id;
  const looks = [
    ['그레이 맨투맨', '중청 데님 팬츠', '카키 야상 자켓', '화이트 스니커즈'],
    ['옥스퍼드 셔츠', '베이지 치노 팬츠', '네이비 블레이저', '블랙 로퍼'],
    ['블랙 터틀넥 니트', '블랙 슬랙스', '그레이 울 코트', '브라운 첼시 부츠'],
    ['스트라이프 긴팔 티', '중청 데님 팬츠', '베이지 트렌치코트', '화이트 스니커즈', '캔버스 에코백'],
    ['아이보리 케이블 니트', '코듀로이 팬츠', '그레이 울 코트', '브라운 첼시 부츠'],
  ];
  const logs = [];
  [2, 3, 5, 6, 9, 11, 12].forEach((ago, i) => {
    const d = new Date();
    d.setDate(d.getDate() - ago);
    logs.push({ date: ymd(d), itemIds: looks[i % looks.length].map(by), note: '', photo: '', demo: true });
  });
  return { items, logs };
}
