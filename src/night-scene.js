// Reference-inspired night lighting, NOT a surveyed lamp plan or a live opening map.
const nightLayer = new THREE.Group();
nightLayer.visible = false;
scene.add(nightLayer);
const nightPoleSpots = [];
const nightCanvas = document.createElement('canvas');
nightCanvas.width = nightCanvas.height = 1024;
const nc = nightCanvas.getContext('2d');
nc.fillStyle = '#000';
nc.fillRect(0, 0, 1024, 1024);
nc.globalCompositeOperation = 'lighter';
// Seasonal lighting coverage, not a live opening feed. Name keys avoid map-number / ID confusion.
// 2025-26 list corroborated by https://www.10100.com/article/47197618 and 2025-12-19 bulletin.
const nightRouteNames = [
  '长龙道',
  '卧龙道',
  '娇龙道',
  '玉龙道',
  '飞龙道',
  '小龙道',
  '银龙道',
  '金龙道',
  '翔龙道',
  '猛龙道',
  '大奔头',
  '威龙道',
  '腾龙道',
];
const nightRouteIds = trails.filter((t) => nightRouteNames.includes(t.name)).map((t) => t.id);
const nightSelectionCanvas = document.createElement('canvas');
nightSelectionCanvas.width = nightSelectionCanvas.height = 2048;
const nightSelectionContext = nightSelectionCanvas.getContext('2d'),
  nightSelectionTexture = new THREE.CanvasTexture(nightSelectionCanvas);
nightSelectionTexture.minFilter = nightSelectionTexture.magFilter = THREE.LinearFilter;
function refreshNightSelection() {
  const c = nightSelectionContext;
  c.clearRect(0, 0, 2048, 2048);
  const t = trails.find((t) => t.id === surfaceSelectedId);
  if (t) {
    c.save();
    c.scale(2048 / SURFACE_SIZE, 2048 / SURFACE_SIZE);
    surfacePiste({ context: c, texture: nightSelectionTexture }, t, 0.98, '#777777');
    surfacePiste({ context: c, texture: nightSelectionTexture }, t, 0.76, '#ffffff');
    c.restore();
  }
  nightSelectionTexture.needsUpdate = true;
}
function lightPool(x, z, rx, rz, strength) {
  const u = ((x - GEO.extent[0]) / (GEO.extent[2] - GEO.extent[0])) * 1024,
    v = (1 - (z - GEO.extent[1]) / (GEO.extent[3] - GEO.extent[1])) * 1024;
  nc.save();
  nc.translate(u, v);
  nc.scale(
    (rx / (GEO.extent[2] - GEO.extent[0])) * 1024,
    (rz / (GEO.extent[3] - GEO.extent[1])) * 1024,
  );
  const grad = nc.createRadialGradient(0, 0, 0.04, 0, 0, 1);
  grad.addColorStop(0, 'rgba(255,255,255,' + strength + ')');
  grad.addColorStop(0.42, 'rgba(255,255,255,' + strength * 0.7 + ')');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  nc.fillStyle = grad;
  nc.beginPath();
  nc.arc(0, 0, 1, 0, Math.PI * 2);
  nc.fill();
  nc.restore();
}
// Overlapping floodlights make a continuous snowy surface, with darker edges and local variation.
for (const t of trails.filter((t) => t.mapped && nightRouteIds.includes(t.id))) {
  nc.save();
  nc.scale(0.5, 0.5);
  nc.shadowColor = 'rgba(255,255,255,.5)';
  nc.shadowBlur = 9;
  surfacePiste({ context: nc, texture: {} }, t, 1.15, 'rgba(255,255,255,.47)');
  nc.restore();
}
for (const t of trails.filter((t) => t.mapped && nightRouteIds.includes(t.id))) {
  const n = Math.ceil(t.modelLength / 95);
  for (let i = 0; i <= n; i++) {
    const p = t.curve.getPoint(i / n),
      tan = t.curve.getTangent(i / n),
      side = new V(-tan.z, 0, tan.x).normalize(),
      q = p.clone().addScaledVector(side, trailWidthAt(t, i / n).plus + 2);
    if (nearFacility(q.x, q.z, 8)) continue;
    lightPool(p.x, p.z, 47, 47, 0.18);
  }
}
for (const h of hotels.filter((h) => h.id <= 4))
  lightPool(h.modelCenter.x, h.modelCenter.z, 65, 65, 0.35);
