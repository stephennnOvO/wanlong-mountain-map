const reservoir = (() => {
  const poly = RESERVOIR_LAYOUT.world,
    center = poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]);
  const heights = poly.map((p) => displayGroundHeightAt(...p)).sort((a, b) => a - b),
    level = heights[Math.floor(heights.length / 2)];
  const group = new THREE.Group();
  group.name = '长龙道下段水池';
  scene.add(group);
  const geometry = terrain.geometry,
    v = geometry.attributes.position;
  const platformLevel = level + 0.85,
    platform = { x0: -1080, x1: -850, z0: 805, z1: 925, blendX: 65, blendZ: 40 };
  for (let i = 0; i < v.count; i++) {
    const x = v.getX(i),
      z = v.getZ(i),
      wx =
        THREE.MathUtils.smoothstep(x, platform.x0 - platform.blendX, platform.x0) *
        (1 - THREE.MathUtils.smoothstep(x, platform.x1, platform.x1 + platform.blendX)),
      wz =
        THREE.MathUtils.smoothstep(z, platform.z0 - platform.blendZ, platform.z0) *
        (1 - THREE.MathUtils.smoothstep(z, platform.z1, platform.z1 + platform.blendZ)),
      weight = wx * wz;
    if (weight > 0) v.setY(i, lerp(v.getY(i), platformLevel, weight));
  }
  // Keep the engineered bench continuous; mask only the basin opening, so
  // coarse DEM triangles cannot make the outside bank sag or pierce the water.
  const cutPoly = poly.map((p) => {
    const dx = p[0] - center[0],
      dz = p[1] - center[1],
      n = Math.hypot(dx, dz);
    return [p[0] + (dx / n) * 3, p[1] + (dz / n) * 3];
  });
  addSiteCut(cutPoly, level - 0.2);
  v.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  for (const record of siteCorrections.auxiliaryBuildings) {
    const g = buildings.children.find((g) => g.userData.sourceId === record.id);
    if (!g) continue;
    const [x, z] = record.center;
    if (
      x < platform.x0 - platform.blendX ||
      x > platform.x1 + platform.blendX ||
      z < platform.z0 - platform.blendZ ||
      z > platform.z1 + platform.blendZ
    )
      continue;
    const next = Math.max(...record.footprint.map((p) => displayGroundHeightAt(...p))) + 0.12;
    g.position.y += next - record.base;
    record.base = next;
  }
  const shape = new THREE.Shape();
  poly.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  shape.closePath();
  const waterGeometry = new THREE.ShapeGeometry(shape);
  waterGeometry.rotateX(-Math.PI / 2);
  waterGeometry.translate(0, level, 0);
  const water = new THREE.Mesh(
    waterGeometry,
    new THREE.MeshStandardMaterial({
      color: '#264c58',
      roughness: 0.28,
      metalness: 0.12,
      side: THREE.DoubleSide,
    }),
  );
  water.name = '水平水面';
  group.add(water);
  const bank = [],
    indices = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      dx = p[0] - center[0],
      dz = p[1] - center[1],
      n = Math.hypot(dx, dz);
    bank.push(
      p[0],
      level + 0.04,
      p[1],
      p[0] + (dx / n) * 2,
      platformLevel + 0.03,
      p[1] + (dz / n) * 2,
      p[0] + (dx / n) * 5.2,
      platformLevel + 0.03,
      p[1] + (dz / n) * 5.2,
    );
    const j = (i + 1) % poly.length;
    for (let k = 0; k < 2; k++)
      indices.push(i * 3 + k, i * 3 + k + 1, j * 3 + k, j * 3 + k, i * 3 + k + 1, j * 3 + k + 1);
  }
  const bankGeometry = new THREE.BufferGeometry();
  bankGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bank, 3));
  bankGeometry.setIndex(indices);
  bankGeometry.computeVertexNormals();
  const rim = new THREE.Mesh(
    bankGeometry,
    new THREE.MeshStandardMaterial({ color: '#b5b5a3', roughness: 1, side: THREE.DoubleSide }),
  );
  rim.receiveShadow = true;
  group.add(rim);
  // Tie the outer bank to the surrounding ground with a continuous skirt.
  const skirt = [],
    faces = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
    for (let j = 0; j <= count; j++) {
      const t = j / count,
        x = lerp(a[0], b[0], t),
        z = lerp(a[1], b[1], t),
        dx = x - center[0],
        dz = z - center[1],
        n = Math.hypot(dx, dz),
        xx = x + (dx / n) * 5.2,
        zz = z + (dz / n) * 5.2,
        k = skirt.length / 3;
      skirt.push(
        xx,
        level + 0.85,
        zz,
        xx,
        Math.min(level - 1.5, displayGroundHeightAt(xx, zz)) - 0.2,
        zz,
      );
      if (j) faces.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(skirt, 3));
  g.setIndex(faces);
  g.computeVertexNormals();
  group.add(new THREE.Mesh(g, rim.material));
  const record = {
    center: [center[0], level, center[1]],
    polygon: poly,
    waterLevel: level,
    platformLevel,
    platform,
    source: 'registered-satellite',
    elevationEstimated: true,
  };
  scene.userData.reservoir = record;
  return {
    ...record,
    group,
    contains: (x, z) => inPolygon(x, z, poly) || hotelEdgeDistance(x, z, poly) < 7,
  };
})();
