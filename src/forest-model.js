// Canopy coverage = source forest polygons plus strong dark-canopy evidence
// from the local georeferenced Esri satellite image. Individual trees are
// deterministic visual samples, not a tree inventory.
const forestMaskBytes = Uint8Array.from(atob(forestCanopyRaster.runs), (c) => c.charCodeAt(0)),
  forestMask = new Uint8Array(forestCanopyRaster.width * forestCanopyRaster.height);
for (let i = 0, k = 0; i < forestMaskBytes.length; i += 2) {
  forestMask.fill(forestMaskBytes[i + 1], k, k + forestMaskBytes[i]);
  k += forestMaskBytes[i];
}
// User-confirmed missing woodland between these two mapped routes.
// This repairs display coverage; it is not a surveyed forest boundary.
const forestReferencePatches = [];
{
  const routes = ['猛龙道', '大奔头'].map((name) => trails.find((t) => t.name === name)),
    lines = routes.map((t) => t.points);
  const z0 = Math.max(...lines.map((p) => Math.min(...p.map((q) => q.z)))),
    z1 = Math.min(...lines.map((p) => Math.max(...p.map((q) => q.z))));
  const at = (points, z) => {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      if (z >= Math.min(a.z, b.z) && z <= Math.max(a.z, b.z))
        return [a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z || 1), z];
    }
  };
  const sides = lines.map((points) => [
      at(points, z0),
      ...points.filter((p) => p.z > z0 && p.z < z1).map((p) => [p.x, p.z]),
      at(points, z1),
    ]),
    polygon = [...sides[0], ...sides[1].reverse()];
  forestReferencePatches.push({
    id: 'menglong-dabentou',
    source: '用户确认两道之间的树林覆盖，2026-10-20；显示边缘沿已映射路线，非测绘林界',
    polygon,
    z0,
    z1,
    bounds: [Math.min(...polygon.map((p) => p[0])), z0, Math.max(...polygon.map((p) => p[0])), z1],
  });
}
function forestPatchAt(x, z) {
  return forestReferencePatches.find(
    (p) =>
      x >= p.bounds[0] && x <= p.bounds[2] && z >= p.z0 && z <= p.z1 && inPolygon(x, z, p.polygon),
  );
}
function canopyEvidence(x, z) {
  if (forestPatchAt(x, z)) return 3;
  const [lon, lat] = unprojectGeo(x, z),
    r = 6378137,
    px = (r * lon * Math.PI) / 180,
    py = r * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
    m = GEO.imagery,
    u = (px - m.xmin) / (m.xmax - m.xmin),
    v = (m.ymax - py) / (m.ymax - m.ymin);
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return withinForest(x, z) ? 1 : 0;
  const ix = Math.min(forestCanopyRaster.width - 1, Math.floor(u * forestCanopyRaster.width)),
    iy = Math.min(forestCanopyRaster.height - 1, Math.floor(v * forestCanopyRaster.height)),
    photo = forestMask[iy * forestCanopyRaster.width + ix];
  return photo === 2 ? 2 : photo === 1 && withinForest(x, z) ? 1 : 0;
}
// Exact segment distances, rather than sparse centreline points; crown radii
// are included so trees no longer overhang pistes, roads or the wider park.
const treeSegments = new Map(),
  treeCell = 64;
