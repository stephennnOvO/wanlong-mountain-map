const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto');
const assetVersion = (source) =>
  crypto.createHash('sha256').update(source).digest('hex').slice(0, 12);
const root = path.join(__dirname, '..');
const internal = false;
const resortOnly = process.env.WANLONG_RESORT_SCOPE === '1';
const linkVersions = process.env.WANLONG_LINK_VERSIONS === '1';
const suffix = process.env.WANLONG_BUILD_SUFFIX || (internal ? '-internal' : '');
if (!/^[a-z-]*$/.test(suffix)) throw Error('Invalid build suffix');
const outputs = new Map();
let html = fs.readFileSync(path.join(root, 'shell.html'), 'utf8');
if (resortOnly) {
  html = html.replace(/<title>[^<]+<\/title>/, '<title>万龙 · 雪场范围版</title>');
}
if (linkVersions) {
  const link = resortOnly
    ? '<a class="map-version-link" href="../index.html">查看完整地图</a>'
    : '<a class="map-version-link" href="resort/index.html">查看雪场范围版</a>';
  html = html.replace('<div class="brand-sub">WANLONG MOUNTAIN ATLAS</div>', link);
}
html = html.replace(
  '<body>',
  '<body><script>' +
    fs.readFileSync(path.join(__dirname, 'startup-guard.js'), 'utf8') +
    '</script><noscript><p>此地图需要浏览器运行脚本。请使用 Safari 或其他浏览器打开地图网页链接；文件预览无法运行三维地图。</p></noscript>',
);
html = html.replace(
  /(<article class="modal" role="dialog" aria-modal="true" aria-labelledby="sources-title">)[\s\S]*?(<\/article>)/,
  (_, open, close) =>
    open +
    (internal
      ? fs.readFileSync(path.join(root, 'sources-content.html'), 'utf8')
      : '<button class="close-modal" aria-label="关闭">×</button><h2 id="sources-title">地图信息</h2>') +
    close,
);
for (const [tag, file] of [
  ['STYLES', 'styles.css'],
  ['THREE', 'vendor/three.min.js'],
  ['DATA', 'data.js'],
  ['APP', 'app.js'],
]) {
  let source = fs.readFileSync(path.join(root, file), 'utf8');
  if (tag === 'APP') {
    // Yield only at early, complete construction boundaries, before UI handlers
    // and the animation loop are installed. Keep the lexical scope and order.
    const opening = "(()=>{'use strict';";
    if (!source.includes(opening) || !source.trimEnd().endsWith('})();'))
      throw Error('App startup wrapper changed');
    source = source.replace(
      opening,
      "(async()=>{'use strict';performance.mark('wanlong-app-start');\nconst yieldStartup=()=>new Promise(resolve=>setTimeout(resolve,0));",
    );
    if (resortOnly) {
      const layout = JSON.parse(fs.readFileSync(path.join(root, 'bike-route-layout.json'), 'utf8'));
      const scope = fs.readFileSync(path.join(root, 'resort-scope.js'), 'utf8');
      source = source.replace(
        'const resortScope=/* RESORT_SCOPE */ null;',
        () =>
          scope +
          '\nconst resortScope=createResortScope(' +
          JSON.stringify(layout.routes.flatMap((route) => route.world)) +
          ');',
      );
    }
    for (const stage of ['GEO_TERRAIN', 'GEO_ROUTES', 'FACILITIES']) {
      const marker = '/* ' + stage + ' */';
      if (!source.includes(marker)) throw Error('Missing startup stage: ' + stage);
      source = source.replace(marker, 'await yieldStartup();\n' + marker);
    }
    // The original })(); closure is also the async IIFE closure. Rejections
    // reach startup-guard.js's existing unhandledrejection fallback.
  }
  if (tag === 'DATA') {
    const audit = JSON.parse(
      fs.readFileSync(path.join(root, 'research/trail-reconciliation/audit.json'), 'utf8'),
    );
    const review = JSON.parse(
      fs.readFileSync(path.join(root, 'research/trail-reconciliation/manual-review.json'), 'utf8'),
    );
    const reviewed = {
      records: audit.records
        .filter((r) => r.points?.length)
        .map((r) => ({ name: r.name, points: r.sourcePoints || r.points })),
      narrow: review.wucaiReturnWidthReview,
    };
    source +=
      '\n' +
      fs.readFileSync(path.join(root, 'geo-data.js'), 'utf8') +
      '\n' +
      fs.readFileSync(path.join(root, 'geo-projection.js'), 'utf8') +
      '\nconst REVIEWED_TRAIL_MOSAIC=' +
      JSON.stringify(reviewed) +
      ';\n' +
      fs.readFileSync(path.join(root, 'geo-link.js'), 'utf8') +
      '\n' +
      fs.readFileSync(path.join(root, 'season-notes.js'), 'utf8') +
      '\n' +
      fs.readFileSync(path.join(root, 'site-plan.js'), 'utf8');
  }
  if (tag === 'APP')
    source = source.replace('/* PERFORMANCE */', () =>
      fs.readFileSync(path.join(root, 'runtime-performance.js'), 'utf8'),
    );
  if (tag === 'APP')
    source = source.replace('/* CAMERA_CONTROLS */', () =>
      fs.readFileSync(path.join(root, 'camera-controls.js'), 'utf8'),
    );
  if (tag === 'APP')
    source = source
      .replace('/* DELIVERY_MODE */ true', String(!internal))
      .replace('/* DELIVERY_UI */', () =>
        fs.readFileSync(path.join(root, 'delivery-ui.js'), 'utf8'),
      );
  if (tag === 'APP')
    source = source.replace('/* BIKE_PERSPECTIVE */', () =>
      internal
        ? fs
            .readFileSync(path.join(root, 'bike-perspective.js'), 'utf8')
            .replace('/* BIKE_PERSPECTIVE_DATA */', () =>
              JSON.stringify(
                JSON.parse(
                  fs.readFileSync(
                    path.join(root, 'research/bike-perspective/comparison.json'),
                    'utf8',
                  ),
                ),
              ),
            )
        : 'const bikePerspective={data:' +
          JSON.stringify({
            routes: JSON.parse(
              fs.readFileSync(path.join(root, 'research/bike-perspective/comparison.json'), 'utf8'),
            ).routes.map(({ id, world, points, sourceFrame }) => ({
              id,
              world,
              points,
              sourceFrame,
            })),
          }) +
          '};',
    );
  if (tag === 'APP')
    source = source.replace(
      '/* MAP_FACILITIES */',
      () =>
        'const BIKE_LOCAL_LAYOUT=' +
        fs.readFileSync(path.join(root, 'bike-route-layout.json'), 'utf8') +
        ';\n' +
        fs.readFileSync(path.join(root, 'map-facilities.js'), 'utf8'),
    );
  if (tag === 'APP')
    source = source.replace('/* INTERFACE_UI */', () =>
      fs.readFileSync(path.join(root, 'interface-ui.js'), 'utf8'),
    );
  if (tag === 'APP') source = source.replace('/* REGISTRATION_OFFLINE_ASSETS */', () => '{}');
  if (tag === 'APP')
    source = source.replace('/* PERFORMANCE_RENDER */', () =>
      ['terrain-render-lod.js', 'scene-spatial-culling.js']
        .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
        .join('\n'),
    );
  if (tag === 'APP')
    source = source.replace(
      '/* HOTELS */',
      () =>
        fs.readFileSync(path.join(root, 'apartment-model.js'), 'utf8') +
        '\n' +
        fs.readFileSync(path.join(root, 'hotel-model.js'), 'utf8'),
    );
  if (tag === 'APP')
    source = source
      .replace(
        '/* FACILITIES */',
        () =>
          "performance.mark('wanlong-facilities-start');" +
          fs.readFileSync(path.join(root, 'facility-geometry.js'), 'utf8') +
          '\n' +
          fs.readFileSync(path.join(root, 'station-details.js'), 'utf8') +
          "performance.mark('wanlong-facilities-end');",
      )
      .replace(
        '/* CABLEWAYS */',
        () =>
          "performance.mark('wanlong-cableways-start');" +
          fs.readFileSync(path.join(root, 'pylon-details.js'), 'utf8') +
          '\n' +
          fs.readFileSync(path.join(root, 'vehicle-details.js'), 'utf8') +
          '\n' +
          fs.readFileSync(path.join(root, 'cableways.js'), 'utf8') +
          '\n' +
          fs.readFileSync(path.join(root, 'park-model.js'), 'utf8') +
          "performance.mark('wanlong-cableways-end');",
      );
  if (tag === 'APP')
    source = source
      .replace('/* NATURAL_VALLEYS */', () =>
        fs.readFileSync(path.join(root, 'natural-valleys.js'), 'utf8'),
      )
      .replace(
        '/* FOREST */',
        () =>
          "performance.mark('wanlong-forest-start');" +
          fs.readFileSync(path.join(root, 'forest-cover-data.js'), 'utf8') +
          '\n' +
          fs.readFileSync(path.join(root, 'forest-model.js'), 'utf8') +
          "performance.mark('wanlong-forest-end');",
      );
  if (tag === 'APP')
    source = source
      .replace(
        '/* GEO_TERRAIN */',
        () =>
          "performance.mark('wanlong-terrain-start');" +
          fs.readFileSync(path.join(root, 'geo-terrain.js'), 'utf8') +
          "performance.mark('wanlong-terrain-end');",
      )
      .replace(
        '/* GEO_ROUTES */',
        () =>
          "performance.mark('wanlong-routes-start');" +
          ['trail-width-data.js', 'trail-footprints.js', 'lift-support-layout.js', 'geo-routes.js']
            .map((f) => fs.readFileSync(path.join(root, f), 'utf8'))
            .join('\n') +
          "performance.mark('wanlong-routes-end');",
      );
  if (tag === 'APP')
    source = source.replace('/* TERRAIN_SURFACE */', () => {
      const review = JSON.parse(
        fs.readFileSync(
          path.join(root, 'research/trail-reconciliation/surface-areas.json'),
          'utf8',
        ),
      );
      const roads = review.polygons.roads.map(({ points }) => points);
      return fs
        .readFileSync(path.join(root, 'terrain-surface.js'), 'utf8')
        .replace('/* REVIEWED_BASE_ROADS */ []', JSON.stringify(roads));
    });
  if (tag === 'APP')
    source = source.replace('/* HOTEL_SNOW_FLOW */', () =>
      fs.readFileSync(path.join(root, 'hotel-snow-flow.js'), 'utf8'),
    );
  if (tag === 'APP') {
    const rawDem =
      process.env.WANLONG_EXPORT_GRADING !== '1' && process.env.WANLONG_USE_GRADED_DEM !== '1';
    const rawSurface = `pisteGrading={
      field:heightAt,
      heightAt:(x,z)=>hotelSnowFlow.blocked(x,z)||menglongPark.contains(x,z)?null:heightAt(x,z),
      mesh:terrain,
      report:{mode:'source-dem',cached:false,vertices:GEO.cols*GEO.rows},
      contains:(x,z)=>pisteFootprintClearance(x,z).clearance<=0
    };`;
    source = source.replace('/* RAW_DEM_MODE */ true', String(rawDem));
    const localDem =
      rawDem && process.env.WANLONG_RAW_DEM !== '1' && process.env.WANLONG_LOCAL_DEM !== '0';
    source = source.replace('/* LOCAL_DEM_MODE */ false', String(localDem));
    const localHeader = localDem
      ? 'window.__LOCAL_TERRAIN_SOURCE_SHA__=' +
        JSON.stringify(require('./local-terrain-cache.cjs').fingerprint().sha256) +
        ';\n' +
        (process.env.WANLONG_LOCAL_CACHE !== '0'
          ? require('./local-terrain-cache.cjs').load()
          : 'window.__LOCAL_TERRAIN_CROSS_REFERENCE__=' +
            JSON.stringify(
              fs
                .readFileSync(path.join(root, 'baked/piste-crossfall-reference.bin'))
                .toString('base64'),
            ) +
            ';\n')
      : '';
    const finalCrossfall =
      localDem && process.env.WANLONG_LOCAL_CACHE !== '0'
        ? 'window.__FINAL_CROSSFALL_PATCH__=' +
          fs.readFileSync(path.join(root, 'baked/crossfall-local.json'), 'utf8') +
          ';\n'
        : '';
    source =
      localHeader +
      finalCrossfall +
      source.replace(
        '/* PISTE_GRADING */',
        () =>
          (localDem
            ? ['piste-grade-limiter.js', 'local-piste-terrain.js']
                .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
                .join('\n') + '\npisteGrading=applyLocalPisteTerrain();'
            : rawDem
              ? rawSurface
              : require('./grading-asset.cjs')(root)) +
          '\n' +
          fs.readFileSync(path.join(root, 'piste-foundations.js'), 'utf8'),
      );
  }
  if (tag === 'APP')
    source = source.replace(
      '/* SITE_RECONSTRUCTION */',
      () =>
        fs.readFileSync(path.join(root, 'site-reconstruction.js'), 'utf8') +
        '\n' +
        fs.readFileSync(path.join(root, 'hotel-access-bridges.js'), 'utf8') +
        '\nconst RESERVOIR_LAYOUT=' +
        fs.readFileSync(path.join(root, 'reservoir-layout.json'), 'utf8') +
        ';\n' +
        fs.readFileSync(path.join(root, 'reservoir.js'), 'utf8'),
    );
  if (tag === 'APP')
    source = source.replace('/* GEO_UI */', () =>
      fs.readFileSync(path.join(root, 'geo-ui.js'), 'utf8'),
    );
  if (tag === 'APP')
    source = source.replace(
      '/* GEO_REFERENCE */',
      () =>
        [
          'wild-corridors.js',
          'geo-reference.js',
          'scene-access.js',
          'magic-carpet-model.js',
          'weather-system.js',
          'official-map-features.js',
          'official-map-viewer.js',
          ...(internal ? ['registration-workbench.js'] : []),
        ]
          .map((f) => fs.readFileSync(path.join(root, f), 'utf8'))
          .join('\n') +
        (internal
          ? ''
          : '\nconst unregisteredImageryScreenshots=[];const registrationWorkbench=null;') +
        '\ninitHotelNightLighting();\ninitWeatherSystem();',
    );
  if (tag === 'APP') source = source.replace('/* REGISTRATION_FIT_AUDIT */', () => '{}');
  if (tag === 'APP')
    source = source
      .replace('/* REGISTRATION_IMAGERY_SOURCES */', () => '[]')
      .replace('/* OPEN_SKIMAP_ELEVATION_AUDIT */', () => '{}');
  if (tag === 'APP') source = source.replace('/* UNREGISTERED_IMAGERY_SCREENSHOTS */', () => '[]');
  if (tag === 'APP')
    source = source.replace('/* NIGHT_SCENE */', () =>
      fs.readFileSync(path.join(root, 'night-scene.js'), 'utf8'),
    );
  if (tag === 'APP') source = source.replace('__USER_MOSAIC__', 'runtime/mosaic-asset.js');
  if (tag === 'APP') {
    source = source.replace(
      "(()=>{'use strict';",
      "(()=>{'use strict';performance.mark('wanlong-app-start');",
    );
    source = source.replace(
      /renderList\(\);updateLabels\(\);drawMinimap\(\);\s+toggleCatalogue\(false\);/,
      "performance.mark('wanlong-scene-ready');renderList();updateLabels();drawMinimap();\n\ntoggleCatalogue(false);",
    );
  }
  if (tag === 'APP')
    source = source.replace('/* SUMMIT_BUILDINGS */', () =>
      fs.readFileSync(path.join(root, 'summit-buildings.js'), 'utf8'),
    );
  if (tag === 'APP')
    source = source.replace('/* DINING_UI */', () =>
      fs.readFileSync(path.join(root, 'dining-ui.js'), 'utf8'),
    );
  if (tag === 'APP') source = source.replace('/* REGISTRATION_OFFLINE_ASSETS */', () => '{}');
  if (tag === 'STYLES')
    html = html.replace(
      '<style>/* STYLES */</style>',
      '<link rel="stylesheet" href="styles.css?v=' + assetVersion(source) + '">',
    );
  else if (tag === 'THREE')
    html = html.replace(
      '<script>/* THREE */</script>',
      '<script defer src="vendor/three.min.js"></script>',
    );
  else {
    const output = (tag === 'DATA' ? 'data' : 'app') + suffix + '-bundle.js';
    new Function(source);
    outputs.set(output, source);
    const roadCache = '';
    html = html.replace(
      '<script>/* ' + tag + ' */</script>',
      roadCache + '<script defer src="' + output + '?v=' + assetVersion(source) + '"></script>',
    );
  }
}
html = html
  .replace('__SATELLITE__', 'research/imagery-multi-source/esri-full-resort-z17.jpg')
  .replace('__TRAIL_MAP__', '最新雪道图高清.jpg');
