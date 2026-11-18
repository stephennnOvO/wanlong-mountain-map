// Separately opt-in reference alignment of a perspective panorama. NOT geographic survey data.
// Control points identify matching lift endpoints / piste junctions in the 2026 panorama.
const panoramaControls = [
  [1008, 334, 115.39743, 40.95487],
  [1020, 810, 115.3906, 40.96741],
  [1043, 810, 115.3904, 40.96741],
  [1205, 795, 115.38765, 40.96743],
  [1440, 800, 115.38219, 40.96696],
  [1460, 800, 115.38082, 40.96722],
  [1480, 800, 115.37216, 40.96656],
  [1780, 825, 115.36786, 40.96657],
  [1215, 350, 115.38757, 40.95479],
  [1235, 352, 115.37126, 40.94615],
  [650, 390, 115.40515, 40.96065],
  [450, 575, 115.406, 40.96379],
  [140, 690, 115.40747, 40.96907],
  [335, 765, 115.40542, 40.96993],
  [680, 850, 115.39642, 40.97018],
  [1050, 495, 115.39201, 40.96128],
];
// An inverse-distance weighted registration is visual only; residual uncertainty is not quantified.
function panoramaToGeo() {
  throw Error('旧逆距权重插值没有透视模型与独立误差检验，已停用。');
}

