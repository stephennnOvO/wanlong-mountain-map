// Script loading also works for direct file:// entry without image/WebGL CORS failures.
function loadOfflineMosaic(url) {
  const texture = new THREE.Texture(),
    script = document.createElement('script');
  script.src = url;
  script.onload = () => {
    const img = new Image();
    img.onload = () => {
      texture.image = img;
      texture.needsUpdate = true;
      delete window.__WANLONG_MOSAIC__;
      script.remove();
    };
    img.src = window.__WANLONG_MOSAIC__;
  };
  script.onerror = () => {
    toast('影像加载失败，请检查文件夹是否完整。');
    script.remove();
  };
  document.head.append(script);
  return texture;
}
const currentTrailMetricCache = new WeakMap();
function currentTrailMetrics(trail) {
  const source = trail.displayPoints || trail.points;
  const cached = currentTrailMetricCache.get(trail);
  if (cached?.source === source) return cached;
  const points = source.map((p) => new V(p.x, displayGroundHeightAt(p.x, p.z), p.z));
  let length = 0,
    min = Infinity,
    max = -Infinity;
  for (let i = 0; i < points.length; i++) {
    min = Math.min(min, points[i].y);
    max = Math.max(max, points[i].y);
    if (i) length += points[i].distanceTo(points[i - 1]);
    points[i].routeDistance = length;
  }
  const result = {
    source,
    points,
    length,
    min: min + GEO.baseElevation,
    max: max + GEO.baseElevation,
  };
  currentTrailMetricCache.set(trail, result);
  return result;
}
function coordinateSourceLink(ids) {
  return ids
    .map(
      (id) =>
        '<a class="source-link" href="https://www.openstreetmap.org/' +
        id +
        '" target="_blank" rel="noopener">OSM ' +
        id +
        ' ↗</a>',
    )
    .join('');
}
function selectUnmappedTrail(id) {
  clearSelection();
  setSurfaceSelection(null);
  const t = trails.find((t) => t.id === id);
  state.selected = { kind: 'trail', id };
  const d = $('detail');
  d.hidden = false;
  d.innerHTML =
    '<div class="detail-top"><div class="eyebrow">SOURCE RECORD</div><button class="close" aria-label="关闭详情">×</button></div><h2>' +
    String(t.mapRef).padStart(2, '0') +
    ' ' +
    t.name +
    '</h2><div class="badge">' +
    trailGrade(t).symbol +
    ' ' +
    trailGrade(t).label +
    ' · 坐标待核实</div><div class="data-grid">' +
    cell('资料长度', t.length, 'm') +
    cell('最高海拔', t.alt ?? '—', t.alt ? 'm' : '') +
    cell('平均坡度', t.avg ?? '—', t.avg ? '°' : '') +
    cell('最大坡度', t.max ?? '—', t.max ? '°' : '') +
    '</div><p class="detail-note">官方2026.09图收录此雪道，可查看图中位置与相邻路线。当前没有独立GIS中心线，三维场景不另造滑行轨迹。</p><a class="source-link" href="' +
    SOURCE +
    '" target="_blank" rel="noopener">查看参数表与原图 ↗</a>';
  d.querySelector('.close').onclick = () => (d.hidden = true);
  const sourceButton = document.createElement('button');
  sourceButton.className = 'secondary';
  sourceButton.id = 'unmapped-official-location';
  sourceButton.textContent = '定位官方图雪道 ↗';
  sourceButton.onclick = () => {
    const q =
      t.name === '雾龙道' ? [0.595, 0.31] : t.name === '赤龙道' ? [0.89, 0.58] : [0.5, 0.45];
    focusOfficialMapRegion(q[0], q[1], 6);
  };
  d.append(sourceButton);
  if (innerWidth <= 760) $('sidebar').classList.add('mobile-hidden');
  renderList();
}
function addStationViews(l, d) {
  d.insertAdjacentHTML('beforeend', officialLiftTableMarkup(l));
  const sourceButton = d.querySelector('[data-official-lift-source]');
  if (sourceButton) sourceButton.onclick = () => focusOfficialMapRegion(0.83, 0.82, 5);
  const group = document.createElement('div');
  group.className = 'station-views';
  group.innerHTML =
    '<div class="profile-title"><span>站房建筑观察</span><span>参考重建</span></div><div class="guide-actions"><button class="secondary" id="station-lower">山脚站近景</button><button class="secondary" id="station-upper">山上站近景</button></div><p class="detail-note">已复核进出站绳路、下托/上压轮组与站内速度。山顶主站群参考实拍增加下层站厅，塔型、尺寸及逐站楼体归属仍为估计。未取得施工图，平面中心线保留 OSM 坐标。</p>';
  d.append(group);
  group.insertAdjacentHTML(
    'beforeend',
    '<a class="source-link" href="research/support-layout-review.html" target="_blank">全部索道 · 支架位置与间距复核 ↗</a>',
  );
  const photo = document.createElement('button');
  photo.className = 'source-link';
  photo.textContent = '官方山顶站群实拍参考 ↗';
  photo.onclick = () =>
    sourcePhoto(
      'station-photo-data',
      '山顶索道站群 · 官方照片',
      '来源：万龙度假天堂订阅号，2026.09.11。照片有多组终端、站房和独立建筑；未获得指北、站房编号及尺寸，不能把整组建筑当作一个简单站房，也不据透视位置推断精确坐标。',
    );
  group.append(photo);
  for (const [id, t] of [
    ['station-lower', 0],
    ['station-upper', 1],
  ])
    $(id).onclick = () => {
      exitExperience(false);
      const p = l.runtime.cablePoint(t);
      desired.target.copy(p).add(new V(0, -2, 0));
      desired.theta = Math.atan2(l.runtime.dir.x, l.runtime.dir.z) + 0.8;
      desired.phi = 1.08;
      desired.radius = innerWidth <= 760 ? 110 : 135;
      document.body.classList.add('exploring');
    };
}
function selectUnverifiedLift(l, focus = true) {
  if (highlightLine) {
    highlightLine.removeFromParent();
    highlightLine.geometry.dispose();
    highlightLine.material.dispose();
  }
  highlightLine = liftSelectionRibbon(l);
  pisteGroup.add(highlightLine);
  state.selected = { kind: 'lift', id: l.id };
  const d = $('detail'),
    rt = l.runtime;
  d.classList.remove('hotel-detail');
  d.hidden = false;
  d.innerHTML =
    '<div class="detail-top"><div class="eyebrow">MAPPED CABLEWAY</div><button class="close" aria-label="关闭详情">×</button></div><h2 style="font-size:23px">' +
    l.name +
    '</h2><div class="badge">坐标已收录 · 编号/参数待核验</div><div class="data-grid">' +
    cell('坐标线长', Math.round(rt.length), 'm') +
    cell('索道端点高差', Math.round(Math.abs(rt.b.y - rt.a.y)), 'm') +
    '</div><p class="detail-note">' +
    l.conflict +
    '</p><p class="detail-note">模拟使用 3 m/s 的体验速度，吊具外形、车数、站内回转和索跨垂度为演示。中心线平面位置来自 OSM，保留源支架坐标记录；原始塔位与用户确认点优先保留，已移除无来源的普通补塔；新7缺少原始逐塔坐标，当前塔位仍为模拟参考。与估读雪道面的重叠不作为随意搬动真实塔位的依据。站口过渡、塔高与站房尺寸非实测。</p><button class="primary" id="experience">▷ 沿此线乘坐体验</button>' +
    coordinateSourceLink([l.geoSource]);
  d.querySelector('.close').onclick = () => (d.hidden = true);
  $('experience').onclick = () => startLift(l);
  addStationViews(l, d);
  if (focus) {
    exitExperience(false);
    desired.target.copy(rt.a).lerp(rt.b, 0.5);
    desired.radius = 3300;
    desired.phi = 0.95;
  }
  if (innerWidth <= 760) $('sidebar').classList.add('mobile-hidden');
  renderList();
  updateLabels();
}
function floorNotesHTML(rows) {
  return rows?.length
    ? '<div class="profile-title" style="margin-top:20px"><span>楼层与配套</span><span>25/26 官方介绍</span></div><div class="facility-notes">' +
        rows
          .map(([floor, text]) => '<div><b>' + floor + '</b><span>' + text + '</span></div>')
          .join('') +
        '</div><a class="source-link" href="' +
        LAST_SEASON_SOURCE +
        '" target="_blank" rel="noopener">官方攻略 · 楼内设施关系 ↗</a>'
    : '';
}
function selectGuideItem(item) {
  exitExperience(false);
  const valley = naturalValleys.find((v) => v.guideId === item.id);
  state.selected = { kind: 'landscape', id: item.id };
  const d = $('detail');
  d.classList.remove('hotel-detail');
  d.hidden = false;
  document.body.classList.add('exploring');
  d.innerHTML =
    '<div class="detail-top"><div class="eyebrow">MOUNTAIN LIFE · 25 / 26</div><button class="close" aria-label="关闭详情">×</button></div><h2 style="font-size:23px">' +
    item.name +
    '</h2><div class="badge">' +
    item.status +
    '</div><div class="facility-notes">' +
    item.connections
      .map(([place, text]) => '<div><b>' + place + '</b><span>' + text + '</span></div>')
      .join('') +
    '</div><p class="detail-note">' +
    item.description +
    '</p>' +
    (valley
      ? '<button class="primary" id="valley-focus">查看天然沟谷地形</button><p class="detail-note">连续变宽、两侧不对称的天然凹谷参考；宽深与谷底位置为估计。' +
        valley.confidence +
        '。</p>'
      : '') +
    (item.contextTrails
      ? '<div class="profile-title"><span>查看相关雪道 · 不代表野雪谷位置</span></div><div class="guide-actions">' +
        item.contextTrails
          .map(
            (name) =>
              '<button class="secondary" data-guide-trail="' + name + '">' + name + ' ↗</button>',
          )
          .join('') +
        '</div>'
      : '') +
    '<button class="secondary" id="guide-map">查看全景原图</button><a class="source-link" href="' +
    item.source +
    '" target="_blank" rel="noopener">阅读官方攻略 · 2026.02.05 ↗</a><p class="detail-note">历史雪季资料，开放情况以现场公告为准。</p>';
  d.querySelector('.close').onclick = () => (d.hidden = true);
  $('guide-map').onclick = () => openReference('trail');
  if (valley) {
    $('valley-focus').onclick = () => focusNaturalValley(valley.id);
    focusNaturalValley(valley.id);
  }
  d.querySelectorAll('[data-guide-trail]').forEach(
    (b) =>
      (b.onclick = () => {
        const t = trails.find((t) => t.name === b.dataset.guideTrail);
        if (t) selectItem('trail', t.id);
        else toast('该文字名称尚未匹配到独立测绘线路，请参阅原图。');
      }),
  );
  if (innerWidth <= 760) $('sidebar').classList.add('mobile-hidden');
  renderList();
}
function selectLandscape(id) {
  if (typeof magicCarpetRecords !== 'undefined') {
    const carpet = magicCarpetRecords.find((r) => r.id === id);
    if (carpet) {
      showMagicCarpetArea(carpet.area);
      return;
    }
  }
  if (typeof mapFacilities !== 'undefined') {
    const target =
      id === 2
        ? mapFacilities.viewpoint
        : id === 6
          ? mapFacilities.jiao
          : id === 7
            ? mapFacilities.yin
            : null;
    if (mapFacilities.select(target?.id ?? id)) return;
  }
  if (innerWidth <= 760) setSettingsOpen(false);
  clearSelection();
  if (id === 3) {
    selectBikeRoutes();
    return;
  }
  if ([13, 15, 16].includes(id)) {
    selectSummitFacility(id);
    return;
  }
  if (id === 14) {
    selectDining();
    return;
  }
  const item = LANDSCAPE_ITEMS.find((i) => i.id === id);
  if (item.connections) {
    selectGuideItem(item);
    return;
  }
  if (item.trailId) {
    selectPark(item);
    return;
  }
  state.selected = { kind: 'landscape', id };
  const d = $('detail');
  d.classList.remove('hotel-detail');
  d.hidden = false;
  document.body.classList.add('exploring');
  d.innerHTML =
    '<div class="detail-top"><div class="eyebrow">BEYOND THE PISTES</div><button class="close" aria-label="关闭详情">×</button></div><h2 style="font-size:23px;line-height:1.5">' +
    item.name +
    '</h2><div class="badge">' +
    item.status +
    '</div><p class="detail-note" style="font-size:12px">' +
    item.description +
    '</p>' +
    (id === 1
      ? '<button class="primary" id="landscape-action">' +
        (geoOverlay.visible ? '隐藏林地边界' : '显示林地边界') +
        '</button>'
      : id === 5
        ? '<button class="primary" id="landscape-action">查看官方原图</button>'
        : id === 3
          ? '<button class="primary" id="landscape-action">查看新版原图 · 自行车道</button>'
          : id === 8
            ? '<button class="primary" id="landscape-action">查看公开项目资料</button>'
            : '<button class="primary" id="landscape-action">定位观景台</button>') +
    '<button class="secondary" id="landscape-satellite">卫星影像参考</button><p class="detail-note">野雪区的许可范围、骑行路权和公园障碍物不能由林地轮廓或卫星照片自动推断；这里清楚保留资料状态。</p><a class="source-link" href="' +
    item.source +
    '" target="_blank" rel="noopener">资料来源 ↗</a>';
  d.querySelector('.close').onclick = () => (d.hidden = true);
  $('landscape-action').onclick = () => {
    if (id === 1) {
      state.forestBoundaries = !geoOverlay.visible;
      geoOverlay.visible = state.forestBoundaries;
      $('forest-boundary-switch').setAttribute('aria-checked', String(state.forestBoundaries));
      $('landscape-action').textContent = state.forestBoundaries ? '隐藏林地边界' : '显示林地边界';
      toast(geoOverlay.visible ? '已显示当前林带边界' : '已隐藏林带边界');
    } else if (id === 5) {
      openReference('trail');
    } else if (id === 3) {
      openReference('trail');
    } else if (id === 8) {
      window.open(item.source, '_blank', 'noopener');
    } else {
      const p = posAtMap(mapPixel(item.geo));
      desired.target.copy(p);
      desired.radius = 1500;
      desired.phi = 0.9;
    }
  };
  $('landscape-satellite').onclick = () => openReference('satellite');
  if (item.geo) {
    const p = posAtMap(mapPixel(item.geo));
    desired.target.copy(p);
    desired.radius = 1900;
    desired.phi = 0.95;
  }
  if (innerWidth <= 760) $('sidebar').classList.add('mobile-hidden');
  renderList();
}
function guestParkMarkup(item) {
  const jumps =
    item.id === 4
      ? '<div class="park-jump-nav">' +
        [1, 2, 3, 4]
          .map(
            (i) => '<button class="secondary" data-park-jump="' + i + '">大跳台 ' + i + '</button>',
          )
          .join('') +
        '<button class="secondary" id="park-jib-focus">上方小道具区</button></div>'
      : '';
  return (
    '<div class="detail-top"><h2>' +
    item.name +
    '</h2><button class="close" aria-label="收起详情">×</button></div>' +
    jumps +
    '<button class="primary" id="park-focus">' +
    (item.id === 4 ? '查看公园' : '查看所属雪道') +
    '</button><button class="secondary" id="park-trail-info">雪道详情</button>'
  );
}
function selectPark(item) {
  const t = trails.find((t) => t.id === item.trailId);
  selectItem('trail', t.id, false);
  state.selected = { kind: 'landscape', id: item.id };
  setSurfaceSelection(item.id === 4 ? null : t.id, '#b18c8d');
  if (highlight) highlight.material.color.set('#b18c8d');
  if (highlightLine) {
    highlightLine.material.color.set('#a47781');
    if (item.id === 4) highlightLine.visible = false;
  }
  const d = $('detail');
  d.classList.remove('hotel-detail');
  d.hidden = false;
  d.innerHTML = DELIVERY_MODE
    ? guestParkMarkup(item)
    : '<div class="detail-top"><div class="eyebrow">TERRAIN PARK · 26 / 27</div><button class="close" aria-label="关闭详情">×</button></div><h2 style="font-size:23px;line-height:1.4">' +
      item.name +
      '</h2><div class="badge">官方已确认所属雪道</div><button class="park-photo" id="park-photo-open" aria-label="放大官方公园配图"><img alt="' +
      item.name +
      '官方施工或场地配图" src="' +
      document.querySelector('[data-park-photo="' + item.photo + '"]').src +
      '"></button><div class="profile-title" style="margin-top:7px"><span>万龙度假天堂订阅号</span><span>2026.08.18</span></div><p class="detail-note" style="font-size:11px">' +
      item.description +
      '</p><p class="detail-note">' +
      (item.id === 4
        ? '四组按航拍收紧排列：第一座不动，第4座Knuckle与调整前第3座位置重合，组距90米改为60米，12米主台保留。收回覆盖柱脚的过宽公园雪面；雪道中心线、索线、其余塔位与全部类型保留；1/4模拟塔按用户最新标点另行沿索线向山脚纠正。形态按照片参考，运行工况尚未校核通过。'
        : '三维色带强调所属雪道，未公开的障碍布局仍待核实。') +
      '</p>' +
      (item.id === 4
        ? '<button class="park-photo" id="park-user-photo" aria-label="查看你提供的猛龙公园现场参考"><img src="' +
          $('park-user-data').src +
          '" alt="用户提供的猛龙公园现场视频画面：宽台、侧坡和信号设备"></button><p class="detail-note">你提供的现场视频 · 秋季土台参考</p>'
        : '') +
      (item.id === 4
        ? '<div class="park-ref-grid">' +
          [
            [2, '上段道具区'],
            [3, '四组大跳台'],
            [8, '双起跳坡'],
          ]
            .map(
              ([i, title]) =>
                '<button class="park-photo" data-park-extra="' +
                i +
                '"><img src="' +
                $('park-extra-' + i).src +
                '" alt="' +
                title +
                '，用户提供的猛龙公园参考截图"><span>' +
                title +
                '</span></button>',
            )
            .join('') +
          '</div><p class="detail-note">15m为用户提供的跳台级别参考，按起跳至落地台肩的水平尺度表现；具体台高、两条起跳坡的角度和间距为视觉估算。</p><div class="park-jump-nav">' +
          [1, 2, 3, 4]
            .map(
              (i) =>
                '<button class="secondary" data-park-jump="' + i + '">大跳台 ' + i + '</button>',
            )
            .join('') +
          '<button class="secondary" id="park-jib-focus">上方小道具区</button></div>'
        : '') +
      (item.id === 4
        ? '<p class="detail-note">冬季造型参考：<a href="https://www.schneestern.com/produkte/snowparks/" target="_blank" rel="noopener">Schneestern 公园实景</a> · <a href="https://www.snowplayground.net/school" target="_blank" rel="noopener">跳台结构图解</a>。仅用于理解雪塑形态，万龙的四组布局来自你提供的截图。</p>'
        : '') +
      '<button class="primary" id="park-focus">' +
      (item.id === 4 ? '⌕ 查看猛龙公园三维形态' : '⌕ 查看所属雪道') +
      '</button><button class="secondary" id="park-trail-info">雪道参数与沿道体验</button><a class="source-link" href="' +
      item.source +
      '" target="_blank" rel="noopener">阅读官方公园文章 ↗</a>';
  d.querySelector('.close').onclick = () => (d.hidden = true);
  function focus() {
    if (item.id === 4) {
      focusMenglongPark();
      return;
    }
    exitExperience(false);
    desired.target.copy(t.curve.getPoint(0.5)).add(new V(0, 30, 0));
    desired.radius = Math.max(1200, Math.min(2900, t.modelLength * 1.6));
    desired.phi = 0.99;
    desired.theta = 0.03;
  }
  focus();
  $('park-focus').onclick = focus;
  if ($('park-jib-focus')) $('park-jib-focus').onclick = () => focusMenglongPark('jib');
  d.querySelectorAll('[data-park-jump]').forEach(
    (b) => (b.onclick = () => focusMenglongPark(Number(b.dataset.parkJump))),
  );
  d.querySelectorAll('[data-park-extra]').forEach(
    (b) =>
      (b.onclick = () => {
        $('reference-title').textContent = '猛龙公园 · ' + b.innerText;
        $('reference-image').src = $('park-extra-' + b.dataset.parkExtra).src;
        $('reference-caption').textContent =
          '用户补充的现场截图。上段道具区、四组大跳台及双起跳坡作为形态依据；画面不提供测绘坐标或精确尺寸。';
        $('reference-modal').hidden = false;
        $('reference-close').focus();
      }),
  );
  if ($('park-user-photo'))
    $('park-user-photo').onclick = () => {
      $('reference-title').textContent = '猛龙公园 · 你提供的现场参考';
      $('reference-image').src = $('park-user-data').src;
      $('reference-caption').textContent =
        '来自你提供的视频画面。可核对连续台面、侧坡、低位旁路、灰杆与蓝色防撞包；这是无积雪季节的现场参考，不能据单帧推算真实尺寸。';
      $('reference-modal').hidden = false;
      $('reference-close').focus();
    };
  $('park-trail-info').onclick = () => selectItem('trail', t.id);
  if ($('park-photo-open'))
    $('park-photo-open').onclick = () => {
      $('reference-title').textContent = item.name + ' · 官方配图';
      $('reference-image').src = document.querySelector(
        '[data-park-photo="' + item.photo + '"]',
      ).src;
      $('reference-caption').textContent =
        '来源：万龙度假天堂订阅号，2026.08.18《名字你来定｜新雪季三大地形公园公开征名！》。施工/场地照片不是正式雪季竣工测绘，不据透视比例推算障碍物尺寸。';
      $('reference-modal').hidden = false;
      $('reference-close').focus();
    };
  if (innerWidth <= 760) $('sidebar').classList.add('mobile-hidden');
  renderList();
}
let userSatelliteIndex = 0;
function syncReferenceNavigation() {
  const frames = unregisteredImageryScreenshots,
    index = frames.findIndex((s) => s.dataURL === $('reference-image').getAttribute('src'));
  $('reference-prev').hidden = $('reference-next').hidden = index < 0;
  if (index >= 0) userSatelliteIndex = index;
}
function showUserSatelliteFrame() {
  const frames = unregisteredImageryScreenshots,
    s = frames[userSatelliteIndex];
  if (!s) return;
  $('reference-title').textContent =
    s.scope + ' · ' + (userSatelliteIndex + 1) + ' / ' + frames.length;
  $('reference-image').src = s.dataURL;
  syncReferenceNavigation();
}
function openReference(type) {
  if (type === 'satellite') showUserSatelliteFrame();
  else {
    $('reference-title').textContent = '2026.09 雪道全景图';
    const image = $('reference-image');
    const source = $('trail-map-data').dataset.src;
    image.hidden = !source;
    if (source) image.src = source;
    else image.removeAttribute('src');
    $('reference-caption').textContent = source ? '' : '请通过万龙滑雪场官方渠道查阅雪道原图。';
    syncReferenceNavigation();
  }
  $('reference-modal').hidden = false;
  $('reference-close').focus();
}
$('reference-prev').onclick = () => {
  userSatelliteIndex =
    (userSatelliteIndex + unregisteredImageryScreenshots.length - 1) %
    unregisteredImageryScreenshots.length;
  showUserSatelliteFrame();
};
$('reference-next').onclick = () => {
  userSatelliteIndex = (userSatelliteIndex + 1) % unregisteredImageryScreenshots.length;
  showUserSatelliteFrame();
};
$('reference-close').onclick = () => {
  $('reference-modal').hidden = true;
};
$('reference-modal').onclick = (e) => {
  if (e.target === $('reference-modal')) $('reference-modal').hidden = true;
};
$('satellite-reference').onclick = () => openReference('satellite');
$('trail-reference').onclick = () => openReference('trail');
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $('reference-modal').hidden = true;
});
function ensureCurrentContours() {
  if (contours.userData.currentTerrain) return;
  const pos = terrainGeo.attributes.position,
    indices = terrainGeo.index.array,
    buckets = new Map(),
    a = new V(),
    b = new V(),
    c = new V();
  for (let i = 0; i < indices.length; i += 3) {
    a.fromBufferAttribute(pos, indices[i]);
    b.fromBufferAttribute(pos, indices[i + 1]);
    c.fromBufferAttribute(pos, indices[i + 2]);
    const vertices = [a, b, c],
      lo = Math.min(a.y, b.y, c.y) + GEO.baseElevation,
      hi = Math.max(a.y, b.y, c.y) + GEO.baseElevation;
    for (let elevation = Math.ceil(lo / 50) * 50; elevation <= hi; elevation += 50) {
      const level = elevation - GEO.baseElevation,
        hits = [];
      for (let k = 0; k < 3; k++) {
        const p = vertices[k],
          q = vertices[(k + 1) % 3];
        if ((p.y < level && q.y >= level) || (q.y < level && p.y >= level)) {
          const t = (level - p.y) / (q.y - p.y);
          hits.push(lerp(p.x, q.x, t), level + 0.3, lerp(p.z, q.z, t));
        }
      }
      if (hits.length === 6) {
        if (!buckets.has(elevation)) buckets.set(elevation, []);
        buckets.get(elevation).push(...hits);
      }
    }
  }
  for (const [elevation, positions] of buckets) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const line = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: '#789a9e',
        transparent: true,
        opacity: elevation % 100 === 0 ? 0.34 : 0.22,
      }),
    );
    line.userData.elevation = elevation;
    contours.add(line);
  }
  contours.userData.currentTerrain = true;
  contours.userData.positionVersion = pos.version;
}
switchControl('contours-switch', 'contours', (v) => {
  if (v) ensureCurrentContours();
  contours.visible = v;
});
switchControl('forest-boundary-switch', 'forestBoundaries', (v) => (geoOverlay.visible = v));
$('paths-switch').disabled = true;
$('paths-switch').parentElement.hidden = true;
pathOverlay.visible = false;
// Screenshot mosaic is candidate-aligned to the old reference grid. Its pixels
// come only from the user's Tencent/Earthol screenshots, with transparency where
// they have no coverage. This is a visual comparison, not survey control.
const imageryExtent = {
  xmin: 12842032.24813589,
  ymin: 5003567.8715476375,
  xmax: 12848147.210398708,
  ymax: 5009071.33758417,
};
let imageryOverlay = null;
$('imagery-switch').onclick = () => {
  state.imagery = !state.imagery;
  $('imagery-switch').setAttribute('aria-checked', state.imagery);
  if (state.imagery && !imageryOverlay) {
    const texture = loadOfflineMosaic('__USER_MOSAIC__');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const uv = terrainGeo.attributes.uv;
    for (let i = 0; i < terrainGeo.attributes.position.count; i++) {
      const c = unprojectGeo(
          terrainGeo.attributes.position.getX(i),
          terrainGeo.attributes.position.getZ(i),
        ),
        mx = ((c[0] * Math.PI) / 180) * 6378137,
        my = Math.asinh(Math.tan((c[1] * Math.PI) / 180)) * 6378137;
      uv.setXY(
        i,
        (mx - imageryExtent.xmin) / (imageryExtent.xmax - imageryExtent.xmin),
        (my - imageryExtent.ymin) / (imageryExtent.ymax - imageryExtent.ymin),
      );
    }
    uv.needsUpdate = true;
    imageryOverlay = new THREE.Mesh(
      terrainGeo,
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    imageryOverlay.name = 'User screenshot candidate overlay';
    imageryOverlay.renderOrder = 10;
    mountain.add(imageryOverlay);
  }
  if (imageryOverlay) imageryOverlay.visible = state.imagery;
  forest.visible = !state.imagery;
  treeSnowCaps.forEach((m) => (m.visible = state.trees));
  snow.visible = !state.imagery && state.snow;
  trails.forEach((t) => {
    if (t.mesh) t.mesh.visible = !state.imagery && !t.mesh.userData.pickOnly;
  });
  $('imagery-credit').hidden = !state.imagery;
  toast(state.imagery ? '腾讯截图候选拼接：约47%覆盖，位置待校核。' : '已回到冬季雪境。');
};
const mappedCount = trails.filter((t) => t.mapped).length;
$('geometry-summary').textContent = '当前模型 ' + mappedCount + '/32 条雪道 · 高程 1:1';
const measurementResult = document.createElement('section');
measurementResult.id = 'measurement-result';
measurementResult.className = 'glass';
measurementResult.hidden = true;
measurementResult.setAttribute('aria-label', '多点坡面测距');
measurementResult.innerHTML =
  '<output id="measurement-total" aria-live="polite"></output><div id="measurement-secondary"></div><div class="measurement-actions"><button id="measurement-undo">撤销上一点</button><button id="measurement-reset">重新测量</button><button id="measurement-finish">结束</button><button id="measurement-close" aria-label="关闭测距">关闭 ×</button></div>';
document.body.append(measurementResult);
const measures = new THREE.Group();
scene.add(measures);
let measurePoints = [],
  measureSegments = [];
function disposeMeasure(object) {
  object.removeFromParent();
  object.geometry?.dispose();
  object.material?.dispose();
}
function clearMeasures() {
  for (const object of [...measures.children]) disposeMeasure(object);
  measurePoints = [];
  measureSegments = [];
}
function setMeasuring(value) {
  state.measuring = value;
  $('measure-toggle').classList.toggle('active', value);
  $('measure-toggle').setAttribute('aria-pressed', String(value));
  $('measurement-finish').textContent = value ? '结束' : '继续选点';
  requestSceneFrame();
}
function updateMeasurement() {
  const totals = measureSegments.reduce(
    (sum, s) => ({
      surface: sum.surface + s.surface,
      horizontal: sum.horizontal + s.horizontal,
      up: sum.up + s.up,
      down: sum.down + s.down,
    }),
    { surface: 0, horizontal: 0, up: 0, down: 0 },
  );
  Object.assign(measurementResult.dataset, {
    points: measurePoints.length,
    surface: totals.surface,
    horizontal: totals.horizontal,
    ascent: totals.up,
    descent: totals.down,
  });
  $('measurement-total').textContent =
    measurePoints.length > 1
      ? '坡面累计 ' + totals.surface.toFixed(1) + ' m'
      : measurePoints.length
        ? '已选起点 · 继续沿路线选点'
        : '请选择起点';
  $('measurement-secondary').textContent =
    measurePoints.length > 1
      ? measurePoints.length +
        ' 点 · 水平 ' +
        totals.horizontal.toFixed(1) +
        ' m · 上升 ' +
        totals.up.toFixed(1) +
        ' m · 下降 ' +
        totals.down.toFixed(1) +
        ' m'
      : '';
  $('measurement-undo').disabled = !measurePoints.length;
  $('measurement-finish').disabled = measurePoints.length < 2;
  requestSceneFrame();
}
function beginMeasurement() {
  interfacePanels.dismissPanels();
  exitExperience(false);
  measurementResult.hidden = false;
  setMeasuring(true);
  updateMeasurement();
}
$('measure-toggle').title = '沿路线多点坡面测距';
$('measure-toggle').setAttribute('aria-label', '多点坡面测距');
$('measure-toggle').onclick = () => {
  if (measurementResult.hidden) {
    clearMeasures();
    beginMeasurement();
  } else {
    measurementResult.hidden = true;
    setMeasuring(false);
    clearMeasures();
  }
};
$('measurement-close').onclick = () => {
  measurementResult.hidden = true;
  setMeasuring(false);
  clearMeasures();
};
$('measurement-reset').onclick = () => {
  clearMeasures();
  beginMeasurement();
};
$('measurement-finish').onclick = () => {
  setMeasuring(!state.measuring);
  updateMeasurement();
};
$('measurement-undo').onclick = () => {
  if (!measurePoints.length) return;
  const point = measurePoints.pop();
  disposeMeasure(point.marker);
  const segment = measureSegments.pop();
  if (segment) disposeMeasure(segment.mesh);
  updateMeasurement();
};
function handleMeasurement(e) {
  raycaster.setFromCamera(pointerInScene(e), camera);
  const hit = raycaster.intersectObject(terrain)[0];
  if (!hit) return;
  const p = hit.point.clone();
  p.y = displayGroundHeightAt(p.x, p.z);
  if (!Number.isFinite(p.y)) return;
  const previous = measurePoints.at(-1)?.point;
  if (previous && Math.hypot(p.x - previous.x, p.z - previous.z) < 0.25) return;
  if (previous) {
    const horizontal = Math.hypot(p.x - previous.x, p.z - previous.z),
      steps = Math.max(1, Math.ceil(horizontal)),
      line = [];
    let surface = 0,
      up = 0,
      down = 0,
      last = null;
    // Sample each user-defined straight leg at <= 1 m horizontal spacing.
    // Use unoffset terrain heights for lengths, and lift only the visible line.
    for (let i = 0; i <= steps; i++) {
      const q = previous.clone().lerp(p, i / steps);
      q.y = displayGroundHeightAt(q.x, q.z);
      if (!Number.isFinite(q.y)) return;
      if (last) {
        surface += q.distanceTo(last);
        const dy = q.y - last.y;
        up += Math.max(0, dy);
        down += Math.max(0, -dy);
      }
      last = q;
      line.push(q.clone().add(new V(0, 0.5, 0)));
    }
    const mesh = lineFromPoints(line, '#b49355');
    mesh.material.depthTest = false;
    mesh.material.depthWrite = false;
    mesh.renderOrder = 20;
    measures.add(mesh);
    measureSegments.push({ surface, horizontal, up, down, mesh });
  }
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(3, 8, 6),
    new THREE.MeshBasicMaterial({ color: '#b49355', depthTest: false, depthWrite: false }),
  );
  marker.renderOrder = 21;
  marker.position.copy(p).add(new V(0, 1, 0));
  measures.add(marker);
  measurePoints.push({ point: p, marker });
  updateMeasurement();
}

/* DINING_UI */

$('night-reference').onclick = () =>
  sourcePhoto(
    'night-photo-data',
    '万龙夜场 · 官方实拍',
    '来源：万龙度假天堂订阅号，2026.09.16。近黑天空、强白照雪与雾凇、红色吊厢和局部护网，作为夜景风格参考；文章未提供逐条夜场开放清单及精确灯位。',
  );
