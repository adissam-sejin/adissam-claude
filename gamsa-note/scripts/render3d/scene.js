// 감사노트 3D 에셋 렌더러 (Three.js) — 투명 배경 PNG로 감/감나무를 굽는다.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- 유틸 ----------
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const reseed = (s) => (seed = s);

function noise3(x, y, z) {
  return (
    Math.sin(x * 2.1 + y * 1.3) * 0.5 +
    Math.sin(y * 2.7 + z * 1.9) * 0.3 +
    Math.sin(z * 3.3 + x * 2.3) * 0.2
  );
}

function lumpy(r, detail, amp, s = 0) {
  let g = new THREE.IcosahedronGeometry(r, detail);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = noise3(v.x * 2 + s, v.y * 2 + s * 0.7, v.z * 2 - s);
    v.multiplyScalar(1 + n * amp);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const mat = {
  persimmon: new THREE.MeshPhysicalMaterial({ color: "#f0600c", roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.25, sheenColor: new THREE.Color("#ff9a4a") }),
  calyx: new THREE.MeshStandardMaterial({ color: "#4f8a22", roughness: 0.55 }),
  stem: new THREE.MeshStandardMaterial({ color: "#6b4423", roughness: 0.8 }),
  bark: new THREE.MeshPhysicalMaterial({ color: "#9a6a43", roughness: 0.7, sheen: 0.3, sheenColor: new THREE.Color("#e0b088") }),
  soil: new THREE.MeshStandardMaterial({ color: "#a86b3c", roughness: 0.95 }),
  soilDark: new THREE.MeshStandardMaterial({ color: "#6e4428", roughness: 0.95 }),
  grass: new THREE.MeshStandardMaterial({ color: "#7cc24a", roughness: 0.85, side: THREE.DoubleSide }),
  sprout: new THREE.MeshPhysicalMaterial({ color: "#8cc65e", roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color("#e0ffc0") }),
  leaves: ["#7fb85a", "#74ad50", "#8cc466", "#79b354"].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.62, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color("#d8f5b0") })),
  pot: new THREE.MeshPhysicalMaterial({ color: "#d39056", roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color("#ffd2a0") }),
  potRim: new THREE.MeshPhysicalMaterial({ color: "#dfa067", roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color("#ffe0b8") }),
  eye: new THREE.MeshPhysicalMaterial({ color: "#1d1712", roughness: 0.15, clearcoat: 1 }),
  white: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
  mouth: new THREE.MeshStandardMaterial({ color: "#3a2116", roughness: 0.5 }),
  blush: new THREE.MeshStandardMaterial({ color: "#ff8f8f", roughness: 0.8, transparent: true, opacity: 0.55 }),
  stone: new THREE.MeshStandardMaterial({ color: "#c9c2b6", roughness: 0.9 }),
};

function shadowAll(o) {
  o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return o;
}

// ---------- 감 ----------
export function makePersimmon(withFace = false) {
  const g = new THREE.SphereGeometry(1, 128, 96);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const band = 1 - Math.abs(v.y);
    let r = 1 + 0.045 * Math.cos(4 * a) * band; // 네 갈래 굴곡
    v.x *= r; v.z *= r;
    v.y *= 0.8;
    if (v.y > 0.55) v.y -= (v.y - 0.55) * 0.55; // 꼭지 쪽 살짝 오목
    if (v.y < -0.6) v.y += (-0.6 - v.y) * 0.4; // 바닥 평평
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const group = new THREE.Group();
  group.add(new THREE.Mesh(g, mat.persimmon));

  // 꼭지 (네 장의 잎)
  const top = 0.6;
  for (let k = 0; k < 4; k++) {
    const leafG = new THREE.SphereGeometry(1, 32, 16);
    const lp = leafG.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      v.fromBufferAttribute(lp, i);
      const t = (v.x + 1) / 2; // 끝으로 갈수록 뾰족
      v.z *= 1 - t * 0.55;
      v.y += Math.sin(t * Math.PI) * 0.15 - t * 0.35; // 바깥쪽으로 처짐
      lp.setXYZ(i, v.x, v.y, v.z);
    }
    leafG.computeVertexNormals();
    const leaf = new THREE.Mesh(leafG, mat.calyx);
    leaf.scale.set(0.3, 0.09, 0.2);
    leaf.position.set(0.24, 0, 0);
    const pivot = new THREE.Group();
    pivot.add(leaf);
    pivot.position.y = top;
    pivot.rotation.y = (k * Math.PI) / 2 + Math.PI / 4;
    group.add(pivot);
  }
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 24), mat.calyx);
  disk.position.y = top + 0.02;
  group.add(disk);
  if (withFace) {
    const face = makeFace(1.35);
    face.position.set(0, -0.04, 1.0);
    face.rotation.x = 0.05;
    group.add(face);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.22, 16), mat.stem);
  stem.position.y = top + 0.14;
  stem.rotation.z = 0.15;
  group.add(stem);
  return shadowAll(group);
}