html = html
  .replace('id="satellite-data" src=', 'id="satellite-data" data-src=')
  .replace('id="trail-map-data" src=', 'id="trail-map-data" data-src=');
html = html.replace(
  '<button id="reference-fit">',
  '<button id="reference-prev" hidden aria-label="上一张卫星截图">上一张</button><button id="reference-next" hidden aria-label="下一张卫星截图">下一张</button><button id="reference-fit">',
);
if (!internal) {
  // Keep the bound elements but omit the internal imagery from the guest build.
  html = html.replace(
    / (?:src|data-src)="(?:__NIGHT_PHOTO__|__STATION_PHOTO__|__PARK_(?:[012]|USER|EXTRA_[238])__|research\/imagery-multi-source\/esri-full-resort-z17\.jpg)"/g,
    '',
  );
}
html = html
  .replace('卫星原图 ↗', '新卫星截图 ↗')
  .replaceAll('卫星地形参考', '新截图候选配准')
  .replace(
    'Source: Esri, Vantor, Earthstar Geographics, GIS User Community · 非实时影像',
    '用户提供腾讯地图 / Earthol 截图 · 候选配准 · 非测绘成果',
  );
for (let i = 0; i < 3; i++)
  html = html.replace('__PARK_' + i + '__', 'research/wechat-images/park-' + i + '.jpg');
