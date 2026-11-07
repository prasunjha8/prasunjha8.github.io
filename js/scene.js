/* =========================================================
   Hero scene: Blender-built rover + live 2D LiDAR.
   The scan is computed analytically (ray vs circle) against
   moving pedestrians and a circular arena wall, every frame.
   ========================================================= */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createVoxelShell } from "./voxelize.js";

const canvas = document.getElementById("scene");
const hero = document.getElementById("hero");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
} catch (e) {
  canvas.hidden = true;
  document.getElementById("scene-fallback").hidden = false;
  throw e;
}
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x07090d, 0.075);
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(0x9fdcff, 0x0a0a12, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 6, 3); scene.add(key);
const rim = new THREE.PointLight(0x00e5ff, 8, 10); rim.position.set(-2, 1.5, -2); scene.add(rim);
const warm = new THREE.PointLight(0xff5a1f, 5, 8); warm.position.set(2.5, 0.6, 1.5); scene.add(warm);

/* ---------- floor grid ---------- */
const grid = new THREE.GridHelper(40, 80, 0x00e5ff, 0x0e2a33);
grid.material.transparent = true; grid.material.opacity = 0.35;
scene.add(grid);
const ARENA = 5;
const ring = new THREE.Mesh(new THREE.RingGeometry(ARENA - 0.02, ARENA, 128), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002; scene.add(ring);

/* ---------- rover (from Blender) ---------- */
const rover = new THREE.Group();
scene.add(rover);
const LIDAR_Y = 1.12;          // height of the LiDAR ring in the Blender model (z-up → y-up)
const LIDAR_X = -0.2;          // its offset along the rover's forward axis
let wheels = [];
let model = null, shell = null, loadedAt = -1;
new GLTFLoader().load("assets/models/rover.glb", (gltf) => {
  const m = gltf.scene;
  m.traverse((o) => {
    if (o.isMesh && o.name.startsWith("Hub")) wheels.push(o);
    if (o.isMesh && o.material?.emissive) o.material.emissiveIntensity = Math.min(o.material.emissiveIntensity ?? 1, 2.5);
  });
  rover.add(m);
  model = m;
  shell = createVoxelShell(m, { count: innerWidth < 700 ? 1500 : 2600 });
  rover.add(shell.mesh);
  loadedAt = clock.elapsedTime + 0.6;     // small pause, then assemble
}, undefined, () => {
  // model failed → simple placeholder so the scan still works
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 1), new THREE.MeshStandardMaterial({ color: 0x111820, metalness: .6, roughness: .4 }));
  b.position.y = 0.55; rover.add(b);
});

/* ---------- pedestrians (wireframe capsules) ---------- */
const PED_R = 0.2;
const pedMat = new THREE.MeshBasicMaterial({ color: 0xff5a1f, wireframe: true, transparent: true, opacity: 0.1 });
const peds = Array.from({ length: 7 }, (_, i) => {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(PED_R, 0.9, 3, 8), pedMat);
  scene.add(mesh);
  const p = { mesh, x: 0, z: 0, vx: 0, vz: 0 };
  respawn(p, true, i);
  return p;
});
function respawn(p, initial, i = 0) {
  // walk along a chord of the arena that passes near (but not through) the rover
  const a = initial ? (i / 7) * Math.PI * 2 + Math.random() : Math.random() * Math.PI * 2;
  const R = ARENA - 0.6;
  p.x = Math.cos(a) * R; p.z = Math.sin(a) * R;
  const tgtA = a + Math.PI + (Math.random() - 0.5) * 1.6;
  const tx = Math.cos(tgtA) * R, tz = Math.sin(tgtA) * R;
  const len = Math.hypot(tx - p.x, tz - p.z), sp = 0.45 + Math.random() * 0.5;
  p.vx = ((tx - p.x) / len) * sp; p.vz = ((tz - p.z) / len) * sp;
  if (initial) { const s = Math.random() * len * 0.8; p.x += (p.vx / sp) * s; p.z += (p.vz / sp) * s; }
}

