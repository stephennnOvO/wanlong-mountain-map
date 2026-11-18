// Full reference footprints read from the September 2026 panorama.
// Piste-bound polygons follow COMPLETE named route chains, including their
// connecting routes. Forest edges / missing routes are separately identified
// approximations. These are neither surveyed boundaries nor opening notices.
const wildTopology = {
  A: '长龙道外侧林地；下缘沿长龙道，外缘为原图林地参考',
  B: '长龙道与短龙道围合林地的上部；下接 C，无独立分隔雪道',
  C: '长龙道与短龙道围合林地的下部；上接 B，底部至两道汇合',
  D: '长龙道大回转内的整片林地；右缘游龙道，上部接短龙道',
  E: '上起长龙道与玉龙道分岔附近；左沿游龙上段、中华龙道，右沿原图红虚线林缘，下至卧龙道',
  F: '长龙道、玉龙道与金龙道三面围合的整片林地',
  G: '翔龙道与飞龙道从山顶分岔至下方交汇的完整区域',
  H: '小龙道、酷龙道与炫龙道围合；下至酷龙、炫龙在玉龙道的交汇',
  I: '炫龙道与大奔头之间；上接小龙道，下至玉龙道',
  J: '猛龙道、威龙道、雨龙道围合；山脚两端由娇龙道短连接闭合',
  K: '飞龙道、银龙道、小龙道围合的完整区域',
  L: '雾龙道与霜龙道之间；顶部接山脊连接道，底部至两道相接处',
  M: '逸龙道两侧均属 M：主体在逸龙道与海龙道之间，另一片在逸龙／雨龙分叉方向与腾龙道之间；逸龙为区内穿行雪道',
  N: '霜龙道与雪龙道之间；顶部接山脊连接道，下至海龙、风龙交汇',
  O: '雪龙道、云龙道与风龙道围合的完整区域',
  P: '海龙道与云龙道之间；上接风龙道，下至娇龙道，包含幸福谷所在林带',
  Q: '云龙道右侧上部林带；上至山脊连接道，右缘为绿龙道方向的林缘，下接 R',
  R: '云龙道右侧下部林带；上接 Q，右沿原图红虚线林缘，下至娇龙道与山脚索道站附近',
  S: '绿龙道与五彩龙道之间的上部林地；下接 T，左下缘转为原图红虚线林缘',
  T: '五彩龙道内侧的中下部林地；左沿绿龙方向的红虚线林缘，下至两道交汇附近',
  U: '五彩龙道下部与赤龙道之间的林地；上至分岔，下至山脚',
};
const wildAdjacentTrails = {
  A: [1],
  B: [1, 2],
  C: [1, 2],
  D: [1, 2, 5],
  E: [1, 5, 14, 3],
  F: [1, 6, 15],
  G: [17, 7],
  H: [8, 9, 18],
  I: [8, 18, 20, 6],
  J: [19, 21, 11, 4],
  K: [7, 10, 8],
  L: [25, 26],
  M: [23, 24, 22, 11],
  N: [26, 27, 29],
  O: [27, 29, 28],
  P: [24, 29, 28, 4],
  Q: [29, 30],
  R: [29, 30, 12, 4],
  S: [30, 13],
  T: [30, 13],
  U: [13, 31],
};
// The user's confirmed M crosses Yilong. This is supported internal topology,
// not an accidental region/piste crossing; the piste itself stays transparent.
const wildInternalTrails = { M: [23] };
const wildSourceOnly = {},
  wildPartial = {};