const panoramaBikes = [
  {
    name: '自行车道 · A 区旁',
    points: [
      [450, 549],
      [439, 544],
      [423, 538],
      [409, 535],
      [393, 536],
      [380, 541],
      [372, 548],
      [370, 556],
      [371, 565],
      [372, 573],
      [368, 581],
      [361, 587],
      [348, 591],
      [339, 595],
      [336, 601],
      [338, 610],
      [343, 620],
      [344, 628],
      [342, 636],
      [336, 643],
      [325, 651],
      [316, 657],
      [309, 664],
      [306, 671],
      [306, 675],
    ],
  },
  {
    name: '自行车道 · E 区旁',
    points: [
      [715, 538],
      [707, 542],
      [698, 551],
      [693, 559],
      [692, 567],
      [695, 575],
      [702, 579],
      [711, 583],
      [716, 589],
      [712, 596],
      [704, 603],
      [698, 609],
      [696, 615],
      [698, 621],
      [705, 627],
      [711, 633],
      [710, 639],
      [704, 647],
      [697, 653],
      [691, 659],
      [689, 668],
      [689, 680],
      [692, 690],
      [697, 699],
      [700, 707],
      [700, 716],
      [695, 724],
      [686, 730],
      [680, 733],
    ],
  },
  {
    name: '自行车道 · F 区旁',
    points: [
      [914, 408],
      [910, 412],
      [905, 415],
      [899, 417],
      [887, 418],
      [879, 420],
      [877, 425],
      [877, 432],
      [873, 437],
      [865, 439],
      [848, 440],
      [839, 443],
      [835, 450],
      [832, 457],
      [827, 463],
      [821, 467],
      [812, 469],
      [799, 468],
    ],
  },
];
const panoramaWild = [
  [
    'A',
    [
      [150, 500],
      [305, 475],
      [415, 493],
      [432, 535],
      [455, 583],
      [413, 617],
      [280, 647],
      [143, 675],
      [115, 635],
    ],
  ],
  [
    'B',
    [
      [457, 500],
      [540, 481],
      [550, 523],
      [520, 543],
      [475, 558],
      [450, 530],
    ],
  ],
  [
    'C',
    [
      [475, 558],
      [520, 543],
      [550, 523],
      [562, 555],
      [550, 574],
      [465, 600],
      [455, 583],
    ],
  ],
  [
    'D',
    [
      [120, 701],
      [145, 682],
      [280, 658],
      [410, 626],
      [488, 597],
      [523, 625],
      [550, 650],
      [519, 678],
      [516, 709],
      [555, 735],
      [529, 770],
      [509, 795],
      [400, 775],
      [260, 764],
      [140, 759],
      [120, 740],
    ],
  ],
  [
    'E',
    [
      [647, 397],
      [680, 412],
      [684, 490],
      [698, 550],
      [732, 624],
      [741, 701],
      [733, 773],
      [710, 819],
      [655, 847],
      [620, 822],
      [623, 740],
      [636, 649],
      [638, 560],
      [624, 476],
    ],
  ],
  [
    'F',
    [
      [698, 388],
      [790, 370],
      [906, 345],
      [1005, 329],
      [946, 386],
      [895, 419],
      [819, 477],
      [776, 444],
    ],
  ],
  [
    'G',
    [
      [1008, 331],
      [1035, 358],
      [1045, 385],
      [1028, 410],
      [1009, 418],
      [978, 437],
      [943, 464],
      [961, 425],
      [982, 383],
    ],
  ],
  [
    'H',
    [
      [937, 516],
      [1009, 498],
      [987, 535],
      [954, 579],
      [904, 664],
      [875, 624],
      [895, 577],
    ],
  ],
  [
    'I',
    [
      [1009, 498],
      [1060, 482],
      [1040, 547],
      [1014, 606],
      [971, 691],
      [936, 738],
      [905, 664],
      [954, 579],
    ],
  ],
  [
    'J',
    [
      [1061, 483],
      [1080, 565],
      [1101, 627],
      [1124, 687],
      [1156, 755],
      [1193, 793],
      [1090, 797],
      [1035, 802],
      [951, 797],
      [974, 765],
      [1002, 704],
      [1023, 638],
      [1044, 572],
    ],
  ],
  [
    'K',
    [
      [1022, 333],
      [1043, 355],
      [1058, 388],
      [1064, 430],
      [1061, 482],
      [1038, 494],
      [1012, 500],
      [1010, 418],
      [1040, 393],
      [1045, 376],
    ],
  ],
  [
    'L',
    [
      [1148, 347],
      [1187, 349],
      [1170, 385],
      [1141, 418],
      [1141, 377],
    ],
  ],
  [
    'M',
    [
      [1075, 425],
      [1125, 445],
      [1174, 492],
      [1224, 548],
      [1213, 615],
      [1175, 598],
      [1138, 548],
      [1099, 483],
    ],
  ],
  [
    'N',
    [
      [1187, 350],
      [1215, 352],
      [1204, 402],
      [1199, 462],
      [1191, 505],
      [1170, 474],
      [1141, 418],
      [1170, 385],
    ],
  ],
  [
    'O',
    [
      [1215, 352],
      [1247, 364],
      [1279, 398],
      [1285, 438],
      [1256, 464],
      [1221, 480],
      [1191, 505],
      [1199, 462],
      [1204, 402],
    ],
  ],
  [
    'P',
    [
      [1191, 505],
      [1221, 480],
      [1256, 464],
      [1285, 438],
      [1286, 489],
      [1306, 548],
      [1328, 620],
      [1368, 696],
      [1427, 794],
      [1319, 797],
      [1292, 760],
      [1260, 675],
      [1232, 607],
      [1208, 547],
    ],
  ],
  [
    'Q',
    [
      [1247, 364],
      [1320, 379],
      [1372, 399],
      [1370, 437],
      [1398, 484],
      [1418, 532],
      [1433, 580],
      [1362, 600],
      [1328, 620],
      [1306, 548],
      [1286, 489],
      [1285, 438],
      [1279, 398],
    ],
  ],
  [
    'R',
    [
      [1328, 620],
      [1362, 600],
      [1433, 580],
      [1444, 633],
      [1459, 698],
      [1475, 755],
      [1478, 786],
      [1427, 794],
      [1368, 696],
    ],
  ],
  [
    'S',
    [
      [1375, 423],
      [1410, 437],
      [1465, 464],
      [1509, 512],
      [1499, 535],
      [1462, 520],
      [1428, 493],
      [1398, 484],
    ],
  ],
  [
    'T',
    [
      [1398, 484],
      [1428, 493],
      [1462, 520],
      [1499, 535],
      [1537, 555],
      [1575, 610],
      [1589, 651],
      [1552, 680],
      [1507, 706],
      [1488, 681],
      [1455, 622],
      [1438, 562],
    ],
  ],
  [
    'U',
    [
      [1589, 651],
      [1624, 678],
      [1673, 705],
      [1715, 756],
      [1748, 818],
      [1685, 812],
      [1609, 791],
      [1555, 745],
      [1507, 706],
      [1552, 680],
    ],
  ],
];
const bikeReference = new THREE.Group(),
  wildReference = new THREE.Group();