/* ---------- LiDAR point cloud ---------- */
const N = 540;                                  // beams per revolution
const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), age = new Float32Array(N).fill(99);
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
const dotTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const g = c.getContext("2d"), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, "#fff"); gr.addColorStop(0.4, "rgba(255,255,255,.6)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
const cloud = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.09, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
scene.add(cloud);

// sweep beam
const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const beam = new THREE.Line(beamGeo, new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
scene.add(beam);
// translucent sweep fan
const fanGeo = new THREE.CircleGeometry(ARENA, 32, 0, 0.5);
const fan = new THREE.Mesh(fanGeo, new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
fan.rotation.x = -Math.PI / 2; scene.add(fan);

/** Distance along a 2D ray (ox,oz)+t(dx,dz) to the nearest pedestrian or the arena wall. */
function castRay(ox, oz, dx, dz) {
  let best = Infinity, isPed = false;
  for (const p of peds) {                     // ray–circle
    const fx = ox - p.x, fz = oz - p.z;
    const b = fx * dx + fz * dz, c = fx * fx + fz * fz - PED_R * PED_R;
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t > 0.05 && t < best) { best = t; isPed = true; }
  }
  // inside arena circle: t = -b + sqrt(b² - c)
  const b = ox * dx + oz * dz, c = ox * ox + oz * oz - ARENA * ARENA;
  const tw = -b + Math.sqrt(b * b - c);
  if (tw < best) { best = tw; isPed = false; }
  return [best, isPed];
}

/* ---------- interaction ---------- */
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener("pointermove", (e) => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; });
let scrollP = 0;
addEventListener("scroll", () => { scrollP = Math.min(1, scrollY / innerHeight); }, { passive: true });

function resize() {
  const w = hero.clientWidth, h = hero.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // on wide screens push the rover to the right of the hero text
  sceneOffset = w > 860 ? Math.min(2.4, (w / h) * 0.95) : 0;
}
let sceneOffset = 0;
new ResizeObserver(resize).observe(hero);
resize();

/* ---------- HUD ---------- */
const hud = { yaw: document.getElementById("hud-yaw"), hits: document.getElementById("hud-hits"), peds: document.getElementById("hud-peds"), min: document.getElementById("hud-min"), fps: document.getElementById("hud-fps") };
let fpsAcc = 0, fpsN = 0, hudT = 0;

/* ---------- loop ---------- */
let visible = true;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) requestAnimationFrame(tick); }).observe(hero);

const clock = new THREE.Clock();
let sweep = 0, idx = 0;
const tmp = new THREE.Vector3();
const color = new THREE.Color();

/* ---------- voxel disintegration triggers ---------- */
let burstAt = -99;
hero.addEventListener("click", (e) => {
  if (e.target.closest("a, button")) return;
  if (clock.elapsedTime - burstAt > 3.2) burstAt = clock.elapsedTime;
});
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
let lastVoxP = -1;

