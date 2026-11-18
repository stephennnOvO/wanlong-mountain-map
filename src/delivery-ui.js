function guestLandscapeVisible(item) {
  return ![5, 8, 100, 101, 102].includes(item.id);
}
// Presentation policy for the public build. Research tools stay in the internal build.
function showGuestFacility(record) {
  clearSelection();
  const d = $('detail');
  d.classList.remove('hotel-detail');
  d.hidden = false;
  d.replaceChildren();
  const header = document.createElement('div');
  header.className = 'detail-top';
  const title = document.createElement('h2');
  title.textContent = record.name;
  const close = document.createElement('button');
  close.className = 'close';
  close.textContent = '收起 ×';
  close.onclick = () => (d.hidden = true);
  header.append(title, close);
  d.append(header);
  if (record.guestDescription) {
    const p = document.createElement('p');
    p.className = 'guest-description';
    p.textContent = record.guestDescription;
    d.append(p);
  }
  if (record.action) {
    const b = document.createElement('button');
    b.className = 'primary';
    b.textContent = '查看地图位置';
    b.onclick = () => {
      record.action();
    };
    d.append(b);
  }
  const source = document.createElement('button');
  source.className = 'secondary';
  source.textContent = '查看雪道图';
  source.onclick = () => {
    const r = record.sourceRegion;
    if (r) focusOfficialMapRegion(r.x, r.y, r.scale);
    else openReference('trail');
  };
  d.append(source);
}
function deliveryText(value) {
  return value
    .replace(/红花梁 · 公开标高/g, '红花梁')
    .replace(/官方([78])索（候选；OSM[^）]+）/g, '$1号索道')
    .replace(/西侧未命名索道（编号待核实）/g, '西侧索道')
    .replace(/查看公寓楼群 · C座未独立配准/g, '查看公寓楼群')
    .replace(/OSM 林地多边形/g, '林地')
    .replace(/自行车道参考/g, '自行车道')
    .replace(/定位三维参考分区/g, '查看分区')
    .replace(/资料长度|坐标线长/g, '长度')
    .replace(/资料房型面积/g, '房型面积')
    .replace(/模型雪面剖面/g, '海拔剖面')
    .replace(/模型高程 · 米/g, '海拔 / 米')
    .replace(/模型坡面长/g, '坡面长度')
    .replace(/模型海拔/g, '海拔')
    .replace(/理论单程行程/g, '单程估算（按最高速度）')
    .replace(/公开参考运营时间/g, '运营时间')
    .replace(/模拟时间/g, '场景时间')
    .replace(/模拟速度/g, '播放速度')
    .replace(/ · (?:参考重建|区域参考|地形参考|形态示意|参考|原图区域|示意|候选)$/g, '')
    .replace(/查看猛龙公园形态示意/g, '查看猛龙公园')
    .replace(/入口位置待核实/g, '暂不支持入口定位')
    .replace(/官方索道表/g, '索道')
    .replace(/官方参数表/g, '索道参数')
    .replace(/待核实/g, '—')
    .replace(/¹/g, '');
}
function cleanDeliveryPanel(root) {
  if (!DELIVERY_MODE) return;
  if (
    root.id === 'detail' &&
    state.selected?.kind === 'hotel' &&
    !root.querySelector('.guest-hotel-rooms')
  ) {
    const roomCopy = {
      1: '35㎡ 山景或景观客房；70㎡ 亲子及景观套房。',
      2: '23㎡ 山景标间、25㎡ 雪景标间、26㎡ 玉龙居，以及 43–50㎡ 套房。',
      3: '24㎡ 休闲居、40㎡ 精致公寓、61㎡ 景观套房，以及 72–90㎡ 家庭房型。',
      4: '汽车、丛林等亲子主题房型，面积约 70–95㎡，适合家庭及多人入住。',
      5: '16.1㎡ 标间至约 58㎡ 一室一厅。部分房型不含早餐及汤泉。',
      6: '15㎡ 日式双人居、18㎡ 标准房、20㎡ 单人房及 27㎡ 高级或三人房。',
    };
    const rooms = root.querySelector('.hotel-rooms');
    if (rooms) {
      rooms.className = 'guest-hotel-rooms';
      rooms.innerHTML =
        '<h3>房型与住宿</h3><p class="guest-description">' + roomCopy[state.selected.id] + '</p>';
    }
    const facilities = root.querySelector('.hotel-facilities');
    if (
      facilities &&
      !facilities.previousElementSibling?.classList.contains('guest-facilities-heading')
    ) {
      const h = document.createElement('h3');
      h.className = 'guest-facilities-heading';
      h.textContent = '酒店配套';
      facilities.before(h);
    }
  }
  const remove =
    '.detail-note,.photo-note,.detail-sub,.eyebrow,.hotel-rooms,.weather-note,.official-lift-table,.park-ref-grid,#park-photo-open,#park-user-photo,#landscape-satellite,#bike-registration-audit,#wild-registration-audit,#bike-perspective-open,.reference-model-badge';
  root.querySelectorAll(remove).forEach((e) => e.remove());
  if (root.id === 'detail') {
    root.querySelectorAll('.source-link').forEach((e) => e.remove());
    root.querySelectorAll('.profile-title').forEach((e) => {
      if (/建筑|参考|官方|订阅号|公众号|发布于|模型坡面长|模型海拔/.test(e.textContent)) e.remove();
    });
    root.querySelectorAll('.facility-notes>div').forEach((e) => {
      if (/不据|未测绘|待核|未核|反推|公开资料|官方介绍|估读|参考重建/.test(e.textContent))
        e.remove();
    });
    root.querySelectorAll('.facility-notes:empty,.profile:empty').forEach((e) => e.remove());
    root.querySelectorAll('.badge').forEach((e) => {
      if (/官方|参考|模拟|建模|测绘|待核|候选|OSM|DEM|GIS/.test(e.textContent)) e.remove();
    });
    const selected = state.selected;
    if (
      selected?.kind === 'landscape' &&
      [2, 6, 7, 100, 101, 102, 103, 104].includes(selected.id) &&
      !root.querySelector('.park-description,.delivery-status')
    ) {
      const badge = document.createElement('div');
      badge.className = 'badge delivery-status';
      badge.textContent = '设施示意';
      (root.querySelector('.panel-scroll') || root).append(badge);
    }
    if (root.querySelector('.wild-source-crop') && !root.querySelector('.delivery-status')) {
      const badge = document.createElement('div');
      badge.className = 'badge delivery-status';
      badge.textContent = '区域示意';
      root.querySelector('.wild-source-crop').before(badge);
    }
  }
  const replacements = {
    定位三维设施: '查看位置',
    查看官方原图: '查看雪道图',
    查看全景原图: '查看雪道图',
    查看高清原图: '查看雪道图',
    查看高清官方原图: '查看雪道图',
    '查看官方图雪道 ↗': '查看雪道图',
    '定位官方图雪道 ↗': '查看雪道图',
    查看天然沟谷地形: '查看山谷',
    '⌕ 查看猛龙公园三维形态': '查看公园',
    雪道参数与沿道体验: '雪道详情',
    卫星影像参考: '卫星影像',
    '查看现有模型 / 参考区域 ↗': '查看位置',
    '查看相关雪道 · 不代表野雪谷位置': '附近雪道',
  };
  root.querySelectorAll('button,a,label,span,small,strong,h2,h3,h4,output').forEach((e) => {
    if (e.children.length) return;
    const current = e.textContent,
      value = replacements[current] || deliveryText(current);
    if (current !== value) e.textContent = value;
  });
  root.querySelectorAll('[title],[aria-label],img[alt]').forEach((e) => {
    for (const attr of ['title', 'aria-label', 'alt'])
      if (e.hasAttribute(attr)) {
        const old = e.getAttribute(attr),
          next = deliveryText(old)
            .replace(/资料来源与建模说明/g, '地图信息')
            .replace(/暂停或继续模拟/g, '暂停或继续播放');
        if (old !== next) e.setAttribute(attr, next);
      }
  });
}
function initializeDeliveryUI() {
  document.body.classList.add('delivery');
  const toolbar = document.querySelector('.toolbar');
  const tools = [
    'toggle-list',
    'view-home',
    'view-top',
    'measure-toggle',
    'map-key',
    'settings-toggle',
    'drag-mode',
    'zoom-out',
    'zoom-in',
    'snow-toggle',
    'play-toggle',
    'interface-toggle',
  ];
  toolbar.append(...tools.map($));
  const separators = toolbar.querySelectorAll('.separator');
  $('zoom-out').before(separators[0]);
  $('snow-toggle').before(separators[1]);
  const toggleLabel = document.createElement('span');
  toggleLabel.className = 'word';
  toggleLabel.textContent = '纯净';
  $('interface-toggle').append(toggleLabel);
  $('interface-toggle').addEventListener('click', () => {
    toggleLabel.textContent = document.body.classList.contains('clean-view')
      ? '显示菜单'
      : '纯净视图';
  });
  const nightChoice = document.querySelector('[data-time="night"]');
  nightChoice.textContent = '夜景';
  const coverage = document.createElement('div');
  coverage.className = 'night-coverage';
  coverage.textContent = '夜滑灯光按25/26雪季常规范围展示，非今日开放状态；以当日公告为准。';
  $('time-segments').after(coverage);
  const nav = document.createElement('nav');
  nav.className = 'guest-navigation glass';
  nav.setAttribute('aria-label', '度假服务');
  const stay = document.createElement('button');
  stay.id = 'stay-open';
  stay.textContent = '酒店住宿';
  const dining = $('dining-toggle');
  dining.textContent = '餐饮';
  dining.title = '餐饮';
  dining.setAttribute('aria-label', '餐饮');
  const facilities = $('official-features-open');
  for (const [button, panel, open] of [
    [
      stay,
      $('sidebar'),
      () => {
        toggleCatalogue(true);
        switchTab('hotels');
      },
    ],
    [dining, diningPanel, () => selectDining()],
    [facilities, $('official-features-panel'), officialMapFeatures.open],
  ]) {
    button.className = 'guest-nav-button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', panel.id);
    button.onclick = () =>
      interfacePanels.openRoot(panel, open, button.getAttribute('aria-expanded') === 'true');
    nav.append(button);
  }
  document.querySelector('.top').insertBefore(nav, document.querySelector('.top-actions'));
  const hidden = [
    'imagery-switch',
    'paths-switch',
    'bike-reference-switch',
    'wild-reference-switch',
    'satellite-reference',
    'night-reference',
    'settings-return',
  ];
  for (const id of hidden) {
    const el = $(id);
    if (!el) continue;
    const row = el.closest('.switch-row') || el;
    row.hidden = true;
    row.classList.add('delivery-hidden');
    el.disabled = true;
  }
  for (const id of ['bike-route-picker', 'wild-zone-picker']) {
    const el = $(id);
    if (el) {
      el.hidden = true;
      el.classList.add('delivery-hidden');
    }
  }
  for (const id of ['trail-reference', 'official-map-open', 'official-label-source']) {
    const el = $(id);
    if (el) el.textContent = '官方雪道图';
  }
  $('forest-boundary-switch').closest('.switch-row').querySelector('span').textContent = '林带边界';
  $('wild-layer-switch').closest('.switch-row').querySelector('span').textContent =
    '野雪分区（示意）';
  $('wild-layer-switch').setAttribute('aria-label', '显示野雪分区');
  $('official-features-panel').setAttribute('aria-label', '设施与服务');
  $('official-features-search').placeholder = '搜索设施';
  $('official-features-search').setAttribute('aria-label', '搜索设施与服务');
  $('reference-modal')
    .querySelector('[role="dialog"]')
    .setAttribute('aria-labelledby', 'reference-title');
  $('reference-modal').querySelector('[role="dialog"]').removeAttribute('aria-label');
  $('reference-image').alt = '万龙雪道图';
  $('reference-modal').querySelector('.eyebrow')?.remove();
  $('official-features-open').textContent = '设施与服务';
  $('measure-toggle').title = '沿坡面多点测距';
  $('measure-toggle').setAttribute('aria-label', '沿坡面多点测距');
  $('tour').setAttribute('aria-label', '山野漫游');
  $('play-toggle').title = '暂停或继续播放';
  const clock = $('environment-hour')?.previousElementSibling;
  if (clock?.firstChild?.nodeType === 3) clock.firstChild.textContent = '场景时间 ';
  const auto = $('environment-auto')?.closest('.switch-row')?.querySelector('span');
  if (auto) auto.textContent = '昼夜循环';
  const speed = $('speed-range')?.closest('.setting')?.querySelector('label');
  if (speed?.firstChild?.nodeType === 3) speed.firstChild.textContent = '播放速度 ';
  for (const item of LANDSCAPE_ITEMS) item.name = deliveryText(item.name);
  for (const lift of lifts) lift.name = deliveryText(lift.name);
  const rename = {
    1: '林地',
    2: 'E 区观景台',
    3: '森林熊自行车公园',
    12: '雪具大厅',
    13: '山顶木屋与雪咖啡厅',
  };
  for (const item of LANDSCAPE_ITEMS) if (rename[item.id]) item.name = rename[item.id];
  const visible = LANDSCAPE_ITEMS.filter(guestLandscapeVisible);
  $('landscape-tab').querySelector('b').textContent = visible.length;
  for (let i = labelData.length - 1; i >= 0; i--) {
    const l = labelData[i],
      record = officialMapFeatures.records.find((r) => r.id === l.officialFeatureId);
    if (
      record?.category === '自行车道' ||
      (l.trail && trails.find((t) => t.id === l.trail)?.mapped === false)
    ) {
      l.el?.remove();
      labelData.splice(i, 1);
      continue;
    }
    l.text = deliveryText(l.text).replace(/ · 图例入口$| · 原图线路入口$/, '');
  }
  for (const r of officialMapFeatures.records) {
    if (r.category === '官方索道表') r.category = '索道';
    if (r.category === '餐饮参考') r.category = '餐饮';
    if (r.category === '图上组合标注') r.category = '服务';
    r.name = deliveryText(r.name);
  }
  for (const option of $('official-features-category').options) {
    const name = option.textContent
      .replace('官方索道表', '索道')
      .replace('餐饮参考', '餐饮')
      .replace('图上组合标注', '服务');
    if (name !== option.textContent) {
      option.textContent = name;
      option.value = name;
    }
  }
  for (const h of hotels)
    h.features = h.features.map((f) =>
      f.replace('25/26 新装开业', '客房住宿').replace('主体七层¹', '七层客房'),
    );
  const info = $('settings-about');
  info.hidden = false;
  info.textContent = '地图信息';
  info.onclick = () => {
    const d = $('detail');
    state.selected = null;
    d.classList.remove('hotel-detail');
    d.hidden = false;
    d.innerHTML =
      '<div class="detail-top"><h2>地图信息</h2><button class="close" aria-label="收起地图信息">收起 ×</button></div><div class="delivery-about"><strong>万龙 · 雪境</strong><div>雪道图版本：2026.09</div><div>交互游览地图，不提供实时雪况或路线导航。开放情况以雪场公告为准。</div><div class="delivery-credits">地图数据 © OpenStreetMap contributors<br>地形数据 Mapzen / USGS<br>三维引擎 Three.js · MIT<br>官方雪道图 © 张家口市万龙运动旅游有限公司</div></div>';
    d.querySelector('.close').onclick = () => (d.hidden = true);
  };
  document
    .querySelectorAll('.settings,.sidebar,.detail,#official-features-panel')
    .forEach(cleanDeliveryPanel);
  renderList();
  updateLabels();
}
