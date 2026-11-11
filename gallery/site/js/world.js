import * as THREE from '../vendor/three.module.min.js';
import { buildAvatar, makeNameLabel } from './avatars.js';

// 대형 전시홀 치수 (미터)
const AISLE = 11; // 전시벽 줄 사이 통로 폭
const SLOT = 4.4; // 작품 한 점이 차지하는 벽 길이
const ISL_GAP = 3.8; // 독립 전시벽 사이 통로
const END = 6; // 전시벽 끝과 홀 끝벽 사이 여유
const ISL_T = 0.5; // 독립 전시벽 두께
const H = 9; // 천장 높이
const ISL_H = 4.8; // 독립 전시벽 높이
const LOBBY = 16; // 입구 로비 깊이
const ART_Y = 2.5; // 작품 중심 높이
const ART_MAX_W = 3.6;
const ART_MAX_H = 2.8;
const PLAYER_R = 0.42;
const SPEED = 5.4;
const TURN = 1.9;
const CAM_BACK = 1.75;
const CAM_UP = 2.15;
const HIRES_DIST = 13;
const HIRES_MAX = 6;

const FONT = '"Pretendard", system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

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

// k번째 작품 칸의 z 좌표 (전시벽 하나에 2칸, 벽 사이에 통로)
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
    renderer.toneMappingExposure = 1.08;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14151a);
    this.scene.fog = new THREE.Fog(0xcdbb9c, 50, 190);
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.08, 220);

    // 반사용 환경맵 (밝은 천장 조명이 있는 단순한 방)
    const envScene = new THREE.Scene();
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(20, 10, 20),
      new THREE.MeshBasicMaterial({ color: 0x8a7a66, side: THREE.BackSide }),
    );
    envScene.add(shell);
    for (const x of [-5, 0, 5]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 14), new THREE.MeshBasicMaterial({ color: 0xfff0d0 }));
      lamp.position.set(x, 4.8, 0);
      envScene.add(lamp);
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(envScene, 0.03).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x9a8468, 1.7));
    const key = new THREE.DirectionalLight(0xffe9c4, 1.0);
    key.position.set(4, 10, 6);
    this.scene.add(key);

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
    this.props = []; // 벤치·화분: 이동만 막음
    this.bounds = { x0: -11, x1: 11, z0: -30, z1: LOBBY };
    this.title = '';
    this.layoutKey = '';

    this.geo = {
      plane: new THREE.PlaneGeometry(1, 1),
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
      leaf: new THREE.IcosahedronGeometry(1, 1),
    };

    // 벽은 바닥 아래로도 같은 높이만큼 이어 붙여, 광택 대리석 바닥에 비친 모습을 만든다.
    // 외벽: 아래쪽은 와인색 벨벳 패널, 금색 띠, 그 위는 아이보리 (세로 대칭 텍스처)
    const band = ISL_H / H / 2;
    const outerTex = canvasTexture(8, 1024, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h / 2);
      g.addColorStop(0, '#b9ab8f');
      g.addColorStop(0.25, '#f1e8d6');
      g.addColorStop(1 - band * 2 - 0.012, '#efe5d2');
      g.addColorStop(1 - band * 2 - 0.011, '#d9b45a');
      g.addColorStop(1 - band * 2, '#b8892f');
      g.addColorStop(1 - band * 2 + 0.001, '#7c1a2c');
      g.addColorStop(0.9, '#6a1424');
      g.addColorStop(1, '#3d0b15');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h / 2);
      ctx.save();
      ctx.translate(0, h);
      ctx.scale(1, -1);
      ctx.fillRect(0, 0, w, h / 2);
      ctx.restore();
    });
    const wineTex = canvasTexture(8, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#7c1a2c');
      g.addColorStop(0.4, '#6a1424');
      g.addColorStop(0.5, '#3d0b15');
      g.addColorStop(0.6, '#6a1424');
      g.addColorStop(1, '#7c1a2c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    // 대리석 바닥: 크림색과 베이지색 큰 타일 + 결
    const floorTex = canvasTexture(1024, 1024, (ctx, w, h) => {
      const rand = hashRand('marble');
      for (let ty = 0; ty < 2; ty++) {
        for (let tx = 0; tx < 2; tx++) {
          ctx.fillStyle = (tx + ty) % 2 ? '#d9cdb8' : '#f6f0e4';
          ctx.fillRect(tx * 512, ty * 512, 512, 512);
        }
      }
      for (let i = 0; i < 70; i++) {
        ctx.strokeStyle = `rgba(${120 + rand() * 60},${100 + rand() * 50},${80 + rand() * 40},${0.05 + rand() * 0.12})`;
        ctx.lineWidth = 1 + rand() * 3;
        ctx.beginPath();
        let x = rand() * w;
        let y = rand() * h;
        ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (rand() - 0.5) * 260;
          y += (rand() - 0.5) * 260;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(150,120,70,0.5)';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, 512, 512);
      ctx.strokeRect(512, 0, 512, 512);
      ctx.strokeRect(0, 512, 512, 512);
      ctx.strokeRect(512, 512, 512, 512);
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.anisotropy = 8;
    this.floorTex = floorTex;
    const carpetTex = canvasTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#8c1024';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c9a045';
      ctx.fillRect(10, 0, 8, h);
      ctx.fillRect(w - 18, 0, 8, h);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 400; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    });
    carpetTex.wrapT = THREE.RepeatWrapping;
    this.carpetTex = carpetTex;
    const radial = (stops) => canvasTexture(256, 256, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      stops.forEach(([o, c]) => g.addColorStop(o, c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    const glowTex = radial([[0, 'rgba(255,236,200,1)'], [0.45, 'rgba(255,226,180,0.5)'], [1, 'rgba(255,220,170,0)']]);
    const shadowTex = radial([[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]);
    const bulbTex = radial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,238,190,0.95)'], [1, 'rgba(255,200,110,0)']]);

    const gold = { color: 0xf0cc74, roughness: 0.32, metalness: 0.7, emissive: 0x5a3f10, envMapIntensity: 1.6 };
    this.mats = {
      wall: new THREE.MeshStandardMaterial({ map: outerTex, roughness: 0.9, envMapIntensity: 0.25 }),
      wine: new THREE.MeshStandardMaterial({ map: wineTex, roughness: 0.95, envMapIntensity: 0.15 }),
      marble: new THREE.MeshStandardMaterial({ color: 0xf3ecdc, roughness: 0.25, envMapIntensity: 0.9 }),
      floor: new THREE.MeshStandardMaterial({
        map: floorTex, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.8, envMapIntensity: 1.2,
      }),
      carpet: new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1, envMapIntensity: 0 }),
      ceil: new THREE.MeshBasicMaterial({ color: 0xcfc3aa }),
      beam: new THREE.MeshStandardMaterial({ color: 0xefe6d3, roughness: 0.6 }),
      gold: new THREE.MeshStandardMaterial(gold),
      frame: new THREE.MeshStandardMaterial({ ...gold, color: 0xe2b85c, roughness: 0.4 }),
      light: new THREE.MeshBasicMaterial({ color: 0xfff3d6, toneMapped: false }),
      glow: new THREE.MeshBasicMaterial({
        map: glowTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
      halo: new THREE.SpriteMaterial({
        map: glowTex, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
      bulbs: new THREE.PointsMaterial({
        map: bulbTex, size: 0.55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }),
      crystal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.3, envMapIntensity: 2.5 }),
      heart: new THREE.MeshBasicMaterial({ map: heartTexture(null), transparent: true, depthWrite: false, toneMapped: false }),
      shadow: new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
      velvet: new THREE.MeshStandardMaterial({ color: 0x8c1024, roughness: 0.95, envMapIntensity: 0.1 }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x3f8f58, roughness: 0.8, flatShading: true }),
      leaf2: new THREE.MeshStandardMaterial({ color: 0x2f7448, roughness: 0.8, flatShading: true }),
    };
    this.geo.torus = new THREE.TorusGeometry(1, 0.035, 10, 48);
    this.geo.octa = new THREE.OctahedronGeometry(1, 0);
    this.geo.colCyl = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
    // 샹들리에 전구 위치 (두 겹의 원)
    const pts = [];
    for (let i = 0; i < 14; i++) pts.push(Math.cos((i / 14) * Math.PI * 2) * 1.25, 0.12, Math.sin((i / 14) * Math.PI * 2) * 1.25);
    for (let i = 0; i < 8; i++) pts.push(Math.cos((i / 8) * Math.PI * 2) * 0.7, -0.5, Math.sin((i / 8) * Math.PI * 2) * 0.7);
    this.geo.bulbs = new THREE.BufferGeometry();
    this.geo.bulbs.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));

    this.me = { x: (Math.random() - 0.5) * 5, z: LOBBY - 4, yaw: 0, pitch: 0, moving: false, player: null };
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

  // 캐릭터 + 바닥 반사 + 그림자 + 이름표
  _makePlayer(avatar, name, self) {
    const group = new THREE.Group();
    const model = buildAvatar(avatar);
    const refl = model.clone();
    refl.scale.y = -1;
    const shadow = new THREE.Mesh(this.geo.plane, this.mats.shadow);
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

  setTitle(title) {
    if (title !== this.title) this.layoutKey = '';
    this.title = title;
  }

  // 입장할 때 로비 시작 위치로 되돌린다
  resetPose() {
    this.me.x = (Math.random() - 0.5) * 5;
    this.me.z = LOBBY - 4;
    this.me.yaw = 0;
    this.me.pitch = 0;
  }

  // 작품 목록 반영 (배치가 바뀌면 전시홀을 다시 짓는다)
  setArtworks(list, urlFor) {
    this.urlFor = urlFor;
    const n = Math.max(list.length, 1);
    const A = Math.max(3, Math.min(6, Math.round(Math.sqrt((n * 5.8) / (2 * AISLE)))));
    const K = Math.max(2, 2 * Math.ceil(n / (2 * A) / 2));
    const key = `${A}x${K}`;
    if (key !== this.layoutKey) {
      this.layoutKey = key;
      this._buildRoom(A, K);
    }
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
      const face = this.faces[i % this.faces.length];
      const z = slotZ(Math.floor(i / this.faces.length));
      const existing = this.arts.get(data.id);
      if (existing && existing.face === face && existing.z === z) {
        existing.data = data;
        if (existing.hearts !== data.hearts) this._buildStickers(existing, data.hearts);
        return;
      }
      if (existing) this._removeArt(data.id, existing);
      this._addArt(data, face, z);
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

  _block(x, z, hx, hz) {
    this.props.push({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz });
  }

  // 대리석 원기둥 + 금색 주두/주초
  _column(x, z, r = 0.55, top = H) {
    this._mesh(this.geo.colCyl, this.mats.marble, r, top * 2, r, x, 0, z);
    this._mirrored(this.geo.cyl, this.mats.gold, r * 1.22, 0.28, r * 1.22, x, top - 0.14, z);
    this._mirrored(this.geo.cyl, this.mats.gold, r * 1.1, 0.12, r * 1.1, x, top - 0.42, z);
    this._mesh(this.geo.cyl, this.mats.gold, r * 1.25, 0.36, r * 1.25, x, 0, z);
    this._block(x, z, r, r);
  }

  // 샹들리에: 금색 고리 두 겹 + 전구 + 크리스탈 + 빛무리
  _chandelier(x, z, scale = 1) {
    for (const s of [1, -1]) {
      const g = new THREE.Group();
      g.position.set(x, s * (H - 2.3 * scale), z);
      g.scale.set(scale, s * scale, scale);
      const ring = (r, y) => {
        const t = this._mesh(this.geo.torus, this.mats.gold, r, r, 1.6, 0, y, 0, g);
        t.rotation.x = Math.PI / 2;
      };
      ring(1.25, 0);
      ring(0.7, -0.62);
      this._mesh(this.geo.cyl, this.mats.gold, 0.03, 2.3, 0.03, 0, 1.15, 0, g);
      this._mesh(this.geo.octa, this.mats.crystal, 0.22, 0.45, 0.22, 0, -1.05, 0, g);
      g.add(new THREE.Points(this.geo.bulbs, this.mats.bulbs));
      if (s > 0) {
        const halo = new THREE.Sprite(this.mats.halo);
        halo.scale.set(6.5, 6.5, 1);
        halo.position.y = -0.2;
        g.add(halo);
      }
      this.room.add(g);
    }
  }

  // 벨벳 벤치
  _bench(x, z) {
    const L = 2.6;
    const D = 0.8;
    this._mirrored(this.geo.box, this.mats.velvet, L, 0.2, D, x, 0.43, z);
    this._mirrored(this.geo.box, this.mats.gold, L + 0.06, 0.06, D + 0.06, x, 0.31, z);
    for (const dx of [-L / 2 + 0.2, L / 2 - 0.2]) {
      this._mirrored(this.geo.box, this.mats.gold, 0.08, 0.3, D - 0.16, x + dx, 0.15, z);
    }
    this._block(x, z, L / 2, D / 2);
  }

  _plant(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const rand = hashRand(`plant${x.toFixed(1)}${z.toFixed(1)}`);
    for (const s of [1, -1]) {
      this._mesh(this.geo.cyl, this.mats.gold, 0.45, 0.85, 0.45, 0, s * 0.425, 0, g);
    }
    for (let i = 0; i < 7; i++) {
      const r = 0.42 + rand() * 0.32;
      const a = rand() * Math.PI * 2;
      const d = i === 0 ? 0 : 0.25 + rand() * 0.4;
      const y = 1.3 + rand() * 1.2;
      for (const s of [1, -1]) {
        const leaf = this._mesh(this.geo.leaf, i % 2 ? this.mats.leaf : this.mats.leaf2, r, r * 0.9, r,
          Math.cos(a) * d, s * y, Math.sin(a) * d, g);
        leaf.rotation.set(rand() * 3, rand() * 3, 0);
      }
    }
    this.room.add(g);
    this._block(x, z, 0.5, 0.5);
  }

  _carpet(x, z, w, len, alongX = false) {
    const m = new THREE.Mesh(this.geo.plane, this.mats.carpet.clone());
    m.material.map = this.carpetTex.clone();
    m.material.map.repeat.set(1, len / 1.5);
    m.material.map.needsUpdate = true;
    m.userData.ownTexture = true;
    m.rotation.x = -Math.PI / 2;
    if (alongX) m.rotation.z = Math.PI / 2;
    m.scale.set(w, len, 1);
    m.position.set(x, alongX ? 0.022 : 0.016, z);
    this.room.add(m);
  }

  _buildRoom(A, K) {
    this._clearRoom();
    const nIsl = K / 2;
    const W = A * AISLE;
    const Lg = END * 2 + nIsl * 2 * SLOT + (nIsl - 1) * ISL_GAP;
    const x0 = -W / 2;
    const x1 = W / 2;
    const z0 = -Lg;
    const z1 = LOBBY;
    const len = z1 - z0;
    const cz = (z0 + z1) / 2;
    this.bounds = { x0, x1, z0, z1 };
    this.walls = [];
    this.props = [];

    // 광택 대리석 바닥 (반투명: 아래쪽의 대칭 구조물이 비쳐 보인다)
    this.floorTex.repeat.set(W / 5, len / 5);
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

    // 외벽
    const T = 0.4;
    this._wall(T, len + T * 2, x0 - T / 2, cz);
    this._wall(T, len + T * 2, x1 + T / 2, cz);
    this._wall(W, T, 0, z0 - T / 2);
    this._wall(W, T, 0, z1 + T / 2);

    // 작품을 거는 벽면: 양쪽 외벽 + 통로 사이의 독립 전시벽(와인색) 양면
    const islZ = (j) => -(END + j * (2 * SLOT + ISL_GAP));
    this.faces = [{ x: x0, nx: 1 }];
    for (let i = 1; i < A; i++) {
      const px = x0 + i * AISLE;
      for (let j = 0; j < nIsl; j++) {
        const zA = islZ(j);
        const zB = zA - 2 * SLOT;
        const mid = (zA + zB) / 2;
        this._wall(ISL_T, zA - zB, px, mid, this.mats.wine, ISL_H);
        this._mirrored(this.geo.box, this.mats.gold, ISL_T + 0.16, 0.16, zA - zB + 0.16, px, ISL_H + 0.08, mid);
        this._mesh(this.geo.box, this.mats.gold, ISL_T + 0.08, 0.3, zA - zB + 0.08, px, 0, mid);
        this.walls.push({ x0: px - ISL_T / 2, x1: px + ISL_T / 2, z0: zB, z1: zA });
      }
      this.faces.push({ x: px - ISL_T / 2, nx: -1 }, { x: px + ISL_T / 2, nx: 1 });
    }
    this.faces.push({ x: x1, nx: -1 });

    // 외벽 벽기둥: 전시벽 구간 사이마다
    for (let j = 0; j <= nIsl; j++) {
      const pz = j === 0 ? islZ(0) + 0.9 : islZ(j - 1) - 2 * SLOT - (j === nIsl ? 0.9 : ISL_GAP / 2);
      for (const [wx, s] of [[x0, 1], [x1, -1]]) {
        this._mesh(this.geo.box, this.mats.marble, 0.3, H * 2, 0.9, wx + s * 0.15, 0, pz);
        this._mirrored(this.geo.box, this.mats.gold, 0.42, 0.3, 1.05, wx + s * 0.2, H - 0.15, pz);
        this._mesh(this.geo.box, this.mats.gold, 0.4, 0.5, 1.02, wx + s * 0.2, 0, pz);
      }
    }

    // 천장 격자 보 + 통로마다 샹들리에
    for (let i = 0; i <= A; i++) {
      this._mirrored(this.geo.box, this.mats.beam, 0.6, 0.5, len, x0 + i * AISLE, H - 0.25, cz);
    }
    const beamStep = (2 * SLOT + ISL_GAP);
    for (let z = z1; z > z0 - 1; z -= beamStep / 2) {
      this._mirrored(this.geo.box, this.mats.beam, W, 0.4, 0.5, 0, H - 0.2, z);
    }
    for (let i = 0; i < A; i++) {
      const ax = x0 + (i + 0.5) * AISLE;
      for (let j = 0; j < nIsl; j++) this._chandelier(ax, islZ(j) - SLOT);
      for (let j = 0; j < nIsl - 1; j += 1) this._chandelier(ax, islZ(j) - 2 * SLOT - ISL_GAP / 2, 0.6);
      // 레드카펫
      this._carpet(ax, (z0 + 1.5 + 2) / 2, 3.2, 2 - (z0 + 1.5));
    }
    this._carpet(0, 4.5, 3.2, W - 3, true);
    this._chandelier(0, LOBBY / 2 - 3, 0.9);
    if (A > 2) {
      this._chandelier(-W / 3, LOBBY / 2 - 2.5, 0.9);
      this._chandelier(W / 3, LOBBY / 2 - 2.5, 0.9);
    }

    // 로비와 전시홀 사이의 열주와 현판(엔타블러처)
    for (let i = 0; i <= A; i++) {
      const cx = x0 + i * AISLE + (i === 0 ? 0.9 : i === A ? -0.9 : 0);
      this._column(cx, 0, 0.6, H - 1.9);
    }
    this._mirrored(this.geo.box, this.mats.marble, W, 1.9, 1.5, 0, H - 0.95, 0);
    this._mirrored(this.geo.box, this.mats.gold, W, 0.12, 1.62, 0, H - 1.9, 0);
    const signW = Math.min(W - 4, 16);
    const signH = signW * (200 / 1792);
    const signY = H - 0.95;
    const title = this.title || '전시회';
    const signTex = canvasTexture(1792, 200, (ctx, w, h) => {
      ctx.fillStyle = '#4a0d18';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#d9b45a';
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      const g = ctx.createLinearGradient(0, 40, 0, h - 40);
      g.addColorStop(0, '#fff0bf');
      g.addColorStop(0.5, '#e2b85c');
      g.addColorStop(1, '#b9892f');
      ctx.fillStyle = g;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 104px ${FONT}`;
      ctx.fillText(fitText(ctx, title, w - 200), w / 2, h / 2 + 2);
    });
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false });
    for (const s of [1, -1]) {
      const sign = this._mesh(this.geo.plane, signMat, signW, signH, 1, 0, signY, s * 0.76);
      if (s < 0) sign.rotation.y = Math.PI;
      sign.userData.ownTexture = s > 0;
    }

    // 로비: 벨벳 벤치와 화분
    this._bench(-W / 4, z1 - 1.4);
    this._bench(W / 4, z1 - 1.4);
    for (const [px, pz] of [
      [x0 + 1.3, z1 - 1.3], [x1 - 1.3, z1 - 1.3], [x0 + 1.3, z0 + 1.3], [x1 - 1.3, z0 + 1.3],
    ]) this._plant(px, pz);
  }

  _addArt(data, face, z) {
    const aspect = Math.max(0.2, Math.min(5, (data.w || 1) / (data.h || 1)));
    let w = ART_MAX_W;
    let h = w / aspect;
    if (h > ART_MAX_H) {
      h = ART_MAX_H;
      w = h * aspect;
    }
    const group = new THREE.Group();
    group.position.set(face.x + face.nx * 0.005, 0, z);
    group.rotation.y = (face.nx * Math.PI) / 2;

    // 조명이 비친 벽면
    const glow = this._mesh(this.geo.plane, this.mats.glow, w + 3.0, h + 3.2, 1, 0, ART_Y + 0.3, 0.006, group);
    glow.renderOrder = 1;

    const picMat = new THREE.MeshBasicMaterial({ color: 0xd9d5ce, toneMapped: false });
    let picture;
    // 금색 액자 + 그림, 그리고 그 바닥 반사
    for (const s of [1, -1]) {
      const part = new THREE.Group();
      part.scale.y = s;
      this._mesh(this.geo.box, this.mats.frame, w + 0.3, h + 0.3, 0.1, 0, ART_Y, 0.05, part);
      const pic = this._mesh(this.geo.plane, picMat, w, h, 1, 0, ART_Y, 0.103, part);
      if (s > 0) picture = pic;
      group.add(part);
    }
    picture.userData.artId = data.id;

    // 제목/작가 명패
    const title = data.title || '무제';
    const author = data.author || '';
    const plateTex = canvasTexture(512, 144, (ctx, cw, ch) => {
      ctx.fillStyle = '#fdfcf9';
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = '#c9a045';
      ctx.fillRect(0, 0, 10, ch);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1b191d';
      ctx.font = `800 44px ${FONT}`;
      ctx.fillText(fitText(ctx, title, cw - 60), 36, author ? 50 : 72);
      if (author) {
        ctx.fillStyle = '#6f6972';
        ctx.font = `500 32px ${FONT}`;
        ctx.fillText(fitText(ctx, author, cw - 60), 36, 102);
      }
    });
    const plate = new THREE.Mesh(this.geo.plane, new THREE.MeshBasicMaterial({ map: plateTex, toneMapped: false }));
    plate.scale.set(1.24, 0.35, 1);
    plate.position.set(0, ART_Y - h / 2 - 0.5, 0.014);
    group.add(plate);

    const stickers = new THREE.Group();
    group.add(stickers);
    this.room.add(group);

    const art = {
      data, group, picture, picMat, plate, stickers, face, z, w, h,
      pos: new THREE.Vector3(face.x, ART_Y, z), hires: null, hiresLoading: false, hearts: -1,
    };
    this.arts.set(data.id, art);
    this.pickables.push(picture);
    this._buildStickers(art, data.hearts || 0);

    const cached = this.thumbTex.get(data.id);
    if (cached) {
      picMat.map = cached;
      picMat.color.set(0xffffff);
      picMat.needsUpdate = true;
    } else {
      this.loader.load(this.urlFor(data.thumb), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        this.thumbTex.set(data.id, tex);
        const cur = this.arts.get(data.id);
        if (cur && !cur.hires) {
          cur.picMat.map = tex;
          cur.picMat.color.set(0xffffff);
          cur.picMat.needsUpdate = true;
        }
      });
    }
  }

  _removeArt(id, art) {
    this.room.remove(art.group);
    this.pickables = this.pickables.filter((p) => p !== art.picture);
    if (art.hires) art.hires.dispose();
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
      const m = new THREE.Mesh(this.geo.plane, this.mats.heart);
      const s = 0.22 + rand() * 0.1;
      m.scale.set(s, s, 1);
      const t = rand();
      const side = Math.floor(rand() * 3); // 왼쪽, 오른쪽, 위
      let x;
      let y;
      if (side === 0) { x = -w / 2 - 0.12; y = ART_Y + (t - 0.5) * h; }
      else if (side === 1) { x = w / 2 + 0.12; y = ART_Y + (t - 0.3) * h * 0.8; }
      else { x = (t - 0.5) * w; y = ART_Y + h / 2 + 0.12; }
      m.position.set(x, y, 0.108 + i * 0.0008);
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
    badge.position.set(w / 2 + 0.1, ART_Y - h / 2 - 0.02, 0.125);
    badge.rotation.z = -0.15;
    badge.renderOrder = 3;
    art.stickers.add(badge);
  }

  // 가까운 작품만 고해상도 이미지로 교체
  _updateHires() {
    const near = [];
    for (const art of this.arts.values()) {
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
            art.picMat.color.set(0xffffff);
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
      const pz = z ?? LOBBY - 4;
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
      this.me.z = LOBBY - 4;
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
