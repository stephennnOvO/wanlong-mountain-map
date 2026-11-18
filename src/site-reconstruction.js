// Independent low-rise volumes checked against the new screenshot building row.
// Footprints are retained separately from estimated heights / roof appearance.
// Dragon Palace low-rise podium is built with the hotel model.
const siteCorrections = { auxiliaryBuildings: [], labelVisible: 0, labelOccluded: 0 };
scene.userData.siteCorrections = siteCorrections;
// Resolve the interrupted ground under the concave building beside Longgong.
// Edit the shared terrain vertices so drawing, picking and ground sampling agree.
if (pisteGrading) {
  const source = GEO.buildings.find((b) => b.id === '1153883044');
  if (source) {
    const poly = source.coords.slice(0, -1).map(projectGeo),
      levels = poly.map((p) => displayGroundHeightAt(...p)).sort((a, b) => a - b),
      level = (levels[2] + levels[3]) / 2;
    const geometry = terrain.geometry,
      vertices = geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i),
        z = vertices.getZ(i),
        distance = inPolygon(x, z, poly) ? 0 : hotelEdgeDistance(x, z, poly);
      if (distance >= 30) continue;
      const weight = 1 - THREE.MathUtils.smoothstep(distance, 8, 30);
      vertices.setY(i, lerp(vertices.getY(i), level, weight));
    }
    vertices.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
}
for (const id of REVIEWED_SITE_PLAN.auxiliaryBuildings) {
  const source = GEO.buildings.find((b) => b.id === id);
  if (!source) continue;
  const poly = source.coords.slice(0, -1).map(projectGeo),
    center = poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]),
    base =
      Math.max(...poly.map((p) => displayGroundHeightAt(...p))) +
      (id === '1153883044' ? 0.02 : 0.12),
    H = Number(source.tags['building:levels'] || 2) * 3,
    group = new THREE.Group();
  group.position.set(center[0], base, center[1]);
  group.name = 'reviewed-building-' + id;
  group.userData = { sourceId: id, estimatedHeight: true };
  buildings.add(group);
  const shape = new THREE.Shape();
  poly.forEach(([x, z], i) =>
    i ? shape.lineTo(x - center[0], center[1] - z) : shape.moveTo(x - center[0], center[1] - z),
  );
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: H, steps: 1, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const body = new THREE.Mesh(geo, facadeMats.ivory);
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  const foundationPositions = [],
    foundationIndices = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let j = 0; j < count; j++) {
      const start = foundationPositions.length / 3;
      for (const t of [j / count, (j + 1) / count]) {
        const x = lerp(a[0], b[0], t),
          z = lerp(a[1], b[1], t);
        foundationPositions.push(
          x - center[0],
          0,
          z - center[1],
          x - center[0],
          Math.min(-0.05, displayGroundHeightAt(x, z) - base - 0.12),
          z - center[1],
        );
      }
      foundationIndices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
    }
  }
  const foundation = new THREE.BufferGeometry();
  foundation.setAttribute('position', new THREE.Float32BufferAttribute(foundationPositions, 3));
  foundation.setIndex(foundationIndices);
  foundation.computeVertexNormals();
  const plinth = new THREE.Mesh(foundation, material('#939b97', { side: THREE.DoubleSide }));
  plinth.receiveShadow = true;
  group.add(plinth);
  const edge = poly
      .map((a, i) => {
        const b = poly[(i + 1) % poly.length];
        return { dx: b[0] - a[0], dz: b[1] - a[1], len: Math.hypot(b[0] - a[0], b[1] - a[1]) };
      })
      .sort((a, b) => b.len - a.len)[0],
    angle = Math.atan2(-edge.dz, edge.dx),
    c = Math.cos(angle),
    sn = Math.sin(angle),
    local = poly.map((p) => [
      (p[0] - center[0]) * c - (p[1] - center[1]) * sn,
      (p[0] - center[0]) * sn + (p[1] - center[1]) * c,
    ]),
    xs = local.map((p) => p[0]),
    zs = local.map((p) => p[1]),
    w = Math.max(...xs) - Math.min(...xs),
    d = Math.max(...zs) - Math.min(...zs);

  // Roof follows the wall footprint, including concave corners, in one local frame.
  const ridgeZ = (Math.min(...zs) + Math.max(...zs)) / 2,
    rise = Math.min(2, d * 0.22);
  const roofY = (z) => H + rise * Math.max(0, 1 - Math.abs(z - ridgeZ) / (d / 2));
  const roofGroup = new THREE.Group();
  roofGroup.rotation.y = angle;
  roofGroup.name = 'footprint-aligned-roof';
  group.add(roofGroup);
  function roofHalf(sign) {
    const clipped = [];
    for (let i = 0; i < local.length; i++) {
      const a = local[i],
        b = local[(i + 1) % local.length],
        da = (a[1] - ridgeZ) * sign,
        db = (b[1] - ridgeZ) * sign;
      if (da >= 0) clipped.push(a);
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
        const t = da / (da - db);
        clipped.push([lerp(a[0], b[0], t), ridgeZ]);
      }
    }
    if (clipped.length < 3) return;
    const shape = new THREE.Shape();
    clipped.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape),
      positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = -positions.getY(i);
      positions.setXYZ(i, x, roofY(z), z);
    }
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material('#74685a', { side: THREE.DoubleSide }));
    mesh.castShadow = mesh.receiveShadow = true;
    roofGroup.add(mesh);
  }
  roofHalf(-1);
  roofHalf(1);
  const gables = [];
  for (let i = 0; i < local.length; i++) {
    const a = local[i],
      b = local[(i + 1) % local.length],
      points = [a];
    if ((a[1] - ridgeZ) * (b[1] - ridgeZ) < 0) {
      const t = (ridgeZ - a[1]) / (b[1] - a[1]);
      points.push([lerp(a[0], b[0], t), ridgeZ]);
    }
    points.push(b);
    for (let j = 1; j < points.length; j++) {
      const u = points[j - 1],
        v = points[j];
      gables.push(
        u[0],
        H,
        u[1],
        v[0],
        H,
        v[1],
        v[0],
        roofY(v[1]),
        v[1],
        u[0],
        H,
        u[1],
        v[0],
        roofY(v[1]),
        v[1],
        u[0],
        roofY(u[1]),
        u[1],
      );
    }
  }
  const gableGeometry = new THREE.BufferGeometry();
  gableGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gables, 3));
  gableGeometry.computeVertexNormals();
  const gableMaterial = facadeMats.ivory.clone();
  gableMaterial.side = THREE.DoubleSide;
  roofGroup.add(new THREE.Mesh(gableGeometry, gableMaterial));

  group.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(group);
  facilityGrounds.push({
    owner: 'reviewed-' + id,
    bounds,
    base,
    top: base,
    groundHigh: base,
    kind: 'auxiliary-building',
  });
  // A compact oriented solid prevents the camera passing through the new body.
  solidVolumes.push({
    owner: 'reviewed-' + id,
    bounds: bounds.clone(),
    center: new V(center[0], base + H / 2, center[1]),
    half: new V(w / 2, H / 2, d / 2),
    axes: [new V(c, 0, -sn), new V(0, 1, 0), new V(sn, 0, c)],
  });
  siteCorrections.auxiliaryBuildings.push({
    id,
    center,
    footprint: poly,
    base,
    height: H,
    source: 'new screenshot review + source footprint',
  });
}

