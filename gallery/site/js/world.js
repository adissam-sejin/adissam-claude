import * as THREE from '../vendor/three.module.min.js';
import { buildAvatar, makeNameLabel } from './avatars.js';

// 전시실 치수 (미터)
const AISLE = 11; // 가벽 줄 사이 통로 폭
const SLOT = 4.4; // 작품 한 점이 차지하는 벽 길이
const ISL_GAP = 3.8; // 가벽 사이 통로
const END = 6; // 가벽 끝과 끝벽 사이 여유
const ISL_T = 0.5; // 가벽 두께
const ISL_H = 4.6; // 가벽 높이 (천장까지 닿지 않는다)
const H = 7.5; // 천장 높이
const LOBBY = 14; // 입구 공간 깊이
const ART_Y = 2.45; // 작품 중심 높이
const ART_MAX_W = 3.6;
const ART_MAX_H = 2.8;
const PLAYER_R = 0.42;
const SPEED = 5.4;
const TURN = 1.9;
const CAM_BACK = 1.75;
const CAM_UP = 2.25;
const HIRES_DIST = 13;
const HIRES_MAX = 6;

const FONT = '"Pretendard", system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

// 전시실 스타일 (관리자가 전시회마다 선택)
export const THEMES = {
  white: {
    name: '화이트 큐브', desc: '흰 벽 · 원목 바닥 · 천창',
    wall: '#fbfaf8', wallShade: '#c4c1bb', island: null, endWall: null,
    floor: 'wood', floorOpacity: 0.93, ceil: 0xf3f2ef, lights: 'skylight',
    frame: 0x1d1d1f, titleWall: '#1f1f21', titleText: '#ffffff',
    hemi: [0xffffff, 0xe2ddd4, 2.5], sun: 1.0, exposure: 1.22, fog: 0xf0eeea, glow: 0.2, bench: 0xb89264,
  },
  concrete: {
    name: '모던 콘크리트', desc: '흰 벽 · 광택 콘크리트 · 면조명',
    wall: '#f7f7f6', wallShade: '#b9babb', island: null, endWall: null,
    floor: 'concrete', floorOpacity: 0.72, ceil: 0xededec, lights: 'grid',
    frame: 0x151516, titleWall: '#f7f7f6', titleText: '#18181a',
    hemi: [0xffffff, 0xd9dadc, 2.4], sun: 0.9, exposure: 1.2, fog: 0xe9eaeb, glow: 0.16, bench: 0xf2f2f0,
  },
  warm: {
    name: '프라이빗 갤러리', desc: '따뜻한 베이지 · 석재 바닥 · 스포트 조명',
    wall: '#cdbda6', wallShade: '#5c5044', island: null, endWall: null,
    floor: 'stone', floorOpacity: 0.8, ceil: 0x7d7062, lights: 'track',
    frame: 0x121212, titleWall: '#3a3129', titleText: '#f1e6d4',
    hemi: [0xffe6c7, 0x5e5142, 0.85], sun: 0.3, exposure: 1.0, fog: 0x8e806e, glow: 0.8, bench: 0x4d3423,
  },
  accent: {
    name: '테라코타', desc: '오프화이트 + 테라코타 포인트 벽 · 트랙 조명',
    wall: '#efe9de', wallShade: '#a79e90', island: '#b4553a', endWall: '#b4553a',
    floor: 'concrete', floorTint: 0xe9dfd0, floorOpacity: 0.78, ceil: 0xe6dfd3, lights: 'track',
    frame: 0xb99365, titleWall: '#b4553a', titleText: '#fff3e6',
    hemi: [0xfff3e2, 0xc4b7a2, 2.0], sun: 0.8, exposure: 1.15, fog: 0xded5c7, glow: 0.36, bench: 0x7a4a2f,
  },
};

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function heartPath(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.8, cy - s * 1.15, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 0.8, cy - s * 1.15, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
  ctx.closePath();
}