// ---------- 섬(바닥) ----------
function island(r = 1.6) {
  const g = new THREE.Group();
  const soil = new THREE.Mesh(lumpyCylinder(r * 0.96, r * 0.7, 0.55), mat.soil);
  soil.position.y = -0.3;
  g.add(soil);
  const grassTop = new THREE.Mesh(roundedDisk(r, 0.16), mat.grass);
  grassTop.position.y = -0.02;
  g.add(grassTop);
  // 돌멩이·풀
  reseed(42);
  for (let i = 0; i < 4; i++) {
    let a = rnd() * Math.PI * 2; const d = r * (0.55 + rnd() * 0.3);
    if (Math.sin(a) > 0.5) a += Math.PI; // 앞쪽(얼굴 앞)은 비움
    const s = new THREE.Mesh(lumpy(0.08 + rnd() * 0.06, 2, 0.15, i), mat.stone);
    s.scale.y = 0.6;
    s.position.set(Math.cos(a) * d, 0.08, Math.sin(a) * d);
    g.add(s);
  }
  for (let i = 0; i < 7; i++) {
    let a = rnd() * Math.PI * 2; const d = r * (0.45 + rnd() * 0.45);
    if (Math.sin(a) > 0.45 && Math.abs(Math.cos(a)) < 0.6) a += Math.PI;
    const tuft = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 6), mat.sprout);
      b.rotation.z = (j - 1) * 0.35;
      b.position.x = (j - 1) * 0.03;
      b.position.y = 0.09;
      tuft.add(b);
    }
    tuft.position.set(Math.cos(a) * d, 0.06, Math.sin(a) * d);
    tuft.rotation.y = rnd() * 3;
    g.add(tuft);
  }
  return shadowAll(g);
}

function lumpyCylinder(rt, rb, h) {
  const g = new THREE.CylinderGeometry(rt, rb, h, 64, 6);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const k = 1 + Math.sin(a * 5) * 0.025 + Math.sin(a * 11 + v.y * 4) * 0.02;
    v.x *= k; v.z *= k;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function roundedDisk(r, h) {
  const pts = [];
  const bevel = h * 0.9;
  pts.push(new THREE.Vector2(0, h / 2));
  for (let i = 0; i <= 10; i++) {
    const t = (i / 10) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - bevel + Math.sin(t) * bevel, h / 2 - bevel + Math.cos(t) * bevel));
  }
  pts.push(new THREE.Vector2(r, -h / 2));
  pts.push(new THREE.Vector2(0, -h / 2));
  const g = new THREE.LatheGeometry(pts, 72);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const k = 1 + Math.sin(a * 5) * 0.025 + Math.sin(a * 9) * 0.015;
    v.x *= k; v.z *= k;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}


// ---------- 귀여운 얼굴 ----------
// surfaceZ: 얼굴이 붙을 표면까지의 z, size: 얼굴 크기
export function makeFace(size = 1) {
  const g = new THREE.Group();
  const eyeG = new THREE.SphereGeometry(0.075 * size, 32, 24);
  [-1, 1].forEach((sd) => {
    const e = new THREE.Mesh(eyeG, mat.eye);
    e.scale.set(1, 1.15, 0.6);
    e.position.set(sd * 0.21 * size, 0.05 * size, 0);
    g.add(e);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.022 * size, 12, 8), mat.white);
    hl.position.set(sd * 0.21 * size + 0.025 * size, 0.085 * size, 0.04 * size);
    g.add(hl);
    const bl = new THREE.Mesh(new THREE.SphereGeometry(0.075 * size, 24, 16), mat.blush);
    bl.scale.set(1.3, 0.75, 0.25);
    bl.position.set(sd * 0.36 * size, -0.07 * size, -0.01 * size);
    g.add(bl);
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.075 * size, 0.017 * size, 12, 32, Math.PI), mat.mouth);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.03 * size, 0.03 * size);
  g.add(smile);
  return g;
}

