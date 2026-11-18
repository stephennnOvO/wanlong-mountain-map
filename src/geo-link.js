// WGS84 local east/north metric approximation. 1 scene unit = 1 metre; vertical factor = 1.
function mapPixel(c) {
  const [x, z] = projectGeo(c);
  return [x / 1.65 + 960, z / 3.6 + 600];
}
function reviewedMosaicGeo([u, v]) {
  const radius = 6378137;
  return [
    (12842032.24813589 + (u * (12848147.210398708 - 12842032.24813589)) / 4096) / radius / DEG,
    Math.atan(
      Math.sinh((5009071.33758417 - (v * (5009071.33758417 - 5003567.8715476375)) / 3686) / radius),
    ) / DEG,
  ];
}
function joinLines(lines) {
  const parts = lines.map((a) => a.coords.map((c) => c.slice(0, 2)));
  if (!parts.length) return null;
  parts.sort((a, b) => a[0][1] - b[0][1]);
  let out = parts.shift();
  for (const part of parts) {
    let gap = Math.hypot(
      ...projectGeo([
        part[0][0] - out.at(-1)[0] + GEO.origin[0],
        part[0][1] - out.at(-1)[1] + GEO.origin[1],
      ]),
    );
    if (gap < 25) out = out.concat(part);
    else {
      const gapRev = Math.hypot(
        ...projectGeo([
          part.at(-1)[0] - out[0][0] + GEO.origin[0],
          part.at(-1)[1] - out[0][1] + GEO.origin[1],
        ]),
      );
      if (gapRev < 25) out = part.concat(out);
      else return out;
    }
  }
  return out;
}
trails.forEach((t) => {
  let key = t.name;
  if (key === '翔龙道') key = '祥龙道';
  let matches = GEO.runs.filter((r) => r.name?.split(',')[0].includes(key));
  if (t.name === '大奔头') matches = GEO.runs.filter((r) => r.name?.includes('大奔头'));
  if (t.name === '银龙道') matches = GEO.runs.filter((r) => r.name?.includes('银龙道（上段）'));
  t.geo = joinLines(matches);
  t.mapped = !!t.geo;
  t.geoSources = matches.flatMap((r) => r.osm);
  t.geoName = matches.map((r) => r.name?.split(',')[0]).join(' + ');
  t.path = t.geo ? t.geo.map(mapPixel) : [];
});
// Preserve audited source continuation and the user's restored Wolong alignment.
if (typeof REVIEWED_TRAIL_MOSAIC !== 'undefined')
  for (const record of REVIEWED_TRAIL_MOSAIC.records) {
    const trail = trails.find((t) => t.name === record.name);
    if (!trail) continue;
    trail.geo = record.points.map(reviewedMosaicGeo);
    trail.path = trail.geo.map(mapPixel);
    trail.mapped = true;
    trail.routeSource = 'reviewed-mosaic';
    if (trail.name === '五彩龙道' && REVIEWED_TRAIL_MOSAIC.narrow) {
      const n = REVIEWED_TRAIL_MOSAIC.narrow,
        p = trail.geo.map(projectGeo),
        lengths = [0];
      for (let i = 1; i < p.length; i++)
        lengths.push(lengths.at(-1) + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
      trail.reviewedNarrowSamples = n.widthsM.map((width, i) => ({
        fraction: lengths[n.sourceVertexStart + i] / lengths.at(-1),
        width,
      }));
    }
  }
const liftMap = {
  1: 'way/1368988315',
  2: 'way/639931083',
  4: 'way/1368988312',
  5: 'way/483990521',
  6: 'way/259556839',
  7: 'way/582002977',
  8: 'way/846769091',
};
lifts.forEach((l) => {
  const r = GEO.lifts.find((r) => r.osm.includes(liftMap[l.id]));
  l.geo = r?.coords.map((c) => c.slice(0, 2));
  l.geoSource = liftMap[l.id];
  l.originalName = l.name;
  l.mapped = !!l.geo;
  if (l.geo && l.geo[0][1] < l.geo.at(-1)[1]) l.geo.reverse();
  l.path = l.geo ? [mapPixel(l.geo[0]), mapPixel(l.geo.at(-1))] : [];
  if (l.id === 4) {
    l.name = '4索';
    l.conflict =
      '按用户确认，此线路显示为“4索”。OSM 原始名称“三索”仅保留在来源记录中；设备参数仍待独立核实。';
    l.capacity = null;
    l.length = null;
    l.drop = null;
    l.speed = null;
    l.flow = null;
    l.hours = '资料未核实';
  }
  if (l.id === 8) {
    l.name = '西侧索道（未命名）';
    l.conflict = 'OSM 未给此线编号。不能确认它与参数表“8索”的对应关系，暂不绑定设备参数。';
    l.capacity = null;
    l.length = null;
    l.drop = null;
    l.speed = null;
    l.flow = null;
    l.hours = '资料未核实';
  }
});
const newLift = GEO.lifts.find((l) => l.name === '新7索');
if (newLift)
  lifts.push({
    id: 9,
    name: '新7索（OSM）',
    type: 'gondola',
    capacity: 8,
    length: null,
    drop: null,
    speed: null,
    flow: null,
    hours: '以新雪季官方公告为准',
    mapped: true,
    geo: newLift.coords.map((c) => c.slice(0, 2)),
    geoSource: newLift.osm[0],
    path: [mapPixel(newLift.coords[0]), mapPixel(newLift.coords.at(-1))],
    conflict: 'OSM 标记“新7索”，8人吊箱。暂未获得公开设备参数和正式投运公告；运行使用体验速度。',
  });
// Hotels: use source footprints/POIs; facade dimensions remain a separate, labelled approximation.
const hotelLocations = {
  1: [115.3917199, 40.9683873],
  2: [115.3945502, 40.9707682],
  3: [115.3935896, 40.9698898],
  4: [115.393004, 40.9693104],
  5: [115.39856, 40.97019],
  6: [115.39315, 40.9695],
};
hotels.forEach((h) => {
  h.geo = hotelLocations[h.id];
  h.p = mapPixel(h.geo);
  h.locationSource = h.id === 6 ? '公寓配套位置待核实' : 'OSM 建筑轮廓/POI';
});
const LANDSCAPE_ITEMS = [
  {
    id: 1,
    name: '树林覆盖',
    category: '林地',
    status: 'OSM 林地多边形',
    source: 'https://www.openstreetmap.org/copyright',
    description:
      '按 OSM 林地多边形放置树木，并用卫星影像对照林带与雪道。单棵树的位置、树种和高度为视觉模拟；这些多边形是林地覆盖，不等同于雪场许可滑行的野雪边界。',
  },
  {
    id: 2,
    name: '野雪 E 区观景台',
    category: '野雪',
    status: '已定位的观景点',
    geo: [115.3984557, 40.9657112],
    source: 'https://www.openstreetmap.org/node/12679534551',
    description:
      'OSM 提供该观景台的坐标，可准确定位这个点。观景台不能代表 E 区边界；A—U 各野雪区的精确边界尚未取得，未据名称虚构多边形。',
  },
  {
    id: 3,
    name: '森林熊山地自行车公园',
    category: '骑行',
    status: '设施已核实 · 路网待核实',
    source: 'https://www.chonglihuaxue.cn/info.asp?id=39',
    description:
      '2026 年夏秋公开旅游项目表确认森林熊山地自行车公园及山地车项目。2026.09 雪道全景图也画有自行车道，但该图为透视示意图，没有坐标与比例尺；尚未取得 GPX/GeoJSON，故不将图上线条冒充精确车道。',
  },
  {
    id: 4,
    name: '猛龙道 · 中高级公园',
    category: '公园',
    status: '26/27 官宣 · 所属雪道已确认',
    trailId: 19,
    photo: 2,
    source: 'https://mp.weixin.qq.com/s/FF8mxKUnTEnuGj7ovui0rg',
    description:
      '万龙度假天堂订阅号于 2026.08.18 明确将中高级地形公园设置在猛龙道，面向熟练公园滑行者。施工航拍可见连续土方平台和起伏；2026.10.14 文章再次展示施工形态。现可标注所属雪道，但未公开精确占地、跳台尺寸与间距。',
  },
  {
    id: 5,
    name: '山径参考图层',
    category: '山径',
    status: 'OSM 路径 · 骑行用途未确认',
    source: 'https://www.openstreetmap.org/way/582002975',
    description:
      '展示 OSM 中已绘制的 path/track 中心线，保留原始地理走向。这些路径没有可靠的自行车专用标记，不能替代森林熊骑行路线图。仅用于查阅空间关系。',
  },
  {
    id: 6,
    name: '娇龙道 · 初级公园',
    category: '公园',
    status: '26/27 官宣 · 所属雪道已确认',
    trailId: 4,
    photo: 0,
    source: 'https://mp.weixin.qq.com/s/FF8mxKUnTEnuGj7ovui0rg',
    description:
      '2026.08.18 官方文章确认初级公园位于娇龙道，内容包括较低难度的小跳台、缓和起伏和基础道具。配图提供山脚与魔毯周边场景参考；正式障碍物布置、尺寸和边界仍需现状图核验。',
  },
  {
    id: 7,
    name: '银龙道 · 中级公园',
    category: '公园',
    status: '26/27 官宣 · 所属雪道已确认',
    trailId: 10,
    photo: 1,
    source: 'https://mp.weixin.qq.com/s/FF8mxKUnTEnuGj7ovui0rg',
    description:
      '2026.08.18 官方文章将中级地形公园安排在银龙道，面向已有基础的进阶雪友，规划跳台组合与道具线路。模型只强调它所关联的银龙中心线，未将施工航拍中的透视距离视为实测间距。',
  },
  {
    id: 8,
    name: '蹦床室 · 新设施核查',
    category: '室内',
    status: '用户线索 · 地点与布局待核实',
    source: 'https://www.chonglihuaxue.cn/info.asp?id=39',
    description:
      '用户提示新增加了蹦床室。已检查提供的两篇 26/27 官方文章，正文未明确列出室内蹦床设施。2026 夏秋项目表列有蹦床项目，但不足以确认新的室内房间、建筑楼层与规模。暂不凭空新建场馆。',
  },
];
// Official-map correspondence is provisional; keep OSM identity explicit.
for (const l of lifts) {
  if (l.id === 7) {
    l.stationBadge = '8?';
    l.name = '官方8索（候选；OSM七索）';
    l.conflict =
      '官方2026.09图与雪道/站群关系支持8索候选；OSM名称七索。尚未以现场标牌确认，不视为已定编号。';
  } else if (l.id === 9) {
    l.stationBadge = '7?';
    l.name = '官方7索（候选；OSM新7索）';
    l.conflict =
      '官方2026.09图与紫龙末端、6索相邻关系支持7索候选；OSM名称新7索。站房范围及正式编号仍待核实。';
  } else if (l.id === 8) {
    l.stationBadge = '西?';
    l.name = '西侧未命名索道（编号待核实）';
  } else l.stationBadge = String(l.id);
}
