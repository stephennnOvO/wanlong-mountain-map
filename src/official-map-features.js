// Official 2026.09 panorama: names and amenities, independently from geographic geometry.
const officialMapFeatures = (() => {
  const records = [],
    add = (name, category, note, action = null) =>
      records.push({ id: records.length, name, category, note, action });
  const original = () => openReference('trail');
  const region =
    (point, radius = 650) =>
    () => {
      exitExperience(false);
      desired.target.copy(point);
      desired.radius = radius;
      desired.phi = 0.9;
    };
  const summit = summitFacilities.find((f) => f.id === 'summit-cafe');
  add('万龙木屋', '地点', '官方图山顶木屋；沿用现有木屋参考锚点。', () => selectSummitFacility(13));
  add(
    '万茏 WANMONT',
    '地点',
    '官方图山顶品牌标识。可查看山顶区域；尚未把该品牌与某一个 OSM 建筑轮廓强行绑定。',
    summit ? region(summit.center, 500) : null,
  );
  add(
    '星空房车',
    '地点',
    '官方图标在山顶索道站群旁。房车场独立轮廓和入口尚未定位，可查看山顶区域。',
    summit ? region(summit.center, 650) : null,
  );
  add(
    '八角亭休息亭',
    '地点',
    '位于官方图长龙、短龙一带的休息亭；没有可独立核验的亭体坐标，保留原图标识。',
  );
  add(
    '聚龙殿',
    '地点',
    '官方图标在龙宫酒店上方主服务区；这里只定位服务区，楼内入口和独立占地待核实。',
    region(hotels.find((h) => h.id === 1).modelCenter, 430),
  );
  const lift5 = lifts.find((l) => l.id === 5 && l.runtime);
  add(
    '汇龙殿',
    '地点',
    '官方图五、六索山脚服务区标识。这里只定位站群区域，不新建猜测楼体。',
    lift5 ? region(lift5.runtime.cablePoint(0), 650) : null,
  );
  for (const h of hotels)
    add(
      h.id === 3 ? '万龙公寓（国际公寓）' : h.id === 4 ? '主题酒店（公寓楼群）' : h.name,
      '住宿',
      h.id === 6
        ? '官方图在公寓群下列出悦龙酒店；独立入口尚未定位，查看原图。'
        : '沿用已有建筑锚点。图中设施图标表示该住宿区域配套，不是各房间、服务入口的测绘坐标。',
      h.id !== 6 ? () => selectHotel(h.id) : null,
    );
  for (const name of ['双龙室外停车场', '龙宫室外停车场', '室外停车场（汇龙区域）'])
    add(
      name,
      '停车与道路',
      '官方图明确标注停车区；实际停车场边界、出入口和通行路线尚未测绘，不恢复侵入雪道的估计前场。',
    );
  add(
    '万龙自行车道入口',
    '入口',
    '官方图山顶木屋附近标注骑行入口方向；精确入口与季节开放以现场指引为准。',
  );
  add(
    '万龙滑雪场 / 红花梁隧道连接方向',
    '入口',
    '官方图右下方公路与红花梁隧道箭头；不据透视图新建道路或隧道入口。',
  );
  add(
    '单板练习区',
    '专项区域',
    '官方图粉色网格区，位于卧龙附近。现有资料未给出测绘边界，查看原图；不把整条卧龙涂成练习区。',
  );
  for (const id of [4, 6, 7]) {
    const item = LANDSCAPE_ITEMS.find((i) => i.id === id);
    if (item)
      add(
        item.name,
        '专项区域',
        '官方图地形公园图例及已有官方公园所属雪道资料；障碍布局沿用已确认模型。',
        () => selectLandscape(id),
      );
  }
  for (const id of [9, 10, 11]) {
    const item = LANDSCAPE_ITEMS.find((i) => i.id === id);
    if (item)
      add(
        item.name,
        '专项区域',
        '官方 U 形谷类别；沿用既有官方攻略的出入口关系和地形参考，不据图标重做雪道高程。',
        () => selectLandscape(id),
      );
  }
  for (const zone of wildZones)
    add(
      '野雪 ' + zone.id + ' 区',
      '野雪分区',
      '官方 A–U 分区；按相邻雪道与林缘说明区域关系，边界为示意。' + zone.topology + '。',
      () => selectWildZone(zone.id),
    );
  for (const bike of bikeRoutes)
    add(
      bike.name,
      '自行车道',
      '官方图橙色自行车道参考，可查看原图线路与邻近区域。三维轨迹尚未独立确认，不沿用旧距离插值。',
      () => selectBikeRoutes(bike.id),
    );
  const services = [
    '信息服务',
    '售票处',
    '公路',
    '停车场',
    '会议室',
    '洗浴',
    '儿童乐园',
    '酒吧',
    '热水',
    '酒店',
    '咖啡',
    '救护中心',
    '洗手间',
    '雪具',
    '室外停车场',
    '健身房',
    'SPA',
    '中餐厅',
    '火锅',
    '休息区',
    '快餐',
    '汉堡',
    '打卡点',
    '自动机售票',
    '魔毯',
  ];
  for (const name of services)
    add(
      name,
      '服务图例',
      '2026.09 官方图图例项目。图中服务符号主要依附山顶、酒店和服务大厅，不把符号转换为未经核实的独立入口坐标。',
    );
  // Append official tables without changing existing record IDs / map pins.
  for (const lift of officialLiftInfo) {
    add(
      lift.name + ' · 官方参数表',
      '官方索道表',
      (lift.type === 'gondola' ? '吊厢' : '吊椅') +
        ' · ' +
        lift.capacity +
        '人；长度 ' +
        lift.length +
        '米；垂直落差 ' +
        lift.drop +
        '米；最高运行速度 ' +
        lift.speed +
        '米/秒；运力 ' +
        lift.flow +
        '人/小时；冬季 ' +
        lift.winterHours +
        '；夏季 ' +
        lift.summerHours +
        '。' +
        lift.note +
        ([4, 8].includes(lift.number)
          ? ' 此官方编号与 OSM 线路的对应尚未核实，不强行绑定三维线路。'
          : ''),
    );
    records.at(-1).sourceRegion = { x: 0.81, y: 0.82, scale: 5 };
  }
  for (const area of officialMagicCarpets) {
    add(
      '魔毯 · ' + area,
      '官方魔毯表',
      area === '室内旱雪区' ? '室内练习区的上坡输送带。' : '沿练习区上行的输送带。',
    );
    const model = magicCarpetRecords.find((r) => r.area === area);
    if (model) {
      const record = records.at(-1);
      record.mapAnchor = model.samples[Math.floor(model.samples.length / 2)].toArray();
      record.mapEntry = { type: 'existing-conveyor-label' };
    }
  }
  for (const r of records)
    if (r.category === '官方索道表') {
      const number = Number(r.name.match(/\d+/)?.[0]),
        lift = lifts.find((l) => l.officialNumber === number),
        info = officialLiftInfo.find((item) => item.number === number);
      r.name = number + '号索道';
      r.officialLiftNumber = number;
      if (lift) {
        r.action = () => selectItem('lift', lift.id);
        delete r.sourceRegion;
      } else
        r.guestDescription = `${info.capacity} 人${info.type === 'gondola' ? '吊厢' : '吊椅'}，全长 ${info.length} 米，垂直落差 ${info.drop} 米。雪道图所列冬季时段为 ${info.winterHours}，实际运营以雪场公告为准。`;
    }
  // Normalized coordinates refer to the displayed landscape source page,
  // including its header and parameter tables; they are NOT geographic points.
  const sourceRegions = {
    万龙木屋: [0.495, 0.235, 5],
    '万茏 WANMONT': [0.55, 0.23, 5],
    星空房车: [0.64, 0.25, 5],
    八角亭休息亭: [0.213, 0.45, 4],
    聚龙殿: [0.637, 0.628, 5],
    汇龙殿: [0.754, 0.63, 5],
    悦龙酒店: [0.487, 0.73, 5],
    单板练习区: [0.472, 0.58, 5],
    双龙室外停车场: [0.342, 0.686, 5],
    龙宫室外停车场: [0.52, 0.665, 5],
    '室外停车场（汇龙区域）': [0.819, 0.612, 5],
    万龙自行车道入口: [0.498, 0.268, 5],
    '万龙滑雪场 / 红花梁隧道连接方向': [0.9, 0.65, 4],
  };
  for (const r of records) {
    const q = sourceRegions[r.name] || (r.category === '服务图例' ? [0.5, 0.9, 3] : null);
    if (q) r.sourceRegion = { x: q[0], y: q[1], scale: q[2] };
  }
  for (const [name, p] of [
    ['聚龙殿', hotels.find((h) => h.id === 1).modelCenter],
    ['汇龙殿', lift5?.runtime.cablePoint(0)],
  ]) {
    const item = records.find((r) => r.name === name);
    if (p && item)
      labelData.push({
        text: name + ' · 区域参考',
        p: p.clone().add(new V(0, 58, 0)),
        officialFeatureId: item.id,
        maxDistance: 1400,
      });
  }
  add('腾龙道上段', '连接标识', '银龙道旁的连接标识。');
  records.at(-1).sourceRegion = { x: 0.58, y: 0.34, scale: 5 };
  add('连接8号索道', '连接标识', '雪道图右下方标注的连接方向。');
  records.at(-1).sourceRegion = { x: 0.8, y: 0.57, scale: 5 };
  // Point labels express regional correspondence, never surveyed boundaries.
  const layer = { visible: true },
    coverage = [];
  let activeGroup = null;
  const atTrail = (name, t = 0.5) => {
    const q = trails.find((q) => q.name === name && q.curve);
    return q ? q.curve.getPoint(t) : null;
  };
  const pin = (r, p, kind = '区域参考') => {
    if (!p) return;
    const q = p.clone();
    q.y = displayGroundHeightAt(q.x, q.z) + 28;
    labelData.push({
      text: r.name + (kind ? ' · ' + kind : ''),
      p: q,
      officialFeatureId: r.id,
      officialLayer: true,
      wild: r.category === '野雪分区' ? r.name.match(/野雪 (.+) 区/)?.[1] : undefined,
      maxDistance: kind === '示意' ? 1800 : 2200,
    });
    r.mapAnchor = q.toArray();
    coverage.push(r.id);
  };
  for (const z of wildZones) {
    const r = records.find((r) => r.name === '野雪 ' + z.id + ' 区');
    let p = z.center ? new V(z.center[0], 0, z.center[1]) : null;
    if (!p && z.candidatePoints?.length) {
      const c = wildInteriorPoint(z.candidatePoints);
      p = new V(c[0], 0, c[1]);
    }
    if (!p) {
      const neighbours = z.adjacentTrails
        .map((id) => trails.find((t) => t.id === id && t.curve))
        .filter(Boolean);
      if (neighbours.length)
        p = neighbours
          .reduce((s, t) => s.add(t.curve.getPoint(0.5)), new V())
          .multiplyScalar(1 / neighbours.length);
    }
    pin(r, p, '示意');
  }
  for (const valley of naturalValleys) {
    const r = records.find((r) => r.name.includes(valley.name)),
      p = valley.samples[Math.floor(valley.samples.length / 2)];
    if (r) pin(r, new V(p.x, 0, p.z));
  }
  const hotelPoint = (id) => hotels.find((h) => h.id === id)?.modelCenter;
  const anchors = {
    '万茏 WANMONT': summit?.center,
    星空房车: summit?.center?.clone().add(new V(45, 0, 35)),
    八角亭休息亭: atTrail('短龙道', 0.65),
    单板练习区: atTrail('卧龙道', 0.55),
    双龙室外停车场: hotelPoint(2)
      ?.clone()
      .add(new V(40, 0, 30)),
    龙宫室外停车场: hotelPoint(1)
      ?.clone()
      .add(new V(45, 0, 35)),
    '室外停车场（汇龙区域）': lift5?.runtime
      .cablePoint(0)
      ?.clone()
      .add(new V(35, 0, 35)),
    悦龙酒店: hotelPoint(6),
    万龙自行车道入口: summit?.center?.clone().add(new V(-45, 0, 35)),
    腾龙道上段: atTrail('腾龙道', 0.2),
    连接8号索道: atTrail('娇龙道', 0.8),
    '万龙滑雪场 / 红花梁隧道连接方向': hotelPoint(1)
      ?.clone()
      .add(new V(140, 0, 120)),
  };
  for (const r of records) {
    if (anchors[r.name]) pin(r, anchors[r.name]);
    else if (r.category === '专项区域' && !r.mapAnchor) {
      const trail = r.name.includes('娇龙')
        ? '娇龙道'
        : r.name.includes('银龙')
          ? '银龙道'
          : r.name.includes('猛龙')
            ? '猛龙道'
            : null;
      if (trail) pin(r, atTrail(trail));
    }
  }
  // Complete point coverage using existing model anchors; no room coordinates
  // or bicycle route geometry are inferred from the illustrative source page.
  for (const h of hotels) {
    const r = records.find(
      (r) =>
        r.category === '住宿' &&
        (r.name === h.name ||
          (h.id === 3 && r.name === '万龙公寓（国际公寓）') ||
          (h.id === 4 && r.name === '主题酒店（公寓楼群）')),
    );
    if (r && !r.mapAnchor) {
      r.mapAnchor = h.modelCenter.toArray();
      r.mapEntry = { type: 'existing-hotel-label', hotelId: h.id };
    }
  }
  for (const name of ['万龙木屋', '聚龙殿', '汇龙殿']) {
    const r = records.find((r) => r.name === name),
      p =
        name === '万龙木屋'
          ? summit?.center
          : name === '聚龙殿'
            ? hotelPoint(1)
            : lift5?.runtime.cablePoint(0);
    if (r && p) {
      r.mapAnchor = p.toArray();
      r.mapEntry = { type: 'existing-place-label' };
    }
  }
  for (let i = 0; i < bikeRoutes.length; i++) {
    const bike = bikeRoutes[i],
      r = records.find((r) => r.category === '自行车道' && r.name === bike.name),
      z = wildZones.find((z) => z.id === ['A', 'E', 'F'][i]),
      zoneRecord = records.find((r) => r.name === '野雪 ' + z?.id + ' 区');
    if (r && zoneRecord?.mapAnchor) pin(r, new V(...zoneRecord.mapAnchor), '原图线路入口');
  }
  const groups = [];
  const group = (name, category, p, names) => {
    const members = records
      .filter((r) => (names ? names.includes(r.name) : r.category === category))
      .map((r) => r.id);
    if (!members.length || !p) return;
    add(
      name,
      '图上组合标注',
      '点击查看此组每个官方图例及原图位置；本标注是查阅入口，不表示所有服务设施均位于锚点。',
    );
    const r = records.at(-1);
    r.memberIds = members;
    pin(r, p, '图例入口');
    groups.push(r.id);
    for (const id of members)
      records[id].mapEntry = { type: 'group-label', groupId: r.id, groupName: name };
  };
  group('酒店餐饮与休闲服务', '服务图例', hotelPoint(2), [
    '会议室',
    '洗浴',
    '儿童乐园',
    '酒吧',
    '酒店',
    '咖啡',
    '健身房',
    'SPA',
    '中餐厅',
    '火锅',
    '快餐',
    '汉堡',
  ]);
  group('服务大厅与交通图例', '服务图例', hotelPoint(1), [
    '信息服务',
    '售票处',
    '公路',
    '停车场',
    '热水',
    '救护中心',
    '洗手间',
    '雪具',
    '室外停车场',
    '休息区',
    '打卡点',
    '自动机售票',
    '魔毯',
  ]);
  group('索道', '官方索道表', lift5?.runtime.cablePoint(0.12));
  add('各区魔毯', '官方魔毯表', '查看各练习区和公园的魔毯。');
  // Missing GIS routes still have a clickable on-map regional entry, explicitly
  // distinguished from a fabricated route centreline.
  for (const t of trails.filter((t) => !t.mapped)) {
    const p = atTrail(t.name === '雾龙道' ? '霜龙道' : '黄龙道', t.name === '雾龙道' ? 0.15 : 0.75);
    if (p) {
      p.y = displayGroundHeightAt(p.x, p.z) + 35;
      labelData.push({
        text: String(t.mapRef).padStart(2, '0') + ' ' + t.name + ' · 原图区域',
        trail: t.id,
        p,
        officialLayer: true,
        maxDistance: 1800,
      });
    }
  }
  const dining = LANDSCAPE_ITEMS.find((i) => i.id === 14);
  if (dining) {
    add('双龙自助与龙景轩', '餐饮参考', '双龙自助晚餐、龙景轩早餐与下午茶。', () => selectDining());
    const record = records.at(-1);
    record.opensPanel = true;
    record.actionLabel = '查看餐饮';
    pin(record, hotelPoint(2));
  }
  add(
    '雪具大厅楼层配套',
    '服务配套',
    '医疗中心、文创店、儿童剧场、阳光大食堂、万龙小火锅、万龙咖啡及VIP休息区，按官方楼层关系列出，不虚构室内坐标。',
    () => selectLandscape(12),
  );
  pin(records.at(-1), hotelPoint(1));
  for (const r of records)
    if (r.mapAnchor && !r.mapEntry)
      r.mapEntry = { type: r.memberIds ? 'group-label-root' : 'point-label' };
  for (const r of records)
    if (r.name === '魔毯' || r.name === '各区魔毯' || r.name.startsWith('魔毯 · ')) {
      delete r.sourceRegion;
      r.action = () => showMagicCarpetArea(r.name.startsWith('魔毯 · ') ? r.name.slice(5) : null);
      r.actionLabel = '查看魔毯';
      r.category = '魔毯';
    }
  const placeDescriptions = {
    万龙木屋: '位于山顶的木屋休憩点。',
    星空房车: '雪道图标注在山顶索道站群附近，可查看周边区域。',
    '万茏 WANMONT': '位于山顶，可查看周边区域。',
    聚龙殿: '龙宫酒店一带的山脚服务区。',
    汇龙殿: '五号、六号索道山脚站一带的服务区。',
  };
  for (const r of records) {
    if (placeDescriptions[r.name]) r.guestDescription = placeDescriptions[r.name];
    else if (
      r.action &&
      ['住宿', '专项区域', '野雪分区', '自行车道', '服务配套', '地点'].includes(r.category)
    )
      r.opensPanel = true;
  }
  const control = document.createElement('button');
  control.id = 'official-label-layer';
  control.className = 'source-link';
  control.textContent = '官方区域标注：显示';
  control.setAttribute('aria-pressed', 'true');
  control.onclick = () => {
    layer.visible = !layer.visible;
    control.textContent = '官方区域标注：' + (layer.visible ? '显示' : '隐藏');
    control.setAttribute('aria-pressed', String(layer.visible));
  };
  $('legend-panel').querySelector('.key-actions').append(control);
  // The remaining service symbols are attached to their shared official legend,
  // rather than invented room coordinates. A persistent map control opens it.
  const sourceControl = document.createElement('button');
  sourceControl.id = 'official-label-source';
  sourceControl.className = 'source-link';
  sourceControl.textContent = '全部官方图标注 ↗';
  sourceControl.onclick = () => openReference('trail');
  $('legend-panel').querySelector('.key-actions').append(sourceControl);
  // Complete the missing existing hotel pin, without shifting its source model.
  const sheng = hotels.find((h) => h.id === 5);
  if (sheng && !labelData.some((l) => l.hotel === 5))
    labelData.push({
      text: '盛龙公寓',
      hotel: 5,
      p: sheng.modelCenter.clone().add(new V(0, 40, 0)),
      maxDistance: 1900,
    });
  const style = document.createElement('style');
  style.textContent = `.official-features{position:fixed;z-index:65;right:24px;top:90px;bottom:100px;width:min(420px,calc(100vw - 32px));padding:20px;box-sizing:border-box;border-radius:16px;display:flex;flex-direction:column;gap:12px;color:#29474b;background:rgba(247,250,249,.97);box-shadow:0 15px 65px #203d4933}.official-features[hidden]{display:none}.official-features h2{font-size:20px;margin:0}.official-features p{font-size:12px;line-height:1.7;margin:0}.official-features input,.official-features select{border:1px solid #c6d4d1;background:white;padding:10px;border-radius:8px;min-width:0;font:inherit;color:inherit}.official-features-controls{display:flex;gap:7px}.official-features-controls input{flex:1}.official-features-results{overflow:auto;flex:1;min-height:0}.official-feature{display:block;text-align:left;width:100%;padding:12px;border:0;border-bottom:1px solid #d9e2df;background:transparent;color:inherit;cursor:pointer}.official-feature strong{display:block;font-size:13px;margin-bottom:4px}.official-feature span{font-size:11px;line-height:1.6;display:block}.official-feature:hover,.official-feature:focus-visible{background:#e9f1ed}.official-feature small{display:block;color:#52766c;margin-top:5px}.official-feature-summary{font-size:11px;color:#54716e}@media(max-width:760px){.official-features{top:65px;bottom:80px;right:16px;padding:15px}.official-features-controls{flex-wrap:wrap}}`;
  document.head.append(style);
  const panel = document.createElement('section');
  panel.id = 'official-features-panel';
  panel.className = 'official-features';
  panel.hidden = true;
  panel.setAttribute('aria-label', '2026.09 官方图标识目录');
  panel.innerHTML =
    '<div class="settings-heading"><h2>官方图标识</h2><button id="official-features-close" class="source-link">收起 ×</button></div><p>2026.09 版 · 地点、专项区域与服务图例。已匹配的项目可查看现有模型；其他项目查看官方原图。</p><div class="official-features-controls"><input id="official-features-search" type="search" placeholder="搜索：单板、热水、汇龙…" aria-label="搜索官方图标识"><select id="official-features-category" aria-label="筛选官方标识分类"><option value="">全部分类</option>' +
    [...new Set(records.map((r) => r.category))].map((c) => '<option>' + c + '</option>').join('') +
    '</select></div><div id="official-features-summary" class="official-feature-summary" role="status"></div><div id="official-features-results" class="official-features-results"></div><button class="secondary" id="official-features-original">查看高清官方原图</button>';
  document.body.append(panel);
  const back = document.createElement('button');
  back.id = 'official-features-back';
  back.className = 'secondary';
  back.textContent = '‹ 返回全部标识';
  back.hidden = true;
  panel.querySelector('.settings-heading').after(back);
  const search = $('official-features-search'),
    filter = $('official-features-category');
  const scroll = () => panel.querySelector('.panel-scroll') || panel;
  let previousGroupView = null;
  back.onclick = () => {
    const group = activeGroup;
    activeGroup = null;
    search.value = previousGroupView?.query || '';
    filter.value = previousGroupView?.category || '';
    render();
    scroll().scrollTop = previousGroupView?.top || 0;
    previousGroupView = null;
    panel.querySelector('[data-feature="' + group + '"]')?.focus({ preventScroll: true });
  };
  function showSource(record) {
    const region = record.sourceRegion;
    if (region) focusOfficialMapRegion(region.x, region.y, region.scale);
    else original();
  }
  function show(id) {
    const r = records.find((r) => r.id === Number(id));
    if (!r) return;
    if ((r.officialLiftNumber || r.opensPanel || r.category === '魔毯') && r.action) {
      r.action();
      return;
    }
    if (r.memberIds) {
      previousGroupView = { query: search.value, category: filter.value, top: scroll().scrollTop };
      activeGroup = r.id;
      panel.hidden = false;
      search.value = '';
      filter.value = '';
      render();
      scroll().scrollTop = 0;
      back.focus({ preventScroll: true });
      return;
    }
    if (DELIVERY_MODE) {
      if (r.action || r.guestDescription) showGuestFacility(r);
      else showSource(r);
      return;
    }
    panel.hidden = true;
    if (r.sourceRegion || !r.action) showSource(r);
    else r.action();
  }
  function actionLabel(r) {
    if (!DELIVERY_MODE)
      return r.sourceRegion
        ? '定位官方图局部'
        : r.action
          ? '查看现有模型 / 参考区域'
          : '查看官方图标识';
    if (r.memberIds) return '展开分类';
    return r.actionLabel || (r.action || r.guestDescription ? '查看详情' : '查看雪道图');
  }
  function render() {
    back.hidden = activeGroup === null;
    panel.querySelector('h2').textContent =
      activeGroup === null
        ? DELIVERY_MODE
          ? '设施与服务'
          : '官方图标识'
        : records[activeGroup].name;
    const q = search.value.trim().toLowerCase(),
      category = filter.value;
    const group =
      activeGroup === null ? records : records[activeGroup].memberIds.map((id) => records[id]);
    const shown = group.filter(
      (r) =>
        (!category || r.category === category) &&
        (!q ||
          (r.name + ' ' + r.category + ' ' + (DELIVERY_MODE ? r.guestDescription || '' : r.note))
            .toLowerCase()
            .includes(q)),
    );
    $('official-features-summary').textContent = shown.length
      ? '显示 ' + shown.length + ' / ' + group.length + ' 项'
      : '没有匹配的设施，请更换关键词或分类。';
    $('official-features-results').innerHTML = shown
      .map(
        (r) =>
          '<div><button class="official-feature" data-feature="' +
          r.id +
          '"><strong>' +
          r.name +
          '</strong><span>' +
          r.note +
          '</span><small>' +
          r.category +
          ' · ' +
          actionLabel(r) +
          '</small></button>' +
          (!DELIVERY_MODE && r.sourceRegion && r.action
            ? '<button class="source-link" data-feature-model="' +
              r.id +
              '">查看现有模型 / 参考区域 ↗</button>'
            : '') +
          '</div>',
      )
      .join('');
    $('official-features-results')
      .querySelectorAll('[data-feature]')
      .forEach((b) => (b.onclick = () => show(b.dataset.feature)));
    $('official-features-results')
      .querySelectorAll('[data-feature-model]')
      .forEach(
        (b) =>
          (b.onclick = () => {
            panel.hidden = true;
            records[Number(b.dataset.featureModel)].action();
          }),
      );
  }
  function open() {
    activeGroup = null;
    previousGroupView = null;
    panel.hidden = false;
    render();
    scroll().scrollTop = 0;
  }
  $('official-features-search').oninput = render;
  $('official-features-category').onchange = render;
  $('official-features-close').onclick = () => (panel.hidden = true);
  $('official-features-original').onclick = original;
  if ($('official-features-open')) $('official-features-open').onclick = open;
  if ($('official-map-open')) $('official-map-open').onclick = original;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') panel.hidden = true;
  });
  return {
    version: '2026.09',
    records,
    open,
    show,
    labelLayer: layer,
    labelCoverage: coverage,
    coverageManifest: () =>
      records.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        anchor: r.mapAnchor || null,
        entry: r.mapEntry || null,
        members: r.memberIds || [],
      })),
    trailLabelManifest: () =>
      trails.map((t) => ({
        id: t.id,
        name: t.name,
        number: t.mapRef,
        mapped: t.mapped,
        labels: labelData
          .filter((l) => l.trail === t.id)
          .map((l) => ({ text: l.text, anchor: l.p.toArray() })),
      })),
  };
})();
