// Visual recovery of the three natural gullies described in the official guide.
// This does NOT alter GEO.heights or heightAt(), and is not a surveyed earthwork.
// Placement uses the named entry/exit corridors, the local satellite drainage
// texture and the DEM. Width, extra relief and exact thalweg remain estimates.
const naturalValleySource = 'https://mp.weixin.qq.com/s/QdY5BBhPSJrHD4MbMyoeSA';
const naturalValleySpecs = [
  {
    id: 'happiness',
    guideId: 9,
    name: '幸福谷',
    entry: '幸福大道护网缺口方向',
    exit: '娇龙道',
    confidence: '入口道路未单独定位；P 下半部谷向参考',
    widths: [18, 24, 22, 19, 15],
    depths: [2.6, 4.4, 4.1, 3.5, 1.8],
    geo: [
      [115.38589, 40.96383],
      [115.38555, 40.96462],
      [115.38535, 40.9654],
      [115.38503, 40.96621],
      [115.38478, 40.96689],
      [115.38444, 40.9674],
    ],
    treeFree: 10,
  },
  {
    id: 'dinosaur',
    guideId: 10,
    name: '恐龙谷',
    entry: '翔龙道右转',
    exit: '恐龙道',
    confidence: '依据攻略出入口，G 标识与现有 OSM 旁道配准有冲突',
    widths: [28, 36, 41, 34, 23],
    depths: [3.2, 5.8, 6.6, 5.2, 2.4],
    geo: [
      [115.39653, 40.95613],
      [115.39653, 40.95702],
      [115.3963, 40.95808],
      [115.39607, 40.95913],
      [115.396, 40.96018],
      [115.39622, 40.9612],
      [115.3962943, 40.9621873],
    ],
    treeFree: 5.2,
  },
  {
    id: 'frost',
    guideId: 11,
    name: '霜龙谷',
    entry: '野雪 L 区护网缺口方向',
    exit: '霜龙道／雪龙道汇合方向',
    confidence: '雾龙无独立中心线；入口点和谷底走向为参考',
    widths: [43, 40, 32, 24, 19],
    depths: [2.6, 3.4, 5.3, 7.2, 6.0],
    geo: [
      [115.38872, 40.95647],
      [115.38861, 40.95729],
      [115.38843, 40.95808],
      [115.388, 40.95895],
      [115.38766, 40.95975],
      [115.38738, 40.96051],
      [115.3871731, 40.9612706],
    ],
    treeFree: 4.2,
  },
];
const valleySmoother = (t) => {
  t = clamp(t, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const naturalValleys = naturalValleySpecs.map((spec) => {
  const p = spec.geo.map((c) => {
      const [x, z] = projectGeo(c);
      return new V(x, 0, z);
    }),
    curve = new THREE.CatmullRomCurve3(p, false, 'centripetal'),
    length = curve.getLength(),
    n = Math.ceil(length / 4),
    samples = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      q = curve.getPointAt(t),
      d = curve.getTangentAt(t);
    samples.push({ x: q.x, z: q.z, tx: d.x, tz: d.z, t, s: t * length });
  }
  const pad = Math.max(...spec.widths) * 1.25 + 18;
  return {
    ...spec,
    length,
    samples,
    bounds: [
      Math.min(...samples.map((p) => p.x)) - pad,
      Math.min(...samples.map((p) => p.z)) - pad,
      Math.max(...samples.map((p) => p.x)) + pad,
      Math.max(...samples.map((p) => p.z)) + pad,
    ],
  };
});
function naturalValleyAt(x, z) {
  let best = null;
  for (const v of naturalValleys) {
    const b = v.bounds;
    if (x < b[0] || z < b[1] || x > b[2] || z > b[3]) continue;
    let local = null;
    for (let i = 1; i < v.samples.length; i++) {
      const a = v.samples[i - 1],
        b = v.samples[i],
        dx = b.x - a.x,
        dz = b.z - a.z,
        u = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1),
        px = a.x + u * dx,
        pz = a.z + u * dz,
        d = Math.hypot(x - px, z - pz);
      if (!local || d < local.distance)
        local = {
          valley: v,
          t: lerp(a.t, b.t, u),
          distance: d,
          side: Math.sign(dx * (z - pz) - dz * (x - px)),
        };
    }
    if (!best || local.distance < best.distance) best = local;
  }
  return best;
}
function valleyInterpolate(values, t) {
  const q = clamp(t, 0, 1) * (values.length - 1),
    i = Math.min(values.length - 2, Math.floor(q));
  return lerp(values[i], values[i + 1], valleySmoother(q - i));
}
function naturalValleyDelta(x, z) {
  const q = naturalValleyAt(x, z);
  if (!q) return 0;
  const v = q.valley,
    t = q.t,
    w =
      valleyInterpolate(v.widths, t) *
      (1 + 0.12 * Math.sin(t * 13.4 + 0.7)) *
      (q.side < 0 ? 1.14 : 0.9),
    u = q.distance / w;
  if (u >= 1) return 0;
  const head = valleySmoother(t / 0.11),
    tail = valleySmoother((1 - t) / 0.13),
    depth = valleyInterpolate(v.depths, t) * (1 + 0.055 * Math.sin(t * 22));
  // Compact C2 U section. Unequal banks and variable width preserve a natural
  // gully, rather than a uniform halfpipe with vertical walls and a flat deck.
  return -depth * (1 - u * u) ** 3 * head * tail;
}
function visibleTerrainHeightAt(x, z) {
  return rawDemMode
    ? pisteGrading
      ? pisteGrading.field(x, z)
      : heightAt(x, z)
    : heightAt(x, z) + naturalValleyDelta(x, z);
}
function naturalValleySurfaceHeightAt(x, z) {
  const delta = naturalValleyDelta(x, z);
  return delta === 0 ? null : heightAt(x, z) + delta;
}
let sourceTerrainPositions = null,
  sourceTerrainNormals = null,
  sourceTerrainColours = null;