scene.add(bikeReference, wildReference);
const bikeRoutes = panoramaBikes.map((b, id) => ({
  ...b,
  id,
  sourcePoints: b.points,
  points: [],
  curve: null,
  length: null,
  registrationApproved: false,
  status: '官方图线路参考',
}));
function focusBikeRoute(id) {
  const r = bikeRoutes.find((r) => r.id === id);
  if (!r) return;
  const points = r.sourcePoints,
    x = (Math.min(...points.map((p) => p[0])) + Math.max(...points.map((p) => p[0]))) / 2,
    y = (Math.min(...points.map((p) => p[1])) + Math.max(...points.map((p) => p[1]))) / 2;
  focusOfficialMapRegion(x / 2000, y / ((5154 * 2000) / 7415), 5);
}
function selectBikeRoutes(selectedRoute = null) {
  if (DELIVERY_MODE) {
    clearSelection();
    exitExperience(false);
    state.selected = { kind: 'landscape', id: 3 };
    const d = $('detail');
    d.hidden = false;
    d.innerHTML =
      '<div class="detail-top"><h2>森林熊自行车公园</h2><button class="close" aria-label="收起详情">收起 ×</button></div><p class="guest-description">路线示意</p>' +
      bikeRoutes
        .map(
          (b) =>
            '<button class="primary" data-bike-map="' +
            b.id +
            '">' +
            b.name.replace('自行车道 · ', '') +
            ' · 查看三维路线</button><button class="secondary" data-bike-source-view="' +
            b.id +
            '">查看官方路线图</button>',
        )
        .join('');
    d.querySelector('.close').onclick = () => (d.hidden = true);
    d.querySelectorAll('[data-bike-map]').forEach(
      (b) => (b.onclick = () => mapFacilities.focusBike(Number(b.dataset.bikeMap))),
    );
    d.querySelectorAll('[data-bike-source-view]').forEach(
      (b) => (b.onclick = () => focusBikeRoute(Number(b.dataset.bikeSourceView))),
    );
    mapFacilities.setBikes(true);
    mapFacilities.focusBike(selectedRoute === null ? bikeRoutes[0]?.id : selectedRoute);
    renderList();
    return;
  }
  clearSelection();
  exitExperience(false);
  state.selected = { kind: 'landscape', id: 3 };
  const d = $('detail');
  d.hidden = false;
  d.innerHTML =
    '<div class="detail-top"><h2>自行车道</h2><button class="close">×</button></div><div class="badge reference-model-badge">透视候选 · 未通过定位校准</div><button class="primary" id="bike-perspective-open">与官方图同视角核对</button><p class="detail-note">按官方图查看三段自行车道及邻近雪道、林区关系。三维轨迹尚未独立确认，原图线路不表示可导航的实测路线。</p>' +
    bikeRoutes
      .map(
        (b) =>
          '<button class="primary" data-bike-map="' +
          b.id +
          '">' +
          b.name +
          ' · 候选线定位</button><button class="secondary" data-bike-focus="' +
          b.id +
          '">查看原图</button>',
      )
      .join('') +
    '<button class="secondary" id="bike-registration-audit">四图配准核查</button>';
  d.querySelector('.close').onclick = clearSelection;
  $('bike-perspective-open').onclick = () => bikePerspective.open();
  d.querySelectorAll('[data-bike-focus]').forEach(
    (b) => (b.onclick = () => focusBikeRoute(Number(b.dataset.bikeFocus))),
  );
  d.querySelectorAll('[data-bike-map]').forEach(
    (b) => (b.onclick = () => mapFacilities.focusBike(Number(b.dataset.bikeMap))),
  );
  if (selectedRoute !== null) mapFacilities.focusBike(selectedRoute);
  $('bike-registration-audit').onclick = () => registrationWorkbench.open();
  renderList();
}
function wildInteriorPoint(points) {
  const xs = points.map((p) => p[0]),
    zs = points.map((p) => p[1]),
    xmin = Math.min(...xs),
    xmax = Math.max(...xs),
    zmin = Math.min(...zs),
    zmax = Math.max(...zs);
  let best = points[0],
    score = -1;
  for (let i = 0; i < 25; i++)
    for (let j = 0; j < 25; j++) {
      const x = lerp(xmin, xmax, (i + 0.5) / 25),
        z = lerp(zmin, zmax, (j + 0.5) / 25);
      if (!inPolygon(x, z, points)) continue;
      let distance = Infinity;
      for (let k = 0; k < points.length; k++) {
        const a = points[k],
          b = points[(k + 1) % points.length],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
        distance = Math.min(distance, (x - a[0] - t * dx) ** 2 + (z - a[1] - t * dz) ** 2);
      }
      distance = Math.min(distance, Math.max(0, referencePisteDistance(x, z) - 2) ** 2);
      if (distance > score) {
        score = distance;
        best = [x, z];
      }
    }
  return best;
}
const wildZones = [],
  wildColours = ['#c49394', '#b99ba6', '#bf9a7e', '#b38f9c'];