// Limit labels and test visibility against the actual height field and structures.
// No raycasts against the million-triangle terrain are performed per frame.
const labelRay = new THREE.Ray(),
  labelHit = new V();
function labelIsOccluded(l) {
  const now = performance.now();
  if (
    l._visibilityTime &&
    now - l._visibilityTime < 100 &&
    camera.position.distanceToSquared(l._visibilityCamera) < 900
  )
    return l._blocked;
  l._visibilityTime = now;
  l._visibilityCamera = camera.position.clone();
  const target = l.p.clone();
  if (l.hotel) {
    const h = hotels.find((h) => h.id === l.hotel);
    if (h?.modelBounds) target.y = h.modelBounds.max.y + 1;
  } else if (l.lift) {
    const lift = lifts.find((q) => q.id === l.lift);
    if (lift) target.copy(lift.runtime.cablePoint(0.5)).add(new V(0, 0.5, 0));
  } else if (
    l.trail ||
    l.wild ||
    l.park ||
    l.bike !== undefined ||
    l.summit ||
    l.officialFeatureId !== undefined
  ) {
    target.y = displayGroundHeightAt(target.x, target.z) + 2;
  }
  const delta = target.clone().sub(camera.position),
    distance = delta.length(),
    horizontal = Math.hypot(delta.x, delta.z),
    steps = Math.min(320, Math.max(16, Math.ceil(horizontal / 8)));
  let blocked = false;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (distance * (1 - t) < 1) break;
    const x = lerp(camera.position.x, target.x, t),
      z = lerp(camera.position.z, target.z, t),
      y = lerp(camera.position.y, target.y, t);
    if (displayGroundHeightAt(x, z) > y + 1.2) {
      blocked = true;
      break;
    }
  }
  if (!blocked) {
    labelRay.set(camera.position, delta.normalize());
    for (const f of facilityGrounds) {
      if (!f.bounds) continue;
      const hit = labelRay.intersectBox(f.bounds, labelHit);
      if (hit && camera.position.distanceTo(hit) < distance - 0.5) {
        blocked = true;
        break;
      }
    }
  }
  if (!blocked) {
    const len2 = horizontal * horizontal;
    for (const t of treeData) {
      const u =
        ((t.x - camera.position.x) * delta.x + (t.z - camera.position.z) * delta.z) /
        (delta.x * delta.x + delta.z * delta.z || 1);
      if (u <= 0 || u >= distance - 1) continue;
      const x = camera.position.x + delta.x * u,
        z = camera.position.z + delta.z * u;
      if (Math.hypot(x - t.x, z - t.z) > t.w) continue;
      const ground = displayGroundHeightAt(t.x, t.z),
        y = camera.position.y + delta.y * u;
      if (y > ground + t.h * 0.18 && y < ground + t.h) {
        const radius = t.w * Math.max(0.18, 1 - (y - ground) / t.h);
        if (Math.hypot(x - t.x, z - t.z) < radius) {
          blocked = true;
          break;
        }
      }
    }
  }
  l._blocked = blocked;
  return blocked;
}
siteCorrections.labelIsOccluded = labelIsOccluded;
positionLabels = function () {
  if (state.mode === 'architecture') {
    $('labels').hidden = true;
    return;
  }
  $('labels').hidden = false;
  const selected = $('labels').current,
    all = selected ? [selected, ...labelData] : labelData,
    dir = camera.getWorldDirection(new V()),
    occupied = [],
    budget = state.mode === 'ski' || state.mode === 'lift' ? 3 : orbit.radius < 1200 ? 8 : 4;
  let shown = 0,
    occluded = 0;
  for (const l of all) {
    const p = l.p.clone().project(camera),
      x = sceneViewport.left + (p.x * 0.5 + 0.5) * sceneViewport.width,
      y = sceneViewport.top + (-p.y * 0.5 + 0.5) * sceneViewport.height;
    let visible =
      state.labels &&
      shown < budget &&
      l.p.clone().sub(camera.position).dot(dir) > 0 &&
      p.z < 1 &&
      p.x > -0.93 &&
      p.x < 0.93 &&
      p.y > -0.86 &&
      p.y < 0.86;
    if (l.officialLayer) visible = visible && officialMapFeatures.labelLayer.visible;
    if (l.maxDistance) visible = visible && camera.position.distanceTo(l.p) < l.maxDistance;
    if (l.bike !== undefined) visible = visible && bikeReference.visible;
    if (l.wild) visible = visible && wildReference.visible;
    if (l.hotel) visible = visible && state.mode === 'orbit';
    const w = l.summit ? 120 : Math.min(190, l.text.replace(/<[^>]*>/g, '').length * 9 + 18),
      h = l.summit ? 45 : 25,
      rect = [x - w / 2, y - h, x + w / 2, y];
    visible =
      visible &&
      rect[0] >= sceneViewport.left + 8 &&
      rect[2] <= sceneViewport.left + sceneViewport.width - 8 &&
      rect[1] >= sceneViewport.top + 8 &&
      rect[3] <= sceneViewport.top + sceneViewport.height - 8;
    if (
      visible &&
      occupied.some(
        (r) =>
          rect[0] < r[2] + 12 && rect[2] > r[0] - 12 && rect[1] < r[3] + 12 && rect[3] > r[1] - 12,
      )
    )
      visible = false;
    if (visible && labelIsOccluded(l)) {
      visible = false;
      occluded++;
    }
    if (visible) {
      shown++;
      occupied.push(rect);
      l.el.style.left = x + 'px';
      l.el.style.top = y + 'px';
    }
    l.el.style.display = visible ? 'block' : 'none';
  }
  siteCorrections.labelVisible = shown;
  siteCorrections.labelOccluded = occluded;
};