// Call after GEO_TERRAIN, before pistes/surface materials/facilities. Refine only
// intersecting source cells to ~2.8 m, so the new narrow terrain is real geometry.
function applyNaturalValleyTerrain() {
  const old = terrainGeo.attributes.position;
  sourceTerrainPositions = new Float32Array(old.array);
  sourceTerrainNormals = new Float32Array(terrainGeo.attributes.normal.array);
  sourceTerrainColours = new Float32Array(terrainGeo.attributes.color.array);
  const vertices = Array.from(old.array),
    colours = Array.from(terrainGeo.attributes.color.array),
    uv = Array.from(terrainGeo.attributes.uv.array),
    indices = [];
  const refined = [];
  for (let j = 0; j < GEO.rows - 1; j++)
    for (let i = 0; i < GEO.cols - 1; i++) {
      const n = j * GEO.cols + i,
        ids = [n, n + 1, n + GEO.cols, n + GEO.cols + 1],
        x0 = Math.min(...ids.map((k) => old.getX(k))),
        x1 = Math.max(...ids.map((k) => old.getX(k))),
        z0 = Math.min(...ids.map((k) => old.getZ(k))),
        z1 = Math.max(...ids.map((k) => old.getZ(k)));
      const affect = naturalValleys.some(
        (v) => x1 >= v.bounds[0] && x0 <= v.bounds[2] && z1 >= v.bounds[1] && z0 <= v.bounds[3],
      );
      if (!affect) {
        indices.push(n, n + GEO.cols, n + 1, n + 1, n + GEO.cols, n + GEO.cols + 1);
        continue;
      }
      const steps = 5,
        start = vertices.length / 3,
        a = new V().fromBufferAttribute(old, n),
        b = new V().fromBufferAttribute(old, n + 1),
        c = new V().fromBufferAttribute(old, n + GEO.cols),
        d = new V().fromBufferAttribute(old, n + GEO.cols + 1);
      for (let y = 0; y <= steps; y++)
        for (let x = 0; x <= steps; x++) {
          const u = x / steps,
            v = y / steps,
            p = a.clone().lerp(b, u).lerp(c.clone().lerp(d, u), v),
            h = visibleTerrainHeightAt(p.x, p.z),
            tint = new THREE.Color('#f2f5f1').lerp(
              new THREE.Color('#d1e1e6'),
              0.1 + 0.08 * Math.sin(p.x * 0.002 - p.z * 0.001),
            );
          vertices.push(p.x, h, p.z);
          colours.push(tint.r, tint.g, tint.b);
          uv.push((i + u) / (GEO.cols - 1), (j + v) / (GEO.rows - 1));
        }
      for (let y = 0; y < steps; y++)
        for (let x = 0; x < steps; x++) {
          const k = start + y * (steps + 1) + x;
          indices.push(k, k + steps + 1, k + 1, k + 1, k + steps + 1, k + steps + 2);
        }
      refined.push([i, j]);
    }
  // Adjacent refined cells share their edge vertices. Otherwise each cell gets
  // an independent normal and the snow shows rectangular lighting seams.
  const welded = new Map(),
    positions = [],
    colors = [],
    textureUV = [],
    remap = new Map(),
    joined = [];
  for (const oldIndex of indices) {
    let index = remap.get(oldIndex);
    if (index === undefined) {
      const k = oldIndex * 3,
        key = [vertices[k], vertices[k + 1], vertices[k + 2]]
          .map((v) => Math.round(v * 1000))
          .join(',');
      index = welded.get(key);
      if (index === undefined) {
        index = positions.length / 3;
        welded.set(key, index);
        positions.push(...vertices.slice(k, k + 3));
        colors.push(...colours.slice(k, k + 3));
        textureUV.push(...uv.slice(oldIndex * 2, oldIndex * 2 + 2));
      }
      remap.set(oldIndex, index);
    }
    joined.push(index);
  }
  terrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  terrainGeo.setAttribute('uv', new THREE.Float32BufferAttribute(textureUV, 2));
  terrainGeo.setIndex(joined);
  terrainGeo.deleteAttribute('normal');
  terrainGeo.computeVertexNormals();
  terrainGeo.computeBoundingSphere();
  terrain.userData.naturalValleys = {
    source: naturalValleySource,
    demPreserved: true,
    refinedCells: refined.length,
    spacingM: 2.85,
    sharedCellNormals: true,
    estimate: true,
  };
  return terrain.userData.naturalValleys;
}
function focusNaturalValley(id) {
  const v = naturalValleys.find((q) => q.guideId === id || q.id === id);
  if (!v) return;
  const c = v.samples[Math.floor(v.samples.length * 0.54)];
  desired.target.set(c.x, visibleTerrainHeightAt(c.x, c.z) + 7, c.z);
  desired.radius = clamp(v.length * 1.25, 380, 1100);
  desired.phi = 1.0;
  desired.theta = Math.atan2(-v.samples.at(-1).tx, -v.samples.at(-1).tz) + 0.42;
}
