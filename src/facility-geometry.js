// Rendering clearances are separate from the unmodified source DEM / route coordinates.
const facilityGrounds = [],
  solidVolumes = [],
  stationRecords = [];
let solidRevision = 0;
function terrainMaximum(bounds, step = 2) {
  let high = -Infinity;
  const nx = Math.max(1, Math.ceil((bounds.max.x - bounds.min.x) / step)),
    nz = Math.max(1, Math.ceil((bounds.max.z - bounds.min.z) / step));
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++)
      high = Math.max(
        high,
        heightAt(
          lerp(bounds.min.x, bounds.max.x, i / nx),
          lerp(bounds.min.z, bounds.max.z, j / nz),
        ),
      );
  return high;
}
function registerSolids(g, owner) {
  solidRevision++;
  g.updateWorldMatrix(true, true);
  g.traverse((m) => {
    if (
      !m.isMesh ||
      !['BoxGeometry', 'CylinderGeometry'].includes(m.geometry.type) ||
      m.material.transparent
    )
      return;
    m.geometry.computeBoundingBox();
    const local = m.geometry.boundingBox,
      scale = new V(),
      rotation = new THREE.Quaternion(),
      translation = new V();
    m.matrixWorld.decompose(translation, rotation, scale);
    let referenceAccess = false;
    for (let parent = m; parent; parent = parent.parent)
      if (parent.userData.estimatedSiteDetail || parent.userData.pendingSnowAccess)
        referenceAccess = true;
    solidVolumes.push({
      owner,
      referenceAccess,
      bounds: new THREE.Box3().setFromObject(m),
      center: local.getCenter(new V()).applyMatrix4(m.matrixWorld),
      half: local.getSize(new V()).multiply(scale).multiplyScalar(0.5),
      axes: [new V(1, 0, 0), new V(0, 1, 0), new V(0, 0, 1)].map((v) =>
        v.applyQuaternion(rotation),
      ),
    });
  });
}
function orientedOverlap(a, b) {
  if (a.bounds && b.bounds && !a.bounds.intersectsBox(b.bounds)) return false;
  const delta = b.center.clone().sub(a.center),
    axes = [...a.axes, ...b.axes];
  for (const x of a.axes) for (const y of b.axes) axes.push(x.clone().cross(y));
  for (const axis of axes) {
    if (axis.lengthSq() < 1e-9) continue;
    axis.normalize();
    let ra = 0,
      rb = 0;
    for (let i = 0; i < 3; i++) {
      ra += a.half.getComponent(i) * Math.abs(a.axes[i].dot(axis));
      rb += b.half.getComponent(i) * Math.abs(b.axes[i].dot(axis));
    }
    if (Math.abs(delta.dot(axis)) >= ra + rb - 0.015) return false;
  }
  return true;
}
function vehicleVolume(rt, u) {
  const { p, tangent } = rt.loopPoint(u),
    gondola = rt.lift.type === 'gondola',
    drop = gondola ? 5.35 : 3.84;
  const volume = {
    center: p.clone().add(new V(0, (0.05 - drop) / 2, 0)),
    half: new V(gondola ? 1.38 : 1.66, (drop + 0.05) / 2 + 0.06, gondola ? 1.26 : 0.49),
    axes: [
      new V(tangent.z, 0, -tangent.x).normalize(),
      new V(0, 1, 0),
      tangent.clone().normalize(),
    ],
  };
  const extent = new V();
  volume.axes.forEach((axis, i) => {
    extent.x += Math.abs(axis.x) * volume.half.getComponent(i);
    extent.y += Math.abs(axis.y) * volume.half.getComponent(i);
    extent.z += Math.abs(axis.z) * volume.half.getComponent(i);
  });
  volume.bounds = new THREE.Box3(
    volume.center.clone().sub(extent),
    volume.center.clone().add(extent),
  );
  return volume;
}
// Broad phase only: retain the original ordered, oriented-box collision test.
// Most frames are above the resort and need no per-building checks at all.
let cameraSolidIndex = null,
  cameraSolidCount = -1,
  cameraSolidMinY = Infinity,
  cameraSolidMaxY = -Infinity;
