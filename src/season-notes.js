// Official 25/26 guide, published 2026-02-05; historical facility relationships only.
const LAST_SEASON_SOURCE = 'https://mp.weixin.qq.com/s/QdY5BBhPSJrHD4MbMyoeSA';
const hotelFloors = {
  1: [['5F', '龙景轩 · 龙宫汤泉']],
  2: [
    ['2F', '双龙自助'],
    ['3F', '双龙美食轩 · 非凡秘境 SPA'],
    ['大堂', '前台后方：双龙汤泉'],
  ],
  3: [
    ['D层', '龙火锅'],
    ['公寓平台', '健身房'],
  ],
  4: [['室内房型', '官方介绍为 17 种主题套房；不据房型反推楼内平面']],
  5: [
    ['配套', '健身房 · 洗衣房'],
    ['雪场连接', '专属连廊滑进滑出；走向、尺寸及落点未测绘'],
  ],
  6: [['步行关系', '官方介绍步行约 2 分钟到雪道；独立入口坐标待核实']],
};
hotels.forEach((h) => (h.floorDetails = hotelFloors[h.id]));
hotels[4].features = ['25/26 新装开业', '专属连廊', '健身房', '洗衣房'];
hotels[5].description =
  '25/26 官方攻略将悦龙列为六家酒店之一，介绍步行约两分钟到雪道。目前未取得可独立核验的入口位置或楼栋轮廓，目录保留详细资料；三维地理场景不猜测其位置。';
const guideItems = [
  {
    id: 9,
    name: '幸福谷 · 野雪',
    category: '野雪谷',
    status: '官方出入口关系 · 沟谷地形参考',
    contextTrails: ['幸福大道', '娇龙道'],
    connections: [
      ['入口', '幸福大道护网缺口'],
      ['谷内', '无需穿越树林 · 小型天然 U 池'],
      ['出口', '衔接娇龙道'],
    ],
    description:
      '25/26 官方攻略介绍的新增野雪谷。文字说明了出入口和地形特点，但没有 GPX、边界与测绘坐标。按出入口关系与公开地形补充天然凹谷参考，沟槽宽深和精确位置为估计。',
  },
  {
    id: 10,
    name: '恐龙谷 · 野雪',
    category: '野雪谷',
    status: '官方入口/出口关系 · 无测绘线',
    contextTrails: ['翔龙道', '恐龙道'],
    connections: [
      ['入口', '翔龙道右转'],
      ['谷内', '较疏树林 · 天然 U 池'],
      ['出口', '衔接恐龙道'],
    ],
    description:
      '25/26 官方攻略将恐龙谷列为进阶野雪谷。原文“翔龙道”的名称保留，并与目录中的 OSM“祥龙道”别名一并说明；未推断右转点的精确坐标。',
  },
  {
    id: 11,
    name: '霜龙谷 · 野雪',
    category: '野雪谷',
    status: '官方入口/出口关系 · 无测绘线',
    contextTrails: ['霜龙道', '雪龙道'],
    connections: [
      ['入口', '野雪 L 区护网缺口'],
      ['谷内', '上段较平 · 下段收窄陡增'],
      ['出口', '衔接霜龙道或雪龙道'],
    ],
    description:
      '25/26 官方攻略介绍的高难度野雪谷。野雪 L 区仅有全景图参考分区，缺口与谷底没有测绘坐标，模型补充连续天然凹谷参考，缺口和谷底精确位置仍待核实。',
  },
  {
    id: 12,
    name: '雪具大厅 · 楼层配套',
    category: '配套',
    status: '25/26 官方介绍 · 楼内位置关系',
    connections: [
      ['室外1层', '医疗中心'],
      ['3F', '崇礼好礼文创店铺'],
      ['4F', '儿童剧场 · 阳光大食堂 · 万龙小火锅'],
      ['4F 快餐厅南侧', '肌骨健康管理中心 · 儿童剧场旁'],
      ['6号门对面', '万龙咖啡'],
      ['6号门前', '酒店 VIP 休息区'],
    ],
    description:
      '官方文章提供楼层及相邻关系，可帮助理解雪场服务设施。没有取得楼内平面图、房间尺寸和独立建筑轮廓，不将文字层级制作成假想室内三维房间。新增蹦床室仍未在该文中确认。',
  },
  {
    id: 13,
    name: '山顶木屋与雪咖啡厅',
    category: '配套',
    status: '官方定位到红花梁山顶 · 房间边界待核实',
    connections: [
      ['红花梁山顶', '山顶木屋 · 半山雪咖啡厅'],
      ['咖啡厅参考', '北欧风格 · 大面积落地窗 · 木质桌椅'],
      ['日落活动', '夕阳派对'],
    ],
    description:
      '名称带“半山”的雪咖啡厅，官方正文明确写位于红花梁山顶。现有木屋外部仅作照片参考体量，咖啡厅与木屋的具体房间关系、入口与占地未取得测绘。不可因名称将它移到半山。',
  },
];
guideItems.forEach((i) => {
  i.source = LAST_SEASON_SOURCE;
  LANDSCAPE_ITEMS.push(i);
});

