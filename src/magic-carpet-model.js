// Open conveyors use the resort photos for appearance. The official panorama
// locates the park belts by area; only Wolong has a mapped centerline.
const magicCarpetRecords = [];
const carpetCanvas = document.createElement('canvas');
carpetCanvas.width = 64;
carpetCanvas.height = 128;
const carpetCtx = carpetCanvas.getContext('2d');
carpetCtx.fillStyle = '#34434a';
carpetCtx.fillRect(0, 0, 64, 128);
for (let y = 0; y < 128; y += 16) {
  carpetCtx.fillStyle = '#637079';
  carpetCtx.fillRect(0, y, 64, 3);
  carpetCtx.fillStyle = '#202c33';
  carpetCtx.fillRect(0, y + 3, 64, 2);
}
carpetCtx.strokeStyle = '#90a9b4';
carpetCtx.lineWidth = 2.5;
carpetCtx.beginPath();
carpetCtx.moveTo(24, 74);
carpetCtx.lineTo(32, 63);
carpetCtx.lineTo(40, 74);
carpetCtx.stroke();
const carpetTexture = new THREE.CanvasTexture(carpetCanvas);
carpetTexture.wrapS = carpetTexture.wrapT = THREE.RepeatWrapping;
carpetTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
const carpetBeltMaterial = material('#ffffff', {
  map: carpetTexture,
  roughness: 0.96,
  side: THREE.DoubleSide,
});
const carpetSideMaterial = material('#b6c4ca', { roughness: 0.48, metalness: 0.35 }),
  carpetEndMaterial = material('#597a90', { roughness: 0.65 });
const carpetStopMaterial = material('#c65b42');

function trainingLanePoint(trail, t, offset) {
  const p = trail.curve.getPoint(t),
    d = trail.curve.getTangent(t),
    length = Math.hypot(d.x, d.z) || 1;
  p.x -= (d.z / length) * offset;
  p.z += (d.x / length) * offset;
  p.y = displayGroundHeightAt(p.x, p.z);
  return p;
}
function clearTrainingSite(x, z, pad) {
  return (
    !menglongPark.contains(x, z, pad + 5) &&
    !nearFacility(x, z, pad) &&
    !hotelSnowFlow.blocked(x, z, pad) &&
    !pylonDetailRecords.some((p) => Math.hypot(p.foot[0] - x, p.foot[2] - z) < pad + 4) &&
    !treeData.some(
      (t) =>
        Math.abs(t.x - x) < t.w + pad &&
        Math.abs(t.z - z) < t.w + pad &&
        Math.hypot(t.x - x, t.z - z) < t.w + pad,
    )
  );
}
function carpetShoulderDepth(trail, x, z) {
  const points = trail.displayPoints || trail.points,
    edges = trail.displayEdges || trail.edges;
  let nearest = Infinity,
    depth = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      dx = b.x - a.x,
      dz = b.z - a.z,
      length = Math.hypot(dx, dz);
    if (length < 0.001) continue;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (length * length), 0, 1);
    const distance = Math.hypot(x - lerp(a.x, b.x, t), z - lerp(a.z, b.z, t));
    if (distance >= nearest) continue;
    const [ex, ez] = edges[i - 1].minus,
      [fx, fz] = edges[i].minus;
    nearest = distance;
    depth = ((z - lerp(ez, fz, t)) * dx - (x - lerp(ex, fx, t)) * dz) / length;
  }
  return depth;
}