// ---------- 화분 ----------
const POT_H = 1.05;
function pot() {
  const g = new THREE.Group();
  // 몸통: 아래로 좁아지는 화분 + 세로 홈
  const prof = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * 0.82;
    let r = 0.6 + t * 0.2;
    if (t < 0.08) r -= (0.08 - t) * 1.2; // 바닥 라운드
    prof.push(new THREE.Vector2(r, y));
  }
  prof.unshift(new THREE.Vector2(0, 0));
  const body = new THREE.LatheGeometry(prof, 128);
  const p = body.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const r = Math.hypot(v.x, v.z);
    if (r > 0.01) {
      const k = 1 - 0.022 * Math.pow(Math.max(0, Math.cos(a * 20)), 6); // 홈
      v.x *= k; v.z *= k;
    }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  body.computeVertexNormals();
  g.add(new THREE.Mesh(body, mat.pot));
  // 테두리
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.11, 32, 128), mat.potRim);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.86;
  rim.scale.z = 1.5;
  g.add(rim);
  const rimBand = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.86, 0.22, 128, 1, true), mat.potRim);
  rimBand.position.y = 0.88;
  g.add(rimBand);
  const rimTop = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.06, 24, 128), mat.potRim);
  rimTop.rotation.x = Math.PI / 2;
  rimTop.position.y = 0.99;
  g.add(rimTop);
  // 흙
  const soil = new THREE.Mesh(lumpy(0.82, 4, 0.04, 9), mat.soilDark);
  soil.scale.set(1, 0.12, 1);
  soil.position.y = 0.94;
  g.add(soil);
  // 얼굴 (화분 앞면)
  const face = makeFace(1.25);
  face.position.set(0, 0.5, 0.735);
  face.rotation.x = -0.22;
  g.add(face);
  return shadowAll(g);
}

// ---------- 나무 부품 ----------
function leaf(len, w, m = mat.sprout) {
  const g = new THREE.SphereGeometry(1, 32, 16);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = (v.x + 1) / 2;
    v.z *= Math.sin(Math.max(0.0001, t) * Math.PI) ** 0.7;
    v.y += Math.sin(t * Math.PI) * 0.35;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m);
  mesh.scale.set(len / 2, 0.05, w / 2);
  mesh.position.x = len / 2;
  const pivot = new THREE.Group();
  pivot.add(mesh);
  return pivot;
}

function stemTube(points, r0, r1, m) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, 40, 1, 16, false);
  // 반지름 테이퍼
  const p = g.attributes.position, v = new THREE.Vector3();
  const segs = 41, radial = 17;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const c = curve.getPointAt(t);
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j < radial; j++) {
      const idx = i * radial + j;
      v.fromBufferAttribute(p, idx).sub(c).multiplyScalar(r).add(c);
      p.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r1, 12, 8), m);
  cap.position.copy(curve.getPointAt(1));
  const grp = new THREE.Group();
  grp.add(mesh, cap);
  return grp;
}

function canopy(blobs, s) {
  const g = new THREE.Group();
  blobs.forEach(([x, y, z, r], i) => {
    const m = new THREE.Mesh(lumpy(r, 5, 0.07, s + i * 1.7), mat.leaves[i % mat.leaves.length]);
    m.position.set(x, y, z);
    m.userData.blob = true;
    g.add(m);
  });
  return g;
}

const FULL_BLOBS = [
  [0, 2.75, 0, 0.95], [-0.85, 2.35, 0.15, 0.72], [0.85, 2.4, 0.1, 0.75],
  [-0.45, 3.25, -0.1, 0.68], [0.5, 3.3, -0.05, 0.66], [0, 2.3, 0.6, 0.7],
  [-0.65, 2.65, 0.55, 0.55], [0.7, 2.75, 0.55, 0.55], [0, 3.55, 0.15, 0.5],
  [-1.25, 2.6, -0.2, 0.45], [1.25, 2.65, -0.25, 0.45],
];