LANDSCAPE_ITEMS.push({
  id: 14,
  name: '双龙自助与龙景轩',
  category: '餐饮',
  status: '26/27 官方菜单与餐饮介绍',
  source: 'https://mp.weixin.qq.com/s/jwkwN3pACQcLvQUfz89coQ',
});
LANDSCAPE_ITEMS[0].description +=
  ' 2026.07 官方文章介绍了夏季森林抚育与过密林木清理，并区分树林野雪、蘑菇道、波浪道和野雪谷四类地形。具体雪包、波浪高度与分布未测绘，不据宣传照片改造 DEM。';
LANDSCAPE_ITEMS[9].description +=
  ' 2026.09 官方夜景配图中的现场路牌也出现“G恐龙谷 U池”与翔龙道、恐龙道的导向，确认该名称与 G 标识；不能由路牌反推边界。';

hotels[3].description =
  '主题公寓的携程与Klook店铺资料均列地址为万龙滑雪场内03号C座；目前没有可靠资料将C座对应到一个独立OSM轮廓。模型展示公寓建筑群，不另复制一栋独立主题高楼。';
hotels[3].architecture = '03号C座运营资料 · 公寓楼群参考 · C座独立轮廓未核实';

hotels[2].description =
  '公寓楼群参考公开外观的连续长条主体与较高端部，按OSM轮廓分别建模；低层裙房、入口和地面配套分别处理。窗带层数为照片估读，楼高非实测。';
hotels[2].architecture = '源轮廓主体与端部 · 连续窗列 · 浅色檐口与低裙房';
// 2026.09 panorama signs and its parameter table share official route numbers.
// Internal trail IDs retain the historic difficulty-sorted application order.
const PANORAMA_ROUTE_ORDER = [
  '长龙道',
  '短龙道',
  '游龙道',
  '中华龙道',
  '卧龙道',
  '玉龙道',
  '金龙道',
  '恐龙道',
  '翔龙道',
  '飞龙道',
  '小龙道',
  '酷龙道',
  '炫龙道',
  '猛龙道',
  '银龙道',
  '大奔头',
  '威龙道',
  '雨龙道',
  '娇龙道',
  '腾龙道',
  '逸龙道',
  '海龙道',
  '雾龙道',
  '霜龙道',
  '雪龙道',
  '风龙道',
  '云龙道',
  '绿龙道',
  '紫龙道',
  '五彩龙道',
  '赤龙道',
  '黄龙道',
];
trails.forEach((t) => (t.mapRef = PANORAMA_ROUTE_ORDER.indexOf(t.name) + 1));