function cameraSolidsAt(p) {
  const size = 80,
    key = (x, z) => Math.floor(x / size) + ',' + Math.floor(z / size);
  if (!cameraSolidIndex || cameraSolidCount !== solidVolumes.length) {
    cameraSolidIndex = new Map();
    cameraSolidCount = solidVolumes.length;
    cameraSolidMinY = Infinity;
    cameraSolidMaxY = -Infinity;
    solidVolumes.forEach((s, id) => {
      const b = s.bounds;
      cameraSolidMinY = Math.min(cameraSolidMinY, b.min.y - 1);
      cameraSolidMaxY = Math.max(cameraSolidMaxY, b.max.y + 1);
      for (let x = Math.floor((b.min.x - 1) / size); x <= Math.floor((b.max.x + 1) / size); x++)
        for (let z = Math.floor((b.min.z - 1) / size); z <= Math.floor((b.max.z + 1) / size); z++) {
          const k = x + ',' + z;
          if (!cameraSolidIndex.has(k)) cameraSolidIndex.set(k, []);
          cameraSolidIndex.get(k).push(id);
        }
    });
  }
  return p.y < cameraSolidMinY || p.y > cameraSolidMaxY
    ? []
    : cameraSolidIndex.get(key(p.x, p.z)) || [];
}
function protectCamera(p) {
  for (let pass = 0; pass < 3; pass++) {
    let candidates = cameraSolidsAt(p),
      last = -1;
    for (let at = 0; at < candidates.length; at++) {
      const id = candidates[at];
      if (id <= last) continue;
      last = id;
      const s = solidVolumes[id],
        b = s.bounds;
      if (
        p.x < b.min.x - 1 ||
        p.x > b.max.x + 1 ||
        p.y < b.min.y - 1 ||
        p.y > b.max.y + 1 ||
        p.z < b.min.z - 1 ||
        p.z > b.max.z + 1
      )
        continue;
      const d = p.clone().sub(s.center),
        q = s.axes.map((a) => d.dot(a)),
        half = [s.half.x + 0.9, s.half.y + 0.9, s.half.z + 0.9];
      if (q.some((v, i) => Math.abs(v) >= half[i])) continue;
      let i = 0;
      for (let j = 1; j < 3; j++) if (half[j] - Math.abs(q[j]) < half[i] - Math.abs(q[i])) i = j;
      p.addScaledVector(s.axes[i], (q[i] < 0 ? -1 : 1) * (half[i] - Math.abs(q[i]) + 0.05));
      // A push may enter another cell: continue at the next original solid ID.
      candidates = cameraSolidsAt(p);
      at = -1;
    }
  }
  return p;
}
function carrierFrames(rt, u) {
  const { p, tangent } = rt.loopPoint(u),
    right = new V(tangent.z, 0, -tangent.x).normalize(),
    along = rt
      .loopPoint(u + 0.00001)
      .p.sub(rt.loopPoint(u - 0.00001).p)
      .normalize(),
    up = along.clone().cross(right).normalize();
  return {
    p,
    body: [right, new V(0, 1, 0), tangent.clone().normalize()],
    rope: [right, up, along],
  };
}
function vehicleParts(rt, u) {
  const frames = carrierFrames(rt, u),
    p = frames.p;
  return rt.parts.map((part) => {
    const axes = part.mesh.geometry.userData.ropeAligned ? frames.rope : frames.body,
      d = part.mesh.geometry.parameters,
      half = new V(d.width / 2 + 0.055, d.height / 2 + 0.055, d.depth / 2 + 0.055),
      offset = part.mesh.geometry.userData.vehicleOffset || [0, 0, 0],
      center = p
        .clone()
        .addScaledVector(axes[0], offset[0])
        .addScaledVector(axes[1], part.y + offset[1])
        .addScaledVector(axes[2], offset[2]),
      extent = new V();
    axes.forEach((axis, i) => {
      extent.x += Math.abs(axis.x) * half.getComponent(i);
      extent.y += Math.abs(axis.y) * half.getComponent(i);
      extent.z += Math.abs(axis.z) * half.getComponent(i);
    });
    return {
      center,
      half,
      axes,
      bounds: new THREE.Box3(center.clone().sub(extent), center.clone().add(extent)),
    };
  });
}
function foundation(g, owner, kind = 'hotel', pad = 0.7, footprint = null) {
  if (kind === 'hotel' && footprint) return hotelSite(g, owner, footprint);
  g.updateWorldMatrix(true, true);
  let bounds = new THREE.Box3().setFromObject(g);
  const high = terrainMaximum(bounds),
    dy = high + 0.85 - bounds.min.y;
  g.position.y += dy;
  g.updateWorldMatrix(true, true);
  bounds = new THREE.Box3().setFromObject(g);
  const lo = bounds.min,
    hi = bounds.max,
    top = lo.y + 0.02,
    x0 = lo.x - pad,
    x1 = hi.x + pad,
    z0 = lo.z - pad,
    z1 = hi.z + pad;
  const vertices = [],
    indices = [],
    edge = [];
  for (const [ax, az, bx, bz] of [
    [x0, z0, x1, z0],
    [x1, z0, x1, z1],
    [x1, z1, x0, z1],
    [x0, z1, x0, z0],
  ]) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 2);
    for (let i = 0; i < n; i++) edge.push([lerp(ax, bx, i / n), lerp(az, bz, i / n)]);
  }
  edge.push(edge[0]);
  for (let i = 0; i < edge.length; i++) {
    const [x, z] = edge[i];
    vertices.push(x, top, z, x, heightAt(x, z) - 0.7, z);
    if (i) {
      const k = i * 2;
      indices.push(k - 2, k - 1, k, k, k - 1, k + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const wall = new THREE.Mesh(geo, material('#9ca9a4', { side: THREE.DoubleSide }));
  wall.receiveShadow = true;
  buildings.add(wall);
  const slab = box(
    x1 - x0,
    0.25,
    z1 - z0,
    material('#d7dfda'),
    (x0 + x1) / 2,
    top - 0.125,
    (z0 + z1) / 2,
  );
  const record = {
    owner,
    kind,
    bounds: bounds.clone(),
    groundHigh: high,
    base: lo.y,
    top,
    deltaY: dy,
    group: g,
    wall,
    slab,
  };
  facilityGrounds.push(record);
  return record;
}
// Hotel courts, lower roads and snow access are separate local surfaces; the source DEM stays intact.
const hotelDisplaySites = [];
function hotelEntryThreshold(site, point) {
  let nearest = null,
    best = Infinity;
  for (let i = 0; i < site.footprint.length; i++) {
    const a = site.footprint[i],
      b = site.footprint[(i + 1) % site.footprint.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    if (length < 0.01) continue;
    const t = clamp(((point.x - a[0]) * dx + (point.z - a[1]) * dz) / (length * length), 0, 1);
    const x = a[0] + t * dx,
      z = a[1] + t * dz,
      d = Math.hypot(point.x - x, point.z - z);
    if (d >= best) continue;
    let nx = -dz / length,
      nz = dx / length;
    if (inPolygon(x + nx * 0.15, z + nz * 0.15, site.footprint)) {
      nx = -nx;
      nz = -nz;
    }
    nearest = { x, z, nx, nz, distance: d };
    best = d;
  }
  return nearest;
}
function blendHotelEntranceGround(positions, sampleGround) {
  const smooth = (t) => {
    const u = clamp(t, 0, 1);
    return u * u * u * (10 + u * (-15 + 6 * u));
  };
  const connections = { 1: [-30, 30], 2: [-45, 24], 3: [0, 28], 4: [75, 30], 5: [-75, 25] };
  for (const hotel of hotels.filter((h) => h.siteAccess?.lobby)) {
    const site = hotelDisplaySites.find((s) => s.owner === 'hotel-' + hotel.id);
    if (!site) continue;
    const [x, z] = hotel.siteAccess.lobby,
      point = hotel.group.localToWorld(new V(x, 0, z));
    const entry = hotelEntryThreshold(site, point);
    if (!entry) continue;
    const { x: ex, z: ez, nx, nz, distance } = entry,
      level = hotel.group.position.y + (hotel.siteAccess.lobbyLevel || 0) - 0.025;
    const flat = Math.max(5.5, distance + 2);
    const [bearing, reach] = connections[hotel.id],
      angle = (bearing * Math.PI) / 180;
    const ax = nx * Math.cos(angle) - nz * Math.sin(angle),
      az = nz * Math.cos(angle) + nx * Math.sin(angle);
    const endHeight = sampleGround(ex + ax * reach, ez + az * reach);
    site.entranceGround = { ...entry, flat, level, connection: { ax, az, reach } };
    for (let i = 0; i < positions.length; i += 3) {
      const dx = positions[i] - ex,
        dz = positions[i + 2] - ez;
      if (Math.abs(dx) > reach + 12 || Math.abs(dz) > reach + 12) continue;
      const along = dx * nx + dz * nz,
        across = Math.abs(dx * nz - dz * nx);
      const run = dx * ax + dz * az,
        offset = Math.abs(dx * az - dz * ax);
      const apron =
        smooth((along + 5) / 3) * (1 - smooth((along - flat) / 5)) * (1 - smooth((across - 3) / 6));
      const approach =
        smooth((run + 2) / 2) *
        (1 - smooth((run - reach + 6) / 6)) *
        (1 - smooth((offset - 3.5) / 4.5));
      if (!apron && !approach) continue;
      if (hotelSnowFlow.blocked(positions[i], positions[i + 2]) && along > 0) continue;
      const clearance = pisteFootprintClearance(positions[i], positions[i + 2]).clearance;
      const preserveSnow = smooth((clearance - 1.7) / 2);
      const pathHeight = lerp(level, endHeight, smooth((run - flat) / (reach - flat)));
      const graded = lerp(pathHeight, level, apron);
      positions[i + 1] = lerp(positions[i + 1], graded, Math.max(apron, approach) * preserveSnow);
    }
  }
}
function blendBaseFrontageGround(positions, sampleGround) {
  const layer = surfaceLayers.piste;
  const pixels = layer.context.getImageData(0, 0, SURFACE_SIZE, SURFACE_SIZE).data;
  const snowAt = (x, z) => {
    const [u, v] = surfacePixel([x, z]);
    return pixels[(Math.floor(v) * SURFACE_SIZE + Math.floor(u)) * 4 + 3] > 120;
  };
  const sites = [
    ...hotelDisplaySites.filter((s) => s.flowRestored),
    ...hotelSnowFlow.obstacles.filter((o) => o.structuralFootprint),
  ];
  for (const site of sites) {
    const p = site.polygon || site.footprint,
      area = p.reduce((sum, a, i) => {
        const b = p[(i + 1) % p.length];
        return sum + a[0] * b[1] - a[1] * b[0];
      }, 0);
    const samples = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      if (length < 0.01) continue;
      const nx = (Math.sign(area) * dz) / length,
        nz = (-Math.sign(area) * dx) / length,
        count = Math.ceil(length / 2.5);
      for (let j = 0; j < count; j++) {
        const x = a[0] + (dx * (j + 0.5)) / count,
          z = a[1] + (dz * (j + 0.5)) / count;
        if (![2.5, 5, 8].some((d) => snowAt(x + nx * d, z + nz * d))) continue;
        const ground = sampleGround(x + nx * 5, z + nz * 5);
        if (ground !== null) samples.push({ x, z, nx, nz, ground });
      }
    }
    if (!samples.length) continue;
    if (site.flowRestored) {
      site.snowFrontage = samples;
      const obstacle = hotelSnowFlow.obstacles.find((o) => o.owner === site.owner);
      if (obstacle) obstacle.snowFrontage = samples;
    }
    const xs = samples.map((s) => s.x),
      zs = samples.map((s) => s.z);
    const x0 = Math.min(...xs) - 8,
      x1 = Math.max(...xs) + 8,
      z0 = Math.min(...zs) - 8,
      z1 = Math.max(...zs) + 8;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i],
        z = positions[i + 2],
        height = positions[i + 1];
      if (
        x < x0 ||
        x > x1 ||
        z < z0 ||
        z > z1 ||
        hotelSnowFlow.blocked(x, z) ||
        pisteFootprintClearance(x, z).clearance < 3.5
      )
        continue;
      let delta = 0,
        total = 0,
        coverage = 0;
      for (const s of samples) {
        const dx = x - s.x,
          dz = z - s.z,
          normal = dx * s.nx + dz * s.nz,
          side = Math.abs(dx * s.nz - dz * s.nx);
        if (normal < 0 || normal > 8 || side > 5) continue;
        const u = 1 - normal / 8,
          v = 1 - side / 5,
          weight = u * u * (3 - 2 * u) * v * v * (3 - 2 * v);
        delta += weight * clamp(s.ground - height, -0.65, 0.65);
        total += weight;
        coverage = Math.max(coverage, weight);
      }
      if (total) positions[i + 1] += (delta / total) * coverage;
    }
  }
}
function addHotelSnowPlinths(sampleGround) {
  const apronMaterial = material('#c6cfcc', { roughness: 0.94, side: THREE.DoubleSide });
  for (const site of hotelDisplaySites.filter((s) => s.snowFrontage?.length)) {
    const positions = [],
      indices = [];
    for (const [i, a] of site.snowFrontage.entries()) {
      const b = site.snowFrontage[i + 1];
      if (!b || Math.hypot(a.x - b.x, a.z - b.z) > 3.1 || a.nx * b.nx + a.nz * b.nz < 0.98)
        continue;
      const start = positions.length / 3;
      for (const p of [a, b])
        for (const depth of [0.02, 1.6]) {
          const x = p.x - p.nx * depth,
            z = p.z - p.nz * depth;
          positions.push(x, Math.max(site.top, sampleGround(x, z) ?? site.top) + 0.035, z);
        }
      indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
    }
    if (!indices.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, apronMaterial);
    mesh.receiveShadow = true;
    mesh.userData.snowSidePlinth = site.owner;
    buildings.add(mesh);
  }
}
function hotelHull(points) {
  const p = points.map((q) => q.slice()).sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]),
    a = [],
    b = [];
  for (const q of p) {
    while (a.length > 1 && cross(a.at(-2), a.at(-1), q) <= 0) a.pop();
    a.push(q);
  }
  for (const q of p.slice().reverse()) {
    while (b.length > 1 && cross(b.at(-2), b.at(-1), q) <= 0) b.pop();
    b.push(q);
  }
  a.pop();
  b.pop();
  return a.concat(b);
}
function hotelEdgeDistance(x, z, p) {
  let best = Infinity;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
  }
  return best;
}
function hotelExpandConvex(poly, distance) {
  const area = poly.reduce((s, p, i) => {
      const q = poly[(i + 1) % poly.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
    sign = area >= 0 ? 1 : -1;
  return poly.map((p, i) => {
    const a = poly[(i + poly.length - 1) % poly.length],
      b = poly[(i + 1) % poly.length],
      u = [p[0] - a[0], p[1] - a[1]],
      v = [b[0] - p[0], b[1] - p[1]],
      lu = Math.hypot(...u) || 1,
      lv = Math.hypot(...v) || 1,
      n = [(sign * u[1]) / lu, (-sign * u[0]) / lu],
      m = [(sign * v[1]) / lv, (-sign * v[0]) / lv],
      factor = distance / Math.max(0.025, 1 + n[0] * m[0] + n[1] * m[1]);
    return [p[0] + (n[0] + m[0]) * factor, p[1] + (n[1] + m[1]) * factor];
  });
}
function hotelDisplayGroundHeightAt(x, z) {
  let y = null;
  for (const s of hotelDisplaySites) {
    if (s.flowRestored) {
      if (inPolygon(x, z, s.footprint)) y = s.top;
      continue;
    }
    if (!inPolygon(x, z, s.outer)) continue;
    let h = heightAt(x, z),
      changed = false;
    for (const r of s.regions) {
      const inside = inPolygon(x, z, r.polygon),
        d = inside ? 0 : hotelEdgeDistance(x, z, r.polygon);
      if (d > r.feather) continue;
      const t = inside ? 1 : 1 - d / r.feather,
        w = t * t * (3 - 2 * t);
      h = lerp(h, r.heightAt ? r.heightAt(x, z) : r.height, w);
      changed = true;
    }
    if (changed) y = h;
  }
  return y;
}
function hotelClip(poly, boundary) {
  let out = poly;
  for (let i = 0; i < boundary.length && out.length; i++) {
    const a = boundary[i],
      b = boundary[(i + 1) % boundary.length],
      side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]),
      input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j],
        q = input[(j + 1) % input.length],
        dp = side(p),
        dq = side(q);
      if (dp >= -1e-8) out.push(p);
      if (dp >= 0 !== dq >= 0) {
        const t = dp / (dp - dq);
        out.push([lerp(p[0], q[0], t), lerp(p[1], q[1], t)]);
      }
    }
  }
  return out;
}
function hotelSite(g, owner, polygon) {
  g.updateWorldMatrix(true, true);
  const initialBounds = new THREE.Box3().setFromObject(g),
    plan = g.userData.hotelSitePlan || {},
    terrainSamples = polygon.map((p) => heightAt(...p)),
    low = Math.min(...terrainSamples),
    high = Math.max(...terrainSamples),
    toWorld = (p) => {
      const q = g.localToWorld(new V(p[0], 0, p[1]));
      return [q.x, q.z];
    };
  let base = low + 1;
  if (plan.roadAnchor) {
    const p = toWorld(plan.roadAnchor);
    base = heightAt(...p) + 0.12 - (plan.roadLevel || 0);
  }
  const gradedFloor = window.__FINAL_CROSSFALL_PATCH__?.siteLevels?.[owner];
  if (/^hotel-[235]$/.test(owner) && Number.isFinite(gradedFloor)) base = gradedFloor + 0.025;
  const previous = g.position.y;
  g.position.y = base;
  g.updateWorldMatrix(true, true);
  const regions = [
    { kind: 'building-footprint', polygon: polygon.slice(), height: base - 0.025, feather: 2.5 },
  ];
  for (const r of plan.regions || [])
    regions.push({
      kind: r.kind,
      polygon: r.polygon.map(toWorld),
      height: base + (r.level || 0) - 0.025,
      feather: r.feather || 4,
    });
  if (plan.afterBase) plan.afterBase(base, regions, toWorld);
  const points = regions.flatMap((r) => r.polygon),
    hull = hotelHull(points),
    center = hull.reduce((s, p) => [s[0] + p[0] / hull.length, s[1] + p[1] / hull.length], [0, 0]),
    outer = hotelHull(
      hull.map((p) => {
        const dx = p[0] - center[0],
          dz = p[1] - center[1],
          d = Math.hypot(dx, dz) || 1;
        return [p[0] + (dx / d) * 8, p[1] + (dz / d) * 8];
      }),
    ),
    bounds = new THREE.Box3().setFromObject(g),
    siteBounds = new THREE.Box3();
  outer.forEach((p) => siteBounds.expandByPoint(new V(p[0], base, p[1])));
  const record = {
    owner,
    kind: 'hotel',
    mode: 'layered-local-site',
    bounds: bounds.clone(),
    siteBounds,
    groundHigh: high,
    groundLow: low,
    base,
    top: base - 0.025,
    deltaY: base - previous,
    maxFillHeight: Math.max(0, base - low),
    cutDepth: high - base,
    demPreserved: true,
    footprint: polygon,
    outer,
    regions,
  };
  record.flowRestored = /^hotel-[1-5]$/.test(owner);
  if (record.flowRestored) record.mode = 'footprint-core-with-retaining-edge';
  hotelDisplaySites.push(record);
  facilityGrounds.push(record);
  return record;
}
function finalizeHotelSites() {
  const mat = material('#ffffff', { roughness: 0.98, side: THREE.DoubleSide, vertexColors: true });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  mat.polygonOffsetUnits = -1;
  for (const s of hotelDisplaySites) {
    if (s.surfaceMesh) continue;
    if (s.flowRestored) {
      s.surfaceMesh = hotelCoreSurface(s);
      continue;
    }
    // The terrain cut is a nearest-filtered geographic texture. Its edge can
    // cover part of the next texel outside the exact cut polygon. Previously
    // the replacement mesh stopped at that same polygon, leaving triangular
    // holes through to the low background plane. A source-height overlap ring
    // covers the raster edge, without expanding the graded / cut area itself.
    const guard = (Math.hypot(SURFACE_X, SURFACE_Z) / SURFACE_SIZE) * 1.15,
      renderOuter = hotelExpandConvex(s.outer, guard);
    s.renderOuter = renderOuter;
    s.surfaceOverlapGuardM = guard;
    // Align the surface grid with the court / road edge. A world-axis grid
    // sliced diagonally by a long retaining wall made its snow contact line
    // oscillate once per cell, despite the analytic edge being straight.
    const reference = s.regions.find((r) => r.kind === 'lower-road')?.polygon || s.footprint;
    let length = 0,
      axis = [1, 0];
    for (let i = 0; i < reference.length; i++) {
      const a = reference[i],
        b = reference[(i + 1) % reference.length],
        d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d > length) {
        length = d;
        axis = [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
      }
    }
    const toGrid = (p) => [p[0] * axis[0] + p[1] * axis[1], -p[0] * axis[1] + p[1] * axis[0]],
      fromGrid = (p) => [p[0] * axis[0] - p[1] * axis[1], p[0] * axis[1] + p[1] * axis[0]],
      gridOuter = renderOuter.map(toGrid),
      xs = gridOuter.map((p) => p[0]),
      zs = gridOuter.map((p) => p[1]),
      x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      z0 = Math.min(...zs),
      z1 = Math.max(...zs),
      step = 0.8,
      vertices = [],
      indices = [],
      colours = [],
      white = new THREE.Color('#edf1eb'),
      cold = new THREE.Color('#d9e4e7');
    const sample = (x, z) => hotelDisplayGroundHeightAt(x, z) ?? heightAt(x, z);
    for (let z = z0; z < z1; z += step)
      for (let x = x0; x < x1; x += step) {
        const q = hotelClip(
          [
            [x, z],
            [Math.min(x + step, x1), z],
            [Math.min(x + step, x1), Math.min(z + step, z1)],
            [x, Math.min(z + step, z1)],
          ],
          gridOuter,
        );
        if (q.length < 3) continue;
        const start = vertices.length / 3;
        for (const gp of q) {
          const p = fromGrid(gp);
          vertices.push(p[0], sample(...p), p[1]);
          const colour = white.clone().lerp(cold, 0.13 + 0.06 * Math.sin(p[0] * 0.012));
          colours.push(colour.r, colour.g, colour.b);
        }
        for (let i = 1; i < q.length - 1; i++) indices.push(start, start + i + 1, start + i);
      }
    // A clipped cell used to have its own independent edge vertices/normals.
    // On a curved snow transition that produced a row of triangular light/dark
    // teeth at every cell boundary, clearly visible beside the summit facade
    // and hotel retaining edges. Share the vertices; the surface itself stays
    // at the exact same displayed heights and the source DEM stays intact.
    const welded = new Map(),
      positions = [],
      colors = [],
      remap = [],
      joined = [];
    for (let i = 0; i < vertices.length / 3; i++) {
      const k = i * 3,
        key = [vertices[k], vertices[k + 1], vertices[k + 2]]
          .map((v) => Math.round(v * 10000))
          .join(',');
      let j = welded.get(key);
      if (j === undefined) {
        j = positions.length / 3;
        welded.set(key, j);
        positions.push(vertices[k], vertices[k + 1], vertices[k + 2]);
        colors.push(colours[k], colours[k + 1], colours[k + 2]);
      }
      remap[i] = j;
    }
    for (const i of indices) joined.push(remap[i]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(joined);
    geom.computeVertexNormals();
    const m = new THREE.Mesh(geom, mat);
    m.userData.hotelGround = true;
    m.userData.owner = s.owner;
    m.userData.sharedSiteNormals = true;
    m.receiveShadow = true;
    buildings.add(m);
    s.surfaceMesh = m;
    addSiteCut(s.outer, Math.min(s.groundLow, s.base, ...s.regions.map((r) => r.height)) - 3);
  }
}
function nearFacility(x, z, pad = 9) {
  return facilityGrounds.some((f) => {
    const b = f.siteBounds || f.bounds;
    return x > b.min.x - pad && x < b.max.x + pad && z > b.min.z - pad && z < b.max.z + pad;
  });
}
let cabinIndex = null,
  cabinIndexCount = -1;
function cabinSolidsAt(x, z, radius) {
  if (!cabinIndex || cabinIndexCount !== solidRevision) {
    cabinIndex = new Map();
    cabinIndexCount = solidRevision;
    for (const s of solidVolumes) {
      const b = s.bounds;
      for (let i = Math.floor(b.min.x / 80); i <= Math.floor(b.max.x / 80); i++)
        for (let j = Math.floor(b.min.z / 80); j <= Math.floor(b.max.z / 80); j++) {
          const key = i + ',' + j;
          if (!cabinIndex.has(key)) cabinIndex.set(key, []);
          cabinIndex.get(key).push(s);
        }
    }
  }
  const result = new Set();
  for (let i = Math.floor((x - radius) / 80); i <= Math.floor((x + radius) / 80); i++)
    for (let j = Math.floor((z - radius) / 80); j <= Math.floor((z + radius) / 80); j++)
      for (const s of cabinIndex.get(i + ',' + j) || []) result.add(s);
  return result;
}
function cabinObstacleTop(x, z, radius = 2.2) {
  let top = -Infinity;
  for (const s of cabinSolidsAt(x, z, radius)) {
    const b = s.bounds;
    if (
      x <= b.min.x - radius ||
      x >= b.max.x + radius ||
      z <= b.min.z - radius ||
      z >= b.max.z + radius
    )
      continue;
    // A rotated facade's world AABB includes empty corners. Test its actual
    // projected oriented footprint before demanding a rope detour over its roof.
    const dx = x - s.center.x,
      dz = z - s.center.z;
    let outside = false;
    for (const edge of s.axes) {
      const len = Math.hypot(edge.x, edge.z);
      if (len < 1e-6) continue;
      const nx = -edge.z / len,
        nz = edge.x / len;
      let extent = radius;
      for (let i = 0; i < 3; i++)
        extent += s.half.getComponent(i) * Math.abs(s.axes[i].x * nx + s.axes[i].z * nz);
      if (Math.abs(dx * nx + dz * nz) > extent) {
        outside = true;
        break;
      }
    }
    if (!outside) top = Math.max(top, b.max.y);
  }
  return top;
}
// Local construction terraces, separate from the original surveyed DEM. The
// terrain refinement applies this to its visible triangles and height sampler.
function buildingGroundRefinement(x, z, raw, previousSite = false) {
  let result = raw;
  let stationCourtDistance = Infinity;
  const station = liftSurfaceHeight(x, z, localDemMode && !previousSite),
    source = heightAt(x, z);
  result += station - source;
  for (const site of hotelDisplaySites.filter((s) => s.flowRestored)) {
    // The building owns an explicit floor and retaining wall. Do not pull the
    // exterior ski slope toward its floor merely to fill an invisible interior.
    for (const region of site.regions.filter(
      (r) => site.owner === 'hotel-1' && r.kind === 'snow-apron',
    )) {
      const inside = inPolygon(x, z, region.polygon),
        distance = inside ? 0 : hotelEdgeDistance(x, z, region.polygon);
      stationCourtDistance = Math.min(stationCourtDistance, distance);
      // Snow access must recover a multi-metre DEM difference as a skiable slope.
      // The flat threshold remains only 3 m deep; this is its sloping transition.
      const feather = Math.max(60, region.feather || 0);
      if (distance >= feather) continue;
      const desired = region.heightAt ? region.heightAt(x, z) : region.height;
      // Legacy broad courts are conceptual, not permission to excavate a hillside.
      const target =
        region.kind === 'building-footprint' ? desired : source + clamp(desired - source, -6, 6);
      const u = 1 - distance / feather,
        w = u * u * (3 - 2 * u);
      result = lerp(result, target, w);
    }
    const hotel = hotels.find((h) => 'hotel-' + h.id === site.owner);
    if (hotel?.siteAccess?.lobby) {
      const [lx, lz] = hotel.siteAccess.lobby,
        p = hotel.group.localToWorld(new V(lx, 0, lz));
      const d = Math.hypot(x - p.x, z - p.z),
        u = 1 - THREE.MathUtils.smoothstep(d, 4.5, 18);
      const level = hotel.group.position.y + (hotel.siteAccess.lobbyLevel || 0) - 0.025;
      if (u > 0) result = lerp(result, source + clamp(level - source, -6, 6), u);
    }
  }
  if (localDemMode) {
    // Keep a level boarding area and grade outwards at a controlled pitch.
    // A direct height blend to the lower hill doubles the grade midway.
    const pair = stationSite(1, 0),
      dx = x - pair.center.x,
      dz = z - pair.center.z;
    const u = dx * pair.side.x + dz * pair.side.z,
      v = dx * pair.dir.x + dz * pair.dir.z;
    const smooth = THREE.MathUtils.smoothstep;
    const oldCourt =
      smooth(stationCourtDistance, 0, 5) *
      (1 - smooth(Math.abs(u), 18, 33)) *
      smooth(v, -49, -22) *
      (1 - smooth(v, 9, 17));
    const platformGround = lerp(result, source + clamp(pair.base - source, -6, 10), oldCourt);
    if (previousSite) return platformGround;
    const distance = Math.hypot(Math.max(0, Math.abs(u) - 19), Math.max(0, -v - 23.5));
    if (distance < 86 && v < 17) {
      const run = Math.hypot(distance, 3) - 3;
      const ramp = pair.base - 0.27 * run - 0.006 * Math.max(0, run - 39) ** 2;
      const lift = ramp - result;
      const join = 0.45;
      const fill = lift <= -join ? 0 : lift >= join ? lift : (lift + join) ** 2 / (4 * join);
      const hotelLimit = 0.27 * Math.max(0, stationCourtDistance - 5);
      const graded =
        result +
        Math.min(fill, hotelLimit) * (1 - smooth(v, 9, 17)) * (1 - smooth(distance, 76, 86));
      // Keep the verified apron immediately beneath and beside the platforms.
      const platformWeight = (1 - smooth(Math.abs(u), 22, 29)) * smooth(v, -25, -20);
      result = lerp(graded, platformGround, platformWeight);
    }
  }
  return result;
}