function tick() {
  if (!visible) return;
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  const speed = reduced ? 0.2 : 1;

  // rover: slow yaw wander, wheels spin with it
  const yaw = Math.sin(t * 0.25) * 0.9 + t * 0.08 * speed;
  rover.rotation.y = yaw;
  rover.position.y = Math.sin(t * 2) * 0.01;

  // voxel state = the most "broken" of: intro assembly, click burst, scroll
  if (shell) {
    const intro = reduced ? 1 : smooth(0, 2.6, t - loadedAt);
    const bt = t - burstAt;   // 0–1.1 s break apart, hold, 1.6–3.0 s re-form
    const burst = bt < 0 || bt > 3 ? 1 : bt < 1.1 ? 1 - smooth(0, 1.1, bt) : bt < 1.6 ? 0 : smooth(1.6, 3.0, bt);
    const scroll = 1 - smooth(0.05, 0.75, scrollP);
    const p = Math.min(intro, burst, scroll);
    const whole = p > 0.995;
    model.visible = whole;
    shell.mesh.visible = !whole;
    if (!whole && (p !== lastVoxP || p < 0.999)) shell.setProgress(p, t);
    lastVoxP = p;
  }
  wheels.forEach((w) => (w.rotation.y += dt * 1.5 * speed));

  // pedestrians walk; respawn when they leave the arena
  for (const p of peds) {
    p.x += p.vx * dt * speed; p.z += p.vz * dt * speed;
    // simple avoidance: step around the rover
    const d = Math.hypot(p.x, p.z);
    if (d < 2.0) { p.x += (p.x / d) * dt * 0.8; p.z += (p.z / d) * dt * 0.8; }
    if (p.x * p.x + p.z * p.z > (ARENA - 0.4) ** 2 && p.x * p.vx + p.z * p.vz > 0) respawn(p, false);
    p.mesh.position.set(p.x, 0.78 + Math.abs(Math.sin(t * 6 + p.x)) * 0.04, p.z);
  }

  // LiDAR origin in world frame
  const ox = Math.cos(-yaw) * LIDAR_X, oz = Math.sin(-yaw) * LIDAR_X;
  const revPerSec = 0.6 * speed;
  const beamsThisFrame = Math.max(1, Math.round(N * revPerSec * dt));
  let minR = Infinity, hits = 0, lastPt = [ox, oz];
  for (let k = 0; k < beamsThisFrame; k++) {
    sweep += (Math.PI * 2) / N;
    const dx = Math.cos(sweep), dz = Math.sin(sweep);
    const [r, isPed] = castRay(ox, oz, dx, dz);
    const i = idx; idx = (idx + 1) % N;
    pos[i * 3] = ox + dx * r; pos[i * 3 + 1] = isPed ? 0.95 : 0.25; pos[i * 3 + 2] = oz + dz * r;
    age[i] = isPed ? -1 : 0;          // peds glow longer
    lastPt = [pos[i * 3], pos[i * 3 + 2]];
  }
  for (let i = 0; i < N; i++) {
    const ped = age[i] < 0;
    const a = Math.abs(age[i]);
    age[i] = ped ? age[i] - dt : age[i] + dt;
    const life = Math.max(0, 1 - a / 1.7);
    if (ped) color.setRGB(1, 0.35, 0.12).multiplyScalar(life * 1.2);
    else color.setRGB(0, 0.9, 1).multiplyScalar(life * 0.8);
    col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b;
    if (life > 0) {
      hits++;
      if (ped) minR = Math.min(minR, Math.hypot(pos[i * 3] - ox, pos[i * 3 + 2] - oz));
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;

  const bp = beamGeo.attributes.position.array;
  bp[0] = ox; bp[1] = LIDAR_Y; bp[2] = oz; bp[3] = lastPt[0]; bp[4] = 0.25; bp[5] = lastPt[1];
  beamGeo.attributes.position.needsUpdate = true;
  fan.position.set(ox, 0.01, oz);
  fan.rotation.z = -sweep;     // circle geometry starts at +x, so rotate trailing wedge behind the beam

  // camera: orbit offset with mouse, dolly with scroll
  mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
  const narrow = camera.aspect < 1;      // phones: pull back, sit the rover below the text
  const camR = (narrow ? 11 : 6.2) + scrollP * 3, camA = 0.75 + mouse.x * 0.5;
  camera.position.set(Math.sin(camA) * camR, (narrow ? 3.4 : 2.6) + mouse.y * 1.2 + scrollP * 2, Math.cos(camA) * camR);
  tmp.set(0, 0.55, 0);
  camera.lookAt(tmp);
  // shift the framing: right of the text on desktop, bottom of the screen on phones
  const W = hero.clientWidth, H = hero.clientHeight;
  camera.setViewOffset(W, H, -sceneOffset * W * 0.09, narrow ? -H * 0.3 : 0, W, H);
  canvas.style.opacity = String(1 - scrollP * 0.8);

  renderer.render(scene, camera);

  // HUD (throttled)
  fpsAcc += dt; fpsN++; hudT += dt;
  if (hudT > 0.25 && hud.yaw) {
    hud.yaw.textContent = (((yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI).toFixed(2) + " rad";
    hud.hits.textContent = String(hits);
    hud.peds.textContent = String(peds.length);
    hud.min.textContent = isFinite(minR) ? minR.toFixed(2) + " m" : "—";
    hud.fps.textContent = Math.round(fpsN / fpsAcc) + " fps";
    hudT = 0; fpsAcc = 0; fpsN = 0;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
