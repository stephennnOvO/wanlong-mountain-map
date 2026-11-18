// Additive reference reconstruction from the 2026.09 panorama and local photos.
// It does not modify DEM vertices, piste routes, or the Menglong park.
function keepSkiersOnParkBypass(trail, t, offset) {
  const lane = trail.trainingBypass;
  if (!lane || offset >= 0) return offset;
  const blend = clamp(Math.min(t - lane.start, lane.end - t) / lane.margin + 1, 0, 1);
  return offset * (1 - blend * blend * (3 - 2 * blend));
}
const mapFacilities = (() => {
  labelData.push({
    text: '长龙道水池',
    p: new V(...reservoir.center).add(new V(0, 12, 0)),
    maxDistance: 2400,
  });
  const group = new THREE.Group();
  group.name = '官方图设施 · 参考重建';
  scene.add(group);
  const records = [],
    contacts = [],
    rejected = [];
  const byName = (name) => trails.find((t) => t.name === name && t.curve);
  const point = (name, t) => byName(name).curve.getPoint(t);
  const deckMaterial = material('#847562'),
    railMaterial = material('#678c8c');
  const ground = (x, z) => displayGroundHeightAt(x, z);
  function blocked(x, z, r = 3) {
    return (
      menglongPark.contains(x, z, r + 8) ||
      nearFacility(x, z, r + 2) ||
      hotelSnowFlow.blocked(x, z, r)
    );
  }
  function onRope(x, z, r = 12) {
    return liftRuntimes.some((rt) => {
      const p = rt.groundCurve.getPoint(0.5);
      if (Math.hypot(p.x - x, p.z - z) > rt.length) return false;
      return rt.lift.geo?.some((c, i, line) => {
        if (!i) return false;
        const a = projectGeo(line[i - 1]),
          b = projectGeo(c),
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
        return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < r;
      });
    });
  }
  function focus(record) {
    exitExperience(false);
    desired.target.copy(record.center);
    desired.radius = record.radius || 180;
    desired.phi = record.phi ?? 0.85;
    if (record.theta !== undefined) desired.theta = record.theta;
    requestSceneFrame();
  }
  function addRecord(name, center, kind, source, geometry) {
    const record = {
      id: 100 + records.length,
      name,
      center: center.clone(),
      kind,
      source,
      geometry,
      reference: true,
    };
    records.push(record);
    LANDSCAPE_ITEMS.push({
      id: record.id,
      name: name + ' · 参考',
      category: kind,
      status: '参考重建',
      description: source,
    });
    labelData.push({
      text: name + ' · 参考',
      p: center.clone().add(new V(0, 15, 0)),
      guide: record.id,
      maxDistance: 1500,
    });
    if (geometry) {
      geometry.traverse((o) => {
        if (o.isMesh) {
          o.userData = { ...o.userData, kind: 'landscape', id: record.id };
          pickables.push(o);
        }
      });
    }
    return record;
  }
  function select(id) {
    const r = records.find((r) => r.id === id);
    if (!r) return false;
    clearSelection();
    state.selected = { kind: 'landscape', id };
    const d = $('detail');
    d.classList.remove('hotel-detail');
    d.hidden = false;
    const info = r.level
      ? '<div class="badge">' +
        r.level +
        '地形公园</div><p class="guest-description park-description">' +
        r.description +
        '</p><p class="guest-description">' +
        r.layout +
        '。道具布置为规划示意，开放情况以现场为准。</p>'
      : '<div class="badge reference-model-badge">参考重建</div>';
    const focusText = r.trailName ? '查看' + r.trailName : '定位三维设施';
    d.innerHTML =
      '<div class="detail-top"><button class="close" aria-label="关闭详情">×</button></div><h2>' +
      r.name +
      '</h2>' +
      info +
      '<button class="primary" id="facility-focus">' +
      focusText +
      '</button><button class="secondary" id="facility-original">查看雪道图</button>';
    d.querySelector('.close').onclick = () => (d.hidden = true);
    $('facility-focus').onclick = () => {
      if (r.trailName) selectItem('trail', byName(r.trailName).id);
      else focus(r);
    };
    if (r.level) {
      const button = document.createElement('button');
      button.className = 'secondary';
      button.textContent = '查看公园魔毯';
      $('facility-original').before(button);
      button.onclick = () => showMagicCarpetArea(r.trailName + '公园', () => select(r.id));
    }
    $('facility-original').onclick = () => openReference('trail');
    focus(r);
    renderList();
    return true;
  }
  function surfacePatch(points, width, color, parent = group) {
    const positions = [],
      indices = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i],
        a = points[Math.max(0, i - 1)],
        b = points[Math.min(points.length - 1, i + 1)],
        side = new V(-(b.z - a.z), 0, b.x - a.x).normalize();
      for (const sign of [-1, 1]) {
        const q = p.clone().addScaledVector(side, width * 0.5 * sign);
        positions.push(q.x, ground(q.x, q.z) + 0.12, q.z);
      }
      if (i) {
        const k = i * 2;
        indices.push(k - 2, k - 1, k, k - 1, k + 1, k);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    mesh.renderOrder = 5;
    parent.add(mesh);
    return mesh;
  }
  function trailSection(name, start, end, spacing = 2) {
    const trail = byName(name),
      n = Math.max(2, Math.ceil((trail.curve.getLength() * Math.abs(end - start)) / spacing)),
      points = [];
    for (let i = 0; i <= n; i++) {
      const p = trail.curve.getPoint(lerp(start, end, i / n));
      p.y = ground(p.x, p.z);
      points.push(p);
    }
    return points;
  }
  const shapedSnow = snowMat.clone();
  shapedSnow.userData.displayGroundOwner = true;
  shapedSnow.onBeforeCompile = terrainSurfaceShaderHook;
  shapedSnow.customProgramCacheKey = () => terrainSurfaceCacheKey + '-core-owner';
  const parkSteel = material('#426276'),
    parkEdge = material('#ad6535'),
    parkDeck = material('#85aeb9');
  const jumpProfile = [
    [0, 0],
    [0.14, 0],
    [0.31, 0.29],
    [0.45, 1],
    [0.57, 0.96],
    [0.67, 0.66],
    [0.86, 0.12],
    [1, 0],
  ];
  const boxProfile = [
    [0, 0],
    [0.29, 0],
    [0.45, 0.76],
    [0.65, 0.53],
    [1, 0],
  ];
  const ease = (t) => t * t * (3 - 2 * t);
  function featureRise(kind, t) {
    if (kind === 'roller') return Math.sin(3 * Math.PI * t) ** 2 * Math.sin(Math.PI * t) ** 0.4;
    const profile = kind === 'jump' ? jumpProfile : boxProfile;
    const i = profile.findIndex((p) => t <= p[0] && p[0] > 0),
      a = profile[i - 1],
      b = profile[i];
    return lerp(a[1], b[1], ease((t - a[0]) / (b[0] - a[0])));
  }
  function drawParkFeature(trail, parkGroup, feature, t, offset) {
    const { kind, width, length, height } = feature,
      span = length / trail.curve.getLength(),
      rows = Math.ceil(length * 1.5),
      columns = 8;
    const at = (u, v) => trainingLanePoint(trail, t + (u - 0.5) * span, offset + (v * width) / 2);
    const relief = (u, v) =>
      height * featureRise(kind, u) * ease(Math.min(1, (1 - Math.abs(v)) / 0.42));
    const positions = [],
      colors = [],
      indices = [];
    const tint = new THREE.Color();
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= columns; i++) {
        const u = j / rows,
          v = (2 * i) / columns - 1,
          p = at(u, v);
        positions.push(p.x, p.y - 0.025 + relief(u, v), p.z);
        tint.copy(terrainWhite).lerp(terrainCold, 0.1 + 0.08 * Math.sin(p.x * 0.002 - p.z * 0.001));
        colors.push(tint.r, tint.g, tint.b);
        if (j && i) {
          const k = j * (columns + 1) + i;
          indices.push(k - columns - 2, k - columns - 1, k - 1, k - 1, k - columns - 1, k);
        }
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const surface = new THREE.Mesh(geometry, shapedSnow);
    surface.receiveShadow = true;
    parkGroup.add(surface);
    if (kind === 'box' || kind === 'rail') {
      const wide = kind === 'box',
        a = at(0.42, 0),
        b = at(0.74, 0),
        depth = a.distanceTo(b);
      a.y += height + 0.13;
      b.y += height + 0.17;
      const c = a.clone().lerp(b, 0.5),
        deck = box(
          wide ? 0.62 : 0.18,
          0.15,
          depth,
          wide ? parkDeck : parkSteel,
          c.x,
          c.y,
          c.z,
          parkGroup,
        );
      deck.quaternion.setFromUnitVectors(new V(0, 0, 1), b.clone().sub(a).normalize());
      for (const f of [0.12, 0.5, 0.88]) {
        const p = a.clone().lerp(b, f),
          foot = ground(p.x, p.z),
          h = p.y - foot;
        box(wide ? 0.4 : 0.14, h, wide ? 0.35 : 0.24, parkEdge, p.x, foot + h / 2, p.z, parkGroup);
      }
    }
    if (kind === 'jump') {
      let previous = null;
      for (const v of [-0.54, -0.27, 0, 0.27, 0.54]) {
        const p = at(0.45, v);
        p.y += relief(0.45, v);
        if (previous) beam(previous, p, 0.035, parkDeck, parkGroup);
        previous = p;
      }
    }
    for (const sign of [-1, 1]) {
      const p = at(0.1, 0.9 * sign);
      box(0.13, 0.62, 0.13, parkEdge, p.x, p.y + 0.31, p.z, parkGroup);
    }
  }
  function park({ name, trailName, level, description, layout, features }) {
    const trail = byName(trailName),
      geometry = new THREE.Group(),
      obstacles = [];
    geometry.name = name;
    group.add(geometry);
    const carpet = magicCarpetRecords.find((r) => r.area === trailName + '公园');
    for (const feature of features) {
      const { kind, t, offsets, length, width } = feature,
        span = length / trail.curve.getLength();
      for (const offset of offsets) {
        const conflicts = obstacles.some(
          (o) =>
            Math.abs(o.offset - offset) < (o.width + width) / 2 + 1.3 &&
            Math.abs(o.t - t) * trail.curve.getLength() < (o.length + length) / 2 + 9,
        );
        if (conflicts) continue;
        const checks = Array.from({ length: 15 }, (_, i) => t + (i / 14 - 0.5) * span);
        if (
          checks.some((f) =>
            [-width / 2, 0, width / 2].some((side) => {
              const p = trainingLanePoint(trail, f, offset + side);
              return (
                !clearTrainingSite(p.x, p.z, 0.85) ||
                pisteFootprintClearance(p.x, p.z).clearance > 0.35 ||
                carpet?.samples.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 2.2)
              );
            }),
          )
        )
          continue;
        drawParkFeature(trail, geometry, feature, t, offset);
        obstacles.push({ kind, t, offset, length, width });
        break;
      }
    }
    const t = obstacles.length
      ? obstacles.reduce((sum, o) => sum + o.t, 0) / obstacles.length
      : features[0].t;
    const center = trainingLanePoint(trail, t, obstacles[0]?.offset ?? 0),
      d = trail.curve.getTangent(t);
    const record = addRecord(name, center, '地形公园', description, geometry);
    Object.assign(record, {
      radius: level === '初级' ? 155 : 200,
      phi: 1.04,
      theta: Math.atan2(d.x, d.z) + 0.85,
      trailName,
      level,
      description,
      layout,
      obstacles,
    });
    if (obstacles.length) {
      const halfSpan = (o) => o.length / (2 * trail.curve.getLength());
      trail.trainingBypass = {
        start: Math.min(...obstacles.map((o) => o.t - halfSpan(o))),
        end: Math.max(...obstacles.map((o) => o.t + halfSpan(o))),
        margin: 18 / trail.curve.getLength(),
      };
    }
    return record;
  }
  const jiao = park({
    name: '娇龙初级公园',
    trailName: '娇龙道',
    level: '初级',
    description:
      '有平缓小跳台、基础波浪道和简易道具，适合初次接触地形公园的滑雪者练习起跳、落地和平衡。',
    layout: '波浪和小桌式跳台组成一条练习线，旁边另设低宽练习箱，主雪道留作绕行',
    features: [
      { kind: 'roller', t: 0.197, offsets: [-7, -6, -5], length: 11, width: 5.5, height: 0.42 },
      { kind: 'jump', t: 0.222, offsets: [-9, -8, -7], length: 14, width: 6.8, height: 0.86 },
      { kind: 'box', t: 0.223, offsets: [-18, -19, -20], length: 12, width: 4.8, height: 0.43 },
    ],
  });
  const yin = park({
    name: '银龙中级公园',
    trailName: '银龙道',
    level: '中级',
    description: '有不同难度的跳台组合和道具线路，适合已掌握基础公园动作的滑雪者练习动作衔接。',
    layout: '跳台由小到大，侧面设滑箱和低杆，可在主雪道绕行',
    features: [
      { kind: 'jump', t: 0.397, offsets: [-10, -13, -16], length: 24, width: 8.4, height: 1.55 },
      { kind: 'jump', t: 0.487, offsets: [-9, -8, -7], length: 29, width: 9.4, height: 2.22 },
      { kind: 'box', t: 0.495, offsets: [-26, -22, -30], length: 18, width: 4.8, height: 0.65 },
      { kind: 'rail', t: 0.541, offsets: [-29, -26, -21], length: 21, width: 5.6, height: 0.82 },
    ],
  });
  function findSite(anchor, radius) {
    let best = null;
    for (let ring = 0; ring <= 60; ring += 6)
      for (let n = 0; n < (ring ? 16 : 1); n++) {
        const a = (n * Math.PI) / 8,
          x = anchor.x + Math.cos(a) * ring,
          z = anchor.z + Math.sin(a) * ring;
        if (
          blocked(x, z, radius) ||
          onRope(x, z, radius + 8) ||
          pisteFootprintClearance(x, z).clearance < radius + 2 ||
          treeData.some((t) => Math.hypot(t.x - x, t.z - z) < t.w + radius)
        )
          continue;
        const heights = [];
        for (let k = 0; k < 8; k++)
          heights.push(
            ground(
              x + Math.cos((k * Math.PI) / 4) * radius,
              z + Math.sin((k * Math.PI) / 4) * radius,
            ),
          );
        const spread = Math.max(...heights) - Math.min(...heights);
        if (spread > 3.5) continue;
        const score = ring + spread * 15;
        if (!best || score < best.score) best = { x, z, heights, score };
      }
    return best;
  }
  function pavilion(name, anchor, roof, fixed = false) {
    const radius = fixed ? 8.5 : roof ? 5 : 4,
      site = fixed
        ? {
            x: anchor.x,
            z: anchor.z,
            heights: Array.from({ length: 8 }, (_, i) =>
              ground(
                anchor.x + Math.cos((i * Math.PI) / 4) * radius,
                anchor.z + Math.sin((i * Math.PI) / 4) * radius,
              ),
            ),
          }
        : findSite(anchor, radius);
    if (!site) {
      rejected.push({ name, reason: 'No clear, moderate-slope site within 60 m' });
      return null;
    }
    const g = new THREE.Group();
    g.name = name;
    group.add(g);
    const top = Math.max(...site.heights) + 0.25,
      center = new V(site.x, top, site.z);
    g.position.copy(center);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.25, 8), deckMaterial);
    floor.position.y = -0.125;
    floor.receiveShadow = true;
    g.add(floor);
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4,
        x = Math.cos(angle) * (radius - 0.35),
        z = Math.sin(angle) * (radius - 0.35),
        foot = ground(site.x + x, site.z + z),
        h = top - foot;
      box(0.22, h, 0.22, deckMaterial, x, -h / 2, z, g);
      contacts.push({ name, x: site.x + x, z: site.z + z, foot });
      if (roof) box(0.18, 2.8, 0.18, deckMaterial, x, 1.4, z, g);
      if (i !== 0) {
        const a = new V(x, 1, z),
          next = ((i + 1) * Math.PI) / 4,
          b = new V(Math.cos(next) * (radius - 0.35), 1, Math.sin(next) * (radius - 0.35));
        beam(a, b, 0.07, railMaterial, g);
      }
    }
    if (roof) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(radius + 1.1, 2.1, 8), material('#839b9b'));
      cap.position.y = 3.75;
      cap.rotation.y = Math.PI / 8;
      cap.castShadow = true;
      g.add(cap);
    }
    // A short supported access ramp terminates on the actual terrain.
    const positions = [],
      indices = [],
      endX = site.x + radius + Math.max(4, (top - ground(site.x + radius + 4, site.z)) * 8),
      endY = ground(endX, site.z);
    for (let i = 0; i <= 12; i++)
      for (const v of [-0.8, 0.8]) {
        const t = i / 12,
          x = lerp(site.x + radius - 0.3, endX, t),
          y = Math.max(ground(x, site.z + v) + 0.03, lerp(top, endY + 0.03, t));
        positions.push(x - center.x, y - top, v);
        if (i && v === -0.8) {
          const k = i * 2;
          indices.push(k - 2, k, k - 1, k - 1, k, k + 1);
        }
      }
    const ramp = new THREE.BufferGeometry();
    ramp.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    ramp.setIndex(indices);
    ramp.computeVertexNormals();
    g.add(new THREE.Mesh(ramp, deckMaterial));
    const record = addRecord(
      name,
      center,
      roof ? '休憩设施' : '观景台',
      roof ? '官方图长龙—短龙区域；亭体为八角参考外形' : '已有 E 区观景点坐标；平台外形参考重建',
      g,
    );
    record.offsetM = Math.hypot(site.x - anchor.x, site.z - anchor.z);
    registerSolids(g, 'reference-' + name);
    return record;
  }
  const viewpointGeo = projectGeo([115.3984557, 40.9657112]),
    viewpoint = pavilion('E 区观景台', new V(viewpointGeo[0], 0, viewpointGeo[1]), false);
  const pavilionFootprint = GEO.buildings
    .find((b) => b.id === BIKE_LOCAL_LAYOUT.pavilion.sourceBuildingId)
    .coords.slice(0, -1)
    .map(projectGeo);
  const pavilionCenter = pavilionFootprint.reduce(
    (s, p) => [s[0] + p[0] / pavilionFootprint.length, s[1] + p[1] / pavilionFootprint.length],
    [0, 0],
  );
  const rest = pavilion('八角亭休息亭', new V(pavilionCenter[0], 0, pavilionCenter[1]), true, true);
  rest.sourceBuildingId = BIKE_LOCAL_LAYOUT.pavilion.sourceBuildingId;
  const practiceGroup = new THREE.Group();
  practiceGroup.name = '单板练习区 · 参考范围';
  group.add(practiceGroup);
  const practicePoints = trailSection('卧龙道', 0.42, 0.65),
    practiceWidth = Math.min(10, trailWidthAt(byName('卧龙道'), 0.55).plus * 0.55);
  surfacePatch(practicePoints, practiceWidth, '#b68ba7', practiceGroup);
  const practice = addRecord(
    '单板练习区',
    practicePoints[Math.floor(practicePoints.length / 2)],
    '练习区',
    '官方图卧龙道上侧；范围随当前雪道约束，非实测边界',
    practiceGroup,
  );
  practice.radius = 280;
  // Local panorama layouts preserve each region's adjacent-trail relationships.
  // These are visitor route illustrations, not surveyed tracks or a grading mask.
  const bikeEdgeMaterial = new THREE.MeshBasicMaterial({
    color: '#fff4d7',
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const bikeMaterial = new THREE.MeshBasicMaterial({
    color: '#c66b16',
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  for (const route of bikeRoutes) {
    const trace = BIKE_LOCAL_LAYOUT.routes.find((r) => r.id === route.id);
    if (!trace?.world?.length) continue;
    // Centripetal interpolation avoids overshoot at the tight illustrated bends.
    const control = trace.world.map((p) => new V(p[0], 0, p[1]));
    if (trace.trimToForest) {
      const piste = byName('长龙道'),
        points = piste.displayPoints || piste.points;
      for (const k of [0, control.length - 1]) {
        const p = control[k];
        let best = points[0],
          distance = Infinity;
        for (const q of points) {
          const d = Math.hypot(q.x - p.x, q.z - p.z);
          if (d < distance) {
            distance = d;
            best = q;
          }
        }
        control[k] = new V(best.x, 0, best.z);
      }
    }
    const curve = new THREE.CatmullRomCurve3(control, false, 'centripetal');
    curve.arcLengthDivisions = Math.max(1024, trace.world.length * 64);
    curve.updateArcLengths();
    const count = Math.max(2, Math.ceil(curve.getLength()));
    let sampled = curve.getSpacedPoints(count);
    if (trace.trimToForest) {
      const clear = (p) => pisteFootprintClearance(p.x, p.z).clearance;
      let first = sampled.findIndex((p) => clear(p) >= 0),
        last = sampled.length - 1;
      while (last > first && clear(sampled[last]) < 0) last--;
      const boundary = (inside, outside) => {
        let a = inside.clone(),
          b = outside.clone();
        for (let n = 0; n < 24; n++) {
          const m = a.clone().lerp(b, 0.5);
          if (clear(m) < 0) a = m;
          else b = m;
        }
        return b;
      };
      const start = first > 0 ? boundary(sampled[first - 1], sampled[first]) : null,
        end = last < sampled.length - 1 ? boundary(sampled[last + 1], sampled[last]) : null;
      sampled = sampled.slice(first, last + 1);
      if (start) sampled.unshift(start);
      if (end) sampled.push(end);
    }
    for (const p of sampled) p.y = ground(p.x, p.z) + 0.16;
    function ribbon(width, lift, mat) {
      const vertices = [],
        indices = [];
      for (let i = 0; i < sampled.length; i++) {
        const a = sampled[Math.max(0, i - 1)],
          b = sampled[Math.min(sampled.length - 1, i + 1)],
          p = sampled[i],
          len = Math.hypot(b.x - a.x, b.z - a.z) || 1,
          nx = -(b.z - a.z) / len,
          nz = (b.x - a.x) / len;
        const halfWidth = trace.trimToForest
          ? Math.min(width * 0.5, Math.max(0, pisteFootprintClearance(p.x, p.z).clearance) * 0.98)
          : width * 0.5;
        for (const side of [-1, 1]) {
          const x = p.x + nx * halfWidth * side,
            z = p.z + nz * halfWidth * side;
          vertices.push(x, ground(x, z) + lift, z);
        }
        if (i) {
          const k = i * 2;
          indices.push(k - 2, k, k - 1, k - 1, k, k + 1);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geo.setIndex(indices);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = route.name;
      mesh.renderOrder = 9;
      mesh.userData = { kind: 'landscape', id: 3, bikeRoute: route.id };
      bikeReference.add(mesh);
      pickables.push(mesh);
      return mesh;
    }
    ribbon(4.6, 0.13, bikeEdgeMaterial);
    ribbon(2.6, 0.17, bikeMaterial);
    route.sourcePoints = trace.points;
    route.sourceFrame = trace.sourceFrame;
    route.points = sampled;
    route.curve = null;
    route.length = null;
    route.schematic = true;
    route.projectionCandidate = false;
    route.registrationApproved = false;
    route.status = '路线示意';
    labelData.push({
      text: route.name + ' · 示意',
      p: sampled[Math.floor(sampled.length / 2)].clone().add(new V(0, 15, 0)),
      bike: route.id,
      maxDistance: 3200,
    });
  }
  function setBikes(on) {
    bikeReference.visible = on;
    $('bike-layer-switch')?.setAttribute('aria-checked', String(on));
    requestSceneFrame();
  }
  function focusBike(id) {
    const route = bikeRoutes.find((r) => r.id === id);
    if (!route?.points.length) return;
    setBikes(true);
    const box = new THREE.Box3().setFromPoints(route.points);
    const halfFov = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * Math.min(1, camera.aspect));
    focus({
      center: box.getCenter(new V()),
      radius: Math.max(
        600,
        ((box.getSize(new V()).length() * 0.5 + 35) / Math.sin(halfFov)) * 1.12,
      ),
      phi: 0.45,
    });
  }
  let wildPrepared = false;
  function setWild(on) {
    if (on && !wildPrepared) {
      surfaceLayers.wild.texture.dispose();
      surfaceLayers.wild.canvas.width = surfaceLayers.wild.canvas.height = 1024;
      const layer = surfaceLayers.wild,
        c = layer.context;
      c.save();
      c.scale(0.5, 0.5);
      for (const z of wildZones) {
        const polygons = z.parts?.length ? z.parts.map((p) => p.points) : [z.candidatePoints];
        for (const poly of polygons) if (poly?.length > 2) surfacePolygon(layer, poly, z.colour);
        z.displayedAsReference = true;
      }
      c.restore();
      c.globalCompositeOperation = 'destination-in';
      c.drawImage(surfaceLayers.forest.canvas, 0, 0, 1024, 1024);
      c.globalCompositeOperation = 'destination-out';
      c.drawImage(surfaceLayers.piste.canvas, 0, 0, 1024, 1024);
      c.globalCompositeOperation = 'source-over';
      layer.texture.needsUpdate = true;
      wildPrepared = true;
    }
    wildReference.visible = on;
    surfaceState.wild.value = on ? 1 : 0;
    $('wild-layer-switch')?.setAttribute('aria-checked', String(on));
    requestSceneFrame();
  }
  function focusWild(id) {
    const zone = wildZones.find((z) => z.id === id);
    if (!zone) return;
    setWild(true);
    const p = wildInteriorPoint(zone.candidatePoints);
    focus({ center: new V(p[0], ground(...p), p[1]), radius: 900 });
  }
  function addSwitch(id, label, apply, on) {
    const row = document.createElement('div');
    row.className = 'switch-row';
    row.innerHTML =
      '<span>' +
      label +
      '</span><button id="' +
      id +
      '" class="switch" role="switch" aria-label="' +
      label +
      '" aria-checked="' +
      on +
      '"></button>';
    $('bike-reference-switch').closest('.switch-row').before(row);
    $(id).onclick = () => apply($(id).getAttribute('aria-checked') !== 'true');
  }
  addSwitch('bike-layer-switch', '自行车道', setBikes, true);
  addSwitch('wild-layer-switch', '野雪参考分区', setWild, false);
  bikeReference.visible = true;
  function bind(name, record) {
    if (!record) return;
    const r = officialMapFeatures.records.find((r) => r.name === name);
    if (r) {
      r.action = () => select(record.id);
      delete r.sourceRegion;
      r.mapAnchor = record.center.toArray();
      for (let i = labelData.length - 1; i >= 0; i--)
        if (labelData[i].officialFeatureId === r.id) labelData.splice(i, 1);
    }
  }
  bind('八角亭休息亭', rest);
  bind('单板练习区', practice);
  for (const r of officialMapFeatures.records) {
    if (r.category !== '专项区域') continue;
    const parkRecord = [jiao, yin].find((park) => r.name.includes(park.trailName));
    if (!parkRecord) continue;
    bind(r.name, parkRecord);
    r.note = parkRecord.description;
    r.opensPanel = true;
    r.actionLabel = '查看公园';
  }
  return {
    group,
    records,
    contacts,
    rejected,
    select,
    focusBike,
    focusWild,
    setBikes,
    setWild,
    jiao,
    yin,
    viewpoint,
    rest,
    practice,
  };
})();
