// This source is inserted inside the app's scene scope by tools/build.cjs.
// Geometry follows publicly visible architectural features; dimensions are illustrative.
const facadeMats = {
  ivory: material('#d7cfb8'),
  cream: material('#cbbda0'),
  orange: material('#be835b'),
  base: material('#787d76'),
  redStone: material('#9a6658'),
  timber: material('#5c5149'),
  frame: material('#b8c4bd'),
  tile: material('#6c5d58'),
  snow: material('#e8efec'),
  glass: material('#557a86', { roughness: 0.22, metalness: 0.35 }),
};
const hotelWindows = [],
  hotelWarmWindows = [],
  hotelColdWindows = [],
  hotelLights = [],
  hotelGroundDetails = [];
const inspectionScene = new THREE.Scene();
inspectionScene.background = new THREE.Color('#dce8ec');
inspectionScene.add(new THREE.HemisphereLight('#d9edff', '#acb6ad', 2));
const inspectionSun = new THREE.DirectionalLight('#fff0dc', 3);
inspectionSun.position.set(-200, 300, 180);
inspectionScene.add(inspectionSun);
const inspectionGround = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), material('#dce8e6'));
inspectionGround.rotation.x = -Math.PI / 2;
inspectionGround.position.y = -2;
inspectionScene.add(inspectionGround);
function hotelGroup(h) {
  const g = new THREE.Group();
  g.position.copy(posAtMap(h.p));
  g.rotation.y = h.id === 2 ? -0.12 : h.id === 5 ? 0.17 : 0.04;
  buildings.add(g);
  h.group = g;
  return g;
}
function hb(g, w, h, d, mat, x, y, z) {
  return box(w, h, d, mat, x, y, z, g);
}
function hotelSign(g, text, w, x, y, z) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 160;
  const cx = c.getContext('2d');
  cx.fillStyle = '#575a4c';
  cx.fillRect(0, 0, 1024, 160);
  cx.fillStyle = '#f0d8a0';
  cx.font = '500 73px "Microsoft YaHei", sans-serif';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText(text, 512, 84);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tx,
    roughness: 0.7,
    emissive: '#d2ac6b',
    emissiveMap: tx,
    emissiveIntensity: 0.08,
  });
  hotelLights.push(mat);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 6.4), mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
