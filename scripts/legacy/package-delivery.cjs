const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'),
  dest = path.join(root, 'delivery', 'wanlong-map');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
  app = fs.readFileSync(path.join(root, 'app-bundle.js'), 'utf8');
if (!app.includes('const DELIVERY_MODE=true;'))
  throw Error('Build the delivery UI before packaging');
const apiStart = app.indexOf('window.__WANLONG__={'),
  apiEnd = app.indexOf('\n})();', apiStart);
if (apiStart < 0 || apiEnd < 0) throw Error('Diagnostics export boundary changed');
app = app.slice(0, apiStart) + app.slice(apiEnd);
function write(file, bytes) {
  const target = path.join(dest, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
}
html = html.replace(
  /(<img id="(?:trail-map-data|dining-breakfast-data|dining-tea-data)"[^>]*?)\s(?:data-src|src)="[^"]*"/g,
  '$1',
);
// This inaccessible imagery input is retained only for legacy DOM bindings.
html = html.replace(/(<img[^>]*id="satellite-data"[^>]*)(?:data-src|src)="[^"]*"/, '$1');
html = html.replace(
  /<meta name="description" content="[^"]*">/,
  '<meta name="description" content="万龙滑雪场三维导览，浏览雪道、索道、酒店与山地设施，体验多点坡面测距与沉浸式游览。">',
);
const version = crypto.createHash('sha256').update(app).digest('hex').slice(0, 12);
html = html.replace(/app-bundle\.js\?v=[a-f0-9]+/, 'app-bundle.js?v=' + version);
new Function(app);
write('index.html', html);
write('app-bundle.js', app);
for (const file of [
  'data-bundle.js',
  'styles.css',
  'vendor/three.min.js',
  'vendor/THREE-LICENSE.txt',
])
  write(file, fs.readFileSync(path.join(root, file)));
write(
  '使用说明.txt',
  '万龙 · 雪境\r\n\r\n解压后用浏览器打开 index.html，可离线使用。请保持文件夹内文件完整。\r\n可将整个文件夹部署到静态网站服务，再用手机浏览器访问。手机的文件预览可能无法运行三维地图。\r\n\r\n默认拖动移动地图。可用工具栏切换拖动模式，也可以右键拖动旋转，或按住 Shift 临时切换。\r\n滚轮对准鼠标下的位置缩放。触屏用单指拖动，双指可平移、捏合缩放或转动。\r\n目录可查询雪道、索道、住宿和景点。测距支持沿坡面连续选点。\r\nEsc 返回，H 回到全景。\r\n\r\n地图信息与数据署名见“环境 → 地图信息”。\r\n',
);
// Remove only files emitted by earlier releases of these two generated bundles.
const retired = [
  'additional-2.jpg',
  'additional-3.jpg',
  'additional-8.jpg',
  'night-2-1.jpg',
  'night-3-9.jpg',
  'park-0.jpg',
  'park-1.jpg',
  'park-2.jpg',
  'site-reference.jpg',
];
for (const folder of ['wanlong-map', 'wanlong-resort']) {
  for (const file of retired)
    fs.rmSync(path.join(root, 'delivery', folder, 'assets', 'photos', file), { force: true });
}
const files = [];
function inventory(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) inventory(p);
    else files.push(path.relative(dest, p).replaceAll('\\', '/'));
  }
}
inventory(dest);
fs.writeFileSync(
  path.join(root, 'research/delivery-review/package.json'),
  JSON.stringify(
    {
      entry: dest,
      files,
      bytes: files.reduce((n, f) => n + fs.statSync(path.join(dest, f)).size, 0),
      diagnosticUI: false,
      diagnosticAPI: false,
    },
    null,
    2,
  ),
);
console.log('Packaged ' + files.length + ' files: ' + dest);
