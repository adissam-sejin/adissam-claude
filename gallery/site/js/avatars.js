import * as THREE from '../vendor/three.module.min.js';

// 캐릭터 = 동물 8종 × 색상 8가지 (예: "cat-3")
export const ANIMALS = [
  { id: 'bear', name: '곰' },
  { id: 'rabbit', name: '토끼' },
  { id: 'cat', name: '고양이' },
  { id: 'dog', name: '강아지' },
  { id: 'penguin', name: '펭귄' },
  { id: 'frog', name: '개구리' },
  { id: 'chick', name: '병아리' },
  { id: 'koala', name: '코알라' },
];

export const COLORS = [
  { name: '크림', hex: 0xf3dcb6 },
  { name: '코랄', hex: 0xff9478 },
  { name: '핑크', hex: 0xff9cc2 },
  { name: '라벤더', hex: 0xb39df2 },
  { name: '하늘', hex: 0x7fc4ff },
  { name: '민트', hex: 0x7fdcb6 },
  { name: '레몬', hex: 0xffd94d },
  { name: '초코', hex: 0x9c6b4e },
];

export function parseAvatar(value) {
  const [a, c] = String(value || '').split('-');
  const animal = ANIMALS.some((x) => x.id === a) ? a : ANIMALS[0].id;
  const color = Number.isInteger(+c) && +c >= 0 && +c < COLORS.length ? +c : 0;
  return { animal, color };
}

export const avatarId = (animal, color) => `${animal}-${color}`;

const sphere = new THREE.SphereGeometry(1, 32, 24);
const cone = new THREE.ConeGeometry(1, 1, 24);
const disc = new THREE.CircleGeometry(1, 24);