// 하트 스티커 텍스처 (숫자가 있으면 하트 안에 표시)
function heartTexture(count) {
  return canvasTexture(128, 128, (ctx) => {
    heartPath(ctx, 64, 62, 50);
    ctx.fillStyle = '#fff';
    ctx.fill();
    heartPath(ctx, 64, 62, 42);
    ctx.fillStyle = '#ff3d6e';
    ctx.fill();
    if (count != null) {
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${count > 99 ? 34 : 44}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(count), 64, 54);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(44, 44, 9, 6, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function hashRand(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// 벽 텍스처: 바닥(가운데)과 천장 근처만 살짝 어둡게. 위아래 대칭이라 아래 절반이 바닥 반사가 된다
function wallTexture(color, shade) {
  const t = canvasTexture(8, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const stops = [[0, shade], [0.06, color], [0.47, color], [0.5, shade], [0.53, color], [0.94, color], [1, shade]];
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return t;
}

function floorTexture(kind) {
  const rand = hashRand(`floor-${kind}`);
  const t = canvasTexture(1024, 1024, (ctx, w, h) => {
    if (kind === 'wood') {
      // 밝은 원목 마루
      const rows = 12;
      const rh = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -rand() * 400;
        while (x < w) {
          const len = 300 + rand() * 300;
          const l = 66 + rand() * 9;
          ctx.fillStyle = `hsl(${30 + rand() * 5}, ${36 + rand() * 10}%, ${l}%)`;
          ctx.fillRect(x, r * rh, len, rh);
          ctx.fillStyle = 'rgba(90,60,30,0.05)';
          for (let k = 0; k < 5; k++) ctx.fillRect(x, r * rh + rand() * rh, len, 1);
          ctx.fillStyle = 'rgba(70,45,20,0.28)';
          ctx.fillRect(x + len - 1.5, r * rh, 1.5, rh);
          x += len;
        }
        ctx.fillStyle = 'rgba(70,45,20,0.22)';
        ctx.fillRect(0, r * rh, w, 1.5);
      }
    } else {
      const stone = kind === 'stone';
      ctx.fillStyle = stone ? '#8d8272' : '#c3c4c5';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        const r = 30 + rand() * 150;
        const x = rand() * w;
        const y = rand() * h;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const v = rand() > 0.5 ? 255 : 0;
        g.addColorStop(0, `rgba(${v},${v},${v},${0.02 + rand() * 0.035})`);
        g.addColorStop(1, `rgba(${v},${v},${v},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.strokeStyle = stone ? 'rgba(40,32,24,0.35)' : 'rgba(60,60,62,0.22)';
      ctx.lineWidth = 3;
      if (stone) {
        ctx.strokeRect(0, 0, w / 2, h / 2);
        ctx.strokeRect(w / 2, 0, w / 2, h / 2);
        ctx.strokeRect(0, h / 2, w / 2, h / 2);
        ctx.strokeRect(w / 2, h / 2, w / 2, h / 2);
      } else ctx.strokeRect(0, 0, w, h);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// k번째 작품 칸의 z 좌표 (가벽 하나에 2칸, 벽 사이에 통로)
const slotZ = (k) => -(END + Math.floor(k / 2) * (2 * SLOT + ISL_GAP) + ((k % 2) + 0.5) * SLOT);

export class World {
  constructor({ canvas, joystick, onPick }) {
    this.canvas = canvas;
    this.onPick = onPick;
    this.paused = false;
    this.running = false;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0eeea);
    this.scene.fog = new THREE.Fog(0xf0eeea, 55, 200);
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.08, 220);

    // 반사용 환경맵 (밝은 천장 조명이 있는 단순한 흰 방)
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(
      new THREE.BoxGeometry(20, 10, 20),
      new THREE.MeshBasicMaterial({ color: 0x9c9a96, side: THREE.BackSide }),
    ));
    for (const x of [-5, 0, 5]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      lamp.position.set(x, 4.8, 0);
      envScene.add(lamp);
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(envScene, 0.03).texture;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose();

    this.hemi = new THREE.HemisphereLight(0xffffff, 0xd6d0c6, 1.9);
    this.sun = new THREE.DirectionalLight(0xffffff, 0.9);
    this.sun.position.set(4, 10, 6);
    this.scene.add(this.hemi, this.sun);

    this.room = new THREE.Group();
    this.scene.add(this.room);
    this.players = new THREE.Group();
    this.scene.add(this.players);

    this.loader = new THREE.TextureLoader();
    this.loader.setCrossOrigin('anonymous');
    this.thumbTex = new Map(); // 작품 id -> 썸네일 텍스처
    this.arts = new Map(); // 작품 id -> 작품 객체
    this.pickables = [];
    this.walls = []; // 벽: 이동, 카메라, 시야를 모두 막음
    this.props = []; // 벤치: 이동만 막음
    this.bounds = { x0: -16, x1: 16, z0: -30, z1: LOBBY };
    this.title = '';
    this.subtitle = '';
    this.layoutKey = '';
    this.themeId = '';
    this.lobby = false; // 로비 모드: 정면 벽에 포스터를 나란히 건다

    this.geo = {
      plane: new THREE.PlaneGeometry(1, 1),
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
    };
    const radial = (stops) => canvasTexture(256, 256, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      stops.forEach(([o, c]) => g.addColorStop(o, c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    // 테마와 무관한 재질
    this.shared = {
      glowTex: radial([[0, 'rgba(255,246,228,1)'], [0.5, 'rgba(255,240,216,0.5)'], [1, 'rgba(255,236,205,0)']]),
      heart: new THREE.MeshBasicMaterial({ map: heartTexture(null), transparent: true, depthWrite: false, toneMapped: false }),
      shadow: new THREE.MeshBasicMaterial({
        map: radial([[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false,
      }),
      black: new THREE.MeshStandardMaterial({ color: 0x161617, roughness: 0.5 }),
      light: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    };
    this.mats = {};
    this.setTheme('white');

    this.me = { x: 0, z: LOBBY - 4, yaw: 0, pitch: 0, moving: false, player: null };
    this.remotes = new Map();
    this.input = { keys: new Set(), joyX: 0, joyY: 0 };
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.hiresTimer = 0;

    this._bindControls(joystick);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  // ───────────── 구성 ─────────────

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 72 : 62;
    this.camera.updateProjectionMatrix();
  }

  // 전시실 스타일 적용 (재질을 새로 만들고 다음 배치 때 방을 다시 짓는다)
  setTheme(id) {
    const key = THEMES[id] ? id : 'white';
    if (key === this.themeId) return;
    this.themeId = key;
    const t = THEMES[key];
    this.theme = t;
    for (const m of Object.values(this.mats)) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
    const shadeOf = (color) => `#${new THREE.Color(color).multiplyScalar(0.62).getHexString()}`;
    const wallMat = (color) => new THREE.MeshStandardMaterial({
      map: wallTexture(color, color === t.wall ? t.wallShade : shadeOf(color)), roughness: 0.95, envMapIntensity: 0.15,
    });
    this.mats = {
      wall: wallMat(t.wall),
      island: wallMat(t.island || t.wall),
      endWall: wallMat(t.endWall || t.wall),
      titleWall: wallMat(t.titleWall),
      floor: new THREE.MeshStandardMaterial({
        map: floorTexture(t.floor), color: t.floorTint || 0xffffff, roughness: t.floor === 'wood' ? 0.4 : 0.14,
        metalness: 0.04, transparent: true, opacity: t.floorOpacity, envMapIntensity: t.floor === 'wood' ? 0.5 : 1.1,
      }),
      ceil: new THREE.MeshBasicMaterial({ color: t.ceil }),
      beam: new THREE.MeshBasicMaterial({ color: new THREE.Color(t.ceil).multiplyScalar(0.93) }),
      frame: new THREE.MeshStandardMaterial({ color: t.frame, roughness: 0.55 }),
      bench: new THREE.MeshStandardMaterial({ color: t.bench, roughness: 0.6 }),
      glow: new THREE.MeshBasicMaterial({
        map: this.shared.glowTex, transparent: true, opacity: t.glow, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    };
    this.hemi.color.set(t.hemi[0]);
    this.hemi.groundColor.set(t.hemi[1]);
    this.hemi.intensity = t.hemi[2];
    this.sun.intensity = t.sun;
    this.renderer.toneMappingExposure = t.exposure;
    this.scene.background.set(t.fog);
    this.scene.fog.color.set(t.fog);
    this.layoutKey = '';
  }

  // 캐릭터 + 바닥 반사 + 그림자 + 이름표
  _makePlayer(avatar, name, self) {
    const group = new THREE.Group();
    const model = buildAvatar(avatar);
    const refl = model.clone();
    refl.scale.y = -1;
    const shadow = new THREE.Mesh(this.geo.plane, this.shared.shadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.1, 1.1, 1);
    shadow.position.y = 0.012;
    const label = makeNameLabel(name, { self });
    label.position.y = self ? 1.6 : 1.85;
    group.add(model, refl, shadow, label);
    this.players.add(group);
    return { group, model, refl, label };
  }

  _disposePlayer(p) {
    this.players.remove(p.group);
    p.label.material.map.dispose();
    p.label.material.dispose();
  }

  setSelf({ name, avatar }) {
    if (this.me.player) this._disposePlayer(this.me.player);
    this.me.player = this._makePlayer(avatar, name, true);
  }

  setTitle(title, subtitle = 'EXHIBITION') {
    if (title !== this.title || subtitle !== this.subtitle) this.layoutKey = '';
    this.title = title;
    this.subtitle = subtitle;
  }

  setLobby(on) {
    if (this.lobby !== on) this.layoutKey = '';
    this.lobby = on;
  }

  // 입장할 때 입구 시작 위치로 되돌린다
  resetPose() {
    this.me.x = (Math.random() - 0.5) * 4;
    this.me.z = LOBBY - 3;
    this.me.yaw = 0;
    this.me.pitch = 0;
  }

  // 작품 목록 반영 (배치가 바뀌면 전시실을 다시 짓는다)
  setArtworks(list, urlFor) {
    this.urlFor = urlFor;
    const n = Math.max(list.length, 1);
    this.itemCount = list.length;
    let key;
    if (this.lobby) {
      const rows = Math.max(1, Math.ceil(n / 6));
      key = `${this.themeId}:lobby${rows}`;
      if (key !== this.layoutKey) this._buildLobby(rows);
    } else {
      const A = Math.max(3, Math.min(6, Math.round(Math.sqrt((n * 5.8) / (2 * AISLE)))));
      const K = Math.max(2, 2 * Math.ceil(n / (2 * A) / 2));
      key = `${this.themeId}:${A}x${K}`;
      if (key !== this.layoutKey) this._buildRoom(A, K);
    }
    this.layoutKey = key;
    const ids = new Set(list.map((a) => a.id));
    for (const [id, art] of this.arts) {
      if (!ids.has(id)) this._removeArt(id, art);
    }
    for (const [id, tex] of this.thumbTex) {
      if (!ids.has(id)) {
        tex.dispose();
        this.thumbTex.delete(id);
      }
    }
    // 모든 벽면의 입구 쪽부터 고르게 채운다
    list.forEach((data, i) => {
      const at = this.placeAt(i);
      const existing = this.arts.get(data.id);
      if (existing && existing.at.key === at.key && existing.data.rev === data.rev) {
        existing.data = data;
        if (existing.hearts !== (data.hearts || 0)) this._buildStickers(existing, data.hearts || 0);
        return;
      }
      if (existing) this._removeArt(data.id, existing);
      this._addArt(data, at);
    });
    this._clampPlayer();
  }

  setHearts(id, count) {
    const art = this.arts.get(id);
    if (art) {
      art.data.hearts = count;
      this._buildStickers(art, count);
    }
  }

  _clearRoom() {
    for (const [id, art] of this.arts) this._removeArt(id, art);
    while (this.room.children.length) {
      const c = this.room.children.pop();
      c.traverse((o) => {
        if (o.userData.ownTexture && o.material?.map) {
          o.material.map.dispose();
          o.material.dispose();
        }
      });
    }
  }

  _mesh(geo, mat, sx, sy, sz, x, y, z, parent = this.room) {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // 바닥 위·아래 대칭인 벽 (아래쪽 절반이 바닥 반사 역할)
  _wall(sx, sz, x, z, mat = this.mats.wall, height = H) {
    return this._mesh(this.geo.box, mat, sx, height * 2, sz, x, 0, z);
  }

  // 위아래 대칭으로 한 쌍을 배치 (반사)
  _mirrored(geo, mat, sx, sy, sz, x, y, z, parent = this.room) {
    this._mesh(geo, mat, sx, sy, sz, x, y, z, parent);
    this._mesh(geo, mat, sx, sy, sz, x, -y, z, parent);
  }

  // 원목 블록 벤치
  _bench(x, z, alongZ) {
    const L = 2.6;
    const D = 0.7;
    this._mesh(this.geo.box, this.mats.bench, alongZ ? D : L, 0.9, alongZ ? L : D, x, 0, z);
    const hx = (alongZ ? D : L) / 2;
    const hz = (alongZ ? L : D) / 2;
    this.props.push({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz });
  }

  // 바닥·천장·외벽 (전시실과 로비 공통)
  _shell(W, z0) {
    const x0 = -W / 2;
    const x1 = W / 2;
    const z1 = LOBBY;
    const len = z1 - z0;
    const cz = (z0 + z1) / 2;
    this.bounds = { x0, x1, z0, z1 };
    this.walls = [];
    this.props = [];
    return { x0, x1, z1, len, cz };
  }

  // 1층 로비: 들어서면 정면 벽에 전시회 포스터가 나란히 걸려 있다
  _buildLobby(rows) {
    this._clearRoom();
    const W = 34;
    const ROW = 11;
    const wallW = 25;
    const wallH = 5.6;
    const z0 = -(rows * ROW + 4);
    const { x0, x1, len, cz } = this._shell(W, z0);
    this._floorAndWalls(W, z0, x0, x1, len, cz);
    const light = this.shared.light;
    for (const ax of [-W / 3, 0, W / 3]) {
      this._mirrored(this.geo.box, light, 3.4, 0.05, len - 5, ax, H - 0.03, cz);
      for (let z = LOBBY - 2.5; z > z0 + 2.5; z -= 4.4) {
        this._mirrored(this.geo.box, this.mats.beam, 3.6, 0.3, 0.12, ax, H - 0.15, z);
      }
    }
    const rowZ = (r) => -(1 + r * ROW);
    for (let r = 0; r < rows; r++) {
      const wz = rowZ(r);
      this._wall(wallW, 0.5, 0, wz, this.mats.island, wallH);
      this._mesh(this.geo.box, this.shared.black, wallW + 0.01, 0.16, 0.51, 0, 0, wz);
      this.walls.push({ x0: -wallW / 2, x1: wallW / 2, z0: wz - 0.25, z1: wz + 0.25 });
      this._bench(-wallW / 2 - 2.2, wz + 2, true);
      this._bench(wallW / 2 + 2.2, wz + 2, true);
    }
    // 첫 벽 위쪽의 안내 문구
    const titleTex = canvasTexture(2048, 160, (ctx, w, h) => {
      ctx.fillStyle = '#19191b';
      ctx.textBaseline = 'middle';
      ctx.font = `800 96px ${FONT}`;
      ctx.fillText(this.title || '전시 안내', 30, h / 2);
      const tw = ctx.measureText(this.title || '전시 안내').width;
      ctx.font = `600 40px ${FONT}`;
      ctx.globalAlpha = 0.6;
      ctx.fillText((this.subtitle || '').toUpperCase().split('').join('\u200a'), 30 + tw + 50, h / 2 + 8);
    });
    const sign = this._mesh(this.geo.plane, new THREE.MeshBasicMaterial({ map: titleTex, transparent: true, toneMapped: false }),
      wallW - 1.4, (wallW - 1.4) * (160 / 2048), 1, 0, 4.75, rowZ(0) + 0.256);
    sign.userData.ownTexture = true;
    sign.renderOrder = 1;
    this.placeAt = (i) => {
      const r = Math.floor(i / 6);
      const col = i % 6;
      const inRow = Math.min(6, this.itemCount - r * 6); // 줄마다 가운데 정렬
      const x = (col - (inRow - 1) / 2) * 3.9;
      return { x, z: rowZ(r) + 0.255, ry: 0, key: `L${r}:${x}`, maxH: 2.9 };
    };
  }

  _floorAndWalls(W, z0, x0, x1, len, cz) {
    const z1 = LOBBY;
    // 바닥 (반투명: 아래쪽의 대칭 구조물이 은은하게 비쳐 보인다)
    this.mats.floor.map.repeat.set(W / 4, len / 4);
    const floor = new THREE.Mesh(this.geo.plane, this.mats.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.scale.set(W, len, 1);
    floor.position.set(0, 0, cz);
    floor.renderOrder = -1;
    this.room.add(floor);
    // 천장 + 바닥 아래 대칭면
    for (const s of [1, -1]) {
      const c = new THREE.Mesh(this.geo.plane, this.mats.ceil);
      c.rotation.x = (s * Math.PI) / 2;
      c.scale.set(W, len, 1);
      c.position.set(0, s * H, cz);
      this.room.add(c);
    }
    // 외벽 + 바닥과 만나는 어두운 틈(걸레받이)
    const T = 0.4;
    this._wall(T, len + T * 2, x0 - T / 2, cz);
    this._wall(T, len + T * 2, x1 + T / 2, cz);
    this._wall(W, T, 0, z0 - T / 2, this.mats.endWall);
    this._wall(W, T, 0, z1 + T / 2);
    this._mesh(this.geo.box, this.shared.black, 0.03, 0.14, len, x0 + 0.015, 0, cz);
    this._mesh(this.geo.box, this.shared.black, 0.03, 0.14, len, x1 - 0.015, 0, cz);
    this._mesh(this.geo.box, this.shared.black, W, 0.14, 0.03, 0, 0, z0 + 0.015);
  }

  _buildRoom(A, K) {
    this._clearRoom();
    const t = this.theme;
    const nIsl = K / 2;
    const W = A * AISLE;
    const Lg = END * 2 + nIsl * 2 * SLOT + (nIsl - 1) * ISL_GAP;
    const z0 = -Lg;
    const { x0, x1, z1, len, cz } = this._shell(W, z0);
    this._floorAndWalls(W, z0, x0, x1, len, cz);

    // 작품을 거는 벽면: 양쪽 외벽 + 통로 사이의 독립 가벽 양면
    const islZ = (j) => -(END + j * (2 * SLOT + ISL_GAP));
    this.faces = [{ x: x0, nx: 1 }];
    for (let i = 1; i < A; i++) {
      const px = x0 + i * AISLE;
      for (let j = 0; j < nIsl; j++) {
        const zA = islZ(j);
        const zB = zA - 2 * SLOT;
        const mid = (zA + zB) / 2;
        this._wall(ISL_T, zA - zB, px, mid, this.mats.island, ISL_H);
        // 가벽 아래 그림자 틈
        this._mesh(this.geo.box, this.shared.black, ISL_T + 0.01, 0.16, zA - zB + 0.01, px, 0, mid);
        this.walls.push({ x0: px - ISL_T / 2, x1: px + ISL_T / 2, z0: zB, z1: zA });
      }
      this.faces.push({ x: px - ISL_T / 2, nx: -1 }, { x: px + ISL_T / 2, nx: 1 });
    }
    this.faces.push({ x: x1, nx: -1 });
    const faces = this.faces;
    this.placeAt = (i) => {
      const f = faces[i % faces.length];
      const k = Math.floor(i / faces.length);
      return { x: f.x + f.nx * 0.005, z: slotZ(k), ry: (f.nx * Math.PI) / 2, key: `${f.x}:${f.nx}:${k}` };
    };

    // 천장 조명
    const light = this.shared.light;
    for (let i = 0; i < A; i++) {
      const ax = x0 + (i + 0.5) * AISLE;
      if (t.lights === 'skylight') {
        // 통로를 따라 길게 난 천창
        this._mirrored(this.geo.box, light, 3.4, 0.05, len - 5, ax, H - 0.03, cz);
        this._mirrored(this.geo.box, this.mats.beam, 3.9, 0.5, 0.25, ax, H - 0.25, z1 - 2.5);
        for (let z = z1 - 2.5; z > z0 + 2.5; z -= 4.4) {
          this._mirrored(this.geo.box, this.mats.beam, 3.6, 0.3, 0.12, ax, H - 0.15, z);
        }
        for (const s of [-1, 1]) {
          this._mirrored(this.geo.box, this.mats.beam, 0.2, 0.55, len - 5, ax + s * 1.8, H - 0.27, cz);
        }
      } else if (t.lights === 'grid') {
        // 큰 사각 면조명 격자
        for (let z = z1 - 3.5; z > z0 + 3; z -= 6) {
          for (const s of [-1, 1]) this._mirrored(this.geo.box, light, 4.4, 0.05, 4.8, ax + s * 2.5, H - 0.03, z);
        }
      } else {
        // 검은 트랙 레일
        for (const s of [-1, 1]) {
          this._mirrored(this.geo.box, this.shared.black, 0.07, 0.07, len - 4, ax + s * 3.1, H - 0.4, cz);
        }
      }
    }
    if (t.lights === 'track') {
      // 벽 위쪽 간접조명 띠
      const cove = new THREE.MeshBasicMaterial({ color: 0xffe2b8, toneMapped: false });
      for (const [wx, s] of [[x0, 1], [x1, -1]]) {
        this._mirrored(this.geo.box, cove, 0.06, 0.08, len, wx + s * 0.03, H - 0.05, cz);
      }
      this._mirrored(this.geo.box, cove, W, 0.08, 0.06, 0, H - 0.05, z0 + 0.03);
    }

    // 벤치: 통로 가운데, 가벽 하나 건너 하나
    for (let i = 0; i < A; i++) {
      const bx = x0 + (i + 0.5) * AISLE;
      for (let j = 0; j < nIsl; j += 2) this._bench(bx, islZ(j) - SLOT, true);
    }

    // 입구의 전시 제목 벽 (입장하는 사람을 마주 본다)
    const tw = Math.min(W - 10, 11);
    const tz = 2.2;
    this._wall(tw, 0.5, 0, tz, this.mats.titleWall, ISL_H);
    this._mesh(this.geo.box, this.shared.black, tw + 0.01, 0.16, 0.51, 0, 0, tz);
    this.walls.push({ x0: -tw / 2, x1: tw / 2, z0: tz - 0.25, z1: tz + 0.25 });
    const title = this.title || '전시회';
    const sub = this.subtitle || '';
    const titleTex = canvasTexture(2048, 640, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = t.titleText;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `600 54px ${FONT}`;
      ctx.globalAlpha = 0.75;
      ctx.fillText(sub.toUpperCase().split('').join(' '), 60, 150);
      ctx.globalAlpha = 1;
      // 긴 제목은 두 줄로
      let size = 190;
      ctx.font = `800 ${size}px ${FONT}`;
      const lines = [];
      if (ctx.measureText(title).width > w - 120 && title.includes(' ')) {
        const words = title.split(' ');
        let line = '';
        for (const word of words) {
          const next = line ? `${line} ${word}` : word;
          if (ctx.measureText(next).width > w - 120 && line) {
            lines.push(line);
            line = word;
          } else line = next;
        }
        lines.push(line);
      } else lines.push(title);
      const shown = lines.slice(0, 2);
      if (shown.length === 2) size = 150;
      ctx.font = `800 ${size}px ${FONT}`;
      shown.forEach((l, i) => ctx.fillText(fitText(ctx, l, w - 120), 60, (shown.length === 2 ? 330 : 400) + i * (size + 24)));
      ctx.fillRect(60, h - 50, 220, 8);
    });
    const titleMat = new THREE.MeshBasicMaterial({ map: titleTex, transparent: true, toneMapped: false });
    const th = (tw - 0.6) * (640 / 2048);
    const sign = this._mesh(this.geo.plane, titleMat, tw - 0.6, th, 1, 0, 2.55, tz + 0.256);
    sign.userData.ownTexture = true;
    sign.renderOrder = 1;
    this._mesh(this.geo.plane, titleMat, tw - 0.6, -th, 1, 0, -2.55, tz + 0.256).material.side = THREE.DoubleSide;
  }

  _addArt(data, at) {
    const aspect = Math.max(0.2, Math.min(5, (data.w || 1) / (data.h || 1)));
    const maxH = at.maxH || ART_MAX_H;
    let w = ART_MAX_W;
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    const group = new THREE.Group();
    group.position.set(at.x, 0, at.z);
    group.rotation.y = at.ry;

    // 스포트 조명이 비친 벽면
    const glow = this._mesh(this.geo.plane, this.mats.glow, w + 3.2, h + 3.6, 1, 0, ART_Y + 0.35, 0.006, group);
    glow.renderOrder = 1;

    const picMat = new THREE.MeshBasicMaterial({ color: 0xdedbd5, toneMapped: false });
    let picture;
    // 얇은 액자 + 그림, 그리고 그 바닥 반사
    for (const s of [1, -1]) {
      const part = new THREE.Group();
      part.scale.y = s;
      this._mesh(this.geo.box, this.mats.frame, w + 0.1, h + 0.1, 0.07, 0, ART_Y, 0.035, part);
      const pic = this._mesh(this.geo.plane, picMat, w, h, 1, 0, ART_Y, 0.072, part);
      if (s > 0) picture = pic;
      group.add(part);
    }
    picture.userData.artId = data.id;

    // 트랙 조명 기구
    if (this.theme.lights === 'track') {
      const lamp = this._mesh(this.geo.cyl, this.shared.black, 0.09, 0.3, 0.09, 0, H - 0.6, 2.4, group);
      lamp.rotation.x = -0.6;
    }

    // 제목/작가 캡션
    const title = data.title || '무제';
    const author = data.author || '';
    const plateTex = canvasTexture(512, 144, (ctx, cw, ch) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#161618';
      ctx.font = `700 42px ${FONT}`;
      ctx.fillText(fitText(ctx, title, cw - 56), 28, author ? 50 : 72);
      if (author) {
        ctx.fillStyle = '#77747a';
        ctx.font = `500 30px ${FONT}`;
        ctx.fillText(fitText(ctx, author, cw - 56), 28, 102);
      }
    });
    const plate = new THREE.Mesh(this.geo.plane, new THREE.MeshBasicMaterial({ map: plateTex, toneMapped: false }));
    plate.scale.set(1.1, 0.31, 1);
    plate.position.set(0, ART_Y - h / 2 - 0.42, 0.012);
    group.add(plate);

    const stickers = new THREE.Group();
    group.add(stickers);
    this.room.add(group);

    const art = {
      data, group, picture, picMat, plate, stickers, at, w, h,
      pos: new THREE.Vector3(at.x, ART_Y, at.z), hires: null, hiresLoading: false, hearts: -1, ownTex: null,
    };
    this.arts.set(data.id, art);
    this.pickables.push(picture);
    this._buildStickers(art, data.hearts || 0);

    const tone = data.dim ? 0x6f6f6f : 0xffffff;
    const apply = (tex) => {
      picMat.map = tex;
      picMat.color.set(tone);
      picMat.needsUpdate = true;
    };
    if (data.canvas) {
      // 직접 그린 이미지(로비 포스터)
      const tex = new THREE.CanvasTexture(data.canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      art.ownTex = tex;
      apply(tex);
      return;
    }
    const cached = this.thumbTex.get(data.id);
    if (cached) apply(cached);
    else {
      this.loader.load(this.urlFor(data.thumb), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        this.thumbTex.set(data.id, tex);
        const cur = this.arts.get(data.id);
        if (cur && !cur.hires) {
          cur.picMat.map = tex;
          cur.picMat.color.set(cur.data.dim ? 0x6f6f6f : 0xffffff);
          cur.picMat.needsUpdate = true;
        }
      });
    }
  }

  _removeArt(id, art) {
    this.room.remove(art.group);
    this.pickables = this.pickables.filter((p) => p !== art.picture);
    if (art.hires) art.hires.dispose();
    if (art.ownTex) art.ownTex.dispose();
    art.plate.material.map.dispose();
    art.plate.material.dispose();
    art.picMat.dispose();
    this._disposeStickers(art);
    this.arts.delete(id);
  }

  _disposeStickers(art) {
    for (const c of [...art.stickers.children]) {
      art.stickers.remove(c);
      if (c.userData.ownTexture) {
        c.material.map.dispose();
        c.material.dispose();
      }
    }
  }

  // 하트 스티커: 액자 둘레에 붙이고, 오른쪽 아래에 개수 표시
  _buildStickers(art, count) {
    art.hearts = count;
    this._disposeStickers(art);
    if (!count) return;
    const { w, h } = art;
    const rand = hashRand(art.data.id);
    const small = Math.min(count - 1, 18);
    for (let i = 0; i < small; i++) {
      const m = new THREE.Mesh(this.geo.plane, this.shared.heart);
      const s = 0.22 + rand() * 0.1;
      m.scale.set(s, s, 1);
      const t = rand();
      const side = Math.floor(rand() * 3); // 왼쪽, 오른쪽, 위
      let x;
      let y;
      if (side === 0) { x = -w / 2 - 0.08; y = ART_Y + (t - 0.5) * h; }
      else if (side === 1) { x = w / 2 + 0.08; y = ART_Y + (t - 0.3) * h * 0.8; }
      else { x = (t - 0.5) * w; y = ART_Y + h / 2 + 0.08; }
      m.position.set(x, y, 0.078 + i * 0.0008);
      m.rotation.z = (rand() - 0.5) * 0.9;
      m.renderOrder = 2;
      art.stickers.add(m);
    }
    const badge = new THREE.Mesh(
      this.geo.plane,
      new THREE.MeshBasicMaterial({ map: heartTexture(count), transparent: true, depthWrite: false, toneMapped: false }),
    );
    badge.userData.ownTexture = true;
    badge.scale.set(0.56, 0.56, 1);
    badge.position.set(w / 2 + 0.06, ART_Y - h / 2 - 0.02, 0.096);
    badge.rotation.z = -0.15;
    badge.renderOrder = 3;
    art.stickers.add(badge);
  }

  // 가까운 작품만 고해상도 이미지로 교체
  _updateHires() {
    const near = [];
    for (const art of this.arts.values()) {
      if (!art.data.image) continue;
      near.push([Math.hypot(art.pos.x - this.me.x, art.pos.z - this.me.z), art]);
    }
    near.sort((a, b) => a[0] - b[0]);
    near.forEach(([d, art], i) => {
      const want = i < HIRES_MAX && d < HIRES_DIST;
      if (want && !art.hires && !art.hiresLoading) {
        art.hiresLoading = true;
        this.loader.load(
          this.urlFor(art.data.image),
          (tex) => {
            art.hiresLoading = false;
            if (this.arts.get(art.data.id) !== art) return tex.dispose();
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 8;
            art.hires = tex;
            art.picMat.map = tex;
            art.picMat.color.set(art.data.dim ? 0x6f6f6f : 0xffffff);
            art.picMat.needsUpdate = true;
          },
          undefined,
          () => { art.hiresLoading = false; },
        );
      } else if (!want && art.hires && d > HIRES_DIST + 4) {
        const thumb = this.thumbTex.get(art.data.id);
        if (thumb) {
          art.picMat.map = thumb;
          art.picMat.needsUpdate = true;
          art.hires.dispose();
          art.hires = null;
        }
      }
    });
  }

  // ───────────── 다른 관람객 ─────────────

  upsertRemote(id, { name, avatar, x, z, ry }) {
    let r = this.remotes.get(id);
    if (r && (r.name !== name || r.avatar !== avatar)) {
      this.removeRemote(id);
      r = null;
    }
    if (!r) {
      const p = this._makePlayer(avatar, name, false);
      const px = x ?? 0;
      const pz = z ?? LOBBY - 3;
      p.group.position.set(px, 0, pz);
      p.group.rotation.y = ry ?? 0;
      this.remotes.set(id, { ...p, name, avatar, tx: px, tz: pz, try: ry ?? 0, phase: Math.random() * 6 });
    }
  }

  moveRemote(id, { x, z, ry }) {
    const r = this.remotes.get(id);
    if (!r) return;
    r.tx = x;
    r.tz = z;
    r.try = ry;
  }

  removeRemote(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    this._disposePlayer(r);
    this.remotes.delete(id);
  }

  clearRemotes() {
    for (const id of [...this.remotes.keys()]) this.removeRemote(id);
  }

  getPose() {
    return { x: +this.me.x.toFixed(2), z: +this.me.z.toFixed(2), ry: +this.me.yaw.toFixed(2) };
  }

  // ───────────── 조작 ─────────────

  _bindControls(joy) {
    const keys = this.input.keys;
    const map = {
      KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
      KeyA: 'l', KeyD: 'r', ArrowLeft: 'tl', ArrowRight: 'tr', KeyQ: 'tl', KeyE: 'tr',
    };
    const onKey = (e) => {
      const k = map[e.code];
      if (!k) return;
      const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '');
      if (e.type === 'keydown') {
        if (this.paused || typing || !this.running) return;
        keys.add(k);
        e.preventDefault();
      } else keys.delete(k);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', () => keys.clear());

    // 화면 드래그로 둘러보기, 탭으로 작품 선택
    let look = null;
    const cv = this.canvas;
    cv.addEventListener('pointerdown', (e) => {
      if (look || this.paused) return;
      look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!look || e.pointerId !== look.id) return;
      const dx = e.clientX - look.x;
      const dy = e.clientY - look.y;
      look.x = e.clientX;
      look.y = e.clientY;
      if (Math.hypot(e.clientX - look.sx, e.clientY - look.sy) > 8) look.moved = true;
      if (look.moved) {
        this.me.yaw -= dx * 0.0055;
        this.me.pitch = Math.max(-0.7, Math.min(0.8, this.me.pitch - dy * 0.004));
      }
    });
    const end = (e) => {
      if (!look || e.pointerId !== look.id) return;
      const tap = !look.moved && performance.now() - look.t < 500;
      look = null;
      if (tap && e.type === 'pointerup' && !this.paused) this._pick(e.clientX, e.clientY);
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);

    // 가상 조이스틱 (터치 기기)
    if (joy) {
      const knob = joy.querySelector('.knob');
      let jid = null;
      const set = (e) => {
        const r = joy.getBoundingClientRect();
        const max = r.width / 2;
        let dx = e.clientX - (r.left + max);
        let dy = e.clientY - (r.top + max);
        const d = Math.hypot(dx, dy);
        if (d > max) { dx *= max / d; dy *= max / d; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.input.joyX = dx / max;
        this.input.joyY = dy / max;
      };
      const reset = (e) => {
        if (e.pointerId !== jid) return;
        jid = null;
        knob.style.transform = '';
        this.input.joyX = this.input.joyY = 0;
      };
      joy.addEventListener('pointerdown', (e) => {
        jid = e.pointerId;
        joy.setPointerCapture(jid);
        set(e);
        e.preventDefault();
      });
      joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) set(e); });
      joy.addEventListener('pointerup', reset);
      joy.addEventListener('pointercancel', reset);
    }
  }

  _pick(cx, cy) {
    const ndc = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    if (!hit || hit.distance > 40) return;
    // 벽 뒤에 가려진 작품은 선택되지 않게 한다
    const p = hit.point;
    const o = this.camera.position;
    for (let t = 0.04; t < 0.94; t += 0.03) {
      if (this._blocked(o.x + (p.x - o.x) * t, o.z + (p.z - o.z) * t, 0)) return;
    }
    this.onPick?.(hit.object.userData.artId);
  }

  _blocked(x, z, r, withProps = false) {
    const b = this.bounds;
    if (x < b.x0 + r || x > b.x1 - r || z < b.z0 + r || z > b.z1 - r) return true;
    for (const w of this.walls) {
      if (x > w.x0 - r && x < w.x1 + r && z > w.z0 - r && z < w.z1 + r) return true;
    }
    if (withProps) {
      for (const w of this.props) {
        if (x > w.x0 - r && x < w.x1 + r && z > w.z0 - r && z < w.z1 + r) return true;
      }
    }
    return false;
  }

  _clampPlayer() {
    const b = this.bounds;
    this.me.x = Math.max(b.x0 + PLAYER_R, Math.min(b.x1 - PLAYER_R, this.me.x));
    this.me.z = Math.max(b.z0 + PLAYER_R, Math.min(b.z1 - PLAYER_R, this.me.z));
    if (this._blocked(this.me.x, this.me.z, PLAYER_R, true)) {
      this.me.x = 0;
      this.me.z = LOBBY - 3;
    }
  }

  // ───────────── 루프 ─────────────

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  stop() {
    this.running = false;
    this.input.keys.clear();
    this.renderer.setAnimationLoop(null);
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const me = this.me;
    const k = this.input.keys;
    let fwd = 0;
    let strafe = 0;
    let turn = 0;
    if (!this.paused) {
      fwd = (k.has('f') ? 1 : 0) - (k.has('b') ? 1 : 0) - this.input.joyY;
      strafe = (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0);
      turn = (k.has('tl') ? 1 : 0) - (k.has('tr') ? 1 : 0) - this.input.joyX * 0.9;
    }
    fwd = Math.max(-1, Math.min(1, fwd));
    if (Math.abs(turn) > 0.12) me.yaw += turn * TURN * dt;

    const sin = Math.sin(me.yaw);
    const cos = Math.cos(me.yaw);
    // 전방 = (-sin, -cos), 오른쪽 = (cos, -sin)
    let vx = -sin * fwd + cos * strafe;
    let vz = -cos * fwd - sin * strafe;
    const vl = Math.hypot(vx, vz);
    me.moving = vl > 0.08;
    if (me.moving) {
      if (vl > 1) { vx /= vl; vz /= vl; }
      const nx = me.x + vx * SPEED * dt;
      const nz = me.z + vz * SPEED * dt;
      if (!this._blocked(nx, me.z, PLAYER_R, true)) me.x = nx;
      if (!this._blocked(me.x, nz, PLAYER_R, true)) me.z = nz;
    }

    const now = performance.now() / 1000;
    const bobOf = (moving, phase = 0) => (moving ? Math.abs(Math.sin(now * 9 + phase)) * 0.07 : 0);

    // 카메라: 캐릭터 뒤쪽 위. 벽에 닿으면 가까이 당긴다
    let back = CAM_BACK;
    while (back > 0.15 && this._blocked(me.x + sin * back, me.z + cos * back, 0.2)) back -= 0.15;
    back = Math.max(back, 0);
    this._camBack = this._camBack == null ? back : this._camBack + (back - this._camBack) * Math.min(1, dt * 10);
    const cb = Math.min(this._camBack, back + 0.3);
    this.camera.position.set(me.x + sin * cb, CAM_UP, me.z + cos * cb);
    this.camera.rotation.set(me.pitch, me.yaw, 0, 'YXZ');

    if (me.player) {
      const p = me.player;
      const bob = bobOf(me.moving);
      p.group.position.set(me.x, 0, me.z);
      p.group.rotation.y = me.yaw;
      p.model.position.y = bob;
      p.refl.position.y = -bob;
      p.group.visible = cb > 0.9;
    }

    // 다른 관람객 보간
    for (const r of this.remotes.values()) {
      const p = r.group.position;
      const dx = r.tx - p.x;
      const dz = r.tz - p.z;
      const dist = Math.hypot(dx, dz);
      const a = Math.min(1, dt * 8);
      if (dist > 10) { p.x = r.tx; p.z = r.tz; } else { p.x += dx * a; p.z += dz * a; }
      let dy = r.try - r.group.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      r.group.rotation.y += dy * a;
      const bob = bobOf(dist > 0.05, r.phase);
      r.model.position.y = bob;
      r.refl.position.y = -bob;
    }

    this.hiresTimer -= dt;
    if (this.hiresTimer <= 0) {
      this.hiresTimer = 0.5;
      this._updateHires();
    }
    this.renderer.render(this.scene, this.camera);
  }
}