function treeAddLine(points, width, kind) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      seg = { a, b, width, kind },
      p = width + 9;
    for (
      let x = Math.floor((Math.min(a[0], b[0]) - p) / treeCell);
      x <= Math.floor((Math.max(a[0], b[0]) + p) / treeCell);
      x++
    )
      for (
        let z = Math.floor((Math.min(a[1], b[1]) - p) / treeCell);
        z <= Math.floor((Math.max(a[1], b[1]) + p) / treeCell);
        z++
      ) {
        const key = x + ',' + z;
        if (!treeSegments.has(key)) treeSegments.set(key, []);
        treeSegments.get(key).push(seg);
      }
  }
}
// Piste clearance uses the same asymmetric footprint as the rendered snow, below.
// Keep crowns 9 m from the rope centreline (both vehicle lanes plus margin),
// instead of clearing a 34 m wide strip before crown radius is even added.
for (const lift of lifts.filter((l) => l.geo)) treeAddLine(lift.geo.map(projectGeo), 9, 'lift');
function forestClearance(x, z, radius = 0) {
  const piste = pisteFootprintClearance(x, z);
  let best = piste.clearance - 2.5 - radius,
    kind = Number.isFinite(best) ? 'piste' : null;
  for (const s of treeSegments.get(Math.floor(x / treeCell) + ',' + Math.floor(z / treeCell)) ||
    []) {
    const dx = s.b[0] - s.a[0],
      dz = s.b[1] - s.a[1],
      t = clamp(((x - s.a[0]) * dx + (z - s.a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1),
      d = Math.hypot(x - s.a[0] - dx * t, z - s.a[1] - dz * t) - s.width - radius;
    if (d < best) {
      best = d;
      kind = s.kind;
    }
  }
  return { distance: best, kind };
}
const treeData = [],
  treeSnowCaps = [],
  forestCounters = {
    sourceForest: 0,
    satelliteInfill: 0,
    foreground: 0,
    background: 0,
    excludedValley: 0,
    userConfirmed: 0,
    coverageRepairTrees: 0,
    narrowBeltTrees: 0,
    linearBeltTrees: 0,
  };
const treeOccupied = new Map(),
  resortTreeRing = GEO.resortBoundary.map(projectGeo),
  forestRandom = (() => {
    let value = 470269;
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  })();
function treePlace(x, z, foreground, narrowBelt = null) {
  if (resortScope && !resortScope.contains(x, z, -12)) return;
  if (reservoir.contains(x, z)) return;
  const evidence = canopyEvidence(x, z);
  if (!evidence) return;
  let h = narrowBelt ? 6.5 + forestRandom() * 5.5 : 8 + forestRandom() * 9;
  let w = h * (0.19 + forestRandom() * 0.045);
  const angle = forestRandom() * Math.PI * 2;
  if (narrowBelt) {
    const available = Math.min(narrowBelt.width * 0.32, forestClearance(x, z).distance - 0.15);
    if (available < 0.9) return;
    if (available < w) {
      h *= available / w;
      w = available;
    }
  }
  if (
    forestClearance(x, z, w).distance < 0 ||
    menglongPark.contains(x, z, w + 3) ||
    nearFacility(x, z, w + 5) ||
    pylonDetailRecords.some((p) => (p.foot[0] - x) ** 2 + (p.foot[2] - z) ** 2 < (w + 3) ** 2) ||
    nightPoleSpots.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < (w + 5) ** 2)
  )
    return;
  if (typeof naturalValleyAt === 'function') {
    const valley = naturalValleyAt(x, z);
    if (valley) {
      const floor = valley.valley.treeFree;
      if (
        valley.distance < floor + w ||
        (valley.distance < floor + w + 8 && forestRandom() < 0.6)
      ) {
        forestCounters.excludedValley++;
        return;
      }
    }
  }
  const ix = Math.floor(x / 5),
    iz = Math.floor(z / 5);
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) {
      const q = treeOccupied.get(ix + i + ',' + (iz + j));
      if (q && (q.x - x) ** 2 + (q.z - z) ** 2 < 19.36) return;
    }
  const t = {
    x,
    z,
    h,
    w,
    angle,
    tint: forestRandom(),
    source: forestPatchAt(x, z)
      ? 'user-reference'
      : withinForest(x, z)
        ? 'source-forest'
        : 'satellite-canopy',
    foreground,
  };
  if (narrowBelt) t.narrowBelt = narrowBelt;
  treeData.push(t);
  treeOccupied.set(ix + ',' + iz, t);
  forestCounters[
    t.source === 'user-reference'
      ? 'userConfirmed'
      : t.source === 'source-forest'
        ? 'sourceForest'
        : 'satelliteInfill'
  ]++;
  forestCounters[foreground ? 'foreground' : 'background']++;
  return true;
}
// Broad woodland gets ~26 m spacing near the resort and ~66 m outside it. A
// jittered grid prevents random-sampling holes and evenly covers thin bands.
for (const pass of [
  { spacing: 44, foreground: true },
  { spacing: 110, foreground: false },
]) {
  for (let z = GEO.extent[1] + pass.spacing * 0.5; z < GEO.extent[3]; z += pass.spacing)
    for (let x = GEO.extent[0] + pass.spacing * 0.5; x < GEO.extent[2]; x += pass.spacing) {
      const px = x + (forestRandom() - 0.5) * pass.spacing * 0.65,
        pz = z + (forestRandom() - 0.5) * pass.spacing * 0.65,
        inside = inPolygon(px, pz, resortTreeRing);
      if (inside !== pass.foreground || forestPatchAt(px, pz)) continue;
      treePlace(px, pz, inside);
    }
}
// This narrow, user-confirmed belt has its own density, independent of the
// broad forest. Keep the park, piste and facility exclusions unchanged.
for (const patch of forestReferencePatches)
  for (let z = patch.z0 + 7; z < patch.z1; z += 28)
    for (let x = patch.bounds[0] + 7; x < patch.bounds[2]; x += 28) {
      const px = x + (forestRandom() - 0.5) * 6,
        pz = z + (forestRandom() - 0.5) * 6;
      if (forestPatchAt(px, pz)) treePlace(px, pz, true);
    }