function buildMagicCarpet(area, plan, sourceId = null) {
  const name = area + '魔毯',
    samples = [];
  for (let k = 1; k < plan.length; k++) {
    const a = plan[k - 1],
      b = plan[k],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5);
    for (let i = k === 1 ? 0 : 1; i <= n; i++) {
      const x = lerp(a[0], b[0], i / n),
        z = lerp(a[1], b[1], i / n);
      samples.push(new V(x, displayGroundHeightAt(x, z), z));
    }
  }
  if (samples[0].y > samples.at(-1).y) samples.reverse();
  const group = new THREE.Group();
  group.name = name;
  magicCarpetReference.add(group);
  const positions = [],
    uv = [],
    indices = [],
    sides = [],
    deck = [],
    width = 1.25;
  let distance = 0;
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i],
      dir = samples[Math.min(i + 1, samples.length - 1)].clone().sub(samples[Math.max(0, i - 1)]);
    dir.y = 0;
    dir.normalize();
    const side = new V(-dir.z, 0, dir.x);
    sides.push(side);
    if (i) distance += p.distanceTo(samples[i - 1]);
    const groundAt = (offset) =>
      displayGroundHeightAt(p.x + side.x * offset, p.z + side.z * offset);
    // A straight conveyor needs a level cross-section even on the outer bank.
    deck.push(
      (sourceId
        ? p.y
        : Math.max(
            p.y,
            groundAt(-0.82),
            groundAt(0.82),
            groundAt(-width / 2),
            groundAt(width / 2),
          )) + 0.14,
    );
    for (const sign of [-1, 1]) {
      const offset = (sign * width) / 2;
      positions.push(
        p.x + side.x * offset,
        sourceId ? groundAt(offset) + 0.14 : deck[i],
        p.z + side.z * offset,
      );
      uv.push(sign === -1 ? 0 : 1, distance / 2);
    }
    if (i) {
      const j = (i - 1) * 2;
      indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const belt = new THREE.Mesh(geometry, carpetBeltMaterial);
  belt.receiveShadow = true;
  group.add(belt);
  const edges = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      carpetSideMaterial,
      (samples.length - 1) * 2,
    ),
    obj = new THREE.Object3D();
  let instance = 0;
  for (let i = 1; i < samples.length; i++)
    for (const sign of [-1, 1]) {
      const a = samples[i - 1].clone().addScaledVector(sides[i - 1], sign * 0.72),
        b = samples[i].clone().addScaledVector(sides[i], sign * 0.72);
      const footA = displayGroundHeightAt(a.x, a.z),
        footB = displayGroundHeightAt(b.x, b.z);
      a.y = sourceId ? footA + 0.16 : deck[i - 1] + 0.02;
      b.y = sourceId ? footB + 0.16 : deck[i] + 0.02;
      const support = sourceId ? 0.28 : Math.max(0.28, a.y - footA, b.y - footB) + 0.12;
      obj.position.copy(a).add(b).multiplyScalar(0.5);
      if (!sourceId) obj.position.y -= support / 2 - 0.14;
      obj.quaternion.setFromUnitVectors(new V(0, 0, 1), b.clone().sub(a).normalize());
      obj.scale.set(0.19, support, a.distanceTo(b) + 0.03);
      obj.updateMatrix();
      edges.setMatrixAt(instance++, obj.matrix);
    }
  edges.computeBoundingSphere();
  edges.receiveShadow = true;
  group.add(edges);
  const terminals = [];
  for (const [index, label] of [
    [0, '入口'],
    [samples.length - 1, '出口'],
  ]) {
    const p = samples[index],
      side = sides[index],
      q = p.clone().addScaledVector(side, 1.12);
    q.y = displayGroundHeightAt(q.x, q.z);
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.48), carpetEndMaterial);
    cabinet.position.copy(q).add(new V(0, 0.36, 0));
    group.add(cabinet);
    const stop = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), carpetStopMaterial);
    stop.position.copy(q).add(new V(0, 0.77, 0));
    group.add(stop);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.2, 0.65), carpetSideMaterial);
    hood.position.copy(p);
    hood.position.y = deck[index] - 0.02;
    hood.rotation.y = Math.atan2(-side.z, side.x);
    group.add(hood);
    const rampPos = [],
      rampIndices = [];
    const dir = new V(side.z, 0, -side.x),
      out = index === 0 ? -1 : 1;
    for (let j = 0; j <= 6; j++)
      for (const sign of [-1, 1]) {
        const v = p
            .clone()
            .addScaledVector(dir, out * j * 0.3)
            .addScaledVector(side, sign * 0.77),
          foot = displayGroundHeightAt(v.x, v.z),
          t = j / 6;
        const y = sourceId
          ? foot + lerp(0.14, 0.025, t)
          : Math.max(foot + 0.025, lerp(deck[index], foot + 0.025, t));
        rampPos.push(v.x, y, v.z);
        if (j && sign === 1) {
          const k = (j - 1) * 2;
          if (out < 0) rampIndices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
          else rampIndices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
      }
    const rampGeo = new THREE.BufferGeometry();
    rampGeo.setAttribute('position', new THREE.Float32BufferAttribute(rampPos, 3));
    rampGeo.setIndex(rampIndices);
    rampGeo.computeVertexNormals();
    const ramp = new THREE.Mesh(rampGeo, carpetSideMaterial);
    ramp.name = 'carpet-loading-ramp';
    group.add(ramp);
    terminals.push({ label, p: p.clone() });
  }
  const record = {
    id: 200 + magicCarpetRecords.length,
    area,
    name,
    group,
    belt,
    samples,
    terminals,
    length: distance,
    sourceId,
  };
  magicCarpetRecords.push(record);
  LANDSCAPE_ITEMS.push({
    id: record.id,
    name: record.name,
    category: '交通设施',
    status: '魔毯',
    description: '初级区上坡输送带',
  });
  for (const mesh of [belt, edges]) {
    mesh.userData = { kind: 'landscape', id: record.id };
    pickables.push(mesh);
  }
  for (const t of terminals)
    labelData.push({
      text: '魔毯' + t.label,
      p: t.p.clone().add(new V(0, 1.5, 0)),
      guide: record.id,
      maxDistance: 90,
    });
  labelData.push({
    text: record.name,
    p: samples[Math.floor(samples.length / 2)].clone().add(new V(0, 4, 0)),
    guide: record.id,
    maxDistance: 600,
  });
}