for (const [id, polygon] of panoramaWild) {
  const points = wildRegistered[id] || [],
    mapped = points.length > 2,
    center = mapped ? wildInteriorPoint(points) : null,
    zone = {
      id,
      points,
      center,
      mapped,
      sourcePolygon: polygon.map((p) => p.map((v) => (v * 2000) / 1916)),
      topology: wildTopology[id],
      adjacentTrails: wildAdjacentTrails[id],
      internalTrails: wildInternalTrails[id] || [],
      parts: id === 'M' ? wildMParts : [],
      partial: !!wildPartial[id],
      reason: wildReferenceNotes[id] || null,
      colour: wildColours[wildZones.length % wildColours.length],
    };
  zone.registrationApproved = false;
  zone.candidatePoints = zone.points;
  zone.mapped = false;
  wildZones.push(zone);
  if (zone.mapped)
    labelData.push({ text: id, p: new V(center[0], heightAt(...center) + 7, center[1]), wild: id });
}
function paintWildZones() {
  const l = surfaceLayers.wild;
  l.context.clearRect(0, 0, SURFACE_SIZE, SURFACE_SIZE);
  l.texture.needsUpdate = true;
}

// Rectangular reading windows on the CURRENT 7415x5154 upright source page.
// The legacy sourcePolygon belongs to the old page framing and stays audit-only.
// These windows locate labels and surrounding trails, not geographic boundaries.
const wildOfficialWindows = {
  A: [0.065, 0.36, 0.25, 0.24],
  B: [0.23, 0.35, 0.11, 0.1],
  C: [0.23, 0.38, 0.11, 0.1],
  D: [0.07, 0.44, 0.25, 0.19],
  E: [0.31, 0.29, 0.1, 0.36],
  F: [0.35, 0.27, 0.15, 0.13],
  G: [0.49, 0.26, 0.07, 0.12],
  H: [0.46, 0.39, 0.065, 0.1],
  I: [0.47, 0.43, 0.07, 0.1],
  J: [0.5, 0.42, 0.13, 0.2],
  K: [0.51, 0.31, 0.06, 0.09],
  L: [0.58, 0.26, 0.045, 0.075],
  M: [0.56, 0.3, 0.09, 0.22],
  N: [0.6, 0.29, 0.05, 0.13],
  O: [0.62, 0.27, 0.06, 0.11],
  P: [0.61, 0.35, 0.11, 0.27],
  Q: [0.66, 0.28, 0.07, 0.13],
  R: [0.67, 0.37, 0.08, 0.23],
  S: [0.71, 0.31, 0.07, 0.13],
  T: [0.74, 0.37, 0.08, 0.17],
  U: [0.8, 0.5, 0.1, 0.12],
};
function wildSourceCrop(z) {
  if (!$('trail-map-data').dataset.src) return '';
  const q = wildOfficialWindows[z.id],
    w = 7415,
    h = 5154;
  return (
    '<svg class="wild-source-crop" viewBox="' +
    [q[0] * w, q[1] * h, q[2] * w, q[3] * h].join(' ') +
    '" role="img" aria-label="2026.09官方原图中野雪' +
    z.id +
    '区及相邻雪道"><image href="' +
    $('trail-map-data').dataset.src +
    '" width="' +
    w +
    '" height="' +
    h +
    '"/></svg>'
  );
}
function selectWildZone(id) {
  const z = wildZones.find((z) => z.id === id);
  if (!z) return;
  exitExperience(false);
  const d = $('detail');
  d.hidden = false;
  d.innerHTML =
    '<div class="detail-top"><h2>野雪 ' +
    id +
    ' 区</h2><button class="close">×</button></div><div class="badge reference-model-badge">参考分区 · 非实测边界</div>' +
    wildSourceCrop(z) +
    '<p class="detail-note">' +
    z.topology +
    '。局部图按当前官方原图显示；区域关系用于理解分区，非实测边界。</p><button class="primary" id="wild-map-focus">定位三维参考分区</button><button class="secondary" id="wild-original">查看高清原图</button><button class="secondary" id="wild-registration-audit">四图配准核查</button>';
  d.querySelector('.close').onclick = () => (d.hidden = true);
  $('wild-map-focus').onclick = () => mapFacilities.focusWild(id);
  mapFacilities.focusWild(id);
  $('wild-original').onclick = () => openReference('trail');
  $('wild-registration-audit').onclick = () => registrationWorkbench.open();
}

