// Source footprints anchor the summit building ensemble; heights / facades are photo references.
const summitFacilities = [];
for (const id of ['1153883029', '1153883030']) {
  const source = GEO.buildings.find((b) => b.id === id);
  if (!source) continue;
  const poly = source.coords.slice(0, -1).map(projectGeo),
    g = new THREE.Group();
  buildings.add(g);
  const shape = new THREE.Shape();
  poly.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  shape.closePath();
  const reading = id === '1153883030',
    H = reading ? 11.8 : 8.6;
  function mass(y, h, mat) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, steps: 1 });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  mass(0, H, reading ? facadeMats.ivory : stationMat);
  mass(H, 0.35, facadeMats.snow);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      wall = new THREE.Group();
    wall.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
    wall.rotation.y = Math.atan2(-dz, dx);
    g.add(wall);
    for (let k = 0; k < (reading ? 3 : 2); k++) {
      const y = 1.8 + k * 3.5;
      box(len, 2.05, 0.3, facadeMats.glass, 0, y, 0, wall);
      box(len + 0.4, 0.34, 0.5, facadeMats.ivory, 0, y + 1.2, 0, wall);
      for (let x = -len / 2 + 2; x < len / 2; x += 3.4)
        box(0.09, 2.12, 0.35, facadeMats.frame, x, y, 0, wall);
    }
  }
  const site = hotelSite(g, 'summit-' + id, poly);
  site.kind = 'summit';
  g.userData.referenceStatus = '源建筑轮廓与实拍窗带；局部基底沿足迹处理，楼高估读';
  registerSolids(g, 'summit-' + id);
  const bounds = new THREE.Box3().setFromObject(g),
    facility = {
      id: reading ? 'summit-reading' : 'summit-service',
      guideId: reading ? 15 : 16,
      name: reading ? '万龙阅读空间' : '山顶配套建筑',
      group: g,
      bounds,
      center: bounds.getCenter(new V()),
      sourceId: id,
      source: 'https://www.openstreetmap.org/way/' + id,
      status: reading ? 'OSM 名称与建筑轮廓 · 外观参考' : 'OSM 建筑轮廓 · 具体用途待核实',
      description: reading
        ? '公开地图将山顶这座独立建筑标为“万龙阅读空间”。模型按该建筑的独立轮廓还原位置，并以公开实拍的连续窗带表现外观；室内布局、开放时间和当前经营用途尚未确认。'
        : '山顶索道站群旁的独立配套建筑。公开地图有建筑轮廓，但没有可核实的专名和室内用途，因此保留为配套建筑，不把它冒认成咖啡厅或某一座索道站房。',
    };
  summitFacilities.push(facility);
  LANDSCAPE_ITEMS.push({
    id: facility.guideId,
    name: facility.name,
    category: '山顶配套',
    status: facility.status,
    description: facility.description,
    source: facility.source,
    summitId: facility.id,
  });
}

finalizeHotelSites();
{
  const bounds = new THREE.Box3().setFromObject(ridgeLodge);
  summitFacilities.unshift({
    id: 'summit-cafe',
    guideId: 13,
    name: '山顶木屋与半山雪咖啡厅',
    group: ridgeLodge,
    bounds,
    center: bounds.getCenter(new V()),
    source: 'https://mp.weixin.qq.com/s/QdY5BBhPSJrHD4MbMyoeSA',
    status: '官方山顶配套介绍 · 木屋外观参考',
    description:
      '25/26 官方攻略将山顶木屋和“半山雪咖啡厅”都列在红花梁山顶。木屋使用芬兰原木，提供卤肉饭、羊汤、红柳烤串等休闲餐饮；咖啡厅以北欧风格、落地窗和木质桌椅为特点，提供咖啡、汉堡及简餐。名称中的“半山”不是把它定位到半山的依据。两处服务的具体房间边界与入口尚未独立测绘，模型只定位山顶木屋参考体量。',
  });
}
function selectSummitFacility(id, focus = true) {
  const f = summitFacilities.find((f) => f.id === id || f.guideId === id);
  if (!f) return;
  clearSelection();
  exitExperience(false);
  state.selected = { kind: 'landscape', id: f.guideId };
  document.body.classList.add('exploring');
  const d = $('detail');
  d.classList.remove('hotel-detail');
  d.hidden = false;
  d.innerHTML =
    '<div class="detail-top"><div class="eyebrow">RED FLOWER RIDGE · SUMMIT</div><button class="close" aria-label="取消选中并关闭详情">取消选中 ×</button></div><h2>' +
    f.name +
    '</h2><div class="badge">' +
    f.status +
    '</div><p class="detail-note">' +
    f.description +
    '</p><button class="primary" id="summit-closeup">查看建筑近景</button><button class="secondary" id="summit-ensemble">查看山顶建筑群</button><a class="source-link" href="' +
    f.source +
    '" target="_blank" rel="noopener">建筑资料来源 ↗</a>' +
    (f.id === 'summit-cafe'
      ? '<a class="source-link" href="https://s.visitbeijing.com.cn/attraction/118458" target="_blank" rel="noopener">北京旅游网 · 万龙木屋介绍 ↗</a>'
      : '') +
    '<p class="detail-note">建筑位置沿公开轮廓或已登记的山顶参考点；楼高、台阶与外观细节为照片估读。未取得房间平面和施工标高。</p>';
  d.querySelector('.close').onclick = clearSelection;
  function view(ensemble = false) {
    const b = ensemble
      ? summitFacilities.reduce((b, s) => b.union(s.bounds), new THREE.Box3())
      : f.bounds;
    desired.target.copy(b.getCenter(new V()));
    desired.theta = 0.65;
    desired.phi = 1.08;
    desired.radius = ensemble ? 410 : Math.max(130, b.getSize(new V()).length() * 2.15);
  }
  $('summit-closeup').onclick = () => view();
  $('summit-ensemble').onclick = () => view(true);
  if (focus) view();
  if (innerWidth <= 760) $('sidebar').classList.add('mobile-hidden');
  renderList();
  updateLabels();
  drawMinimap();
}