for (const [tag, file] of [
  ['DINING_BREAKFAST', 'extra-14.jpg'],
  ['DINING_TEA', 'extra-20.jpg'],
  ['NIGHT_PHOTO', 'night-3-9.jpg'],
  ['STATION_PHOTO', 'night-2-1.jpg'],
])
  html = html.replace('__' + tag + '__', 'research/wechat-images/' + file);
for (const i of [2, 3, 8])
  html = html.replace('__PARK_EXTRA_' + i + '__', 'research/user-park/additional-' + i + '.jpg');
html = html.replace('__PARK_USER__', 'research/user-park/site-reference.jpg');
html = html.replace(/<img\b[^>]*\bsrc="[^"]*"[^>]*>/g, (tag) =>
  tag.includes(' loading=') ? tag : tag.replace(/>$/, ' loading="lazy" decoding="async">'),
);
html = html.replace(
  '</head>',
  '<!-- Third-party license: Three.js r160\n' +
    fs.readFileSync(path.join(root, 'vendor/THREE-LICENSE.txt'), 'utf8') +
    '\n-->\n</head>',
);
outputs.set('index' + suffix + '.html', html);
// Resolve inputs, validate the cache and parse both bundles before replacing any
// generated entry. A failed build must leave the previous usable scene intact.
for (const [file, content] of outputs) fs.writeFileSync(path.join(root, file), content);
console.log(
  'Built index' +
    suffix +
    '.html · ' +
    (Buffer.byteLength(html) / 1024).toFixed(0) +
    ' KiB shell · local assets only',
);

fs.mkdirSync(path.join(root, 'runtime'), { recursive: true });
fs.writeFileSync(path.join(root, 'runtime/mosaic-asset.js'), 'window.__WANLONG_MOSAIC__=null;');