export function makeTree(stage) {
  const root = new THREE.Group();
  root.add(island(stage >= 5 ? 1.8 : stage >= 3 ? 1.6 : 1.45));
  const plant = new THREE.Group();
  plant.position.y = 0.04;
  root.add(plant);
  const add = (...o) => plant.add(...o);
  const putFace = (size, x, y, z, tilt = 0) => {
    const f = makeFace(size);
    f.position.set(x, y, z);
    f.rotation.x = tilt;
    f.name = "face";
    add(f);
  };

  if (stage <= 2) {
    // 얼굴이 있는 흙 둔덕에서 싹이 남
    const mound = new THREE.Mesh(lumpy(0.62, 4, 0.05, 5), mat.soil);
    mound.scale.set(1, 0.55, 0.9);
    add(mound);
    putFace(0.95, 0, 0.13, 0.555, -0.5);
    const top = 0.32;
    if (stage === 0) {
      const seedM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), mat.stem);
      seedM.scale.set(1, 0.7, 0.75);
      seedM.position.set(0.05, top + 0.02, -0.05);
      seedM.rotation.z = 0.6;
      add(seedM);
    } else if (stage === 1) {
      add(stemTube([[0, top - 0.05, -0.05], [0.02, top + 0.25, -0.05], [-0.01, top + 0.5, -0.05]], 0.035, 0.03, mat.sprout));
      const l1 = leaf(0.42, 0.24); l1.position.set(-0.01, top + 0.5, -0.05); l1.rotation.set(0, 0.2, 0.55);
      const l2 = leaf(0.42, 0.24); l2.position.set(-0.01, top + 0.5, -0.05); l2.rotation.set(0, Math.PI + 0.2, 0.55);
      add(l1, l2);
    } else {
      add(stemTube([[0, top - 0.05, -0.05], [0.05, top + 0.5, -0.05], [-0.03, top + 1.05, -0.05]], 0.05, 0.035, mat.sprout));
      [[0.4, 0.4, 0.4], [0.65, 2.2, 0.45], [1.05, 1.0, 0.35], [1.05, 4.1, 0.38]].forEach(([y, ry, len], i) => {
        const l = leaf(len + 0.1, 0.26); l.position.set(0.02, top + y, -0.05); l.rotation.set(0, ry, 0.5 + (i % 2) * 0.1);
        add(l);
      });
    }
  } else {
    const roots = new THREE.Mesh(lumpy(0.5, 3, 0.08, 3), mat.soilDark);
    roots.scale.set(1, 0.18, 1);
    add(roots);
    const H = { 3: 1.25, 4: 1.85, 5: 2.3 }[stage];
    const R0 = { 3: 0.09, 4: 0.15, 5: 0.25 }[stage];
    add(stemTube([[0, 0, 0], [0.05, H * 0.5, 0.02], [-0.03, H, 0]], R0, R0 * 0.55, mat.bark));
    if (stage >= 4) {
      add(stemTube([[0.02, H * 0.6, 0], [0.4, H * 0.82, 0.05], [0.65, H * 0.98, 0.1]], R0 * 0.45, R0 * 0.25, mat.bark));
      add(stemTube([[0, H * 0.55, 0], [-0.4, H * 0.78, 0.02], [-0.7, H * 0.92, 0.05]], R0 * 0.45, R0 * 0.25, mat.bark));
    }
    if (stage === 3) {
      add(canopy([[0, 1.55, 0, 0.55], [-0.4, 1.4, -0.1, 0.36], [0.4, 1.42, -0.1, 0.38], [0, 1.95, -0.1, 0.34]], 11));
      putFace(0.62, 0, 1.5, 0.57, -0.1);
    } else if (stage === 4) {
      add(canopy([[0, 2.2, 0, 0.72], [-0.65, 1.95, 0.1, 0.52], [0.65, 2.0, 0.05, 0.54], [-0.3, 2.6, -0.05, 0.5], [0.35, 2.62, 0, 0.48], [0, 1.85, 0.45, 0.5]], 21));
      putFace(0.8, 0, 1.86, 0.97, -0.05);
    } else {
      const c = canopy(FULL_BLOBS, 31);
      c.name = "canopy";
      add(c);
      putFace(1.05, 0, 2.3, 1.33, -0.05);
    }
  }
  return shadowAll(root);
}

