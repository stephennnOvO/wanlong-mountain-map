// One geographic apartment ensemble. OSM footprints are NOT hotel-brand boundaries.
function apartmentFootprint(h, sourceId, floors) {
  const source = GEO.buildings.find((b) => b.id === sourceId),
    world = source.coords.slice(0, -1).map(projectGeo),
    cx = world.reduce((s, p) => s + p[0], 0) / world.length,
    cz = world.reduce((s, p) => s + p[1], 0) / world.length,
    g = hotelGroup(h);
  g.position.set(cx, 0, cz);
  g.rotation.y = 0;
  h.nativeMetres = true;
  h.sourceFootprint = world;
  h.footprintId = sourceId;
  const poly = world.map((p) => [p[0] - cx, p[1] - cz]),
    plinth = 5.8,
    fh = 3.1,
    H = plinth + floors * fh;
  const shape = new THREE.Shape();
  poly.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  shape.closePath();
  function mass(y, height, mat) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  mass(0, plinth, facadeMats.base);
  mass(plinth, H - plinth, facadeMats.cream);
  mass(H, 0.35, facadeMats.ivory);
  const area = poly.reduce((s, p, i) => {
      const q = poly[(i + 1) % poly.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
    sign = area > 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      nx = (sign * dz) / length,
      nz = (-sign * dx) / length,
      theta = Math.atan2(-dz, dx),
      faceAngle = Math.atan2(nx, nz),
      cols = Math.max(1, Math.floor(length / 3.25));
    const edge = new THREE.Group();
    edge.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
    edge.rotation.y = theta;
    g.add(edge);
    for (let k = 0; k <= floors; k++)
      hb(edge, length + 0.15, 0.1, 0.32, facadeMats.ivory, 0, plinth + k * fh, 0);
    for (let j = 0; j < cols; j++) {
      const t = (j + 0.5) / cols,
        x = lerp(a[0], b[0], t),
        z = lerp(a[1], b[1], t);
      for (let k = 0; k < floors; k++)
        windowAt(g, x + nx * 0.18, plinth + k * fh + 1.55, z + nz * 0.18, 1.42, 1.72, faceAngle);
      for (const y of [1.55, 4.2])
        windowAt(g, x + nx * 0.18, y, z + nz * 0.18, 1.7, 2.0, faceAngle);
      if (j % 4 === 0) {
        const pillar = hb(g, 0.32, H, 0.38, facadeMats.ivory, x + nx * 0.26, H / 2, z + nz * 0.26);
        pillar.rotation.y = faceAngle;
      }
    }
  }
  // Source-native roof geometry; Shenglong has flat white roofs and low roof pavilions.
  const roofRise = h.id === 5 ? 0.8 : 3.5,
    inner = poly.map((p) => [p[0] * 0.95, p[1] * 0.95]),
    vertices = [],
    indices = [];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length,
      k = vertices.length / 3;
    vertices.push(
      poly[i][0],
      H + 0.3,
      poly[i][1],
      poly[j][0],
      H + 0.3,
      poly[j][1],
      inner[j][0],
      H + roofRise,
      inner[j][1],
      inner[i][0],
      H + roofRise,
      inner[i][1],
    );
    indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  rg.setIndex(indices);
  rg.computeVertexNormals();
  const rm = new THREE.Mesh(rg, h.id === 5 ? facadeMats.snow : facadeMats.tile);
  rm.material.side = THREE.DoubleSide;
  rm.castShadow = true;
  g.add(rm);
  const topShape = new THREE.Shape();
  inner.forEach(([x, z], i) => (i ? topShape.lineTo(x, -z) : topShape.moveTo(x, -z)));
  topShape.closePath();
  const cap = new THREE.Mesh(new THREE.ShapeGeometry(topShape), facadeMats.snow);
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = H + roofRise + 0.05;
  g.add(cap);
  let longest = 0,
    front = null;
  const snowSide = h.id === 5 ? new V(0.22, 0, -0.98) : new V(-0.707, 0, -0.707);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      nx = (sign * dz) / len,
      nz = (-sign * dx) / len;
    if (len > longest && nx * snowSide.x + nz * snowSide.z > 0.5) {
      longest = len;
      front = { a, b, nx, nz, len };
    }
  }
  if (front) {
    const { a, b, nx, nz, len } = front;
    for (let j = 0; j < Math.floor(len / 16); j++) {
      const t = (j + 0.5) / Math.floor(len / 16),
        x = lerp(a[0], b[0], t),
        z = lerp(a[1], b[1], t),
        dormer = new THREE.Group();
      dormer.position.set(x, H + 1.4, z);
      dormer.rotation.y = Math.atan2(nx, nz);
      g.add(dormer);
      hb(dormer, 2.3, 2.0, 1.5, facadeMats.ivory, 0, 0, 0);
      windowAt(g, x + nx * 0.85, H + 1.4, z + nz * 0.85, 1.25, 1.35, Math.atan2(nx, nz));
      roof(dormer, 0, 1.0, 0, 2.7, 2, 1.1);
    }
    const x = (a[0] + b[0]) / 2,
      z = (a[1] + b[1]) / 2,
      entry = new THREE.Group();
    entry.position.set(x, 0, z);
    entry.rotation.y = Math.atan2(nx, nz);
    g.add(entry);
    hb(entry, 8, 0.25, 3, facadeMats.tile, 0, 3.3, 1.4);
    for (const side of [-1, 1]) hb(entry, 0.2, 3, 0.2, facadeMats.frame, side * 3.5, 1.5, 2.5);
    hotelSign(
      g,
      h.id === 5 ? '盛 龙 公 寓' : h.id === 3 ? '万 龙 公 寓' : '公 寓 楼 群',
      8,
      x + nx * 0.5,
      4.6,
      z + nz * 0.5,
    ).rotation.y = Math.atan2(nx, nz);
    h.snowFront = { x, z, nx, nz };
    h.orientation = {
      snowFacadeBearingDeg: ((Math.atan2(-nx, nz) * 180) / Math.PI + 360) % 360,
      longAxisBearingDeg: ((Math.atan2(-(b[0] - a[0]), b[1] - a[1]) * 180) / Math.PI + 360) % 360,
    };
    if (h.id === 3) {
      snowHall(entry, 0, 0, 3.2, len * 0.86, 7.0, 5.8);
      hb(entry, len * 0.88, 0.5, 6.4, facadeMats.snow, 0, 7.4, 3.2);
    }
    if (h.id === 3 || h.id === 4) {
      const site = hotelSiteFrame(h, [x, z], [nx, nz]),
        width = len + 8;
      g.userData.hotelSitePlan = {
        roadAnchor: site.point(0, 13),
        regions: [
          { kind: 'lobby-apron', polygon: site.rect(0, 3, width, 9), level: 0, feather: 1.5 },
          { kind: 'lower-road', polygon: site.rect(0, 14, width, 12), level: 0, feather: 1.5 },
          { kind: 'snow-landing', polygon: site.rect(0, 30, width, 14), level: 5.4, feather: 4 },
        ],
      };
      hotelSiteRoad(site, 0, 14, width, 12);
      hotelRetainingEdge(
        site,
        0,
        23,
        width,
        0,
        5.4,
        h.id === 3 ? { x: len * 0.22, width: 4 } : null,
      );
      hotelSnowTransition(h, site, 35, width, 5.4);
      h.siteAccess = {
        lobby: site.point(0, 6.4),
        road: site.point(0, 14),
        snow: site.point(0, 28),
        lobbyLevel: 0,
        roadLevel: 0,
        snowLevel: 5.4,
      };
      // One bridge in the shared ensemble; no second brand-specific entrance is inferred.
      if (h.id === 3)
        hotelBridge(h, site, { x: len * 0.22, start: 5.8, end: 27, level: 5.4, width: 3.2 });
    }
    // Repeated small roof pavilions, with a taller end feature on the apartment bar.
    if (h.id !== 5) {
      for (const t of [0.08, 0.92]) {
        const xx = lerp(a[0], b[0], t) - nx * 4,
          zz = lerp(a[1], b[1], t) - nz * 4,
          tower = new THREE.Group();
        tower.position.set(xx, H, zz);
        tower.rotation.y = Math.atan2(nx, nz);
        g.add(tower);
        hb(tower, 4.8, 4.0, 5, facadeMats.ivory, 0, 2, 0);
        windowAt(g, xx + nx * 2.6, H + 2, zz + nz * 2.6, 2, 2.6, Math.atan2(nx, nz));
        roof(tower, 0, 4, 0, 5.5, 5.5, 2);
      }
    }
  }
  // Oriented envelope for dimensions only; collision follows the source polygon.
  let fit = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      angle = Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
      c = Math.cos(angle),
      s = Math.sin(angle),
      xs = poly.map((p) => c * p[0] - s * p[1]),
      zs = poly.map((p) => s * p[0] + c * p[1]),
      x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      z0 = Math.min(...zs),
      z1 = Math.max(...zs),
      area = (x1 - x0) * (z1 - z0);
    if (!fit || area < fit.area) fit = { angle, c, s, x0, x1, z0, z1, area };
  }
  const f = fit;
  // Inscribed source-triangle strips preserve concave courtyard voids.
  const triangles = THREE.ShapeUtils.triangulateShape(
    poly.map((p) => new THREE.Vector2(...p)),
    [],
  );
  for (const ids of triangles) {
    const tri = ids.map((i) => poly[i]),
      zs = tri.map((p) => p[1]),
      lo = Math.min(...zs),
      hi = Math.max(...zs),
      steps = Math.max(1, Math.ceil((hi - lo) / 0.3));
    function interval(z) {
      const xs = [];
      for (let i = 0; i < 3; i++) {
        const a = tri[i],
          b = tri[(i + 1) % 3];
        if (Math.abs(b[1] - a[1]) < 1e-9) {
          if (Math.abs(z - a[1]) < 1e-8) xs.push(a[0], b[0]);
        } else if (z >= Math.min(a[1], b[1]) - 1e-9 && z <= Math.max(a[1], b[1]) + 1e-9)
          xs.push(lerp(a[0], b[0], (z - a[1]) / (b[1] - a[1])));
      }
      return [Math.min(...xs), Math.max(...xs)];
    }
    for (let k = 0; k < steps; k++) {
      const z0 = lerp(lo, hi, k / steps),
        z1 = lerp(lo, hi, (k + 1) / steps),
        cuts = [z0, z1, ...zs.filter((z) => z > z0 && z < z1)].map(interval),
        x0 = Math.max(...cuts.map((p) => p[0])),
        x1 = Math.min(...cuts.map((p) => p[1]));
      if (x1 - x0 < 0.015) continue;
      const solid = hb(
        g,
        x1 - x0,
        H,
        z1 - z0,
        facadeMats.base,
        (x0 + x1) / 2,
        H / 2,
        (z0 + z1) / 2,
      );
      solid.visible = false;
      solid.userData.sourcePlanCollision = true;
    }
  }
  h.approxFloors = floors;
  h.coreDepth = Math.min(f.x1 - f.x0, f.z1 - f.z0);
  return g;
}