const wildReferenceNotes = {
  A: '外侧林缘没有测绘控制点，按长龙道位置及原图林地跨度补齐整片参考轮廓；外缘位置置信较低。',
  B: 'B/C 之间没有可定位的独立雪道；两区共享的内部划分线为参考，合并外轮廓完整沿长龙与短龙。',
  C: 'B/C 之间没有可定位的独立雪道；两区共享的内部划分线为参考，合并外轮廓完整沿长龙与短龙。',
  E: '右侧红虚线是林缘，不是玉龙道。按原图上、下端及林带宽度补全；边界位置为参考，未把整片山坡填到玉龙道。',
  F: '补回从山脊长龙道到玉龙—金龙交点的全部范围，不再仅保留两道共同纬度内的下部小块。',
  J: '使用实际已取得的威龙道中心线。左侧猛龙公园所在雪道透出，右侧至威龙，下缘顺雨龙回到山脚；没有以大奔头替代猛龙或威龙。',
  K: '由飞龙—银龙分岔沿两道完整下行，底边逐点沿小龙道闭合；上、下端均未截短。',
  L: '雾龙道暂无独立地理中心线。其参考走向由山脊及霜龙道交接位置约束，仅用于恢复 L 的完整外形；没有修改或新增真实雪道资料。',
  M: '按用户确认，原有腾龙侧半片完整保留，并补上逸龙另一侧的海龙片。两片共享逸龙道，统一显示为 M，雪道本体透出。海龙侧上缘以逸龙上端所在坡段近似连接；原图所示逸龙／雨龙分叉与旧 OSM 短分段仍有差异，参考轮廓不表示测绘精度。',
  P: '完整延伸至山脚娇龙道，补回幸福谷所在的下半片林带。',
  Q: '右缘按原图林缘在云龙—绿龙之间插值；这条林缘不是绿龙道中心线。Q/R 内部接线没有测绘坐标。',
  R: '从 Q 连续延伸至山脚；绿龙下端与紫龙、五彩龙的已知交接只用于定位林缘，不把紫龙改名为绿龙。',
  S: 'S/T 的分段按原图上下关系参考定位。上部贴绿龙与五彩龙，左下边转入图示红虚线林缘。',
  T: '补齐到绿龙与五彩龙交汇附近；左侧沿原图红虚线林缘，未把绿龙右侧未画斜线的整条空白坡面一并涂满。林缘与 S/T 内部分界为参考。',
  U: '赤龙道暂无独立地理中心线。依据五彩龙分岔、山脚及原图赤龙位于黄龙内侧的关系补全参考边界；未以黄龙中心线替代赤龙。',
};
function referenceGeo(id) {
  return trails.find((t) => t.id === id).geo;
}
function referenceAtLat(line, lat, choose = 'first') {
  const hits = [];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1],
      b = line[i];
    if (lat < Math.min(a[1], b[1]) || lat > Math.max(a[1], b[1]) || a[1] === b[1]) continue;
    hits.push([lerp(a[0], b[0], (lat - a[1]) / (b[1] - a[1])), lat]);
  }
  if (!hits.length) return null;
  return choose === 'west'
    ? hits.reduce((a, b) => (a[0] < b[0] ? a : b))
    : choose === 'east'
      ? hits.reduce((a, b) => (a[0] > b[0] ? a : b))
      : hits[0];
}
function referenceClean(line) {
  return line.filter(
    (p, i) => p && (!i || Math.hypot(p[0] - line[i - 1][0], p[1] - line[i - 1][1]) > 1e-10),
  );
}
function referenceRing(...chains) {
  const p = referenceClean(chains.flat());
  if (p.length > 1 && Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 1e-10) p.pop();
  return p;
}
function referenceClipLatitude(poly, lat, upper) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      ia = upper ? a[1] <= lat : a[1] >= lat,
      ib = upper ? b[1] <= lat : b[1] >= lat;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (lat - a[1]) / (b[1] - a[1]);
      out.push([lerp(a[0], b[0], t), lat]);
    }
  }
  return referenceClean(out);
}
const wildMGeoParts = (() => {
  const g = referenceGeo,
    rev = (a) => a.slice().reverse(),
    bottom = referenceAtLat(g(22), g(23).at(-1)[1]),
    seaTop = referenceAtLat(g(24), g(23)[0][1]);
  return [
    {
      id: 'confirmed-teng-side',
      name: '原已确认半片 · 腾龙侧',
      geo: referenceRing(g(22).slice(7, 9), [bottom], rev(g(23))),
    },
    {
      id: 'added-sea-side',
      name: '新增半片 · 逸龙—海龙侧',
      geo: referenceRing([g(23)[0], seaTop], g(24).slice(8, 12), rev(g(23))),
    },
  ];
})();
const wildMParts = wildMGeoParts.map((p) => ({ ...p, points: p.geo.map(projectGeo) }));
const wildGeoRegistered = (() => {
  const g = referenceGeo,
    rev = (a) => a.slice().reverse(),
    long = g(1);
  const bc = referenceRing(long.slice(15, 31), rev(g(2)));
  const stForest = [
    ...g(30).slice(0, 4),
    ...[
      [40.9587, 0.15],
      [40.9598, 0.28],
      [40.961, 0.36],
      [40.9622, 0.38],
      [40.9632, 0.29],
    ].map(([lat, t]) => {
      const a = referenceAtLat(g(30), lat),
        b = referenceAtLat(g(13).slice(3, 18), lat);
      return [lerp(a[0], b[0], t), lat];
    }),
    g(30).at(-1),
  ];
  const st = referenceRing(stForest, rev(g(13).slice(3, 26)));
  const leftE = referenceRing(long.slice(9, 13), g(5).slice(0, 7), g(14));
  const forestE = [
    [115.3964156, 40.9701833],
    [115.39565, 40.9698],
    [115.3957, 40.9685],
    [115.39695, 40.9664],
    [115.39865, 40.9647],
    [115.40165, 40.9625],
    [115.40355, 40.9604],
    [115.40475, 40.9587],
    long[9],
  ];
  // A's exterior is a reference forest rim outside the upper side of the
  // large Longlong hairpin. Its piste edge is retained point for point.
  const aEdge = long.slice(19, 46),
    aOuter = [
      [115.4104, 40.9685],
      [115.412, 40.9664],
      [115.4121, 40.9644],
      [115.4113, 40.9626],
      [115.4097, 40.9622],
    ];
  const mist = [
    g(29)[8],
    [115.38932, 40.9558],
    [115.3891, 40.95665],
    [115.38875, 40.9576],
    g(26)[2],
  ];
  const mBottom = referenceAtLat(g(22), g(23).at(-1)[1]),
    mSeaTop = referenceAtLat(g(24), g(23)[0][1]);
  const cloud = g(29).slice(11),
    greenBase = referenceRing(g(30), g(12));
  const rim = [
    g(30)[0],
    ...[
      [40.9563, 0.87],
      [40.9575, 0.82],
      [40.9587, 0.76],
      [40.9601, 0.7],
      [40.96155, 0.68],
      [40.9626, 0.68],
      [40.9637, 0.7],
      [40.965, 0.73],
      [40.9662, 0.78],
    ].map(([lat, t]) => {
      const a = referenceAtLat(cloud, lat),
        b = referenceAtLat(greenBase, lat);
      return [lerp(a[0], b[0], t), lat];
    }),
    g(4)[12],
  ];
  const qr = referenceRing(cloud, g(4).slice(10, 13), rev(rim));
  const red = [
    g(13)[13],
    [115.3757, 40.9636],
    [115.3748, 40.9645],
    [115.3736, 40.9655],
    [115.3724, 40.9663],
    g(13).at(-1),
  ];
  return {
    A: referenceRing(aEdge, aOuter),
    B: referenceClipLatitude(bc, 40.96305, true),
    C: referenceClipLatitude(bc, 40.96305, false),
    D: referenceRing(long.slice(30), rev(g(5).slice(6)), g(2).slice(22)),
    E: referenceRing(leftE, forestE),
    F: referenceRing(long.slice(0, 10), g(6).slice(0, 5), rev(g(15))),
    G: referenceRing(g(17), rev(g(7).slice(0, 11))),
    H: referenceRing(g(9), rev(g(18)), g(8).slice(3, 10)),
    I: referenceRing(g(18), g(6).slice(8, 12), rev(g(20)), g(8).slice(1, 4)),
    J: referenceRing(g(19), g(4).slice(0, 3), rev(g(11).slice(10)), rev(g(21).slice(1, 4))),
    K: referenceRing(g(7).slice(2), rev(g(8).slice(1, 7)), rev(g(10))),
    L: referenceRing(mist, rev(g(26).slice(0, 3))),
    // Exact union of the unchanged user-confirmed half and the added sea-side
    // half. Yilong is their shared INTERNAL edge, removed from the outer ring.
    M: referenceRing(g(22).slice(7, 9), [mBottom], rev(g(24).slice(8, 12)), [mSeaTop]),
    N: referenceRing(g(26), rev(g(27)), rev(g(29).slice(9, 12))),
    O: referenceRing(g(27), rev(g(28)), rev(g(29).slice(11, 18))),
    P: referenceRing(g(24).slice(16), g(4).slice(8, 11), rev(g(29).slice(17)), g(28)),
    Q: referenceClipLatitude(qr, 40.96155, true),
    R: referenceClipLatitude(qr, 40.96155, false),
    S: referenceClipLatitude(st, 40.95875, true),
    T: referenceClipLatitude(st, 40.95875, false),
    U: referenceRing(g(13).slice(13), rev(red)),
  };
})();
const wildRegistered = Object.fromEntries(
  Object.entries(wildGeoRegistered).map(([id, p]) => [id, p.map(projectGeo)]),
);
// Clear only the visible piste footprint (+ 2 m antialiasing allowance).
// The former extra 28 m erased a substantial fraction of narrow full zones.
function clearWildPistes(layer) {
  const c = layer.context;
  c.save();
  c.globalCompositeOperation = 'destination-out';
  for (const t of trails.filter((t) => t.mapped)) surfacePiste(layer, t, 1.04, '#000');
  for (const b of GEO.buildings) surfacePolygon(layer, b.coords.map(projectGeo), '#000');
  for (const rt of liftRuntimes)
    for (const t of [0, 1]) {
      const p = rt.groundCurve.getPoint(t);
      c.beginPath();
      const q = surfacePixel([p.x, p.z]);
      c.ellipse(
        q[0],
        q[1],
        (23 / SURFACE_X) * SURFACE_SIZE,
        (23 / SURFACE_Z) * SURFACE_SIZE,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
  c.restore();
  layer.texture.needsUpdate = true;
}
function referencePisteDistance(x, z) {
  let best = Infinity;
  for (const p of pathSamples) best = Math.min(best, Math.hypot(x - p.x, z - p.z) - p.w / 2);
  return best;
}
// Trace the remaining fill edge after piste transparency, so complete
// snow-edge outlines survive rather than being erased with a centreline.
function outlineWildVisible(layer, selected) {
  const c = layer.context,
    w = layer.canvas.width,
    h = layer.canvas.height,
    img = c.getImageData(0, 0, w, h),
    d = img.data,
    alpha = new Uint8Array(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = d[i * 4 + 3];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (alpha[i] < 30) continue;
      if (alpha[i - 1] < 15 || alpha[i + 1] < 15 || alpha[i - w] < 15 || alpha[i + w] < 15) {
        const j = i * 4;
        d[j] = 134;
        d[j + 1] = 85;
        d[j + 2] = 94;
        d[j + 3] = selected ? 235 : 200;
      }
    }
  c.putImageData(img, 0, 0);
}