const sourceCarpet = GEO.lifts.find((l) => l.type === 'magic_carpet');
if (sourceCarpet) buildMagicCarpet('卧龙道', sourceCarpet.coords.map(projectGeo), sourceCarpet.id);
const plannedCarpets = [
  {
    area: '学校教学区',
    trailName: '卧龙道',
    endpoints: [
      [0.64, -26],
      [0.83, -26],
    ],
  },
  {
    area: '娇龙道公园',
    trailName: '娇龙道',
    endpoints: [
      [0.185, -31],
      [0.24, -39],
    ],
  },
  {
    area: '银龙道公园',
    trailName: '银龙道',
    endpoints: [
      [0.34, -15],
      [0.57, -41],
    ],
  },
];
for (const { area, trailName, endpoints } of plannedCarpets) {
  const trail = trails.find((t) => t.name === trailName);
  const ends = endpoints.map(([t, offset]) => trainingLanePoint(trail, t, offset));
  const length = Math.hypot(ends[1].x - ends[0].x, ends[1].z - ends[0].z),
    steps = Math.ceil(length + 4);
  // Check the full run and its approaches. A belt may use the shoulder of its
  // own slope, but may not cut across the groomed interior or another route.
  const checks = Array.from({ length: steps + 1 }, (_, i) =>
    ends[0].clone().lerp(ends[1], ((i / steps) * (length + 4) - 2) / length),
  );
  if (
    checks.some((p) => {
      const piste = pisteFootprintClearance(p.x, p.z);
      return (
        (piste.clearance < 0.8 &&
          (piste.trail !== trailName || carpetShoulderDepth(trail, p.x, p.z) > 0.95)) ||
        !clearTrainingSite(p.x, p.z, 2.7) ||
        magicCarpetRecords.some((r) => r.samples.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 5))
      );
    })
  )
    continue;
  buildMagicCarpet(
    area,
    ends.map((p) => [p.x, p.z]),
  );
}