// Give a narrow confirmed strip a sparse row even when the coarse grid misses it.
// Never bypass the same crown-aware clearance rules used by the main forest.
for (const patch of forestReferencePatches)
  for (let z = patch.z0 + 12; z < patch.z1 - 12; z += 36) {
    let candidate = null;
    for (let x = patch.bounds[0] + 3; x < patch.bounds[2] - 3; x += 3) {
      if (
        !forestPatchAt(x, z) ||
        forestClearance(x, z, 4).distance < 0 ||
        menglongPark.contains(x, z, 7)
      )
        continue;
      if (treeData.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 25 ** 2)) continue;
      const score = forestClearance(x, z, 4).distance;
      if (!candidate || score > candidate.score) candidate = { x, z, score };
    }
    if (candidate && treePlace(candidate.x, candidate.z, true))
      forestCounters.coverageRepairTrees++;
  }
// Paint once and use that same evidence to find thin woodland. Closing
// one-pixel gaps is only for measuring the width of the woodland, never for
// choosing planting sites. A margin around broad cores leaves their edges
// and existing spacing alone.
function forestFloorPixels() {
  const layer = surfaceLayers.forest,
    size = layer.canvas.width,
    source = document.createElement('canvas');
  source.width = source.height = size;
  const context = source.getContext('2d'),
    pixels = context.createImageData(size, size);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const x = GEO.extent[0] + ((i + 0.5) / size) * SURFACE_X,
        z = GEO.extent[3] - ((j + 0.5) / size) * SURFACE_Z,
        evidence = canopyEvidence(x, z);
      if (!evidence || menglongPark.contains(x, z, 3) || nearFacility(x, z, 4)) continue;
      const k = (j * size + i) * 4;
      pixels.data[k] = pixels.data[k + 1] = pixels.data[k + 2] = 255;
      pixels.data[k + 3] = evidence === 1 ? 135 : 205;
    }
  context.putImageData(pixels, 0, 0);
  layer.context.filter = 'blur(0.7px)';
  layer.context.drawImage(source, 0, 0);
  layer.context.filter = 'none';
  layer.texture.needsUpdate = true;
  return pixels;
}
function fillNarrowForestBelts({ width: size, data: pixels }) {
  const dx = SURFACE_X / size,
    dz = SURFACE_Z / size,
    diagonal = Math.hypot(dx, dz);
  const mask = new Uint8Array(size * size);
  const isWood = (k) => pixels[k * 4 + 3] !== 0;
  for (let j = 1; j < size - 1; j++)
    for (let i = 1; i < size - 1; i++) {
      const k = j * size + i;
      mask[k] = Number(
        isWood(k) || (isWood(k - 1) && isWood(k + 1)) || (isWood(k - size) && isWood(k + size)),
      );
    }
  // Chamfer distances in metres. Both passes use the map's actual x/z scale.
  function distances(isSeed) {
    const values = Float32Array.from(mask, (_, k) => (isSeed(k) ? 0 : Infinity));
    for (let j = 1; j < size - 1; j++)
      for (let i = 1; i < size - 1; i++) {
        const k = j * size + i;
        values[k] = Math.min(
          values[k],
          values[k - 1] + dx,
          values[k - size] + dz,
          values[k - size - 1] + diagonal,
          values[k - size + 1] + diagonal,
        );
      }
    for (let j = size - 2; j > 0; j--)
      for (let i = size - 2; i > 0; i--) {
        const k = j * size + i;
        values[k] = Math.min(
          values[k],
          values[k + 1] + dx,
          values[k + size] + dz,
          values[k + size - 1] + diagonal,
          values[k + size + 1] + diagonal,
        );
      }
    return values;
  }
  const toClearing = distances((k) => !mask[k]);
  const toBroadForest = distances((k) => toClearing[k] >= 20);
  const thin = Uint8Array.from(mask, (wood, k) =>
    Number(wood && toClearing[k] <= 17 && toBroadForest[k] >= 26),
  );
  const candidates = [],
    linearCandidates = [];
  const worldX = (k) => GEO.extent[0] + ((k % size) + 0.5) * dx;
  const worldZ = (k) => GEO.extent[3] - (Math.floor(k / size) + 0.5) * dz;
  const neighbours = [-1, 1, -size, size, -size - 1, -size + 1, size - 1, size + 1];
  for (let seed = 0; seed < thin.length; seed++) {
    if (!thin[seed]) continue;
    const belt = [seed];
    thin[seed] = 0;
    let minI = size,
      maxI = 0,
      minJ = size,
      maxJ = 0;
    for (let at = 0; at < belt.length; at++) {
      const k = belt[at],
        i = k % size,
        j = Math.floor(k / size);
      minI = Math.min(minI, i);
      maxI = Math.max(maxI, i);
      minJ = Math.min(minJ, j);
      maxJ = Math.max(maxJ, j);
      for (const offset of neighbours)
        if (thin[k + offset]) {
          thin[k + offset] = 0;
          belt.push(k + offset);
        }
    }
    if (belt.length < 3 || Math.hypot((maxI - minI) * dx, (maxJ - minJ) * dz) < 19) continue;
    // Fit the dominant axis in metres, independent of the raster orientation.
    // Short or roughly round patches still get the earlier sparse treatment.
    const meanX = belt.reduce((sum, k) => sum + worldX(k), 0) / belt.length;
    const meanZ = belt.reduce((sum, k) => sum + worldZ(k), 0) / belt.length;
    let xx = 0,
      xz = 0,
      zz = 0;
    for (const k of belt) {
      const x = worldX(k) - meanX,
        z = worldZ(k) - meanZ;
      xx += x * x;
      xz += x * z;
      zz += z * z;
    }
    const angle = 0.5 * Math.atan2(2 * xz, xx - zz),
      ux = Math.cos(angle),
      uz = Math.sin(angle);
    const along = (x, z) => (x - meanX) * ux + (z - meanZ) * uz;
    let start = Infinity,
      end = -Infinity;
    for (const k of belt) {
      const s = along(worldX(k), worldZ(k));
      start = Math.min(start, s);
      end = Math.max(end, s);
    }
    const length = end - start + Math.abs(ux) * dx + Math.abs(uz) * dz;
    const widthByArea = (belt.length * dx * dz) / length;
    const elongation = length / Math.max(widthByArea, Math.min(dx, dz));
    const linear = length >= 34 && elongation >= 2.6;
    const step = clamp(7.5 + widthByArea * 0.19, 9, 12);
    for (const k of belt) {
      if (!isWood(k)) continue;
      const x = worldX(k),
        z = worldZ(k);
      if (!inPolygon(x, z, resortTreeRing)) continue;
      const width = Math.max(Math.min(dx, dz), 2 * toClearing[k] - Math.min(dx, dz));
      const candidate = {
        x,
        z,
        width,
        broadMargin: toBroadForest[k],
        belt: seed,
        order: (Math.imul(k, 2654435761) >>> 0) / 4294967296,
      };
      candidates.push(candidate);
      if (linear)
        linearCandidates.push({
          ...candidate,
          length,
          elongation,
          step,
          station: Math.floor((along(x, z) - start) / step),
        });
    }
  }
  // Fill gaps in a seeded order so long belts get a scattered row instead of
  // a regular grid. The same capped batches continue to render all trees.
  candidates.sort((a, b) => a.order - b.order);
  const usedBelts = new Set(),
    limit = Math.ceil(treeData.length * 0.13);
  const linearLimit = Math.ceil(treeData.length * 0.055);
  function plantInGap(candidate, spacing, linear = false) {
    const { x, z, width, broadMargin, belt } = candidate;
    const cells = Math.ceil(spacing / 5);
    let chosen = null;
    for (const [u, v] of [
      [0, 0],
      [-0.25, 0],
      [0.25, 0],
      [0, -0.25],
      [0, 0.25],
    ]) {
      const px = x + u * dx,
        pz = z + v * dz;
      if (!canopyEvidence(px, pz) || menglongPark.contains(px, pz, 6) || nearFacility(px, pz, 8))
        continue;
      const clearance = forestClearance(px, pz).distance;
      if (clearance < 1.2 || clearance > 60) continue;
      const ix = Math.floor(px / 5),
        iz = Math.floor(pz / 5);
      let near = false;
      for (let i = -cells; i <= cells && !near; i++)
        for (let j = -cells; j <= cells; j++) {
          const tree = treeOccupied.get(ix + i + ',' + (iz + j));
          if (tree && (tree.x - px) ** 2 + (tree.z - pz) ** 2 < spacing ** 2) {
            near = true;
            break;
          }
        }
      if (!near && (!chosen || clearance > chosen.clearance)) chosen = { x: px, z: pz, clearance };
    }
    if (!chosen) return false;
    const metadata = { width, broadMargin, belt };
    if (linear)
      Object.assign(metadata, {
        linear: true,
        length: candidate.length,
        elongation: candidate.elongation,
      });
    return treePlace(chosen.x, chosen.z, true, metadata);
  }
  for (const candidate of candidates) {
    if (forestCounters.narrowBeltTrees >= limit) break;
    if (!plantInGap(candidate, clamp(10 + candidate.width * 0.18, 11, 16))) continue;
    forestCounters.narrowBeltTrees++;
    usedBelts.add(candidate.belt);
  }
  // Fill gaps along the fitted axis, at most one new tree per station.
  // Prefer the belt interior when several raster cells share a station.
  linearCandidates.sort(
    (a, b) =>
      b.length - a.length ||
      a.belt - b.belt ||
      a.station - b.station ||
      b.width - a.width ||
      a.order - b.order,
  );
  const filledStations = new Set(),
    linearBelts = new Set();
  for (const candidate of linearCandidates) {
    if (forestCounters.linearBeltTrees >= linearLimit || forestCounters.narrowBeltTrees >= limit)
      break;
    const key = candidate.belt + ':' + candidate.station;
    if (filledStations.has(key) || !plantInGap(candidate, candidate.step, true)) continue;
    filledStations.add(key);
    linearBelts.add(candidate.belt);
    usedBelts.add(candidate.belt);
    forestCounters.narrowBeltTrees++;
    forestCounters.linearBeltTrees++;
  }
  return {
    count: usedBelts.size,
    linearBelts: linearBelts.size,
    limit,
    eligibleCells: candidates.length,
  };
}
const narrowForestCoverage = fillNarrowForestBelts(forestFloorPixels());
// Thin only after belt placement: seeded interior trees and belt budgets remain exact.
const peripheralBefore = treeData.length;
function resortEdgeDistance(x, z) {
  let best = Infinity;
  for (let i = 0; i < resortTreeRing.length; i++) {
    const a = resortTreeRing[i],
      b = resortTreeRing[(i + 1) % resortTreeRing.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    best = Math.min(best, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
  }
  return best;
}
for (let i = treeData.length - 1; i >= 0; i--) {
  const tree = treeData[i];
  if (tree.foreground) continue;
  // Protect mapped runs outside the approximate resort polygon as well.
  if (pisteFootprintClearance(tree.x, tree.z).clearance < 100) continue;
  const distance = resortEdgeDistance(tree.x, tree.z),
    keep = distance < 160 ? 0.4 : distance < 400 ? 0.16 : distance < 800 ? 0.06 : 0;
  const sample = (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296;
  if (sample < keep) continue;
  treeData.splice(i, 1);
  forestCounters.background--;
  forestCounters[
    tree.source === 'user-reference'
      ? 'userConfirmed'
      : tree.source === 'source-forest'
        ? 'sourceForest'
        : 'satelliteInfill'
  ]--;
}
forestCounters.peripheralRemoved = peripheralBefore - treeData.length;
const obj = new THREE.Object3D(),
  treeGreen = new THREE.Color(),
  trunkGeo = new THREE.CylinderGeometry(0.38, 0.62, 1, 5),
  coneGeo = new THREE.ConeGeometry(1, 1, 5),
  snowCone = new THREE.ConeGeometry(1, 1, 5);
const trunks = new THREE.InstancedMesh(trunkGeo, material('#6a7367'), treeData.length);
forest.add(trunks);
const treeGround = treeData.map((tree) => displayGroundHeightAt(tree.x, tree.z));
for (let layer = 0; layer < 2; layer++) {
  const crowns = new THREE.InstancedMesh(coneGeo, material('#42655e'), treeData.length),
    caps = new THREE.InstancedMesh(snowCone, material('#d6e5e5'), treeData.length);
  treeData.forEach((t, i) => {
    const y = treeGround[i];
    if (layer === 0) {
      obj.position.set(t.x, y + t.h * 0.18, t.z);
      obj.scale.set(1, t.h * 0.36, 1);
      obj.rotation.set(0, t.angle, 0);
      obj.updateMatrix();
      trunks.setMatrixAt(i, obj.matrix);
    }
    const size = layer === 0 ? 1 : 0.65,
      cy = y + t.h * (layer === 0 ? 0.34 : 0.71),
      ch = t.h * (layer === 0 ? 0.67 : 0.57),
      w = t.w * size;
    obj.position.set(t.x, cy, t.z);
    obj.scale.set(w, ch, w);
    obj.rotation.set(0, t.angle + layer * 0.4, 0);
    obj.updateMatrix();
    crowns.setMatrixAt(i, obj.matrix);
    treeGreen.setHSL(0.405 + t.tint * 0.025, 0.19, 0.21 + t.tint * 0.12);
    crowns.setColorAt(i, treeGreen);
    obj.position.set(t.x - w * 0.07, cy + ch * 0.24, t.z - w * 0.08);
    obj.scale.set(w * 0.62, ch * 0.58, w * 0.62);
    obj.updateMatrix();
    caps.setMatrixAt(i, obj.matrix);
  });
  crowns.castShadow = layer === 0;
  crowns.receiveShadow = true;
  caps.receiveShadow = true;
  forest.add(crowns, caps);
  treeSnowCaps.push(caps);
}
forest.children.forEach((m) => nightSurface(m.material, m === trunks ? 0.22 : 0.85));
forest.userData.coverage = {
  ...forestCounters,
  count: treeData.length,
  previousCount: 11347,
  originalCount: 13000,
  layersPerTree: 2,
  nearSpacingM: 44,
  farSpacingM: 110,
  confirmedStripSpacingM: 28,
  narrowForestCoverage,
  method:
    'OSM forest + satellite canopy, sparse broad forest and gap filling in narrow woodland, crown-aware piste/lift/park/site clearance',
  image: 'research/satellite.jpg',
  treePositions: 'visual samples, not surveyed',
};
