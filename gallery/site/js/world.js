import * as THREE from '../vendor/three.module.min.js';
import { buildAvatar, makeNameLabel } from './avatars.js';

const AISLE_W = 7; // 통로 폭
const SLOT_W = 3.1; // 작품 한 점이 차지하는 벽 길이
const WALL_H = 4.2;
const LOBBY = 8; // 입구 로비 깊이
const ART_Y = 2.05; // 작품 중심 높이
const ART_MAX_W = 2.3;
const ART_MAX_H = 2.0;
const PLAYER_R = 0.38;
const SPEED = 4.2;
const TURN = 1.9;
const CAM_BACK = 1.7;
const CAM_UP = 2.3;
const HIRES_DIST = 9;
const HIRES_MAX = 6;

const FONT = 'system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

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

export class World {
  constructor({ canvas, joystick, onPick }) {
    this.canvas = canvas;
    this.onPick = onPick;
    this.paused = false;
    this.running = false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe9e6e0);
    this.scene.fog = new THREE.Fog(0xe9e6e0, 30, 80);
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.08, 120);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xe6ddd0, 2.3));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xfff4e6, 0.9);
    sun.position.set(3, 8, 5);
    this.scene.add(sun);

    this.room = new THREE.Group();
    this.scene.add(this.room);
    this.players = new THREE.Group();
    this.scene.add(this.players);

    this.loader = new THREE.TextureLoader();
    this.loader.setCrossOrigin('anonymous');
    this.thumbTex = new Map(); // 작품 id -> 썸네일 텍스처
    this.arts = new Map(); // 작품 id -> { data, group, picture, stickers, pos, hires }
    this.pickables = [];
    this.walls = []; // 충돌용 사각형 {x0,x1,z0,z1}
    this.bounds = { x0: -5, x1: 5, z0: -10, z1: LOBBY };
    this.title = '';
    this.layoutKey = '';

    this.geo = {
      plane: new THREE.PlaneGeometry(1, 1),
      box: new THREE.BoxGeometry(1, 1, 1),
    };
    this.mats = {
      wall: new THREE.MeshStandardMaterial({ color: 0xf4f1eb, roughness: 0.95 }),
      ceil: new THREE.MeshBasicMaterial({ color: 0xf1eee8 }),
      frame: new THREE.MeshStandardMaterial({ color: 0x2a2623, roughness: 0.6 }),
      base: new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.8 }),
      light: new THREE.MeshBasicMaterial({ color: 0xfffdf5 }),
      blank: new THREE.MeshBasicMaterial({ color: 0xd8d4cd }),
      heart: new THREE.MeshBasicMaterial({ map: heartTexture(null), transparent: true, depthWrite: false }),
    };
    this.floorTex = canvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#b89268';
      ctx.fillRect(0, 0, w, h);
      for (let row = 0; row < 8; row++) {
        const off = (row % 2) * 128;
        for (let col = -1; col < 3; col++) {
          const shade = 150 + Math.floor(Math.random() * 40);
          ctx.fillStyle = `rgb(${shade + 30},${shade - 8},${shade - 50})`;
          ctx.fillRect(col * 256 + off + 1, row * 64 + 1, 254, 62);
        }
      }
    });
    this.floorTex.wrapS = this.floorTex.wrapT = THREE.RepeatWrapping;
    this.mats.floor = new THREE.MeshStandardMaterial({ map: this.floorTex, roughness: 0.7 });

    // 내 캐릭터
    this.me = { x: (Math.random() - 0.5) * 3, z: LOBBY - 2.5, yaw: 0, pitch: 0, moving: false, group: null };
    this.remotes = new Map();
    this.input = { keys: new Set(), joyX: 0, joyY: 0 };
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.hiresTimer = 0;

    this._bindControls(joystick);
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  // ───────────── 구성 ─────────────

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 70 : 65;
    this.camera.updateProjectionMatrix();
  }

  setSelf({ name, avatar }) {
    if (this.me.group) this.players.remove(this.me.group);
    const g = new THREE.Group();
    g.add(buildAvatar(avatar));
    const label = makeNameLabel(name, { self: true });
    label.position.y = 1.68;
    g.add(label);
    this.players.add(g);
    this.me.group = g;
  }

  setTitle(title) {
    this.title = title;
    this.layoutKey = '';
  }

  // 작품 목록 반영 (배치가 바뀌면 전시실을 다시 짓는다)
  setArtworks(list, urlFor) {
    this.urlFor = urlFor;
    const n = Math.max(list.length, 1);
    const A = Math.max(1, Math.min(6, Math.round(Math.sqrt((n * SLOT_W) / (2 * AISLE_W)))));
    const K = Math.max(2, Math.ceil(n / (2 * A)));
    const key = `${A}x${K}`;
    if (key !== this.layoutKey) {
      this.layoutKey = key;
      this._buildRoom(A, K);
    }
    // 사라진 작품 제거
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
    // 배치: 모든 벽면 앞쪽부터 고르게 채운다
    list.forEach((data, i) => {
      const face = this.faces[i % this.faces.length];
      const k = Math.floor(i / this.faces.length);
      const z = -(this.endGap + SLOT_W * (k + 0.5));
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

  _box(mat, sx, sy, sz, x, y, z) {
    const m = new THREE.Mesh(this.geo.box, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    this.room.add(m);
    return m;
  }

  _buildRoom(A, K) {
    this._clearRoom();
    const W = A * AISLE_W;
    const endGap = A > 1 ? 3.4 : 1.2;
    const Lg = K * SLOT_W + endGap * 2;
    this.endGap = endGap;
    const x0 = -W / 2;
    const x1 = W / 2;
    const z0 = -Lg;
    const z1 = LOBBY;
    const len = z1 - z0;
    const cz = (z0 + z1) / 2;
    this.bounds = { x0, x1, z0, z1 };
    this.walls = [];

    // 바닥, 천장
    this.floorTex.repeat.set(W / 4, len / 4);
    const floor = new THREE.Mesh(this.geo.plane, this.mats.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.scale.set(W, len, 1);
    floor.position.set(0, 0, cz);
    this.room.add(floor);
    const ceil = new THREE.Mesh(this.geo.plane, this.mats.ceil);
    ceil.rotation.x = Math.PI / 2;
    ceil.scale.set(W, len, 1);
    ceil.position.set(0, WALL_H, cz);
    this.room.add(ceil);

    // 외벽
    const T = 0.3;
    this._box(this.mats.wall, T, WALL_H, len + T * 2, x0 - T / 2, WALL_H / 2, cz);
    this._box(this.mats.wall, T, WALL_H, len + T * 2, x1 + T / 2, WALL_H / 2, cz);
    this._box(this.mats.wall, W, WALL_H, T, 0, WALL_H / 2, z0 - T / 2);
    this._box(this.mats.wall, W, WALL_H, T, 0, WALL_H / 2, z1 + T / 2);
    // 걸레받이
    this._box(this.mats.base, 0.04, 0.12, len, x0 + 0.02, 0.06, cz);
    this._box(this.mats.base, 0.04, 0.12, len, x1 - 0.02, 0.06, cz);

    // 작품을 거는 벽면 목록
    this.faces = [{ x: x0, nx: 1 }];
    for (let i = 1; i < A; i++) {
      const px = x0 + i * AISLE_W;
      const pz0 = -(Lg - endGap);
      const pz1 = -endGap;
      this._box(this.mats.wall, T, WALL_H, pz1 - pz0, px, WALL_H / 2, (pz0 + pz1) / 2);
      this._box(this.mats.base, T + 0.04, 0.12, pz1 - pz0 + 0.04, px, 0.06, (pz0 + pz1) / 2);
      this.walls.push({ x0: px - T / 2, x1: px + T / 2, z0: pz0, z1: pz1 });
      this.faces.push({ x: px - T / 2, nx: -1 }, { x: px + T / 2, nx: 1 });
    }
    this.faces.push({ x: x1, nx: -1 });

    // 천장 조명 띠
    for (let i = 0; i < A; i++) {
      const lx = x0 + (i + 0.5) * AISLE_W;
      this._box(this.mats.light, 0.5, 0.04, Lg - 1.5, lx, WALL_H - 0.03, -Lg / 2);
    }
    this._box(this.mats.light, Math.min(W - 2, 8), 0.04, 0.5, 0, WALL_H - 0.03, LOBBY / 2);

    // 입구 현판 (로비에서 전시실로 들어가는 문 위)
    const beamH = 1.1;
    this._box(this.mats.wall, W, beamH, T, 0, WALL_H - beamH / 2, 0);
    const signW = Math.min(W - 1, 9);
    const title = this.title || '전시회';
    const signTex = canvasTexture(1536, 160, (ctx, w, h) => {
      ctx.fillStyle = '#211e1c';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f4efe6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 84px ${FONT}`;
      ctx.fillText(fitText(ctx, title, w - 120), w / 2, h / 2 + 4);
    });
    const sign = new THREE.Mesh(this.geo.plane, new THREE.MeshBasicMaterial({ map: signTex }));
    sign.userData.ownTexture = true;
    sign.scale.set(signW, signW * (160 / 1536), 1);
    sign.position.set(0, WALL_H - beamH / 2, T / 2 + 0.01);
    this.room.add(sign);
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
    group.position.set(face.x + face.nx * 0.01, 0, z);
    group.rotation.y = (face.nx * Math.PI) / 2;

    const frame = new THREE.Mesh(this.geo.box, this.mats.frame);
    frame.scale.set(w + 0.14, h + 0.14, 0.06);
    frame.position.set(0, ART_Y, 0.03);
    group.add(frame);

    const picMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const picture = new THREE.Mesh(this.geo.plane, picMat);
    picture.scale.set(w, h, 1);
    picture.position.set(0, ART_Y, 0.065);
    picture.userData.artId = data.id;
    group.add(picture);

    // 제목/작가 명패
    const title = data.title || '무제';
    const author = data.author || '';
    const plateTex = canvasTexture(512, 128, (ctx, cw, ch) => {
      ctx.fillStyle = '#fffdf8';
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = '#d6cfc2';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, cw - 4, ch - 4);
      ctx.fillStyle = '#1e1b19';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 40px ${FONT}`;
      ctx.fillText(fitText(ctx, title, cw - 40), cw / 2, author ? 46 : 64);
      if (author) {
        ctx.fillStyle = '#6b645c';
        ctx.font = `500 30px ${FONT}`;
        ctx.fillText(fitText(ctx, author, cw - 40), cw / 2, 92);
      }
    });
    const plate = new THREE.Mesh(this.geo.plane, new THREE.MeshBasicMaterial({ map: plateTex }));
    plate.scale.set(0.84, 0.21, 1);
    plate.position.set(0, ART_Y - h / 2 - 0.32, 0.012);
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

    // 썸네일 텍스처
    const cached = this.thumbTex.get(data.id);
    if (cached) {
      picMat.map = cached;
      picMat.needsUpdate = true;
    } else {
      picMat.color.set(0xd8d4cd);
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
    const small = Math.min(count - 1, 16);
    for (let i = 0; i < small; i++) {
      const m = new THREE.Mesh(this.geo.plane, this.mats.heart);
      const s = 0.17 + rand() * 0.08;
      m.scale.set(s, s, 1);
      const t = rand();
      const side = Math.floor(rand() * 3); // 왼쪽, 오른쪽, 위
      let x;
      let y;
      if (side === 0) { x = -w / 2 - 0.05; y = ART_Y + (t - 0.5) * h; }
      else if (side === 1) { x = w / 2 + 0.05; y = ART_Y + (t - 0.3) * h * 0.8; }
      else { x = (t - 0.5) * w; y = ART_Y + h / 2 + 0.05; }
      m.position.set(x, y, 0.07 + i * 0.0006);
      m.rotation.z = (rand() - 0.5) * 0.9;
      art.stickers.add(m);
    }
    const badge = new THREE.Mesh(
      this.geo.plane,
      new THREE.MeshBasicMaterial({ map: heartTexture(count), transparent: true, depthWrite: false }),
    );
    badge.userData.ownTexture = true;
    badge.scale.set(0.42, 0.42, 1);
    badge.position.set(w / 2 + 0.02, ART_Y - h / 2 + 0.02, 0.085);
    badge.rotation.z = -0.15;
    art.stickers.add(badge);
  }

  // 가까운 작품만 고해상도 이미지로 교체
  _updateHires() {
    const near = [];
    for (const art of this.arts.values()) {
      const d = Math.hypot(art.pos.x - this.me.x, art.pos.z - this.me.z);
      near.push([d, art]);
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
            if (!this.arts.has(art.data.id) || this.arts.get(art.data.id) !== art) return tex.dispose();
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
      } else if (!want && art.hires && d > HIRES_DIST + 3) {
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
      const group = new THREE.Group();
      const model = buildAvatar(avatar);
      group.add(model);
      const label = makeNameLabel(name);
      label.position.y = 1.95;
      group.add(label);
      const px = x ?? 0;
      const pz = z ?? LOBBY - 2;
      group.position.set(px, 0, pz);
      group.rotation.y = ry ?? 0;
      this.players.add(group);
      r = { group, model, name, avatar, tx: px, tz: pz, try: ry ?? 0, phase: Math.random() * 6 };
      this.remotes.set(id, r);
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
    this.players.remove(r.group);
    r.group.traverse((o) => {
      if (o.isSprite) {
        o.material.map.dispose();
        o.material.dispose();
      }
    });
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
    this._onKey = (e) => {
      const k = map[e.code];
      if (!k) return;
      const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '');
      if (e.type === 'keydown') {
        if (this.paused || typing) return;
        keys.add(k);
        e.preventDefault();
      } else keys.delete(k);
    };
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKey);
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
        this.me.pitch = Math.max(-0.7, Math.min(0.7, this.me.pitch - dy * 0.004));
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
    if (!hit || hit.distance > 25) return;
    // 벽 뒤에 가려진 작품은 선택되지 않게 한다
    const p = hit.point;
    const o = this.camera.position;
    for (let t = 0.05; t < 0.95; t += 0.05) {
      if (this._blocked(o.x + (p.x - o.x) * t, o.z + (p.z - o.z) * t, 0)) return;
    }
    this.onPick?.(hit.object.userData.artId);
  }

  _blocked(x, z, r) {
    const b = this.bounds;
    if (x < b.x0 + r || x > b.x1 - r || z < b.z0 + r || z > b.z1 - r) return true;
    for (const w of this.walls) {
      if (x > w.x0 - r && x < w.x1 + r && z > w.z0 - r && z < w.z1 + r) return true;
    }
    return false;
  }

  _clampPlayer() {
    const b = this.bounds;
    this.me.x = Math.max(b.x0 + PLAYER_R, Math.min(b.x1 - PLAYER_R, this.me.x));
    this.me.z = Math.max(b.z0 + PLAYER_R, Math.min(b.z1 - PLAYER_R, this.me.z));
    if (this._blocked(this.me.x, this.me.z, PLAYER_R)) {
      this.me.x = 0;
      this.me.z = LOBBY - 2.5;
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
      if (!this._blocked(nx, me.z, PLAYER_R)) me.x = nx;
      if (!this._blocked(me.x, nz, PLAYER_R)) me.z = nz;
    }

    const now = performance.now() / 1000;
    if (me.group) {
      me.group.position.set(me.x, me.moving ? Math.abs(Math.sin(now * 9)) * 0.05 : 0, me.z);
      me.group.rotation.y = me.yaw;
    }

    // 카메라: 캐릭터 뒤쪽 위. 벽에 닿으면 가까이 당긴다
    let back = CAM_BACK;
    while (back > 0.15 && this._blocked(me.x + sin * back, me.z + cos * back, 0.2)) back -= 0.15;
    back = Math.max(back, 0);
    this._camBack = this._camBack == null ? back : this._camBack + (back - this._camBack) * Math.min(1, dt * 10);
    const cb = Math.min(this._camBack, back + 0.3);
    this.camera.position.set(me.x + sin * cb, CAM_UP, me.z + cos * cb);
    this.camera.rotation.set(me.pitch, me.yaw, 0, 'YXZ');
    if (me.group) me.group.visible = cb > 0.9;

    // 다른 관람객 보간
    for (const r of this.remotes.values()) {
      const p = r.group.position;
      const dx = r.tx - p.x;
      const dz = r.tz - p.z;
      const dist = Math.hypot(dx, dz);
      const a = Math.min(1, dt * 8);
      if (dist > 8) { p.x = r.tx; p.z = r.tz; } else { p.x += dx * a; p.z += dz * a; }
      let dy = r.try - r.group.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      r.group.rotation.y += dy * a;
      r.model.position.y = dist > 0.05 ? Math.abs(Math.sin(now * 9 + r.phase)) * 0.05 : 0;
    }

    this.hiresTimer -= dt;
    if (this.hiresTimer <= 0) {
      this.hiresTimer = 0.5;
      this._updateHires();
    }
    this.renderer.render(this.scene, this.camera);
  }
}