function roof(g, x, y, z, w, d, h = 10) {
  const p = [
      -w / 2,
      0,
      -d / 2,
      w / 2,
      0,
      -d / 2,
      w / 2,
      0,
      d / 2,
      -w / 2,
      0,
      d / 2,
      -w * 0.42,
      h,
      -d * 0.15,
      w * 0.42,
      h,
      -d * 0.15,
      w * 0.42,
      h,
      d * 0.15,
      -w * 0.42,
      h,
      d * 0.15,
    ],
    ix = [0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4, 4, 7, 5, 5, 7, 6];
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geom.setIndex(ix);
  geom.computeVertexNormals();
  const m = new THREE.Mesh(geom, facadeMats.tile);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  const snowRoof = m.clone();
  snowRoof.geometry = geom.clone();
  snowRoof.material = facadeMats.snow;
  snowRoof.position.y += 1.2;
  snowRoof.scale.set(0.96, 0.98, 0.95);
  g.add(snowRoof);
  hb(g, w + 3, 1.5, d + 3, facadeMats.frame, x, y, z);
}
function windowAt(g, x, y, z, w, h, side = 0) {
  g.updateWorldMatrix(true, false);
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  o.rotation.y = side;
  o.scale.set(w, h, 1);
  o.updateMatrix();
  o.matrix.premultiply(g.matrixWorld);
  const m = o.matrix.clone();
  let owner = g;
  for (let p = g; p; p = p.parent)
    if (hotels.some((h) => h.group === p)) {
      owner = p;
      break;
    }
  m.owner = owner;
  hotelWindows.push(m);
  if (rand() < 0.29) hotelWarmWindows.push(m);
  else hotelColdWindows.push(m);
}
function floorFacade(g, x, z, w, d, floors, fh, mat, startY = 0) {
  hb(g, w, floors * fh, d, mat, x, startY + (floors * fh) / 2, z);
  for (let k = 0; k < floors; k++) {
    const yy = startY + k * fh + fh * 0.53;
    hb(g, w + 1.5, 0.6, d + 1.5, facadeMats.frame, x, startY + k * fh, z);
    const cols = Math.floor(w / 8.5);
    for (let j = 0; j < cols; j++) {
      const xx = x - w / 2 + ((j + 0.5) * w) / cols;
      windowAt(g, xx, yy, z + d / 2 + 0.36, 4.3, fh * 0.61);
      windowAt(g, xx, yy, z - d / 2 - 0.36, 4.3, fh * 0.61, Math.PI);
      hb(g, 5.6, 0.6, 1.1, facadeMats.ivory, xx, yy - fh * 0.35, z + d / 2 + 0.5);
    }
    for (const side of [-1, 1]) {
      const n = Math.max(2, Math.floor(d / 9));
      for (let j = 0; j < n; j++) {
        windowAt(
          g,
          x + side * (w / 2 + 0.36),
          yy,
          z - d / 2 + ((j + 0.5) * d) / n,
          4.3,
          fh * 0.61,
          (side * Math.PI) / 2,
        );
      }
    }
  }
  for (let j = 0; j <= Math.floor(w / 17); j++) {
    const xx = x - w / 2 + (j * w) / Math.floor(w / 17);
    hb(
      g,
      1.3,
      floors * fh + 0.8,
      1.3,
      facadeMats.ivory,
      xx,
      startY + (floors * fh) / 2,
      z + d / 2 + 0.7,
    );
  }
  hb(g, w + 2.5, 1.4, d + 2.5, facadeMats.ivory, x, startY + floors * fh, z);
}
function glassHall(g, x, y, z, w, h, d) {
  hb(g, w, h, d, facadeMats.glass, x, y + h / 2, z);
  const n = Math.max(1, Math.floor(w / 6));
  for (let j = 0; j <= n; j++)
    hb(g, 0.55, h, 1, facadeMats.frame, x - w / 2 + (j * w) / n, y + h / 2, z + d / 2 + 0.6);
  for (let k = 0; k <= Math.floor(h / 4); k++)
    hb(g, w, 0.45, 1, facadeMats.frame, x, y + k * 4, z + d / 2 + 0.6);
  hb(g, w + 4, 2, d + 4, facadeMats.snow, x, y + h + 1, z);
}
function entrance(g, x, z, w = 27) {
  hb(g, w + 6, 1.5, 16, facadeMats.base, x, 1, z + 6);
  for (let i = 0; i < 3; i++)
    hb(g, w + 8 + i * 3, 1, 4, facadeMats.ivory, x, 1 - i * 0.35, z + 14 + i * 2);
  glassHall(g, x, 1, z, w, 10, 9);
  hb(g, w + 11, 1.3, 20, facadeMats.tile, x, 12, z + 4);
  hb(g, w + 11, 1, 20, facadeMats.snow, x, 13, z + 4);
  for (const side of [-1, 1])
    hb(g, 0.9, 11, 0.9, facadeMats.frame, x + side * (w / 2 + 3), 6, z + 10);
}
function fence(g, x, z, w) {
  hotelGroundDetails.push({ kind: 'fence', g, x, z, w });
}
function clockTower(g, x, z) {
  hb(g, 20, 24, 18, facadeMats.base, x, 12, z);
  hb(g, 19, 12, 17, facadeMats.ivory, x, 30, z);
  roof(g, x, 36, z, 25, 23, 7);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const cx = c.getContext('2d');
  cx.fillStyle = '#ede8d5';
  cx.beginPath();
  cx.arc(128, 128, 116, 0, Math.PI * 2);
  cx.fill();
  cx.strokeStyle = '#4b605c';
  cx.lineWidth = 7;
  cx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    cx.beginPath();
    cx.moveTo(128 + Math.sin(a) * 90, 128 - Math.cos(a) * 90);
    cx.lineTo(128 + Math.sin(a) * 103, 128 - Math.cos(a) * 103);
    cx.stroke();
  }
  cx.lineWidth = 6;
  cx.beginPath();
  cx.moveTo(128, 62);
  cx.lineTo(128, 128);
  cx.lineTo(173, 153);
  cx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8 }),
  );
  m.position.set(x, 30, z + 9.2);
  g.add(m);
}
function spire(g, x, y, z) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(4, 15, 6), facadeMats.tile);
  m.position.set(x, y + 7.5, z);
  g.add(m);
  hb(g, 0.6, 6, 0.6, facadeMats.frame, x, y + 17, z);
}
function parking(g, x, z, w, d, count) {
  hotelGroundDetails.push({ kind: 'parking', g, x, z, w, d, count });
}
// Native metre reference frames: west-positive X and north-positive Z in the geographic scene.
// Keep each facade's direction explicit; a longest edge alone cannot distinguish front/back.
function hotelFrame(h, id, angle) {
  const source = GEO.buildings.find((b) => b.id === id),
    points = source.coords.slice(0, -1).map(projectGeo),
    c = Math.cos(angle),
    sn = Math.sin(angle),
    xs = points.map((p) => c * p[0] - sn * p[1]),
    zs = points.map((p) => sn * p[0] + c * p[1]),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs),
    cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2,
    g = hotelGroup(h);
  g.rotation.y = angle;
  g.scale.set(1, 1, 1);
  g.position.set(c * cx + sn * cz, 0, -sn * cx + c * cz);
  h.nativeMetres = true;
  h.sourceFootprint = points;
  h.footprintId = id;
  h.orientation = {
    angleRad: angle,
    longAxisBearingDeg: (270 - (angle * 180) / Math.PI + 360) % 360,
    snowFacadeBearingDeg: (180 - (angle * 180) / Math.PI + 360) % 360,
  };
  return { g, w: x1 - x0, d: z1 - z0 };
}
function snowHall(g, x, y, z, w, h, d) {
  glassHall(g, x, y, z, w, h, d);
  const cols = Math.max(1, Math.floor(w / 3.5));
  for (let j = 0; j <= cols; j++)
    hb(g, 0.16, h, 0.3, facadeMats.frame, x - w / 2 + (j * w) / cols, y + h / 2, z - d / 2 - 0.1);
  for (let k = 0; k <= Math.floor(h / 3.2); k++)
    hb(g, w, 0.16, 0.3, facadeMats.frame, x, y + k * 3.2, z - d / 2 - 0.1);
}
// Source-plan parts retain separate architectural levels; the elevated dining room
// must not turn into a solid extrusion from the terrain to the roof.
function hotelPolygonPart(
  g,
  poly,
  { name, bottom, height, floors = 0, material: mat, slab = 0.35, glazed = false },
) {
  const part = new THREE.Group();
  part.name = name;
  part.userData.hotelPlanPart = { name, polygon: poly.map((p) => p.slice()), bottom, height };
  g.add(part);
  const shape = new THREE.Shape();
  poly.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  shape.closePath();
  function mass(y, depth, material) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = y;
    mesh.castShadow = mesh.receiveShadow = true;
    part.add(mesh);
    return mesh;
  }
  mass(bottom, height, mat);
  mass(bottom, 0.22, facadeMats.orange);
  mass(bottom + height, slab, glazed ? facadeMats.orange : facadeMats.snow);
  const area = poly.reduce((sum, a, i) => {
      const b = poly[(i + 1) % poly.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0),
    sign = area > 0 ? 1 : -1;
  const levels = glazed ? 3 : floors,
    fh = height / levels;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      nx = (sign * dz) / length,
      nz = (-sign * dx) / length,
      angle = Math.atan2(nx, nz),
      cols = Math.floor(length / (glazed ? 3.5 : 4.8));
    // All facade members use their actual edge, including the main wing's ~10° bend.
    const edge = new THREE.Group();
    edge.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
    edge.rotation.y = Math.atan2(-dz, dx);
    part.add(edge);
    for (let k = 0; k <= levels; k++)
      hb(edge, length, 0.16, 0.2, facadeMats.frame, 0, bottom + k * fh, 0);
    for (let j = 0; j < cols; j++) {
      const t = (j + 0.5) / cols,
        x = lerp(a[0], b[0], t),
        z = lerp(a[1], b[1], t);
      for (let k = 0; k < levels; k++)
        windowAt(
          g,
          x + nx * 0.2,
          bottom + (k + 0.53) * fh,
          z + nz * 0.2,
          glazed ? Math.min(2.9, length / cols - 0.3) : 2.5,
          fh * 0.61,
          angle,
        );
    }
  }
  // registerSolids consumes boxes. Inscribe narrow boxes in each source triangle,
  // rather than adding a whole-building rectangle across the concave plan/underpass.
  const triangles = THREE.ShapeUtils.triangulateShape(
    poly.map((p) => new THREE.Vector2(...p)),
    [],
  );
  for (const ids of triangles) {
    const tri = ids.map((i) => poly[i]),
      zs = tri.map((p) => p[1]),
      lo = Math.min(...zs),
      hi = Math.max(...zs),
      steps = Math.max(1, Math.ceil((hi - lo) / 0.65));
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
        part,
        x1 - x0,
        height + slab,
        z1 - z0,
        facadeMats.base,
        (x0 + x1) / 2,
        bottom + (height + slab) / 2,
        (z0 + z1) / 2,
      );
      solid.visible = false;
      solid.userData.sourcePlanCollision = true;
    }
  }
  return part;
}
// Photo-derived local levels, in metres. These are display terraces, not DEM survey corrections.
function hotelSiteFrame(h, origin, normal) {
  const g = h.group,
    side = [normal[1], -normal[0]],
    point = (x, z) => [
      origin[0] + side[0] * x + normal[0] * z,
      origin[1] + side[1] * x + normal[1] * z,
    ];
  const rect = (x, z, w, d) => [
    point(x - w / 2, z - d / 2),
    point(x + w / 2, z - d / 2),
    point(x + w / 2, z + d / 2),
    point(x - w / 2, z + d / 2),
  ];
  const frame = new THREE.Group();
  frame.position.set(origin[0], 0, origin[1]);
  frame.rotation.y = Math.atan2(normal[0], normal[1]);
  g.add(frame);
  return { g: frame, point, rect };
}
function hotelBridge(h, frame, { x = 0, start, end, level, width = 3.4, covered = true }) {
  const length = end - start,
    bridge = new THREE.Group();
  bridge.position.set(x, level, (start + end) / 2);
  frame.g.add(bridge);
  bridge.userData.pendingSnowAccess = true;
  hb(bridge, width, 0.3, length, facadeMats.base, 0, -0.15, 0);
  if (covered) {
    hb(bridge, width + 0.4, 0.25, length + 0.4, facadeMats.snow, 0, 3.05, 0);
    for (const side of [-1, 1]) {
      hb(bridge, 0.12, 2.7, length, facadeMats.glass, (side * width) / 2, 1.45, 0);
      for (let z = -length / 2; z <= length / 2 + 0.1; z += 3)
        hb(bridge, 0.14, 2.9, 0.14, facadeMats.frame, (side * width) / 2, 1.45, z);
    }
  } else
    for (const side of [-1, 1]) {
      hb(bridge, 0.12, 0.12, length, facadeMats.frame, (side * width) / 2, 1.15, 0);
      for (let z = -length / 2; z <= length / 2 + 0.1; z += 2)
        hb(bridge, 0.12, 1.2, 0.12, facadeMats.frame, (side * width) / 2, 0.6, z);
    }
  h.referenceBridge = {
    rendered: false,
    status: '接入待核实；宽雪台已撤除，暂不展示悬空的估计接桥',
    level,
    width,
    length,
    start: frame.point(x, start),
    end: frame.point(x, end),
    roadProbe: frame.point(x, (start + end) / 2),
  };
  return bridge;
}
function hotelSiteRoad(frame, x, z, w, d, level = 0) {
  const detail = new THREE.Group();
  detail.userData.estimatedSiteDetail = true;
  frame.g.add(detail);
  const road = hb(
    detail,
    w,
    0.12,
    d,
    material('#686e6d', {
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }),
    x,
    level + 0.09,
    z,
  );
  road.userData.hotelRoad = true;
  for (const side of [-1, 1])
    hb(detail, w, 0.12, 0.25, facadeMats.frame, x, level + 0.02, z + (side * d) / 2);
}
function hotelRetainingEdge(frame, x, z, w, low, high, opening = null) {
  const detail = new THREE.Group();
  detail.userData.estimatedSiteDetail = true;
  frame.g.add(detail);
  hb(detail, w, high - low, 0.4, facadeMats.base, x, (low + high) / 2, z);
  for (let xx = x - w / 2; xx <= x + w / 2; xx += 4)
    if (!opening || Math.abs(xx - opening.x) > opening.width / 2)
      hb(detail, 0.09, 1.1, 0.09, facadeMats.frame, xx, high + 0.55, z);
  const spans = opening
    ? [
        [x - w / 2, opening.x - opening.width / 2],
        [opening.x + opening.width / 2, x + w / 2],
      ]
    : [[x - w / 2, x + w / 2]];
  for (const [a, b] of spans)
    hb(detail, b - a, 0.09, 0.09, facadeMats.frame, (a + b) / 2, high + 1.05, z);
}
function hotelSnowTransition(h, frame, start, width, level, length = 32) {
  h.group.userData.hotelSitePlan.afterBase = (base, regions, toWorld) => {
    const a = toWorld(frame.point(0, start)),
      b = toWorld(frame.point(0, start + length)),
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    regions.push({
      kind: 'snow-transition',
      polygon: frame.rect(0, start + length / 2, width, length).map(toWorld),
      height: base + level - 0.025,
      feather: 2,
      heightAt: (x, z) => {
        const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (length * length), 0, 1),
          blend = t * t * (3 - 2 * t);
        return lerp(base + level - 0.025, heightAt(x, z), blend);
      },
    });
  };
}
// Double Dragon: southwest accommodation wing; northeast raised dining hall; snow side is SE.
{
  const h = hotels[1],
    { g, w, d } = hotelFrame(h, '259557731', 0.8766147105);
  g.updateWorldMatrix(true, false);
  const plan = h.sourceFootprint.map(([x, z]) => {
      const p = g.worldToLocal(new V(x, 0, z));
      return [p.x, p.z];
    }),
    take = (ids) => ids.map((i) => plan[i]);
  const facadeSeed = seed,
    guestIndices = [0, 1, 2, 16, 17],
    connectorIndices = [2, 3, 4, 5, 6, 7, 12, 13, 14, 15, 16],
    diningIndices = [7, 8, 9, 10, 11, 12];
  hotelPolygonPart(g, take(guestIndices), {
    name: 'double-guest-wing',
    bottom: 0,
    height: 22.4,
    floors: 7,
    material: facadeMats.ivory,
  });
  hotelPolygonPart(g, take(connectorIndices), {
    name: 'double-middle-connector',
    bottom: 0,
    height: 13.2,
    floors: 4,
    material: facadeMats.ivory,
  });
  hotelPolygonPart(g, take(diningIndices), {
    name: 'double-raised-dining',
    bottom: 13,
    height: 10,
    material: facadeMats.glass,
    slab: 1.5,
    glazed: true,
  });
  // Preserve the 172 random draws of the former two facades, so changing this
  // building's window count does not rearrange later buildings/forest details.
  seed = facadeSeed;
  for (let i = 0; i < 172; i++) rand();
  // Supports remain 13m high, entirely inside the dining-room plan.
  for (const [x, z] of [
    [-55, -15],
    [-43, -12],
    [-31, -9],
  ])
    hb(g, 0.9, 13, 0.9, facadeMats.base, x, 6.5, z);
  g.userData.sourcePlanParts = {
    sourceId: h.footprintId,
    guestIndices,
    connectorIndices,
    diningIndices,
  };
  // Covered bridge crosses the forecourt/access road; estimated width, not a bridge survey.
  const site = hotelSiteFrame(h, [0, -8], [0, -1]);
  g.userData.hotelSitePlan = {
    roadAnchor: site.point(12, 13),
    regions: [
      { kind: 'lobby-apron', polygon: site.rect(0, 3, 125, 8), level: 0, feather: 2 },
      { kind: 'lower-road', polygon: site.rect(0, 14, 125, 16), level: 0, feather: 2 },
      { kind: 'snow-landing', polygon: site.rect(0, 38, 125, 21), level: 5.4, feather: 5 },
    ],
  };
  hotelSiteRoad(site, 0, 14, 125, 16);
  hotelBridge(h, site, { x: -2, start: -1, end: 34, level: 5.4 });
  hotelRetainingEdge(site, 0, 27.5, 125, 0, 5.4, { x: -2, width: 4 });
  hotelSnowTransition(h, site, 46, 125, 5.4);
  h.siteAccess = {
    lobby: site.point(24, 2),
    road: site.point(-2, 14),
    snow: site.point(-2, 34),
    lobbyLevel: 0,
    roadLevel: 0,
    snowLevel: 5.4,
  };
  const fa = plan[2],
    fb = plan[1],
    fl = Math.hypot(fb[0] - fa[0], fb[1] - fa[1]),
    fnx = (fb[1] - fa[1]) / fl,
    fnz = -(fb[0] - fa[0]) / fl;
  const sign = hotelSign(
    g,
    '双 龙 酒 店',
    18,
    (fa[0] + fb[0]) / 2 + fnx * 0.25,
    21.0,
    (fa[1] + fb[1]) / 2 + fnz * 0.25,
  );
  sign.rotation.y = Math.atan2(fnx, fnz);
  parking(g, 13, -21, 72, 18, 14);
  h.architecture = '东北—西南长轴 · 东南临雪道 · 东北端架空玻璃餐厅 · 跨路封闭连廊';
}
// One shared geographic apartment ensemble. Brands/indoor themed suites are not separate towers.
apartmentFootprint(hotels[2], '1153883037', 17);
apartmentFootprint(hotels[3], '1153883038', 19);
hotels[3].locationUnverified = true;
// Dragon Palace: northern guest-room bar, southern snow-facing podium, east-end arrival court.
{
  const h = hotels[0],
    { g, w, d } = hotelFrame(h, '1153883032', 0.1243735728);
  hb(g, 121, 9, 52, facadeMats.base, 0, 4.5, 0);
  for (let i = 0; i < 3; i++) {
    const x = -39 + i * 39,
      fl = 10 - i,
      H = 8 + fl * 3.1;
    floorFacade(g, x, 14, 38, 25, fl, 3.1, facadeMats.ivory, 8);
    roof(g, x, H, 14, 39.5, 27, 4.0);
    for (const xx of [x - 18, x + 18]) hb(g, 0.6, 9, 0.5, facadeMats.timber, xx, H - 4.5, 0.9);
    hb(g, 38.7, 0.65, 25.7, facadeMats.timber, x, H - 9, 14);
    snowHall(g, x, H - 9, 0.9, 12, 8.8, 0.8);
    hb(g, 1, 5, 1, facadeMats.timber, x, H + 1, 14);
  }
  // The tall blue lift/stair glazing belongs to the EAST SHORT END, not the whole south facade.
  hb(g, 1.3, 38, 10, facadeMats.glass, -59, 19, 13);
  for (let i = 0; i <= 12; i++) hb(g, 1.4, 0.12, 10.1, facadeMats.frame, -59.1, i * 3.1, 13);
  roof(g, -57, 40, 13, 8, 13, 3.6);
  snowHall(g, 0, 0, -20, 119, 9, 14);
  // Glazed upper dining room is at the western end, overlooking the snow front.
  snowHall(g, 43, 9, -18, 32, 5.4, 16);
  roof(g, 43, 14.4, -18, 33, 17, 1.8);
  // Small clock gable at the east corner of the snow-service podium.
  const clock = new THREE.Group();
  clock.scale.set(0.3, 0.35, 0.28);
  clock.position.set(-43, 0, -18);
  clock.rotation.y = Math.PI;
  g.add(clock);
  clockTower(clock, 0, 0);
  const entry = new THREE.Group();
  entry.position.set(-60, 0, 11);
  entry.rotation.y = -Math.PI / 2;
  g.add(entry);
  entrance(entry, 0, 0, 11);
  entry.scale.set(0.45, 0.52, 0.5);
  const sign = hotelSign(g, '龙 宫 酒 店', 15, -61, 6, 12);
  sign.rotation.y = -Math.PI / 2;
  // Arrival court is east of the building; the southern frontage remains a snow apron.
  parking(g, -75, 4, 22, 47, 12);
  h.architecture = '东西偏7°长轴 · 南偏东雪道长立面 · 北偏西背山 · 东北端蓝玻璃塔和到达入口';
  const site = hotelSiteFrame(h, [0, 0], [0, 1]);
  g.userData.hotelSitePlan = {
    roadAnchor: [-75, 4],
    regions: [
      { kind: 'arrival-court', polygon: site.rect(-75, 4, 28, 56), level: 0, feather: 3 },
      { kind: 'snow-apron', polygon: site.rect(0, -28.5, 121, 3), level: 0, feather: 12 },
    ],
  };
  hotelSiteRoad(site, -75, 4, 24, 52);
  h.siteAccess = {
    lobby: [-63, 11],
    road: [-75, 4],
    snow: [0, -31],
    lobbyLevel: 0,
    roadLevel: 0,
    snowLevel: 0,
  };
}
// Shenglong: the U-shaped footprint EAST of Double Dragon, corroborated by image 5 and satellite.
// The old OSM named point overlaps Dragon Palace and is not used for this building.
{
  const h = hotels[4];
  apartmentFootprint(h, '1032077621', 7);
  const g = h.group,
    f = h.snowFront;
  if (f) {
    const site = hotelSiteFrame(h, [f.x, f.z], [f.nx, f.nz]),
      width = 95;
    g.userData.hotelSitePlan = {
      roadAnchor: site.point(0, 30),
      roadLevel: -5.4,
      regions: [
        { kind: 'raised-courtyard', polygon: site.rect(0, 11, width, 24), level: 0, feather: 1.5 },
        {
          kind: 'lower-road',
          polygon: site.rect(0, 30, width + 10, 12),
          level: -5.4,
          feather: 1.5,
        },
        { kind: 'snow-landing', polygon: site.rect(0, 45, width + 10, 14), level: 0, feather: 4 },
      ],
    };
    hotelSiteRoad(site, 0, 30, width + 10, 12, -5.4);
    hotelBridge(h, site, { start: 21, end: 42, level: 0, covered: false });
    hotelRetainingEdge(site, 0, 23, width, -5.4, 0, { x: 0, width: 4 });
    hotelRetainingEdge(site, 0, 38, width + 10, -5.4, 0, { x: 0, width: 4 });
    hotelSnowTransition(h, site, 50, width + 10, 0);
    h.siteAccess = {
      lobby: site.point(0, 2),
      road: site.point(0, 30),
      snow: site.point(0, 42),
      lobbyLevel: 0,
      roadLevel: -5.4,
      snowLevel: 0,
    };
  }
  h.group.userData.hotelStyle = 'shenglong';
  h.locationConflict = false;
  h.architecture = '东南—西北微转长轴 · 南偏西开口庭院 · 两端外伸翼楼 · 隔道路接长龙道';
}
// Yuelong is represented by its own entrance in the apartment podium, not an invented tower.
{
  const h = hotels[5],
    g = hotelGroup(h);
  hb(g, 61, 15, 30, facadeMats.base, 0, 7.5, 0);
  glassHall(g, 0, 2, 17, 51, 9, 8);
  roof(g, 0, 15, 0, 64, 34, 2);
  entrance(g, 0, 20, 22);
  hotelSign(g, '悦 龙 酒 店', 43, 0, 12, 21.4);
  h.modelCenter = g.position.clone().add(new V(0, 10, 15));
  h.modelRadius = 170;
}
// Fit the reference facade models to source building envelopes. Height is still an exterior estimate.
const footprintIds = { 1: '1153883032', 2: '259557731', 3: '1153883037', 4: '1153883038' };
for (const h of hotels) {
  const g = h.group;
  g.updateWorldMatrix(true, true);
  const old = g.matrixWorld.clone(),
    b = GEO.buildings.find((b) => b.id === footprintIds[h.id]);
  if (b) h.sourceFootprint = b.coords.slice(0, -1).map(projectGeo);
  if (b && !h.nativeMetres) {
    g.position.set(0, 0, 0);
    g.rotation.y = 0;
    g.scale.set(1, 1, 1);
    g.updateWorldMatrix(true, true);
    const raw =
        h.id === 2
          ? new THREE.Box3(new V(-121, -0.4, -28), new V(165, 53.5, 43))
          : new THREE.Box3().setFromObject(g),
      size = raw.getSize(new V()),
      localCenter = raw.getCenter(new V()),
      pp = b.coords.map(projectGeo);
    let longest = 0,
      angle = 0;
    for (let i = 1; i < pp.length; i++) {
      const dx = pp[i][0] - pp[i - 1][0],
        dz = pp[i][1] - pp[i - 1][1],
        len = Math.hypot(dx, dz);
      if (len > longest) {
        longest = len;
        angle = Math.atan2(-dz, dx);
      }
    }
    const c = Math.cos(angle),
      s = Math.sin(angle),
      rx = pp.map((p) => c * p[0] - s * p[1]),
      rz = pp.map((p) => s * p[0] + c * p[1]),
      x0 = Math.min(...rx),
      x1 = Math.max(...rx),
      z0 = Math.min(...rz),
      z1 = Math.max(...rz),
      cx = (x0 + x1) / 2,
      cz = (z0 + z1) / 2;
    g.rotation.y = angle;
    g.scale.set(((x1 - x0) * 0.96) / size.x, 0.55, ((z1 - z0) * 0.96) / size.z);
    const offset = localCenter
        .clone()
        .multiply(g.scale)
        .applyAxisAngle(new V(0, 1, 0), angle),
      wx = c * cx + s * cz,
      wz = -s * cx + c * cz;
    g.position.set(wx - offset.x, heightAt(wx, wz), wz - offset.z);
    h.footprintId = b.id;
  } else if (!h.nativeMetres) g.scale.set(0.6, 0.55, 0.6);
  if (h.id <= 5) {
    foundation(g, 'hotel-' + h.id, 'hotel', 0.7, h.sourceFootprint);
    registerSolids(g, 'hotel-' + h.id);
  }
  if (h.id === 6) g.visible = false;
  g.updateWorldMatrix(true, true);
  const delta = g.matrixWorld.clone().multiply(old.invert());
  for (const m of hotelWindows) if (m.owner === g) m.premultiply(delta);
  const fit = new THREE.Box3().setFromObject(g);
  h.modelBounds = fit.clone();
  h.modelCenter = fit.getCenter(new V());
  h.modelRadius = clamp(fit.getSize(new V()).length() * 0.9, 140, 240);
}
finalizeHotelSites();
// Forecourt details follow the finished local road/court rather than the uncut DEM.
for (const detail of hotelGroundDetails) {
  const g = detail.g;
  if (hotels.some((h) => h.id <= 5 && h.group === g) || g === hotels[5].group) continue;
  function world(x, z) {
    const p = g.localToWorld(new V(x, 0, z));
    p.y = hotelDisplayGroundHeightAt(p.x, p.z) ?? heightAt(p.x, p.z);
    return p;
  }
  if (detail.kind === 'parking') {
    const { x, z, w, d, count } = detail,
      corners = [
        world(x - w / 2, z - d / 2),
        world(x + w / 2, z - d / 2),
        world(x + w / 2, z + d / 2),
        world(x - w / 2, z + d / 2),
      ];
    surfacePolygon(
      surfaceLayers.site,
      corners.map((p) => [p.x, p.z]),
      'rgba(174,185,183,.65)',
    );
    const mats = [material('#dae1df'), material('#637276'), material('#a27565')];
    for (let i = 0; i < count; i++) {
      const localX = x - w / 2 + ((i + 0.5) * w) / count,
        p = world(localX, z),
        cg = new THREE.Group();
      cg.position.copy(p);
      cg.rotation.y = g.rotation.y;
      buildings.add(cg);
      hb(cg, 1.85, 1.15, 4.0, mats[i % 3], 0, 0.72, 0);
      hb(cg, 1.7, 0.75, 2.1, facadeMats.glass, 0, 1.5, -0.1);
      const line = [
        world(localX - (w / count) * 0.48, z - d * 0.4),
        world(localX - (w / count) * 0.48, z + d * 0.4),
      ];
      surfaceStroke(
        surfaceLayers.site,
        line.map((p) => [p.x, p.z]),
        0.2,
        '#e1e7e3',
      );
    }
  } else {
    const { x, z, w } = detail,
      n = Math.ceil((w * g.scale.x) / 4);
    for (let i = 0; i < n; i++) {
      const p = world(x - w / 2 + (i / n) * w, z),
        q = world(x - w / 2 + ((i + 1) / n) * w, z);
      beam(p.clone(), p.clone().add(new V(0, 1.2, 0)), 0.05, woodMat, buildings);
      for (const y of [0.65, 1.15])
        beam(
          p.clone().add(new V(0, y, 0)),
          q.clone().add(new V(0, y, 0)),
          0.045,
          woodMat,
          buildings,
        );
    }
  }
}
// Windows use real geometry with independent warm and cold glazing batches.
for (const [mat, matrices] of [
  [facadeMats.glass, hotelColdWindows],
  [warmMat, hotelWarmWindows],
]) {
  for (const inspector of [false, true]) {
    const mm = matrices.filter((m) => m.owner.visible !== false && false === inspector);
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.65), mat, mm.length);
    mm.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.receiveShadow = true;
    (inspector ? inspectionScene : buildings).add(mesh);
  }
}
// Entrances and promenade lights; warm emissive details preserve night performance.
const lampMat = material('#efe0b3', { emissive: '#ffbc66', emissiveIntensity: 0.28 });
hotelLights.push(lampMat);
for (const h of hotels.filter((h) => h.id <= 5)) {
  const b = h.modelBounds;
  for (let i = 0; i < 4; i++) {
    const x = lerp(b.min.x + 2, b.max.x - 2, (i + 0.5) / 4),
      z = b.max.z + 5,
      y = hotelDisplayGroundHeightAt(x, z) ?? heightAt(x, z);
    beam(new V(x, y, z), new V(x, y + 3, z), 0.08, steelMat, buildings);
    box(0.7, 0.2, 0.7, lampMat, x, y + 3, z, buildings);
  }
}
// Picking proxies are independent of the batched, highly detailed facade geometry.
for (const h of hotels) {
  if (h.id === 6 || h.locationUnverified) continue;
  const proxy = new THREE.Mesh(
    new THREE.BoxGeometry(h.modelRadius * 0.58, h.id === 3 || h.id === 4 ? 66 : 46, 60),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    }),
  );
  proxy.position.copy(h.modelCenter);
  proxy.userData = { kind: 'hotel', id: h.id };
  scene.add(proxy);
  pickables.push(proxy);
}
function selectHotel(id, focus = true) {
  setSurfaceSelection(null);
  const h = hotels.find((h) => h.id === id);
  state.selected = { kind: 'hotel', id };
  if (highlight) {
    pisteGroup.remove(highlight);
    highlight.geometry.dispose();
    highlight.material.dispose();
    highlight = null;
  }
  if (highlightLine) {
    pisteGroup.remove(highlightLine);
    highlightLine.geometry.dispose();
    highlightLine.material.dispose();
    highlightLine = null;
  }
  document.body.classList.add('exploring');
  const d = $('detail');
  d.classList.add('hotel-detail');
  d.hidden = false;
  d.innerHTML =
    '<div class="detail-top"><div class="eyebrow">STAY IN THE MOUNTAINS</div><button class="close" aria-label="关闭详情">×</button></div><h2>' +
    h.name +
    '</h2><div class="detail-sub">' +
    h.english +
    '</div><div class="badge">▥ ' +
    h.kind +
    '</div><div class="data-grid">' +
    cell('资料房型面积', h.rooms, '㎡') +
    cell('房型容纳', h.people, '人') +
    '</div><div class="hotel-facilities">' +
    h.features.map((f) => '<span>' + f + '</span>').join('') +
    '</div><div class="hotel-rooms">' +
    h.roomNote +
    '</div><p class="detail-note">' +
    h.description +
    '</p>' +
    floorNotesHTML(h.floorDetails) +
    '<div class="profile-title"><span>建筑观察</span></div><p class="photo-note">' +
    h.architecture +
    '<br>参考公开外观重建，楼高与立面非实测；未获得施工图，非建筑测绘模型。房型是资料范围，价格与营业状态以酒店公告为准。</p><button class="primary" id="hotel-closeup">⌕ 建筑近景</button><button class="secondary" id="hotel-overview">◇ 山脚建筑群</button><a class="source-link" href="' +
    h.source +
    '" target="_blank" rel="noopener">酒店资料来源 ↗</a><a class="source-link" href="' +
    h.ref +
    '" target="_blank" rel="noopener">查看外观与图集参考 ↗</a>';
  addDiningLink(h, d);
  d.querySelector('.close').onclick = () => {
    d.hidden = true;
    document.body.classList.remove('exploring');
  };
  function view(close) {
    exitExperience(false);
    if (h.locationUnverified) {
      const complex = hotels[2].modelBounds.clone().union(hotels[3].modelBounds);
      desired.target.copy(complex.getCenter(new V()));
      desired.theta = -0.3;
      desired.phi = 1.1;
      desired.radius = 450;
      toast('主题公寓为03号C座；尚未把C座对应到独立测绘轮廓，展示公寓楼群。');
      return;
    }
    if (close && h.locationConflict) {
      state.mode = 'architecture';
      $('labels').hidden = true;
      $('reference-warning').hidden = false;
      $('reference-warning').textContent =
        '盛龙公寓 · 独立外观展示 · OSM 地名位置与全景图有冲突，未将该体量摆入地理模型';
      $('ride-title').innerHTML =
        '盛龙公寓 · 建筑外观观察<small>独立展示，不是地理定位 · Esc 返回雪场</small>';
      $('ride-bar').hidden = false;
    }
    desired.target.copy(close ? h.modelCenter : new V(0, 120, 950));
    desired.theta = close
      ? h.id === 1
        ? -2.3
        : h.orientation
          ? (-h.orientation.snowFacadeBearingDeg * Math.PI) / 180
          : -2.35
      : 0.07;
    desired.phi = close ? 1.17 : 1.01;
    desired.radius = close ? h.modelRadius * 2.3 : 2750;
  }
  $('hotel-closeup').onclick = () => view(true);
  if (h.id === 6) {
    $('hotel-closeup').disabled = true;
    $('hotel-closeup').textContent = '入口位置待核实';
  }
  if (h.locationConflict) $('hotel-closeup').textContent = '独立查看建筑外观';
  if (h.locationUnverified) $('hotel-closeup').textContent = '查看公寓楼群 · C座未独立配准';
  $('hotel-overview').onclick = () => view(false);
  if (focus) view(h.id !== 6);
  if (innerWidth <= 760) $('sidebar').classList.add('mobile-hidden');
  renderList();
  updateLabels();
  drawMinimap();
}