const nightTexture = new THREE.CanvasTexture(nightCanvas);
nightTexture.minFilter = THREE.LinearFilter;
nightTexture.magFilter = THREE.LinearFilter;
const nightUniform = { value: 0 };
function nightSurface(mat, strength) {
  const previous = mat.onBeforeCompile,
    previousKey = mat.customProgramCacheKey.call(mat);
  mat.onBeforeCompile = (shader) => {
    previous.call(mat, shader);
    shader.uniforms.uNight = nightUniform;
    shader.uniforms.uNightSelection = { value: nightSelectionTexture };
    shader.uniforms.uNightMap = { value: nightTexture };
    shader.vertexShader = 'varying vec2 vNightUV;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvec4 nP=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nnP=instanceMatrix*nP;\n#endif\nnP=modelMatrix*nP;\nvNightUV=vec2((nP.x-(' +
        GEO.extent[0].toFixed(4) +
        '))/' +
        (GEO.extent[2] - GEO.extent[0]).toFixed(4) +
        ',(nP.z-(' +
        GEO.extent[1].toFixed(4) +
        '))/' +
        (GEO.extent[3] - GEO.extent[1]).toFixed(4) +
        ');',
    );
    shader.fragmentShader =
      'uniform float uNight;uniform sampler2D uNightSelection;uniform sampler2D uNightMap;varying vec2 vNightUV;\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\nfloat nLight=texture2D(uNightMap,clamp(vNightUV,0.0,1.0)).r;\ntotalEmissiveRadiance+=vec3(.94,.975,1.0)*nLight*uNight*' +
        strength.toFixed(2) +
        ';',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      '#include <opaque_fragment>\nfloat selectedNight=texture2D(uNightSelection,clamp(vNightUV,0.0,1.0)).r;\ngl_FragColor.rgb=mix(gl_FragColor.rgb,mix(vec3(.008,.045,.065),vec3(.02,.68,.85),smoothstep(.52,.8,selectedNight)),smoothstep(.03,.3,selectedNight)*uNight);',
    );
  };
  mat.customProgramCacheKey = () => previousKey + 'night-selected-field-v2-' + strength;
  mat.needsUpdate = true;
}
nightSurface(snowMat, 0.8);
trails.forEach((t) => {
  if (t.mesh) nightSurface(t.mesh.material, 0.85);
});
// No physical piste lamps without verified siting. Lighting is a surface effect only.
// Warm pools follow modelled entrance / road courts in each building's local
// frame. A world-axis bounding box can put frontage lights on the uphill back.
// This is a visual lighting plan, not surveyed lamp positions.
const hotelNightLayer = new THREE.Group();
hotelNightLayer.name = 'Hotel exterior night lighting';
hotelNightLayer.visible = false;
scene.add(hotelNightLayer);
const hotelNightSpots = [],
  hotelLightCanvas = document.createElement('canvas');
hotelLightCanvas.width = hotelLightCanvas.height = 1024;
const hotelLightContext = hotelLightCanvas.getContext('2d');
hotelLightContext.fillStyle = '#000';
hotelLightContext.fillRect(0, 0, 1024, 1024);
const hotelLightTexture = new THREE.CanvasTexture(hotelLightCanvas);
hotelLightTexture.minFilter = hotelLightTexture.magFilter = THREE.LinearFilter;
function hotelLightPool(x, z, rx, rz, strength) {
  const c = hotelLightContext,
    u = ((x - GEO.extent[0]) / (GEO.extent[2] - GEO.extent[0])) * 1024,
    v = (1 - (z - GEO.extent[1]) / (GEO.extent[3] - GEO.extent[1])) * 1024;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.translate(u, v);
  c.scale(
    (rx / (GEO.extent[2] - GEO.extent[0])) * 1024,
    (rz / (GEO.extent[3] - GEO.extent[1])) * 1024,
  );
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, 'rgba(255,255,255,' + strength + ')');
  g.addColorStop(0.35, 'rgba(255,255,255,' + strength * 0.65 + ')');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, 1, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