// User-supplied official panorama, lower-right imprint 2026.09; local original
// 最新雪道图高清.jpg. These fields describe official map metadata, not geometry.
const OFFICIAL_MAP_VERSION = '2026.09';
trails.forEach((t) => {
  t.officialMapVersion = OFFICIAL_MAP_VERSION;
  t.officialTableRef = t.mapRef;
  t.officialGrade = ['大奔头', '霜龙道', '风龙道'].includes(t.name) ? 'double' : t.level;
  t.officialGradeLabel = t.officialGrade === 'double' ? '双钻高级' : levels[t.level].label;
  if (t.name === '小龙道') {
    t.officialAltitudeStatus = 'printed-anomaly';
    t.officialAltitudeNote =
      '官方2026.09参数表原文为856米，与图示山腰位置及相邻雪道高程不一致；保留原值，待官方核实，不用于校正DEM。';
  }
});
// Independent official table: never substitute these values into lift runtime,
// since OSM 三索/official4索 and unnamed/official8索 are not confirmed matches.
const officialLiftInfo = [
  {
    number: 1,
    name: '1号索道',
    type: 'gondola',
    capacity: 8,
    length: 1581,
    drop: 462.5,
    speed: 6,
    flow: 2400,
    winterHours: '08:30–16:30',
    summerHours: '09:00–16:30/17:00',
  },
  {
    number: 2,
    name: '2号索道',
    type: 'chair',
    capacity: 6,
    length: 1602,
    drop: 462.5,
    speed: 5,
    flow: 1980,
    winterHours: '08:30–16:30',
    summerHours: '以实际通知为准',
  },
  {
    number: 4,
    name: '4号索道',
    type: 'chair',
    capacity: 4,
    length: 808,
    drop: 259.8,
    speed: 2.2,
    flow: 1145,
    winterHours: '以实际通知为准',
    summerHours: '以实际通知为准',
  },
  {
    number: 5,
    name: '5号索道',
    type: 'gondola',
    capacity: 8,
    length: 1913,
    drop: 526.95,
    speed: 6,
    flow: 2400,
    winterHours: '08:30–16:00',
    summerHours: '以实际通知为准',
  },
  {
    number: 6,
    name: '6号索道',
    type: 'chair',
    capacity: 4,
    length: 2028,
    drop: 535.1,
    speed: 5,
    flow: 1500,
    winterHours: '08:30–16:00',
    summerHours: '以实际通知为准',
  },
  {
    number: 7,
    name: '7号索道',
    type: 'gondola',
    capacity: 8,
    length: 2046,
    drop: 534,
    speed: 6,
    flow: 2400,
    winterHours: '08:30–16:00',
    summerHours: '以实际通知为准',
  },
  {
    number: 8,
    name: '8号索道',
    type: 'gondola',
    capacity: 8,
    length: 1907,
    drop: 500.5,
    speed: 6,
    flow: 2400,
    winterHours: '09:30–15:00',
    summerHours: '以实际通知为准',
  },
].map((r) => ({
  ...r,
  version: OFFICIAL_MAP_VERSION,
  note: '官方表雪季10月底–4月初；夏季6月底–10月初。图示运营时段，不代表实时开放；保留与OSM编号的差异。',
}));
// Official panorama topology + endpoint relief + slope-length cross-check.
// Preserve runtime IDs: equipment geometry and user-corrected support positions use them.
const officialLiftNumbers = { 1: 1, 2: 2, 4: 4, 5: 5, 6: 6, 7: 8, 9: 7 };
for (const lift of lifts) {
  const number = officialLiftNumbers[lift.id];
  lift.officialNumber = number || null;
  if (number) {
    const info = officialLiftInfo.find((r) => r.number === number);
    lift.name = number + '号索道';
    lift.stationBadge = String(number);
    lift.type = info.type;
    lift.capacity = info.capacity;
    lift.length = info.length;
    lift.drop = info.drop;
    lift.speed = info.speed;
    lift.flow = info.flow;
    lift.hours = info.winterHours;
    lift.conflict = null;
    lift.numberSource = 'official-panorama-2026.09-topology-and-endpoints';
  } else {
    lift.name = '西侧索道';
    lift.stationBadge = '西';
    lift.capacity = lift.length = lift.drop = lift.speed = lift.flow = null;
    lift.hours = '以现场公告为准';
  }
}
const officialMagicCarpets = ['卧龙道', '学校教学区', '室内旱雪区', '娇龙道公园', '银龙道公园'];