const matCache = new Map();
function mat(color, roughness = 0.55) {
  const key = `${color}:${roughness}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return matCache.get(key);
}
const tint = (hex, target, t) => new THREE.Color(hex).lerp(new THREE.Color(target), t).getHex();

function part(geo, material, sx, sy, sz, x, y, z, rx = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.rotation.set(rx, 0, rz);
  return m;
}

// 캐릭터 모델. 발이 y=0, 얼굴은 -Z 방향. 큰 머리 + 작은 몸의 2등신
export function buildAvatar(value) {
  const { animal, color } = parseAvatar(value);
  const base = COLORS[color].hex;
  const body = mat(base);
  const light = mat(tint(base, 0xffffff, 0.72));
  const shade = mat(tint(base, 0x3a2a2a, 0.3));
  const pink = mat(0xff9fb5);
  const white = mat(0xffffff, 0.4);
  const dark = mat(0x2a2230, 0.15);
  const orange = mat(0xffa23a);
  const g = new THREE.Group();
  const add = (...a) => g.add(part(...a));
  const HY = 1.0; // 머리 중심
  const both = (fn) => { fn(-1); fn(1); };

  // 몸, 팔, 다리
  add(sphere, body, 0.27, 0.3, 0.25, 0, 0.42, 0);
  both((s) => add(sphere, body, 0.1, 0.12, 0.13, s * 0.13, 0.11, -0.03));
  both((s) => add(sphere, body, 0.075, 0.16, 0.08, s * 0.29, 0.5, 0, 0, s * 0.55));
  // 머리
  add(sphere, body, 0.44, 0.4, 0.41, 0, HY, 0);

  // 눈(반짝이 포함), 볼터치
  const eyes = (x, y, z, s = 1) => both((sd) => {
    add(sphere, dark, 0.074 * s, 0.092 * s, 0.034, sd * x, y, z);
    add(sphere, white, 0.027 * s, 0.027 * s, 0.014, sd * x - 0.022, y + 0.034, z - 0.03);
    add(sphere, white, 0.013 * s, 0.013 * s, 0.01, sd * x + 0.026, y - 0.03, z - 0.028);
  });
  const blush = (x = 0.285, y = HY - 0.085, z = -0.305) => both((sd) => {
    const b = part(disc, pink, 0.062, 0.04, 1, sd * x, y, z);
    b.rotation.y = Math.PI + sd * -0.75;
    b.material = pinkFlat;
    g.add(b);
  });
  const belly = () => add(sphere, light, 0.19, 0.21, 0.08, 0, 0.4, -0.185);
  const muzzle = (noseScale = 1) => {
    add(sphere, light, 0.125, 0.09, 0.075, 0, HY - 0.085, -0.365);
    add(sphere, dark, 0.036 * noseScale, 0.026 * noseScale, 0.02, 0, HY - 0.05, -0.435);
  };

  switch (animal) {
    case 'bear':
      both((s) => {
        add(sphere, body, 0.14, 0.14, 0.08, s * 0.31, HY + 0.31, 0.02);
        add(sphere, pink, 0.08, 0.08, 0.03, s * 0.31, HY + 0.31, -0.045);
      });
      eyes(0.17, HY + 0.02, -0.375);
      muzzle();
      belly();
      add(sphere, body, 0.08, 0.08, 0.08, 0, 0.36, 0.25);
      blush();
      break;
    case 'rabbit':
      both((s) => {
        add(sphere, body, 0.09, 0.3, 0.06, s * 0.16, HY + 0.6, 0.03, 0, s * -0.12);
        add(sphere, pink, 0.045, 0.21, 0.02, s * 0.16, HY + 0.6, -0.02, 0, s * -0.12);
      });
      eyes(0.17, HY + 0.02, -0.375);
      add(sphere, light, 0.1, 0.07, 0.06, 0, HY - 0.085, -0.37);
      add(sphere, pink, 0.03, 0.022, 0.02, 0, HY - 0.055, -0.425);
      belly();
      add(sphere, white, 0.1, 0.1, 0.1, 0, 0.36, 0.27);
      blush();
      break;
    case 'cat':
      both((s) => {
        add(cone, body, 0.15, 0.24, 0.1, s * 0.26, HY + 0.39, 0.02, 0, s * -0.25);
        add(cone, pink, 0.085, 0.15, 0.04, s * 0.26, HY + 0.37, -0.035, 0, s * -0.25);
      });
      eyes(0.18, HY + 0.02, -0.37);
      add(sphere, light, 0.1, 0.07, 0.06, 0, HY - 0.09, -0.37);
      add(sphere, pink, 0.028, 0.02, 0.02, 0, HY - 0.06, -0.425);
      belly();
      add(sphere, body, 0.06, 0.26, 0.06, 0.1, 0.5, 0.3, 0.55, -0.3);
      blush();
      break;
    case 'dog':
      both((s) => add(sphere, shade, 0.1, 0.22, 0.14, s * 0.42, HY + 0.06, 0.02, 0, s * 0.2));
      eyes(0.17, HY + 0.02, -0.375);
      muzzle(1.25);
      add(sphere, pink, 0.035, 0.03, 0.012, 0, HY - 0.15, -0.425);
      belly();
      add(sphere, body, 0.05, 0.14, 0.05, 0, 0.5, 0.27, 0.7);
      blush();
      break;
    case 'penguin':
      add(sphere, white, 0.33, 0.29, 0.14, 0, HY - 0.03, -0.3);
      add(sphere, white, 0.21, 0.24, 0.1, 0, 0.4, -0.18);
      eyes(0.15, HY + 0.03, -0.425);
      add(cone, orange, 0.06, 0.13, 0.045, 0, HY - 0.06, -0.46, -Math.PI / 2);
      both((s) => add(sphere, orange, 0.1, 0.04, 0.15, s * 0.13, 0.04, -0.07));
      blush(0.25, HY - 0.09, -0.4);
      break;
    case 'frog':
      both((s) => {
        add(sphere, body, 0.14, 0.14, 0.14, s * 0.2, HY + 0.33, -0.08);
        add(sphere, white, 0.1, 0.1, 0.06, s * 0.2, HY + 0.34, -0.18);
        add(sphere, dark, 0.055, 0.065, 0.03, s * 0.2, HY + 0.34, -0.225);
        add(sphere, white, 0.02, 0.02, 0.012, s * 0.2 - 0.02, HY + 0.365, -0.25);
      });
      add(sphere, dark, 0.11, 0.012, 0.02, 0, HY - 0.08, -0.39);
      belly();
      blush(0.27, HY - 0.06, -0.32);
      break;
    case 'chick':
      eyes(0.17, HY + 0.03, -0.375);
      add(cone, orange, 0.065, 0.13, 0.05, 0, HY - 0.06, -0.44, -Math.PI / 2);
      add(sphere, body, 0.04, 0.11, 0.04, 0, HY + 0.44, 0);
      add(sphere, body, 0.035, 0.09, 0.035, 0.07, HY + 0.41, 0.01, 0, -0.5);
      add(sphere, body, 0.035, 0.09, 0.035, -0.07, HY + 0.41, 0.01, 0, 0.5);
      both((s) => add(sphere, orange, 0.09, 0.035, 0.13, s * 0.13, 0.035, -0.06));
      belly();
      blush();
      break;
    case 'koala':
      both((s) => {
        add(sphere, body, 0.2, 0.2, 0.1, s * 0.42, HY + 0.2, 0.03);
        add(sphere, light, 0.12, 0.12, 0.04, s * 0.42, HY + 0.2, -0.05);
      });
      eyes(0.19, HY + 0.03, -0.365);
      add(sphere, dark, 0.07, 0.095, 0.05, 0, HY - 0.05, -0.4);
      belly();
      blush(0.29, HY - 0.1, -0.3);
      break;
  }
  return g;
}

const pinkFlat = new THREE.MeshBasicMaterial({ color: 0xff8fae, transparent: true, opacity: 0.75 });

// 이름표 스프라이트
export function makeNameLabel(text, { self = false } = {}) {
  const font = '700 44px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const c = document.createElement('canvas');
  let ctx = c.getContext('2d');
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 52;
  c.width = w;
  c.height = 72;
  ctx = c.getContext('2d');
  ctx.fillStyle = self ? 'rgba(255,255,255,0.94)' : 'rgba(22,22,28,0.82)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 72, 36);
  ctx.fill();
  ctx.font = font;
  ctx.fillStyle = self ? '#1c1a20' : '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 38);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
  );
  const h = self ? 0.12 : 0.26;
  sprite.scale.set((w / 72) * h, h, 1);
  return sprite;
}

// 캐릭터 선택 화면용 미리보기 렌더러 (색을 바꿀 때마다 다시 그린다)
export class AvatarPreview {
  constructor(size = 200) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setSize(size, size);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb8a898, 2.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-1.5, 2.5, -3);
    this.scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
    this.camera.position.set(-0.75, 1.05, -3.25);
    this.camera.lookAt(0, 0.8, 0);
  }

  render(value) {
    const g = buildAvatar(value);
    this.scene.add(g);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.scene.remove(g);
    return url;
  }
}