function hotelNightSurface(mat, strength) {
  if (!mat || mat.userData.hotelNightSurface) return;
  mat.userData.hotelNightSurface = true;
  const previous = mat.onBeforeCompile,
    key = mat.customProgramCacheKey.call(mat);
  mat.onBeforeCompile = (shader) => {
    previous.call(mat, shader);
    shader.uniforms.uHotelNight = nightUniform;
    shader.uniforms.uHotelLightMap = { value: hotelLightTexture };
    shader.vertexShader = 'varying vec2 vHotelLightUV;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvec4 hotelP=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nhotelP=instanceMatrix*hotelP;\n#endif\nhotelP=modelMatrix*hotelP;\nvHotelLightUV=vec2((hotelP.x-(' +
        GEO.extent[0].toFixed(4) +
        '))/' +
        (GEO.extent[2] - GEO.extent[0]).toFixed(4) +
        ',(hotelP.z-(' +
        GEO.extent[1].toFixed(4) +
        '))/' +
        (GEO.extent[3] - GEO.extent[1]).toFixed(4) +
        ');',
    );
    shader.fragmentShader =
      'uniform float uHotelNight;uniform sampler2D uHotelLightMap;varying vec2 vHotelLightUV;\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\nfloat hotelLux=texture2D(uHotelLightMap,clamp(vHotelLightUV,0.0,1.0)).r;\ntotalEmissiveRadiance+=vec3(1.0,.72,.40)*hotelLux*uHotelNight*' +
        strength.toFixed(3) +
        ';',
    );
  };
  mat.customProgramCacheKey = () => key + 'hotel-exterior-' + strength;
  mat.needsUpdate = true;
}
function initHotelNightLighting() {
  for (const h of hotels.filter((h) => h.id <= 5 && h.group?.visible !== false)) {
    const site = hotelDisplaySites.find((s) => s.owner === 'hotel-' + h.id),
      court =
        site?.regions.find((r) => r.kind === 'lower-road') ||
        site?.regions.find((r) => r.kind === 'arrival-court');
    const world = (p) => h.group.localToWorld(new V(p[0], 0, p[1])),
      road = h.siteAccess ? world(h.siteAccess.road) : h.modelCenter.clone(),
      entrance = h.siteAccess ? world(h.siteAccess.lobby) : road;
    let axis = new V(1, 0, 0),
      width = 30;
    if (court) {
      let longest = 0;
      for (let i = 0; i < court.polygon.length; i++) {
        const a = court.polygon[i],
          b = court.polygon[(i + 1) % court.polygon.length],
          d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d > longest) {
          longest = d;
          axis.set((b[0] - a[0]) / d, 0, (b[1] - a[1]) / d);
        }
      }
      width = Math.min(longest * 0.8, 100);
    }
    for (let i = 0; i < 4; i++) {
      const p = road.clone().addScaledVector(axis, ((i + 0.5) / 4 - 0.5) * width),
        y = displayGroundHeightAt(p.x, p.z);
      hotelNightSpots.push({
        hotelId: h.id,
        x: p.x,
        y: y + 3,
        z: p.z,
        reference: 'modelled entrance court / access road; estimated lighting',
      });
      hotelLightPool(p.x, p.z, 23, 23, 0.3);
    }
    hotelLightPool(entrance.x, entrance.z, 25, 25, 0.35);
    // Broad, low illumination makes the forecourt legible between individual
    // lamps. Five non-shadowing sources illuminate the facade normals too.
    const y = displayGroundHeightAt(road.x, road.z),
      lamp = new THREE.PointLight('#ffd69e', 280, 85, 2);
    lamp.position.set(road.x, y + 5, road.z);
    lamp.castShadow = false;
    hotelNightLayer.add(lamp);
  }
  hotelLightTexture.needsUpdate = true;
  hotelNightSurface(snowMat, 0.65);
  for (const m of Object.values(facadeMats)) hotelNightSurface(m, 0.14);
  for (const s of hotelDisplaySites) hotelNightSurface(s.surfaceMesh?.material, 0.65);
}
function setNightScene(on) {
  nightUniform.value = on ? 1 : 0;
  nightLayer.visible = on;
  hotelNightLayer.visible = on;
  $('night-note').hidden = !on;
  fill.intensity = on ? 0.035 : 0.6;
}
