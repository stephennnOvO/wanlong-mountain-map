(() => {
  let failed = false;
  function show(message) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => show(message), { once: true });
      return;
    }
    if (failed) return;
    failed = true;
    const loading = document.getElementById('loading');
    if (loading) loading.hidden = true;
    const panel = document.createElement('section');
    panel.id = 'map-load-error';
    panel.setAttribute('role', 'alert');
    panel.style.cssText =
      'position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;gap:12px;overflow:auto;padding:24px;background:#e4edef;color:#203d42;text-align:center';
    const title = document.createElement('h2');
    title.textContent = '地图暂时无法显示';
    const text = document.createElement('p');
    text.textContent = message;
    const retry = document.createElement('button');
    retry.className = 'primary';
    retry.textContent = '重新加载';
    retry.onclick = () => location.reload();
    panel.append(title, text, retry);
    const source = document.getElementById('trail-map-data'),
      url = source?.dataset.src || source?.getAttribute('src');
    if (url) {
      const map = document.createElement('details'),
        label = document.createElement('summary'),
        image = document.createElement('img');
      label.textContent = '查看官方雪道图';
      image.alt = '万龙官方雪道图';
      image.style.cssText = 'display:block;width:min(100%,1100px);height:auto;margin:12px auto';
      map.addEventListener('toggle', () => {
        if (map.open && !image.hasAttribute('src')) image.src = url;
      });
      map.append(label, image);
      panel.append(map);
    }
    document.body.append(panel);
    retry.focus();
  }
  const starting = () => !document.getElementById('loading')?.hidden;
  window.addEventListener(
    'error',
    (event) => {
      if (starting() && (event instanceof ErrorEvent || event.target?.tagName === 'SCRIPT'))
        show('加载过程中遇到了问题，请重新加载。');
    },
    true,
  );
  window.addEventListener('unhandledrejection', () => {
    if (starting()) show('加载过程中遇到了问题，请重新加载。');
  });
  window.addEventListener('wanlong-webgl-unavailable', () =>
    show('当前浏览器无法启动三维图形。你仍可查看官方雪道图。'),
  );
  document.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      show('图形显示已中断，请重新加载地图。');
    },
    true,
  );
})();
