import * as THREE from '../vendor/three.module.min.js';

// 선택 가능한 캐릭터 목록
export const AVATARS = [
  { id: 'bear', name: '곰', body: 0x9a6b43, accent: 0xf1d9b5 },
  { id: 'rabbit', name: '토끼', body: 0xf4f1ee, accent: 0xf7a8b8 },
  { id: 'cat', name: '고양이', body: 0xf2a341, accent: 0xfff3dc },
  { id: 'fox', name: '여우', body: 0xe8662a, accent: 0xffffff },
  { id: 'penguin', name: '펭귄', body: 0x2d3440, accent: 0xffffff },
  { id: 'frog', name: '개구리', body: 0x62b84f, accent: 0xd9f2a6 },
  { id: 'chick', name: '병아리', body: 0xffd84a, accent: 0xff9a2e },
  { id: 'robot', name: '로봇', body: 0x9aa7b8, accent: 0x4fd1ff },
];

const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
const sphere = new THREE.SphereGeometry(1, 20, 14);
const cone = new THREE.ConeGeometry(1, 1, 14);
const box = new THREE.BoxGeometry(1, 1, 1);

function part(geo, material, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}

// 캐릭터 모델 생성. 발이 y=0, 얼굴은 -Z 방향, 키 약 1.6m
export function buildAvatar(id) {
  const def = AVATARS.find((a) => a.id === id) || AVATARS[0];
  const g = new THREE.Group();
  const body = mat(def.body);
  const accent = mat(def.accent);
  const dark = mat(0x1d1d22);
  const HY = 1.25; // 머리 중심 높이

  // 몸통, 배, 발
  g.add(part(sphere, body, 0.3, 0.42, 0.28, 0, 0.6, 0));
  g.add(part(sphere, accent, 0.2, 0.28, 0.1, 0, 0.58, -0.2));
  g.add(part(sphere, body, 0.11, 0.07, 0.15, -0.14, 0.07, -0.03));
  g.add(part(sphere, body, 0.11, 0.07, 0.15, 0.14, 0.07, -0.03));
  // 팔
  g.add(part(sphere, body, 0.08, 0.2, 0.08, -0.33, 0.66, 0));
  g.add(part(sphere, body, 0.08, 0.2, 0.08, 0.33, 0.66, 0));

  if (def.id === 'robot') {
    g.add(part(box, body, 0.6, 0.5, 0.52, 0, HY, 0));
    g.add(part(box, dark, 0.46, 0.2, 0.04, 0, HY + 0.02, -0.26));
    const glow = new THREE.MeshBasicMaterial({ color: def.accent });
    g.add(part(sphere, glow, 0.05, 0.05, 0.03, -0.11, HY + 0.02, -0.285));
    g.add(part(sphere, glow, 0.05, 0.05, 0.03, 0.11, HY + 0.02, -0.285));
    g.add(part(box, dark, 0.03, 0.2, 0.03, 0, HY + 0.34, 0));
    g.add(part(sphere, glow, 0.06, 0.06, 0.06, 0, HY + 0.46, 0));
    return g;
  }

  // 머리와 눈
  g.add(part(sphere, body, 0.34, 0.31, 0.32, 0, HY, 0));
  const eyeY = def.id === 'frog' ? HY + 0.27 : HY + 0.04;
  const eyeZ = def.id === 'frog' ? -0.16 : -0.29;
  if (def.id === 'frog') {
    g.add(part(sphere, body, 0.12, 0.12, 0.12, -0.17, HY + 0.24, -0.08));
    g.add(part(sphere, body, 0.12, 0.12, 0.12, 0.17, HY + 0.24, -0.08));
  }
  g.add(part(sphere, dark, 0.045, 0.055, 0.03, -0.13, eyeY, eyeZ));
  g.add(part(sphere, dark, 0.045, 0.055, 0.03, 0.13, eyeY, eyeZ));

  switch (def.id) {
    case 'bear':
      g.add(part(sphere, body, 0.12, 0.12, 0.06, -0.25, HY + 0.26, 0));
      g.add(part(sphere, body, 0.12, 0.12, 0.06, 0.25, HY + 0.26, 0));
      g.add(part(sphere, accent, 0.13, 0.1, 0.08, 0, HY - 0.08, -0.28));
      g.add(part(sphere, dark, 0.04, 0.03, 0.03, 0, HY - 0.04, -0.35));
      break;
    case 'rabbit':
      g.add(part(sphere, body, 0.07, 0.3, 0.05, -0.13, HY + 0.5, 0.02));
      g.add(part(sphere, body, 0.07, 0.3, 0.05, 0.13, HY + 0.5, 0.02));
      g.add(part(sphere, accent, 0.035, 0.2, 0.02, -0.13, HY + 0.5, -0.03));
      g.add(part(sphere, accent, 0.035, 0.2, 0.02, 0.13, HY + 0.5, -0.03));
      g.add(part(sphere, accent, 0.035, 0.03, 0.03, 0, HY - 0.05, -0.31));
      break;
    case 'cat':
    case 'fox': {
      const earH = def.id === 'fox' ? 0.3 : 0.22;
      g.add(part(cone, body, 0.11, earH, 0.07, -0.2, HY + 0.33, 0));
      g.add(part(cone, body, 0.11, earH, 0.07, 0.2, HY + 0.33, 0));
      g.add(part(sphere, accent, 0.14, 0.1, 0.09, 0, HY - 0.09, -0.27));
      g.add(part(sphere, dark, 0.035, 0.028, 0.03, 0, HY - 0.05, -0.36));
      const tail = part(sphere, def.id === 'fox' ? body : body, 0.09, 0.09, 0.26, 0, 0.42, 0.36);
      tail.rotation.x = -0.7;
      g.add(tail);
      break;
    }
    case 'penguin': {
      g.add(part(sphere, accent, 0.25, 0.22, 0.1, 0, HY - 0.03, -0.24));
      g.add(part(sphere, dark, 0.045, 0.055, 0.03, -0.11, HY + 0.04, -0.33));
      g.add(part(sphere, dark, 0.045, 0.055, 0.03, 0.11, HY + 0.04, -0.33));
      const beak = part(cone, mat(0xffa52e), 0.06, 0.14, 0.05, 0, HY - 0.06, -0.37);
      beak.rotation.x = -Math.PI / 2;
      g.add(beak);
      break;
    }
    case 'frog':
      g.add(part(sphere, dark, 0.14, 0.012, 0.03, 0, HY - 0.08, -0.29));
      break;
    case 'chick': {
      const beak = part(cone, accent, 0.06, 0.14, 0.05, 0, HY - 0.04, -0.34);
      beak.rotation.x = -Math.PI / 2;
      g.add(beak);
      g.add(part(sphere, accent, 0.03, 0.1, 0.03, 0, HY + 0.36, 0));
      g.add(part(sphere, accent, 0.03, 0.08, 0.03, 0.06, HY + 0.33, 0.02));
      break;
    }
  }
  return g;
}

// 이름표 스프라이트
export function makeNameLabel(text, { self = false } = {}) {
  const font = '600 44px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const c = document.createElement('canvas');
  let ctx = c.getContext('2d');
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 48;
  c.width = w;
  c.height = 72;
  ctx = c.getContext('2d');
  ctx.fillStyle = self ? 'rgba(232,120,60,0.92)' : 'rgba(20,20,26,0.78)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 72, 36);
  ctx.fill();
  ctx.font = font;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 38);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const h = self ? 0.11 : 0.24;
  sprite.scale.set((w / 72) * h, h, 1);
  return sprite;
}

// 캐릭터 선택 화면용 미리보기 이미지(dataURL) 생성
export function renderAvatarPreviews(size = 160) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f80, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(-1, 2, -3);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  cam.position.set(-1.1, 1.35, -3.6);
  cam.lookAt(0, 0.86, 0);
  const out = {};
  for (const a of AVATARS) {
    const g = buildAvatar(a.id);
    scene.add(g);
    renderer.render(scene, cam);
    out[a.id] = renderer.domElement.toDataURL('image/png');
    scene.remove(g);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}
