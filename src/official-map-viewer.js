// Full-resolution offline source image, with an independent zoomable viewport.
const officialMapViewer = (() => {
  const image = $('reference-image'),
    viewport = $('reference-image-viewport');
  let scale = 1;
  function zoom(value) {
    const previous = scale;
    scale = clamp(value, 1, 32);
    const x = (viewport.scrollLeft + viewport.clientWidth / 2) / (previous || 1),
      y = (viewport.scrollTop + viewport.clientHeight / 2) / (previous || 1);
    image.style.width = Math.round(viewport.clientWidth * scale) + 'px';
    image.style.maxWidth = 'none';
    $('reference-zoom-value').textContent =
      scale === 1 ? '适应窗口' : Math.round(scale * 100) + '%';
    viewport.scrollLeft = x * scale - viewport.clientWidth / 2;
    viewport.scrollTop = y * scale - viewport.clientHeight / 2;
  }
  function fit() {
    scale = 1;
    image.style.width = '100%';
    $('reference-zoom-value').textContent = '适应窗口';
    viewport.scrollLeft = viewport.scrollTop = 0;
  }
  $('reference-zoom-in').onclick = () => zoom(scale * 1.6);
  $('reference-zoom-out').onclick = () => zoom(scale / 1.6);
  $('reference-fit').onclick = fit;
  new MutationObserver(() => {
    fit();
    syncReferenceNavigation();
  }).observe(image, { attributes: true, attributeFilter: ['src'] });
  new MutationObserver(() => {
    if (!$('reference-modal').hidden) fit();
  }).observe($('reference-modal'), { attributes: true, attributeFilter: ['hidden'] });
  viewport.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        zoom(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
      }
    },
    { passive: false },
  );
  window.addEventListener('resize', () => {
    if (scale > 1) zoom(scale);
  });
  return {
    zoom,
    fit,
    async focus(x, y, value = 4) {
      openReference('trail');
      try {
        await image.decode();
      } catch {}
      await new Promise(requestAnimationFrame);
      zoom(value);
      viewport.scrollLeft = image.clientWidth * x - viewport.clientWidth / 2;
      viewport.scrollTop = image.clientHeight * y - viewport.clientHeight / 2;
    },
  };
})();
function focusOfficialMapRegion(x, y, scale = 4) {
  return officialMapViewer.focus(x, y, scale);
}
function officialLiftTableMarkup(lift) {
  const r = officialLiftInfo.find((r) => r.number === lift.officialNumber);
  if (!r)
    return '<p class="detail-note">2026.09官方图未单列“新7索”的独立设备表，保留OSM资料差异。</p>';
  return (
    '<details class="official-lift-table"><summary>2026.09 官方图 · ' +
    r.name +
    '参数</summary><p class="detail-note">' +
    ([4, 8].includes(lift.id)
      ? '此为官方编号资料，尚未确认与当前OSM线路对应，不据此改变设备模型。'
      : '官方图参数与当前资料逐项核对。') +
    '</p><div class="data-grid">' +
    cell('吊具', r.capacity + '人' + (r.type === 'gondola' ? '吊厢' : '吊椅')) +
    cell('长度', r.length, 'm') +
    cell('垂直落差', r.drop, 'm') +
    cell('最高速度', r.speed, 'm/s') +
    cell('运力', r.flow, '人/小时') +
    '</div><p class="detail-note">雪季：' +
    r.winterHours +
    '<br>夏季：' +
    r.summerHours +
    '<br>图示参考时段，实际以现场公告为准。</p><button class="source-link" data-official-lift-source>放大官方索道参数表 ↗</button></details>'
  );
}

// The route sign number belongs to the official panorama, not array order.
for (const t of trails.filter((t) => t.mapped)) {
  const grade = trailGrade(t);
  labelData.push({
    text: String(t.mapRef).padStart(2, '0') + ' ' + grade.symbol + ' ' + t.name,
    trail: t.id,
    p: t.curve.getPoint(0.48).add(new V(0, 12, 0)),
    maxDistance: 2400,
  });
}
if ($('official-map-open')) $('official-map-open').onclick = () => openReference('trail');