paintWildZones();
const wildPicker = document.createElement('div');
wildPicker.id = 'wild-zone-picker';
wildPicker.className = 'wild-zone-picker';
wildPicker.hidden = true;
wildPicker.innerHTML =
  '<p>A–U 全 21 区 · 官方图区域索引</p><div>' +
  wildZones.map((z) => '<button data-wild-zone="' + z.id + '">' + z.id + '</button>').join('') +
  '</div>';
$('wild-reference-switch').closest('.switch-row').after(wildPicker);
wildPicker
  .querySelectorAll('button')
  .forEach((b) => (b.onclick = () => selectWildZone(b.dataset.wildZone)));
bikeReference.visible = wildReference.visible = false;
function referenceState() {
  surfaceState.wild.value = surfaceState.bike.value = 0;
  bikeReference.visible = $('bike-layer-switch')?.getAttribute('aria-checked') === 'true';
  wildReference.visible = $('wild-layer-switch')?.getAttribute('aria-checked') === 'true';
  $('wild-zone-picker').hidden = true;
  if (typeof bikePicker !== 'undefined') {
    bikePicker.hidden = true;
    syncReferenceBrowsers();
  }
  $('reference-warning').hidden = true;
}
// These are source-image browsers, not drawable layers. Disclose in place.
const bikePicker = document.createElement('div');
bikePicker.id = 'bike-route-picker';
bikePicker.className = 'reference-picker';
bikePicker.hidden = true;
bikePicker.innerHTML = bikeRoutes
  .map(
    (b) =>
      '<button type="button" data-bike-source="' + b.id + '">' + b.name + ' · 查看原图 ↗</button>',
  )
  .join('');
$('bike-reference-switch').closest('.switch-row').after(bikePicker);
bikePicker
  .querySelectorAll('button')
  .forEach((button) => (button.onclick = () => focusBikeRoute(Number(button.dataset.bikeSource))));
const referenceBrowsers = [
  ['bike-reference-switch', bikePicker, '原图路线'],
  ['wild-reference-switch', wildPicker, '原图分区'],
];
function syncReferenceBrowsers() {
  for (const [id, picker, label] of referenceBrowsers) {
    const button = $(id);
    button.setAttribute('aria-expanded', String(!picker.hidden));
    button.textContent = (picker.hidden ? '展开' : '收起') + label;
  }
}
for (const [id, picker] of referenceBrowsers) {
  const button = $(id);
  button.className = 'reference-disclosure';
  button.removeAttribute('role');
  button.removeAttribute('aria-checked');
  button.removeAttribute('aria-label');
  button.setAttribute('aria-controls', picker.id);
  button.onclick = () => {
    const opening = picker.hidden;
    for (const [, other] of referenceBrowsers) other.hidden = true;
    picker.hidden = !opening;
    syncReferenceBrowsers();
  };
}
syncReferenceBrowsers();