function indoorCarpetDiagram() {
  return `<svg class="carpet-diagram" viewBox="0 0 300 152" role="img" aria-label="室内练习坡和上行魔毯示意">
  <path d="M22 83 154 39 274 83 143 137Z" fill="#a6c3c7"/>
  <path d="M22 75 154 31 274 83 143 127Z" fill="#e5efed" stroke="#709797"/>
  <path d="M22 75V36L154 9v22M154 9l120 35v39" fill="none" stroke="#96b2b3" stroke-width="2"/>
  <path d="M43 81 163 41l13 6L58 88Z" fill="#3b5362" stroke="#839fad" stroke-width="2"/>
  <path d="M63 77l70-24m0 0-11 1m11-1-8 6" fill="none" stroke="#f0f6f7" stroke-width="2"/>
  <path d="M100 86 195 56m-65 45 93-33" fill="none" stroke="#a1c0bb" stroke-dasharray="3 4"/>
  <text x="32" y="112">上行魔毯</text><text x="182" y="109">旱雪练习坡</text>
 </svg>`;
}
function focusMagicCarpet(record, endpoint = null) {
  exitExperience(false);
  const index =
      endpoint === '入口'
        ? 0
        : endpoint === '出口'
          ? record.samples.length - 1
          : Math.floor(record.samples.length / 2),
    p = record.samples[index],
    side = record.samples[Math.min(index + 1, record.samples.length - 1)]
      .clone()
      .sub(record.samples[Math.max(0, index - 1)]);
  desired.target.copy(p).add(new V(0, 0.6, 0));
  desired.theta = Math.atan2(side.x, side.z) + Math.PI / 3;
  desired.phi = 0.85;
  desired.radius = endpoint ? 28 : Math.max(90, record.length * 1.05);
  requestSceneFrame();
}
function showMagicCarpetArea(area = null, backToPark = null) {
  clearSelection();
  const d = $('detail');
  d.classList.remove('hotel-detail');
  d.hidden = false;
  d.replaceChildren();
  const header = document.createElement('div');
  header.className = 'detail-top';
  const title = document.createElement('h2');
  title.textContent = area ? area + ' · 魔毯' : '魔毯';
  const close = document.createElement('button');
  close.className = 'close';
  close.textContent = '收起 ×';
  close.onclick = () => (d.hidden = true);
  header.append(title, close);
  d.append(header);
  const button = (label, action) => {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.textContent = label;
    b.onclick = action;
    d.append(b);
  };
  if (!area) {
    for (const a of officialMagicCarpets) button(a, () => showMagicCarpetArea(a));
    return;
  }
  const p = document.createElement('p');
  p.className = 'guest-description';
  const record = magicCarpetRecords.find((r) => r.area === area);
  if (record) {
    state.selected = { kind: 'landscape', id: record.id };
    p.textContent = record.sourceId
      ? '沿坡面上行的露天输送带，设有上下客端口。'
      : '沿练习区外侧上行。三维图展示大致布置，进出位置请留意现场标识。';
    d.append(p);
    button('查看整条魔毯', () => focusMagicCarpet(record));
    for (const t of record.terminals)
      button('查看' + t.label, () => focusMagicCarpet(record, t.label));
    focusMagicCarpet(record);
  } else if (area === '室内旱雪区') {
    p.textContent = '室内练习区的上坡输送带。请向滑雪学校查询室内场地入口。';
    d.append(p);
    d.insertAdjacentHTML('beforeend', indoorCarpetDiagram());
  } else {
    p.textContent = '可在雪道图的魔毯栏查看所属区域。';
    d.append(p);
  }
  button('查看雪道图', () => openReference('trail'));
  if (backToPark) button('‹ 返回公园', backToPark);
  button('‹ 全部魔毯区域', () => showMagicCarpetArea());
  renderList();
}
