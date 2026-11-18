// One terrain surface owns piste colours, selection and reference fills. No coplanar ribbons.
const SURFACE_SIZE = 2048,
  SURFACE_X = GEO.extent[2] - GEO.extent[0],
  SURFACE_Z = GEO.extent[3] - GEO.extent[1];
function surfaceLayer(size = SURFACE_SIZE) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d'),
    texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.premultiplyAlpha = true;
  return { canvas, context, texture };
}
// Wild and bike references currently open the official map rather than
// painting a geographic fill. Their shader inputs are transparent placeholders.
const surfaceLayers = {
  forest: surfaceLayer(512),
  piste: surfaceLayer(),
  wild: surfaceLayer(1),
  bike: surfaceLayer(1),
  cut: surfaceLayer(),
  site: surfaceLayer(),
};
surfaceLayers.cut.texture.minFilter = surfaceLayers.cut.texture.magFilter = THREE.NearestFilter;
surfaceLayers.cut.texture.generateMipmaps = false;
surfaceLayers.cut.texture.premultiplyAlpha = false;
const surfaceState = {
    routes: { value: 0 },
    wild: { value: 0 },
    bike: { value: 0 },
    forestBoundary: { value: 0 },
  },
  siteCuts = [];
// Keep every existing control on the same state, without a second set of lines.
Object.defineProperty(geoOverlay, 'visible', {
  configurable: true,
  get: () => surfaceState.forestBoundary.value === 1,
  set: (value) => {
    surfaceState.forestBoundary.value = value ? 1 : 0;
  },
});
geoOverlay.userData.boundarySource = 'visible-forest-mask-minus-piste-and-site';
function surfacePixel(p) {
  return [
    ((p[0] - GEO.extent[0]) / SURFACE_X) * SURFACE_SIZE,
    (1 - (p[1] - GEO.extent[1]) / SURFACE_Z) * SURFACE_SIZE,
  ];
}
function surfacePath(ctx, points, close = false) {
  ctx.beginPath();
  points.forEach((p, i) => {
    const [x, y] = surfacePixel(p);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  if (close) ctx.closePath();
}
function surfaceStroke(layer, points, width, color) {
  const c = layer.context;
  c.save();
  c.lineWidth = (width / SURFACE_X) * SURFACE_SIZE;
  c.strokeStyle = color;
  c.lineCap = c.lineJoin = 'round';
  surfacePath(c, points);
  c.stroke();
  c.restore();
  layer.texture.needsUpdate = true;
}
function surfacePolygon(layer, points, fill, border = null, width = 2) {
  const c = layer.context;
  c.save();
  surfacePath(c, points, true);
  c.fillStyle = fill;
  c.fill('evenodd');
  if (border) {
    c.lineWidth = (width / SURFACE_X) * SURFACE_SIZE;
    c.strokeStyle = border;
    c.lineJoin = 'round';
    c.stroke();
  }
  c.restore();
  layer.texture.needsUpdate = true;
}
let surfaceSelectedId = null,
  surfaceSelectedColour = '#b89659';
const pisteSurfaceObstacles = [];
const reviewedBaseRoadPixels = /* REVIEWED_BASE_ROADS */ [];
const reviewedBaseRoadPath = new Path2D();
for (const polygon of reviewedBaseRoadPixels) {
  polygon.forEach(([u, v], i) => {
    const radius = 6378137;
    const lon =
      (12842032.24813589 + (u * (12848147.210398708 - 12842032.24813589)) / 4096) / radius / DEG;
    const lat =
      Math.atan(
        Math.sinh(
          (5009071.33758417 - (v * (5009071.33758417 - 5003567.8715476375)) / 3686) / radius,
        ),
      ) / DEG;
    const [x, y] = surfacePixel(projectGeo([lon, lat]));
    i ? reviewedBaseRoadPath.lineTo(x, y) : reviewedBaseRoadPath.moveTo(x, y);
  });
  reviewedBaseRoadPath.closePath();
}
const pistePaintPaths = new WeakMap();
function cachedPistePath(trail, scale) {
  const points = trail.displayPoints || trail.points,
    edges = trail.displayEdges || trail.edges;
  let entry = pistePaintPaths.get(trail);
  if (!entry || entry.points !== points || entry.edges !== edges) {
    entry = { points, edges, paths: new Map() };
    pistePaintPaths.set(trail, entry);
  }
  if (!entry.paths.has(scale)) {
    const path = new Path2D();
    surfacePistePath(path, trail, scale);
    entry.paths.set(scale, path);
  }
  return entry.paths.get(scale);
}
function surfacePistePath(c, trail, scale) {
  const points = trail.displayPoints || trail.points,
    edges = trail.displayEdges || trail.edges;
  // Fill segment quads as a union: hairpins/shared sections must not cut even-odd holes.
  for (let i = 1; i < edges.length; i++) {
    const polygon = [];
    for (const [j, key] of [
      [i - 1, 'minus'],
      [i, 'minus'],
      [i, 'plus'],
      [i - 1, 'plus'],
    ])
      polygon.push([
        lerp(points[j].x, edges[j][key][0], scale),
        lerp(points[j].z, edges[j][key][1], scale),
      ]);
    // All subpaths need the same winding for a true nonzero union, including
    // reversed source lines and folds at a tight bend.
    if (
      polygon.reduce((s, p, j) => {
        const q = polygon[(j + 1) % polygon.length];
        return s + p[0] * q[1] - q[0] * p[1];
      }, 0) < 0
    )
      polygon.reverse();
    polygon.forEach((p, j) => {
      const [x, y] = surfacePixel(p);
      j ? c.lineTo(x, y) : c.moveTo(x, y);
    });
    c.closePath();
  }
}
function surfacePiste(layer, trail, scale, color) {
  const c = layer.context;
  c.save();
  c.fillStyle = color;
  c.fill(cachedPistePath(trail, scale), 'nonzero');
  c.restore();
  layer.texture.needsUpdate = true;
}
let pistePaintBase = null;
function repaintPistes() {
  const l = surfaceLayers.piste,
    mapped = trails.filter((t) => t.mapped);
  l.context.clearRect(0, 0, SURFACE_SIZE, SURFACE_SIZE);
  const references = mapped.flatMap((t) => [
    t.displayPoints || t.points,
    t.displayEdges || t.edges,
  ]);
  const baseChanged =
    !pistePaintBase ||
    pistePaintBase.routes !== surfaceState.routes.value ||
    pistePaintBase.obstacles !== pisteSurfaceObstacles.length ||
    references.some((r, i) => r !== pistePaintBase.references[i]);
  if (baseChanged) {
    // All snow beds first. A later trail's white bed must never erase an earlier colour.
    // Paint the union once: per-trail alpha compositing made shared junctions
    // brighter than either incoming piste (0.96 -> 0.9984 at a two-way overlap).
    const union = new Path2D();
    for (const t of mapped) union.addPath(cachedPistePath(t, 1));
    for (const { polygon } of reviewedSnowJunctions) {
      const area = polygon.reduce((sum, p, i) => {
        const q = polygon[(i + 1) % polygon.length];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0);
      (area < 0 ? polygon.slice().reverse() : polygon).forEach((p, i) => {
        const [x, y] = surfacePixel(p);
        i ? union.lineTo(x, y) : union.moveTo(x, y);
      });
      union.closePath();
    }
    l.context.save();
    l.context.fillStyle = 'rgba(249,252,252,.96)';
    l.context.fill(union, 'nonzero');
    l.context.restore();
    if (surfaceState.routes.value)
      for (const t of [...mapped].sort(
        (a, b) =>
          ({ hard: 0, medium: 1, easy: 2 })[a.level] - { hard: 0, medium: 1, easy: 2 }[b.level],
      )) {
        const c = new THREE.Color(levels[t.level].color);
        surfacePiste(
          l,
          t,
          0.82,
          'rgba(' +
            [c.r, c.g, c.b].map((v) => Math.round(Math.pow(v, 1 / 2.2) * 255)).join(',') +
            ',.88)',
        );
      }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SURFACE_SIZE;
    canvas.getContext('2d').drawImage(l.canvas, 0, 0);
    pistePaintBase = {
      canvas,
      references,
      routes: surfaceState.routes.value,
      obstacles: pisteSurfaceObstacles.length,
    };
  } else l.context.drawImage(pistePaintBase.canvas, 0, 0);
  const t = mapped.find((t) => t.id === surfaceSelectedId);
  if (t) {
    l.context.save();
    l.context.globalAlpha = 0.74;
    surfacePiste(l, t, 0.84, surfaceSelectedColour);
    l.context.restore();
  }
  // Source widths remain in the data. A footprint is never painted as skiable
  // through an actual building / station, even where an estimated edge overlaps.
  l.context.save();
  l.context.globalCompositeOperation = 'destination-out';
  l.context.fill(reviewedBaseRoadPath, 'evenodd');
  for (const o of pisteSurfaceObstacles) {
    surfacePath(l.context, o.polygon, true);
    l.context.fill();
    if (o.pad) {
      l.context.lineWidth = ((o.pad * 2) / SURFACE_X) * SURFACE_SIZE;
      l.context.lineJoin = 'round';
      l.context.strokeStyle = '#000';
      l.context.stroke();
    }
  }
  l.context.restore();
  l.texture.needsUpdate = true;
}
function setSurfaceSelection(id, colour = '#b89659') {
  surfaceSelectedId = id;
  surfaceSelectedColour = colour;
  repaintPistes();
  if (typeof refreshNightSelection === 'function') refreshNightSelection();
}
function setSurfaceRouteColours(on) {
  surfaceState.routes.value = on ? 1 : 0;
  repaintPistes();
}
// hotelSnowFlow paints once after final display boundaries are available.
function addSiteCut(polygon, base) {
  siteCuts.push({ polygon, base });
  const encoded = Math.round((base + 100) * 10),
    r = 255,
    g = Math.floor(encoded / 256),
    b = encoded % 256;
  surfacePolygon(surfaceLayers.cut, polygon, 'rgb(' + r + ',' + g + ',' + b + ')');
}
const originalTerrainHook = snowMat.onBeforeCompile;
snowMat.onBeforeCompile = function (shader) {
  originalTerrainHook.call(this, shader);
  for (const key of Object.keys(surfaceLayers))
    shader.uniforms['uSurface_' + key] = { value: surfaceLayers[key].texture };
  shader.uniforms.uForestBoundaries = surfaceState.forestBoundary;
  shader.uniforms.uRouteColours = surfaceState.routes;
  shader.uniforms.uWildFill = surfaceState.wild;
  shader.uniforms.uBikeFill = surfaceState.bike;
  shader.uniforms.uTerrainCuts = { value: this.userData.displayGroundOwner ? 0 : 1 };
  shader.vertexShader =
    'varying vec2 vSurfaceUV;varying float vSurfaceHeight;\n' + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\nvSurfaceUV=vec2((position.x-(' +
      GEO.extent[0].toFixed(5) +
      '))/' +
      SURFACE_X.toFixed(5) +
      ',(position.z-(' +
      GEO.extent[1].toFixed(5) +
      '))/' +
      SURFACE_Z.toFixed(5) +
      ');vSurfaceHeight=position.y;',
  );
  shader.fragmentShader =
    'varying vec2 vSurfaceUV;varying float vSurfaceHeight;uniform float uForestBoundaries,uRouteColours,uWildFill,uBikeFill,uTerrainCuts;' +
    Object.keys(surfaceLayers)
      .map((k) => 'uniform sampler2D uSurface_' + k + ';')
      .join('') +
    '\nvec3 surfaceRGB(vec4 t){return pow(clamp(t.rgb/max(t.a,.001),0.0,1.0),vec3(2.2));}\n' +
    shader.fragmentShader;
  const sitePoints = siteCuts.flatMap((c) => c.polygon),
    siteMin = surfacePixel([
      Math.min(...sitePoints.map((p) => p[0])) - 100,
      Math.min(...sitePoints.map((p) => p[1])) - 100,
    ]),
    siteMax = surfacePixel([
      Math.max(...sitePoints.map((p) => p[0])) + 100,
      Math.max(...sitePoints.map((p) => p[1])) + 100,
    ]);
  const region =
    'vSurfaceUV.x>' +
    (siteMin[0] / SURFACE_SIZE).toFixed(6) +
    '&&vSurfaceUV.x<' +
    (siteMax[0] / SURFACE_SIZE).toFixed(6) +
    '&&vSurfaceUV.y>' +
    (1 - siteMin[1] / SURFACE_SIZE).toFixed(6) +
    '&&vSurfaceUV.y<' +
    (1 - siteMax[1] / SURFACE_SIZE).toFixed(6);
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    '#include <color_fragment>\nfloat forestSnow=texture2D(uSurface_forest,vSurfaceUV).a;diffuseColor.rgb*=mix(vec3(1.0),vec3(.755,.835,.89),forestSnow);\nif(' +
      region +
      '){vec4 sc=texture2D(uSurface_cut,vSurfaceUV);float cutHeight=(floor(sc.g*255.0+.5)*256.0+floor(sc.b*255.0+.5))*.1-100.0;if(uTerrainCuts>.5&&sc.r>.9&&vSurfaceHeight>cutHeight+.05)discard;vec4 sy=texture2D(uSurface_site,vSurfaceUV);diffuseColor.rgb=mix(diffuseColor.rgb,surfaceRGB(sy),sy.a);}' +
      '\nvec4 sw=vec4(0.0);if(uWildFill>.5){sw=texture2D(uSurface_wild,vSurfaceUV);}' +
      '\nvec4 sp=texture2D(uSurface_piste,vSurfaceUV);diffuseColor.rgb=mix(diffuseColor.rgb,surfaceRGB(sp),sp.a);' +
      '\nvec4 sb=vec4(0.0);if(uBikeFill>.5){sb=texture2D(uSurface_bike,vSurfaceUV);}',
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <tonemapping_fragment>',
    '#include <tonemapping_fragment>\nif(uRouteColours>.5)gl_FragColor.rgb=mix(gl_FragColor.rgb,surfaceRGB(sp),sp.a*.44);if(uWildFill>.5){float regionOpacity=mix(sw.a*.65*(1.0-sp.a*.85),sw.a*.86,smoothstep(.76,.99,sw.a));regionOpacity*=1.0-smoothstep(.005,.02,sp.a);gl_FragColor.rgb=mix(gl_FragColor.rgb,surfaceRGB(sw),regionOpacity);}if(uBikeFill>.5)gl_FragColor.rgb=mix(gl_FragColor.rgb,surfaceRGB(sb),sb.a*.88);if(uForestBoundaries>.5){float woodland=forestSnow*(1.0-sp.a)*(1.0-texture2D(uSurface_site,vSurfaceUV).a);float edge=1.0-smoothstep(0.0,max(fwidth(woodland)*1.2,.001),abs(woodland-.20));gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.16,.43,.32),edge*.9);}',
  );
};
snowMat.customProgramCacheKey = () => 'terrain-unified-surface-v6-current-forest-boundary';

const terrainSurfaceShaderHook = snowMat.onBeforeCompile,
  terrainSurfaceCacheKey = snowMat.customProgramCacheKey.call(snowMat);
