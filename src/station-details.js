// Official photos night-2-1, upgrade-13/14: silver barrel covers and white end panels.
// Dimensions and mechanics are illustrative; not a surveyed reconstruction of every numbered station.
const stationRotors = [],
  stationDetailRecords = [],
  terminalMechanismRecords = [];
const terminalMats = {
  metal: material('#a8afb0', { roughness: 0.48, metalness: 0.52 }),
  end: material('#e8e9e3', { roughness: 0.72, metalness: 0.12 }),
  seam: material('#747f80', { roughness: 0.65, metalness: 0.4 }),
  dark: material('#33454a', { roughness: 0.4, metalness: 0.18 }),
};
function mergeRotor(g) {
  g.updateWorldMatrix(true, true);
  const inverse = g.matrixWorld.clone().invert(),
    positions = [],
    normals = [];
  let length = 0;
  for (const m of [...g.children]) {
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    geo.applyMatrix4(inverse.clone().multiply(m.matrixWorld));
    positions.push(geo.attributes.position.array);
    normals.push(geo.attributes.normal.array);
    length += geo.attributes.position.array.length;
    m.removeFromParent();
    m.geometry.dispose();
    geo.dispose();
  }
  const p = new Float32Array(length),
    n = new Float32Array(length);
  let at = 0;
  positions.forEach((a, i) => {
    p.set(a, at);
    n.set(normals[i], at);
    at += a.length;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  const m = new THREE.Mesh(geo, steelMat);
  m.castShadow = true;
  g.add(m);
}
function terminalCanopy(g) {
  const half = 7.1,
    rise = 3.25,
    spring = 2.92,
    depth = 24.8,
    segments = 20;
  function shell(z0, z1, offset, mat) {
    const v = [],
      ix = [];
    for (let j = 0; j < 2; j++)
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI;
        v.push(-Math.cos(a) * (half + offset), spring + Math.sin(a) * (rise + offset), j ? z1 : z0);
        if (!j && i < segments) {
          const k = i;
          ix.push(k, k + segments + 1, k + 1, k + 1, k + segments + 1, k + segments + 2);
        }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setIndex(ix);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }
  shell(-depth / 2, depth / 2, 0, terminalMats.metal);
  const s = new THREE.Shape();
  s.moveTo(-half, 0);
  for (let i = 1; i <= segments; i++) {
    const a = (Math.PI * i) / segments;
    s.lineTo(-Math.cos(a) * half, Math.sin(a) * rise);
  }
  s.lineTo(-half, 0);
  const capGeo = new THREE.ExtrudeGeometry(s, { depth: 0.19, steps: 1, bevelEnabled: false });
  for (const z of [-depth / 2 - 0.19, depth / 2]) {
    const end = new THREE.Mesh(capGeo, terminalMats.end);
    end.position.set(0, spring, z);
    end.castShadow = true;
    g.add(end);
    box(4.9, 1.38, 0.045, terminalMats.dark, 0, 4.06, z + (z > 0 ? 0.21 : -0.025), g);
    for (const x of [-2.45, -0.82, 0.82, 2.45])
      box(0.07, 1.4, 0.065, terminalMats.end, x, 4.06, z + (z > 0 ? 0.24 : -0.055), g);
    box(5, 0.08, 0.07, terminalMats.end, 0, 3.39, z + (z > 0 ? 0.24 : -0.055), g);
  }
  for (let z = -11; z <= 11; z += 2) shell(z - 0.035, z + 0.035, 0.025, terminalMats.seam);
  for (const x of [-half, half]) box(0.12, 0.18, 24.8, terminalMats.seam, x, spring + 0.02, 0, g);
  for (const z of [-5, 0, 5]) box(2, 0.09, 1.2, terminalMats.seam, 0, spring + rise + 0.025, z, g);
}
function terminalStairs(g, base) {
  // Fold maintenance access into the outboard platform strip instead of a long diagonal ladder.
  const top = -6.25,
    bottom = Math.min(top - 0.22, base - g.position.y),
    drop = top - bottom,
    flights = Math.max(1, Math.ceil(drop / 3.3)),
    steps = Math.ceil(drop / flights / 0.22),
    run = Math.min(5.3, steps * 0.3);
  for (let f = 0; f < flights; f++) {
    const flip = f % 2,
      xc = flip ? -5.82 : -6.48,
      y0 = top - (drop * f) / flights,
      y1 = top - (drop * (f + 1)) / flights,
      z0 = flip ? -5 - run : -5,
      z1 = flip ? -5 : -5 - run;
    for (let k = 0; k <= steps; k++)
      box(
        0.58,
        0.08,
        0.34,
        terminalMats.seam,
        xc,
        lerp(y0, y1, k / steps),
        lerp(z0, z1, k / steps),
        g,
      );
    for (const x of [xc - 0.27, xc + 0.27]) {
      beam(new V(x, y0 + 0.85, z0), new V(x, y1 + 0.85, z1), 0.035, steelMat, g);
      for (const u of [0, 0.5, 1])
        beam(
          new V(x, lerp(y0, y1, u), lerp(z0, z1, u)),
          new V(x, lerp(y0, y1, u) + 0.85, lerp(z0, z1, u)),
          0.035,
          steelMat,
          g,
        );
    }
    if (f < flights - 1) box(1.3, 0.1, 0.7, terminalMats.seam, -6.15, y1, z1, g);
  }
  return { flights, drop, run };
}
const stationNumberMaterials = new Map();
let stationWordmarkMaterial = null;
function stationNumberMaterial(label) {
  if (stationNumberMaterials.has(label)) return stationNumberMaterials.get(label);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#f4efeb';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 104, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f4efeb';
  ctx.font = label.length > 1 ? '700 95px sans-serif' : '700 155px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 135);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  stationNumberMaterials.set(label, material);
  return material;
}
function getStationWordmarkMaterial() {
  if (stationWordmarkMaterial) return stationWordmarkMaterial;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#a82d3a';
  ctx.fillRect(0, 0, 1024, 160);
  ctx.fillStyle = '#f7f2ed';
  ctx.font = 'italic 700 92px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WANLONG', 512, 84);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  stationWordmarkMaterial = new THREE.MeshStandardMaterial({ map, roughness: 0.7 });
  return stationWordmarkMaterial;
}
function detailPhotoBaseStation(g, rt, apron, style = null) {
  // User's 2026-10-18 webcam: two low, parallel red machine covers on a shared apron.
  const travelSign = style?.t === 1 ? -1 : 1;
  const half = 6,
    depth = style ? 24 : rt.lift.id === 1 ? 27 : 25.5,
    spring = style ? 1.65 : 2,
    rise = style ? 1.65 : 1.25,
    bottom = 0.65,
    segments = 32,
    paint = material(style ? '#e1e3dd' : '#a82d3a', { roughness: 0.48, metalness: 0.18 }),
    edge = material('#e7e5de', { roughness: 0.55, metalness: 0.3 }),
    roof = material(style ? '#a1a9a9' : '#656c6e', { roughness: 0.57, metalness: 0.5 }),
    deckLocal = apron - g.position.y + 0.12;
  const positions = [],
    indices = [];
  for (let j = 0; j < 2; j++)
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI;
      positions.push(-Math.cos(a) * half, spring + Math.sin(a) * rise, j ? depth / 2 : -depth / 2);
      if (!j && i < segments) {
        const k = i;
        indices.push(k, k + segments + 1, k + 1, k + 1, k + segments + 1, k + segments + 2);
      }
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const cover = new THREE.Mesh(geo, roof);
  cover.castShadow = true;
  cover.receiveShadow = true;
  g.add(cover);
  for (const sign of [-1, 1]) {
    box(0.12, spring - bottom, depth, paint, sign * half, (spring + bottom) / 2, 0, g);
    box(0.13, 0.11, depth, edge, sign * half, bottom + 0.01, 0, g);
  }
  const shape = new THREE.Shape();
  shape.moveTo(-half, bottom);
  shape.lineTo(-half, spring);
  for (let i = 1; i <= segments; i++) {
    const a = (i / segments) * Math.PI;
    shape.lineTo(-Math.cos(a) * half, spring + Math.sin(a) * rise);
  }
  shape.lineTo(half, bottom);
  shape.closePath();
  for (const z of [-depth / 2, depth / 2]) {
    const capShape = shape.clone();
    if (z > 0 && rt.terminalProfiles.some((e) => e.end === 0))
      for (const x of [-3, 3]) {
        const slot = new THREE.Path();
        slot.moveTo(x - 1.1, bottom + 0.005);
        slot.lineTo(x - 1.1, 2.8);
        slot.lineTo(x + 1.1, 2.8);
        slot.lineTo(x + 1.1, bottom + 0.005);
        slot.closePath();
        capShape.holes.push(slot);
      }
    const cap = new THREE.Mesh(new THREE.ShapeGeometry(capShape), paint);
    cap.material = paint.clone();
    cap.material.side = THREE.DoubleSide;
    cap.position.z = z;
    cap.castShadow = true;
    g.add(cap);
    const outline = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI;
      outline.push(new V(-Math.cos(a) * half, spring + Math.sin(a) * rise, z));
    }
    for (let i = 1; i < outline.length; i++) beam(outline[i - 1], outline[i], 0.065, edge, g);
    if (z > 0 && rt.terminalProfiles.some((e) => e.end === 0)) {
      for (const [a, b] of [
        [-half, -4.1],
        [-1.9, 1.9],
        [4.1, half],
      ])
        beam(new V(a, bottom, z), new V(b, bottom, z), 0.065, edge, g);
    } else beam(new V(-half, bottom, z), new V(half, bottom, z), 0.065, edge, g);
    const label =
      rt.lift.stationBadge ||
      ([7, 8, 9].includes(rt.lift.id) ? '?' : String(rt.lift.name).match(/\d+/)?.[0] || '?');
    g.userData.stationBadge = label;
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), stationNumberMaterial(label));
    badge.position.set(0, 1.75, z + (z < 0 ? -0.025 : 0.025));
    if (z < 0) badge.rotation.y = Math.PI;
    g.add(badge);
  }
  for (const sign of [-1, 1]) {
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(17, 1.25), getStationWordmarkMaterial());
    banner.position.set(sign * (half + 0.075), 1.32, 0);
    banner.rotation.y = (sign * Math.PI) / 2;
    g.add(banner);
  }
  box(12.7, 0.18, depth + 1.5, stationMat, 0, deckLocal - 0.09, 0, g);
  for (const x of [-5.45, 5.45])
    for (const z of [-10, 0, 10]) {
      const h = 0.65 - deckLocal;
      box(0.28, h, 0.28, steelMat, x, deckLocal + h / 2, z, g);
      box(0.65, 0.22, 0.65, terminalMats.seam, x, deckLocal + 0.11, z, g);
    }
  for (const z of [-8, 0, 8]) beam(new V(-5.5, 1.8, z), new V(5.5, 1.8, z), 0.1, steelMat, g);
  const rotor = new THREE.Group();
  rotor.position.y = -0.13;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(3, 0.075, 6, 64), steelMat);
  wheel.rotation.x = Math.PI / 2;
  rotor.add(wheel);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    beam(new V(0, 0, 0), new V(Math.cos(a) * 2.95, 0, Math.sin(a) * 2.95), 0.065, steelMat, rotor);
  }
  mergeRotor(rotor);
  g.add(rotor);
  stationRotors.push(rotor);
  // Conveyor tires act on detached carriers inside the station. The separate
  // larger entrance sheaves follow the rope's changing grade outside it.
  for (const x of [-3, 3])
    for (let z = 3; z <= 7; z += 1.3) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.04, 5, 12), terminalMats.dark);
      w.rotation.y = Math.PI / 2;
      w.position.set(x, -0.21, z * travelSign);
      g.add(w);
    }
  detailTerminalEntry(g, rt, style?.t || 0);
  if (rt.lift.type === 'gondola')
    for (const x of [-5.65, 5.65]) box(0.8, 0.15, 9.5, stationMat, x, -4.82, 7 * travelSign, g);
  const bx = 6.5,
    bz = 7.5 * travelSign,
    by = deckLocal + 1.3;
  box(1.7, 2.5, 3.3, terminalMats.end, bx, by, bz, g);
  box(1.74, 1.35, 3.35, glassMat, bx, by + 0.35, bz, g);
  box(2, 0.12, 3.6, roofMat, bx, deckLocal + 2.62, bz, g);
  // Short front queue fences and a shallow accessible approach, not elevated stairs.
  for (const x of [-5.8, 5.8]) {
    beam(
      new V(x, deckLocal + 0.9, -depth / 2 - 0.6),
      new V(x, deckLocal + 0.9, -3.5),
      0.04,
      steelMat,
      g,
    );
    for (const z of [-depth / 2 - 0.6, -9, -4])
      beam(new V(x, deckLocal, z), new V(x, deckLocal + 0.9, z), 0.04, steelMat, g);
  }
  g.userData.referenceStatus = style
    ? style.t
      ? '官方山顶站群：银色弧形机罩、白端面、建筑承托平台；逐站编号外观及尺寸估测'
      : '官方六索施工图提供低银罩/白端面风格；除6索外编号外观未逐站核实，采用低候车站坪示意'
    : '用户2026-10-18的1/2索实拍：红色长机罩、并排贴地站坪；尺寸为图像比例估计';
  stationDetailRecords.push({
    liftId: rt.lift.id,
    t: style?.t || 0,
    group: g,
    canopy: style
      ? 'low silver barrel / white end face'
      : 'red longitudinal machine enclosure / grey roof / white WANLONG fascia',
    reference: style
      ? 'research/wechat-images/' + (style.t ? 'night-2-1.jpg' : 'upgrade-14.jpg')
      : 'research/user-lift12-20261018.png',
    surveyed: false,
    access: { flights: 0, drop: 0.12, run: 0 },
  });
  return g.position.y + deckLocal;
}
function detailTerminalEntry(g, rt, end) {
  const profile = rt.terminalProfiles.find((e) => e.end === end),
    start = profile ? 8 : 12,
    finish = profile ? 20 : 21,
    count = profile ? 12 : 8,
    contacts = [],
    sign = end ? -1 : 1;
  g.updateWorldMatrix(true, false);
  const local = (p) => g.worldToLocal(p.clone()),
    at = (d, lane) => rt.cablePoint(end + (sign * d) / rt.length, lane);
  for (const lane of [-laneWidth, laneWidth]) {
    const centers = [];
    for (let i = 0; i < count; i++) {
      const d = lerp(start, finish, i / (count - 1)),
        p = at(d, lane),
        a = at(Math.max(0, d - 0.3), lane),
        b = at(d + 0.3, lane),
        tangent = b.clone().sub(a).normalize(),
        up = rt.side.clone().cross(tangent).normalize().multiplyScalar(sign);
      if (up.y < 0) up.negate();
      // A rising departure needs hold-down rollers; descending departures use
      // support rollers. This is the terminal assembly, not a retyped line tower.
      const slopeBefore = at(Math.max(0, d - 0.65), lane).y,
        slopeAfter = at(d + 0.65, lane).y,
        curvature = slopeAfter + slopeBefore - 2 * p.y,
        holdDown = profile ? rt.towerY[profile.index] >= profile.level : curvature > 1e-5,
        row = holdDown ? 1 : -1,
        center = p.clone().addScaledVector(up, 0.39 * row),
        c = local(center),
        wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.18, 12), terminalMats.dark);
      wheel.quaternion.setFromUnitVectors(new V(0, 1, 0), new V(1, 0, 0));
      wheel.position.copy(c);
      wheel.castShadow = true;
      g.add(wheel);
      centers.push(center.clone().addScaledVector(up, 0.6 * row));
      contacts.push({
        distance: d,
        kind: holdDown ? 'hold-down' : 'support',
        rope: p.toArray(),
        center: center.toArray(),
      });
    }
    for (let i = 1; i < centers.length; i++)
      beam(local(centers[i - 1]), local(centers[i]), 0.11, steelMat, g);
    for (const i of [0, Math.floor((count - 1) / 2), count - 1]) {
      const c = local(centers[i]);
      beam(new V(lane < 0 ? -5.45 : 5.45, 1.8, 10 * sign), c, 0.085, steelMat, g);
    }
  }
  terminalMechanismRecords.push({
    liftId: rt.lift.id,
    end,
    contacts,
    rangeM: [start, finish],
    surveyed: false,
    basis: profile
      ? 'Wanlong lower-terminal photographs + manufacturer support/hold-down distinction; estimated dimensions'
      : 'manufacturer terminal entrance assembly; exact numbered station mechanism unverified',
  });
}
// Upper terminals in the main summit group sit over service/garage halls.
// The floor follows the inferred cut below the boarding roof, rather than a
// tall opaque world-axis podium. Heights and individual hall splits are estimates.
function detailSummitSupportHall(g, rt, deck, site) {
  const depth = site.hallDepth,
    wall = material('#d5ccad', { roughness: 0.9 }),
    front = material('#466771', { roughness: 0.35, metalness: 0.12 }),
    trim = terminalMats.end;
  box(12.7, 0.28, 27.4, trim, 0, deck - 0.14, 0, g);
  for (const x of [-6.18, 6.18]) box(0.28, depth, 27.2, wall, x, deck - depth / 2, 0, g);
  box(12.4, depth, 0.3, wall, 0, deck - depth / 2, 13.45, g);
  for (const z of [-13.45, 13.45])
    for (const y of [deck - depth + 1.7, deck - depth + 4.4]) {
      box(12.2, 1.65, 0.16, front, 0, y, z, g);
      box(12.65, 0.18, 0.3, trim, 0, y + 0.98, z, g);
      for (const x of [-5.8, -2.9, 0, 2.9, 5.8]) box(0.16, 2.55, 0.28, wall, x, y + 0.25, z, g);
    }
  for (const x of [-5.8, 0, 5.8])
    for (const z of [-12, 0, 12]) box(0.36, depth, 0.36, trim, x, deck - depth / 2, z, g);
  g.userData.supportMode = 'roof-hall';
  g.userData.hallDepth = depth;
  g.userData.referenceStatus += '；承托楼房按官方山顶实景分层恢复，楼层与支承结构为参考';
}
function detailGroundedStation(g, rt, t, site) {
  const deck = detailPhotoBaseStation(g, rt, site.base, { t }),
    local = deck - g.position.y;
  if (site.supportMode === 'roof-hall') detailSummitSupportHall(g, rt, local, site);
  // Platform sits on the small prepared court. Its low apron edge replaces tall piers.
  if (t === 1 && site.supportMode !== 'roof-hall') {
    const stone = material('#c1bba7', { roughness: 0.94 }),
      c = Math.cos(g.rotation.y),
      s = Math.sin(g.rotation.y);
    for (const x of [-6.2, 6.2])
      for (let z = -11; z <= 11; z += 2.2) {
        const wx = g.position.x + x * c + z * s,
          wz = g.position.z - x * s + z * c,
          raw = Math.min(...[-1.1, 0, 1.1].map((dz) => heightAt(wx + dz * s, wz + dz * c))),
          h = Math.max(0.18, deck - raw + 0.15);
        box(0.32, h, 2.18, stone, x, local - h / 2, z, g);
      }
  }
  if (rt.lift.id === 6 && t === 0) {
    // The readable circled 6 belongs to the brown gabled entry hall beside the machinery.
    // Compact interpreted footprint; no unsupported claim of an exact surveyed hall.
    const wall = material('#ded6bf', { roughness: 0.92 }),
      roof = material('#76574b', { roughness: 0.9 });
    box(4.8, 3.5, 9, wall, -9.8, local + 1.75, 0, g);
    for (const sign of [-1, 1]) {
      const m = box(2.9, 0.16, 9.5, roof, -9.8 + sign * 1.2, local + 4.05, 0, g);
      m.rotation.z = -sign * 0.43;
    }
    box(2.7, 2.5, 0.07, glassMat, -9.8, local + 1.3, -4.56, g);
    hotelSign(g, '⑥', 1.3, -9.8, local + 3, -4.65);
    g.userData.referenceStatus += '；6索侧厅按可辨识棕色坡顶入口厅缩略表达';
  }
  return deck;
}
function detailStation(g, rt, t, base) {
  g.userData.referenceStatus = '实拍外观参考；尺寸及机械布局为示意，未逐站测绘';
  // Drop the old continuous opaque room boxes. Preserve deck and original under-platform posts.
  for (const m of [...g.children]) {
    const p = m.geometry?.parameters;
    if (
      p &&
      ((p.width === 1.2 && p.height === 6 && p.depth === 21) ||
        (p.width === 1.25 && p.height === 1.8 && p.depth === 20))
    ) {
      m.removeFromParent();
      m.geometry.dispose();
    }
  }
  terminalCanopy(g);
  for (const x of [-6.18, 6.18])
    for (const z of [-9, 0, 9]) {
      box(0.22, 9.13, 0.25, steelMat, x, -1.69, z, g);
      box(0.48, 0.13, 0.5, terminalMats.seam, x, -6.18, z, g);
    }
  for (const z of [-8, 0, 8]) {
    beam(new V(-6, 2.05, z), new V(6, 2.05, z), 0.12, steelMat, g);
    for (const x of [-5, -2, 1]) {
      beam(new V(x, 2.05, z), new V(x + 1.5, 2.72, z), 0.07, steelMat, g);
      beam(new V(x + 1.5, 2.72, z), new V(x + 3, 2.05, z), 0.07, steelMat, g);
    }
  }
  const rotor = new THREE.Group();
  rotor.userData.moving = true;
  rotor.position.y = 0.38;
  g.add(rotor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3, 0.1, 5, 36), steelMat);
  rim.rotation.x = Math.PI / 2;
  rotor.add(rim);
  rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 12), steelMat));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    beam(
      new V(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45),
      new V(Math.cos(a) * 2.95, 0, Math.sin(a) * 2.95),
      0.07,
      steelMat,
      rotor,
    );
  }
  mergeRotor(rotor);
  stationRotors.push(rotor);
  box(1.7, 0.85, 3.6, roofMat, 0, 1.4, -2, g);
  box(0.22, 2.1, 0.22, steelMat, 0, 1.65, 0, g);
  for (const x of [-laneWidth, laneWidth])
    for (let z = -10; z <= -3; z += 1.4) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.2, 8), chairMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, -0.3, z);
      g.add(wheel);
    }
  // One compact operator booth instead of two continuous glazed wings; inner face x=5.58.
  const x = 6.48,
    z = 5.4,
    w = 1.8,
    d = 4.8;
  box(w, 1, d, terminalMats.end, x, -5.75, z, g);
  box(w, 0.15, d, terminalMats.end, x, -2.65, z, g);
  box(w - 0.12, 2.05, d - 0.16, glassMat, x, -4.35, z, g);
  for (const xx of [x - w / 2, x + w / 2])
    for (const zz of [z - d / 2, z, z + d / 2])
      box(0.075, 3.5, 0.075, terminalMats.end, xx, -4.45, zz, g);
  box(w + 0.18, 0.13, d + 0.18, terminalMats.seam, x, -2.55, z, g);
  box(0.08, 1.9, 0.07, terminalMats.end, x - w / 2 - 0.03, -4.05, z + 0.7, g);
  box(0.55, 0.2, 1.5, terminalMats.dark, x, -4.8, z, g);
  for (const xx of [-5.55, 5.55]) {
    for (const yy of [-5.85, -5.2])
      beam(new V(xx, yy, -10.4), new V(xx, yy, 10.4), 0.035, steelMat, g);
    for (let zz = -10; zz <= 10; zz += 4)
      beam(new V(xx, -6.25, zz), new V(xx, -5.18, zz), 0.035, steelMat, g);
    box(0.13, 0.025, 21, facadeMats.orange, xx, -6.235, 0, g);
  }
  const access = terminalStairs(g, base);
  hotelSign(g, rt.lift.name.replace('（OSM）', ''), 5.3, 0, 2.25, 12.55);
  for (const xx of [-4.7, 4.7])
    for (const zz of [-8, 0, 8]) box(0.24, 0.07, 0.45, warmMat, xx, 2.78, zz, g);
  stationDetailRecords.push({
    liftId: rt.lift.id,
    t,
    group: g,
    access,
    reference: '官方山顶站群及六索施工照片；编号对应以实拍可见标识为限',
    canopy: 'silver barrel / white end-face',
    surveyed: false,
  });
}
