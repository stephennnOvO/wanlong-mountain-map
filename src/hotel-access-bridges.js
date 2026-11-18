// Photo-referenced hotel access bridges. Dimensions are model estimates; the
// two-level road/piste relationship is retained instead of restoring broad pads.
const hotelAccessBridges = [];
for (const id of [2, 5]) {
  const h = hotels.find((h) => h.id === id),
    ref = h.referenceBridge;
  if (!ref) continue;
  const world = (p) => h.group.localToWorld(new V(p[0], 0, p[1]));
  let start = id === 5 ? world([h.snowFront.x, h.snowFront.z]) : world(ref.start);
  const oldEnd = world(ref.end),
    dir = oldEnd.clone().sub(start);
  dir.y = 0;
  dir.normalize();
  // Anchor the bridge just inside the source wall rather than in its courtyard.
  for (let d = 0; d < 35 && !inPolygon(start.x, start.z, h.sourceFootprint); d += 0.2)
    start.addScaledVector(dir, -0.2);
  const side = new V(dir.z, 0, -dir.x);
  let length = 0;
  for (let d = 8; d < 100; d += 0.25) {
    const p = start.clone().addScaledVector(dir, d);
    if (pisteFootprintClearance(p.x, p.z).clearance < 0) {
      length = d + 3;
      break;
    }
  }
  if (!length) continue;
  const end = start.clone().addScaledVector(dir, length),
    width = id === 5 ? 3.5 : 3.6;
  const endY = displayGroundHeightAt(end.x, end.z),
    startY = h.group.position.y + (id === 2 ? 5.4 : 0);
  const deckY = (t) => lerp(startY, endY + 0.06, t);
  // Only lower the narrow road crossing. Preserve mapped ski surfaces and all
  // building footprints. The shared vertex buffer also feeds physics and LOD.
  const roadAt = length * (id === 5 ? 0.52 : 0.44),
    roadY = Math.min(
      startY - 4.6,
      displayGroundHeightAt(start.x + dir.x * roadAt, start.z + dir.z * roadAt),
    );
  const geo = terrain.geometry,
    pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i),
      dx = x - start.x,
      dz = z - start.z,
      u = dx * side.x + dz * side.z,
      v = dx * dir.x + dz * dir.z;
    if (id === 5) {
      // The forecourt is one level, including the ground beneath the courtyard.
      const lateral = 1 - THREE.MathUtils.smoothstep(Math.abs(u), 34, 46);
      const along =
        THREE.MathUtils.smoothstep(v, -18, -10) *
        (1 - THREE.MathUtils.smoothstep(v, roadAt + 10, roadAt + 15));
      if (lateral * along > 0 && pisteFootprintClearance(x, z).clearance > 2)
        pos.setY(i, lerp(pos.getY(i), roadY, lateral * along));
    } else if (
      Math.abs(u) <= 32 &&
      Math.abs(v - roadAt) <= 11 &&
      pisteFootprintClearance(x, z).clearance >= 3 &&
      !hotelSnowFlow.blocked(x, z)
    ) {
      const weight =
        (1 - THREE.MathUtils.smoothstep(Math.abs(u), 17, 32)) *
        (1 - THREE.MathUtils.smoothstep(Math.abs(v - roadAt), 5, 11));
      pos.setY(i, lerp(pos.getY(i), Math.min(pos.getY(i), roadY), weight));
    }
    if (id === 5 && Math.abs(u) <= 34 && v >= -10 && v <= roadAt + 10) pos.setY(i, roadY);
    // Own a level threshold across the full bridge width, with a wider grid
    // margin so interpolation cannot reintroduce a crossfall at the exit.
    const across = 1 - THREE.MathUtils.smoothstep(Math.abs(u), width / 2 + 7, width / 2 + 15);
    const along = 1 - THREE.MathUtils.smoothstep(Math.abs(v - (length + 2)), 7, 16);
    if (across * along > 0 && v > length - 7) pos.setY(i, lerp(pos.getY(i), endY, across * along));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  // Extend existing structural skirts to the revised forecourt, not to old DEM.
  const site = hotelDisplaySites.find((s) => s.owner === 'hotel-' + id);
  if (site?.retainingWall) {
    const wg = site.retainingWall.geometry,
      wp = wg.attributes.position;
    for (let i = 0; i < wp.count; i += 4)
      for (const j of [2, 3]) {
        const k = i + j;
        wp.setY(k, Math.min(site.top - 0.02, pisteGrading.field(wp.getX(k), wp.getZ(k)) - 0.12));
      }
    wp.needsUpdate = true;
    wg.computeVertexNormals();
    wg.computeBoundingBox();
    wg.computeBoundingSphere();
  }
  // Keep the lower ground and bridge clearance without an explicit road overlay.
  const g = new THREE.Group();
  g.name = 'hotel-access-bridge-' + id;
  buildings.add(g);
  const frame = material(id === 5 ? '#c9bd8c' : '#a4ada5'),
    wall = material('#c1c7c1'),
    glass = material('#7cabb0', { transparent: true, opacity: 0.28, depthWrite: false }),
    floor = material('#927b64');
  function beam(a, b, w, d, mat) {
    const delta = b.clone().sub(a),
      m = box(w, delta.length(), d, mat, 0, 0, 0, g);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new V(0, 1, 0), delta.normalize());
    return m;
  }
  const point = (u, v, y = 0) =>
    new V(
      start.x + side.x * u + dir.x * v,
      deckY(v / length) + y,
      start.z + side.z * u + dir.z * v,
    );
  const segments = Math.ceil(length / 3),
    bay = length / segments,
    height = 2.65;
  for (let i = 0; i < segments; i++) {
    const a = i * bay,
      b = (i + 1) * bay,
      mid = (a + b) / 2,
      t = mid / length;
    const deck = box(width, 0.28, bay + 0.015, floor, 0, 0, 0, g);
    deck.position.copy(point(0, mid, -0.14));
    deck.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
    deck.rotateX(-Math.atan2(endY + 0.06 - startY, length));
    const roof = box(width + 0.2, 0.14, bay + 0.04, id === 5 ? glass : frame, 0, 0, 0, g);
    roof.position.copy(point(0, mid, height));
    roof.rotation.copy(deck.rotation);
    for (const s of [-1, 1]) {
      const skin = box(0.06, height - 0.2, bay, id === 5 ? glass : wall, 0, 0, 0, g);
      skin.position.copy(point((s * width) / 2, mid, height / 2));
      skin.rotation.copy(deck.rotation);
      beam(point((s * width) / 2, a), point((s * width) / 2, a, height), 0.12, 0.12, frame);
      beam(point((s * width) / 2, a, height), point((s * width) / 2, b, height), 0.12, 0.12, frame);
      if (id === 5)
        beam(
          point((s * width) / 2, a, 0.12),
          point((s * width) / 2, b, height - 0.12),
          0.1,
          0.1,
          frame,
        );
      else if (i % 3 === 1) {
        const window = box(0.075, 1.0, bay * 0.45, windowMat, 0, 0, 0, g);
        window.position.copy(point(s * (width / 2 + 0.04), mid, 1.8));
        window.rotation.y = Math.atan2(dir.x, dir.z);
      }
    }
  }
  for (const v of [length * 0.12, length * 0.78])
    for (const s of [-1, 1]) {
      const top = point(s * (width / 2 - 0.2), v, -0.28),
        ground = displayGroundHeightAt(top.x, top.z);
      if (top.y - ground > 0.3) beam(new V(top.x, ground - 0.15, top.z), top, 0.36, 0.36, frame);
    }
  // A short tessellated threshold shares the final terrain edge with the piste.
  const verts = [],
    indices = [],
    steps = 8;
  for (let j = 0; j <= steps; j++)
    for (let i = 0; i <= 4; i++) {
      const u = lerp(-width / 2, width / 2, i / 4),
        v = (j / steps) * 4,
        p = point(u, length + v),
        ground = displayGroundHeightAt(p.x, p.z),
        blend = j / steps;
      verts.push(p.x, lerp(endY + 0.06, ground + 0.025, blend), p.z);
      if (i < 4 && j < steps) {
        const k = j * 5 + i;
        indices.push(k, k + 5, k + 1, k + 1, k + 5, k + 6);
      }
    }
  const landingGeo = new THREE.BufferGeometry();
  landingGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  landingGeo.setIndex(indices);
  landingGeo.computeVertexNormals();
  const landing = new THREE.Mesh(landingGeo, material('#e4eceb', { side: THREE.DoubleSide }));
  landing.receiveShadow = true;
  g.add(landing);
  registerSolids(g, 'hotel-bridge-' + id);
  const local = (p) => {
    const q = h.group.worldToLocal(p.clone());
    return [q.x, q.z];
  };
  h.referenceBridge = {
    rendered: true,
    status: '实景结构参考',
    level: startY - h.group.position.y,
    width,
    length,
    start: local(start),
    end: local(end),
    roadProbe: local(start.clone().addScaledVector(dir, roadAt)),
    endLevel: endY + 0.06 - h.group.position.y,
  };
  h.siteAccess.snow = local(end);
  h.siteAccess.snowLevel = h.referenceBridge.endLevel;
  const samples = Array.from({ length: 21 }, (_, i) => {
    const v = roadAt - 3 + i * 0.3,
      p = point(0, v, -0.28);
    return p.y - displayGroundHeightAt(p.x, p.z);
  });
  hotelAccessBridges.push({
    id,
    start: [start.x, startY, start.z],
    end: [end.x, endY + 0.06, end.z],
    length,
    width,
    roadAt,
    roadY,
    minRoadClearance: Math.min(...samples),
    grade: (endY + 0.06 - startY) / length,
  });
}
scene.userData.hotelAccessBridges = hotelAccessBridges;
