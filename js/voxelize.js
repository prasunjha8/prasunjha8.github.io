/* =========================================================
   Voxel (dis)assembly effect: a model breaks into glowing cubes
   and re-forms from them.

   Cubes are sampled on the model's real surfaces (area-weighted, using
   MeshSurfaceSampler) and stored in one InstancedMesh, so a few thousand
   cubes cost a single draw call. `setProgress(p)`: p = 1 is fully assembled
   (cubes sit on the surface); p = 0 is fully scattered.
   ========================================================= */
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";

export function createVoxelShell(model, { count = 2600, size = 0.032, glow = 0x00e5ff } = {}) {
  model.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();

  // gather meshes and their surface area so cubes are spread evenly
  const parts = [];
  let totalArea = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const pos = g.attributes.position;
    let area = 0;
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(pos, i + 1).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(pos, i + 2).applyMatrix4(o.matrixWorld);
      area += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    const col = o.material?.emissiveIntensity > 0.5 && o.material.emissive?.getHex() ? o.material.emissive : (o.material?.color ?? new THREE.Color(1, 1, 1));
    parts.push({ mesh: o, sampler: new MeshSurfaceSampler(o).build(), area, color: col.clone() });
    totalArea += area;
  });

  const home = new Float32Array(count * 3), scatter = new Float32Array(count * 3);
  const spin = new Float32Array(count * 3), delay = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const p = new THREE.Vector3(), tint = new THREE.Color(glow), tmpC = new THREE.Color();
  let minY = Infinity, maxY = -Infinity, k = 0;
  for (const part of parts) {
    const n = part === parts[parts.length - 1] ? count - k : Math.round((part.area / totalArea) * count);
    for (let j = 0; j < n && k < count; j++, k++) {
      part.sampler.sample(p);
      p.applyMatrix4(part.mesh.matrixWorld).applyMatrix4(inv);   // into model space
      home.set([p.x, p.y, p.z], k * 3);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      // scatter: outward from the centre, biased upward, like debris lifting off
      const dir = new THREE.Vector3(p.x, 0, p.z).normalize().multiplyScalar(0.5 + Math.random() * 1.6);
      dir.x += (Math.random() - 0.5) * 1.2; dir.z += (Math.random() - 0.5) * 1.2;
      dir.y = 0.3 + Math.random() * 1.6;
      scatter.set([p.x + dir.x, p.y + dir.y, p.z + dir.z], k * 3);
      spin.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], k * 3);
      tmpC.copy(part.color).lerp(tint, 0.55);
      colors.set([tmpC.r, tmpC.g, tmpC.b], k * 3);
    }
  }
  // builds bottom-up, breaks apart top-down
  for (let i = 0; i < count; i++) delay[i] = ((home[i * 3 + 1] - minY) / (maxY - minY || 1)) * 0.55 + Math.random() * 0.25;

  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  inst.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  inst.frustumCulled = false;

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
  const ease = (x) => 1 - Math.pow(1 - x, 3);

  /** p: 0 scattered → 1 assembled. t: time, for the drifting shimmer. */
  function setProgress(prog, t = 0) {
    for (let i = 0; i < count; i++) {
      // each cube has its own window inside [0,1]
      const local = Math.min(1, Math.max(0, (prog - delay[i] * 0.55) / 0.45));
      const f = ease(local), r = 1 - f;
      const i3 = i * 3;
      v.set(
        home[i3] + (scatter[i3] - home[i3]) * r + Math.sin(t * 1.3 + i) * 0.05 * r,
        home[i3 + 1] + (scatter[i3 + 1] - home[i3 + 1]) * r,
        home[i3 + 2] + (scatter[i3 + 2] - home[i3 + 2]) * r + Math.cos(t * 1.1 + i) * 0.05 * r,
      );
      e.set(spin[i3] * r + t * r, spin[i3 + 1] * r, spin[i3 + 2] * r);
      q.setFromEuler(e);
      const sc = 0.35 + 0.65 * (local > 0 && local < 1 ? 1.3 : f > 0.99 ? 1 : 0.8);
      s.setScalar(sc * (0.7 + 0.6 * ((i * 7919) % 13) / 13));
      m.compose(v, q, s);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
  }
  setProgress(0);
  return { mesh: inst, setProgress };
}