// ---------- 장면 & 카메라 ----------
function scene(obj) {
  const s = new THREE.Scene();
  s.environment = envTex;
  s.environmentIntensity = 0.35;
  const hemi = new THREE.HemisphereLight("#fff6e8", "#6a8a4a", 0.7);
  s.add(hemi);
  const key = new THREE.DirectionalLight("#fff1dc", 2.6);
  key.position.set(3.5, 6, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -4; key.shadow.camera.right = 4;
  key.shadow.camera.top = 6; key.shadow.camera.bottom = -2;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.05;
  s.add(key);
  const rim = new THREE.DirectionalLight("#ffd9b0", 0.8);
  rim.position.set(-4, 3, -3);
  s.add(rim);
  s.add(obj);
  return s;
}

function shoot(s, cam, w, h) {
  renderer.setSize(w, h);
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
  renderer.render(s, cam);
  return renderer.domElement.toDataURL("image/png");
}

// 모든 나무 단계에 같은 카메라 → 크기가 자연스럽게 커짐
function treeCam() {
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  cam.position.set(0, 3.6, 13.2);
  cam.lookAt(0, 2.45, 0);
  return cam;
}

// 감이 열릴 자리: 카메라를 향하고 가려지지 않는 잎 표면 점
function fruitSpots(tree, cam, max = 60) {
  tree.updateMatrixWorld(true);
  const canopyG = tree.getObjectByName("canopy");
  const blobs = canopyG.children;
  const ray = new THREE.Raycaster();
  const spots = [];
  reseed(2024);
  const camPos = cam.position.clone();
  const faceObj = tree.getObjectByName("face");
  const facePos = faceObj ? faceObj.getWorldPosition(new THREE.Vector3()) : null;
  for (let tries = 0; tries < 6000 && spots.length < max; tries++) {
    const b = blobs[Math.floor(rnd() * blobs.length)];
    const dir = new THREE.Vector3(rnd() * 2 - 1, rnd() * 1.6 - 0.7, rnd() * 2 - 1).normalize();
    const center = b.getWorldPosition(new THREE.Vector3());
    // 표면점: 중심에서 바깥으로 레이캐스트
    ray.set(center.clone().add(dir.clone().multiplyScalar(3)), dir.clone().negate());
    const hit = ray.intersectObject(b, false)[0];
    if (!hit) continue;
    const p = hit.point;
    const n = hit.face.normal.clone().transformDirection(b.matrixWorld);
    if (facePos && p.distanceTo(facePos) < 0.62) continue;
    const toCam = camPos.clone().sub(p).normalize();
    if (n.dot(toCam) < 0.45) continue;
    // 가려짐 체크
    ray.set(camPos, p.clone().sub(camPos).normalize());
    const first = ray.intersectObjects(blobs, false)[0];
    if (!first || first.point.distanceTo(p) > 0.03) continue;
    const ndc = p.clone().project(cam);
    const x = (ndc.x + 1) / 2, y = (1 - ndc.y) / 2;
    if (spots.some((s) => Math.hypot(s.x - x, (s.y - y) * 1.1) < 0.068)) continue;
    spots.push({ x, y, p: p.clone(), n });
  }
  return spots;
}

// ---------- 외부 API ----------
window.renderPersimmon = (size = 512, angle = 0, withFace = true) => {
  const p = makePersimmon(withFace);
  p.rotation.y = withFace ? 0 : 0.5 + angle;
  p.rotation.x = withFace ? 0.12 : 0.28;
  const s = scene(p);
  const cam = new THREE.PerspectiveCamera(22, 1, 0.1, 50);
  cam.position.set(0, 1.4, 6.2);
  cam.lookAt(0, 0.06, 0);
  return shoot(s, cam, size, size);
};

window.renderTree = (stage, w = 600, h = 660, withFruits = 0) => {
  const t = makeTree(stage);
  const s = scene(t);
  const cam = treeCam();
  cam.aspect = w / h;
  // 단계마다 캐릭터가 화면에 꽉 차도록 맞춤
  t.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(t);
  const size = box.getSize(new THREE.Vector3());
  const cy = (box.min.y + box.max.y) / 2;
  const fov = (cam.fov * Math.PI) / 180;
  const fitH = (size.y * 0.5 * 1.12) / Math.tan(fov / 2);
  const fitW = (size.x * 0.5 * 1.12) / Math.tan(fov / 2) / cam.aspect;
  const dist = Math.max(fitH, fitW, 5.4);
  cam.position.set(0, cy + dist * 0.16, dist);
  cam.lookAt(0, cy, 0);
  cam.updateProjectionMatrix();
  let meta = null;
  cam.updateMatrixWorld(true);
  if (stage === 5) {
    const spots = fruitSpots(t, cam);
    meta = spots.map((s) => ({ x: +s.x.toFixed(4), y: +s.y.toFixed(4) }));
    if (withFruits) {
      spots.slice(0, withFruits).forEach((sp) => {
        const f = makePersimmon();
        f.scale.setScalar(0.17);
        f.position.copy(sp.p).add(sp.n.clone().multiplyScalar(0.1));
        f.rotation.set(0.25, rnd() * 6, (rnd() - 0.5) * 0.3);
        t.add(f);
      });
    }
  }
  return { png: shoot(s, cam, w, h), meta };
};

window.ready = true;
