// Local visual simulation. These controls are not observations or an astronomical ephemeris.
// The shared source terrain, trail centre lines, towers and buildings are never changed here.
const weatherPresets = {
  clear: {
    label: '晴朗',
    fog: 0.000072,
    direct: 1,
    ambient: 1,
    fill: 1,
    cloud: 0,
    wind: 15,
    snow: 0,
  },
  cloudy: {
    label: '多云',
    fog: 0.000105,
    direct: 0.4,
    ambient: 1.1,
    fill: 1.14,
    cloud: 0.75,
    wind: 25,
    snow: 0,
  },
  snow: {
    label: '降雪',
    fog: 0.00015,
    direct: 0.25,
    ambient: 1.13,
    fill: 1.1,
    cloud: 0.9,
    wind: 30,
    snow: 50,
  },
  mist: {
    label: '薄雾',
    fog: 0.00024,
    direct: 0.3,
    ambient: 1.07,
    fill: 1.05,
    cloud: 0.68,
    wind: 8,
    snow: 0,
  },
};
const environmentFrames = [
  { h: 0, bg: '#101b2a', sun: '#a5bedf', power: 0.18, hemi: 0.32, fill: 0.1, exposure: 1.13 },
  { h: 5.5, bg: '#182a3b', sun: '#a5bad5', power: 0.2, hemi: 0.38, fill: 0.12, exposure: 1.12 },
  { h: 6.5, bg: '#c7bdc0', sun: '#ffc78d', power: 1.2, hemi: 0.91, fill: 0.34, exposure: 1.02 },
  { h: 8, bg: '#d5e3eb', sun: '#fff0d7', power: 2.65, hemi: 1.05, fill: 0.36, exposure: 0.98 },
  { h: 12, bg: '#dce8ec', sun: '#fff0d5', power: 2.85, hemi: 1.12, fill: 0.38, exposure: 0.96 },
  { h: 15.5, bg: '#e5dfd5', sun: '#ffdcaa', power: 2.65, hemi: 1.02, fill: 0.34, exposure: 0.99 },
  { h: 16.5, bg: '#e8d3c1', sun: '#ffb76f', power: 2.05, hemi: 0.92, fill: 0.3, exposure: 1.02 },
  { h: 17.5, bg: '#9b9eaf', sun: '#f7c5b2', power: 0.52, hemi: 0.7, fill: 0.23, exposure: 1.07 },
  { h: 18.5, bg: '#101b2a', sun: '#a5bedf', power: 0.18, hemi: 0.32, fill: 0.1, exposure: 1.13 },
  { h: 24, bg: '#101b2a', sun: '#a5bedf', power: 0.18, hemi: 0.32, fill: 0.1, exposure: 1.13 },
];
const weatherState = {
  initialized: false,
  hour: 11.5,
  preset: 'clear',
  auto: false,
  snowClock: 0,
  lastHour: NaN,
  lastPreset: null,
  lastNight: null,
  lastShadowHour: NaN,
  elapsed: 0,
  snowSignature: '',
  lightUpdates: 0,
};
function environmentTimeLabel(hour) {
  const minutes = Math.round((((hour % 24) + 24) % 24) * 60) % 1440;
  return (
    String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0')
  );
}
function environmentFrameAt(hour) {
  let i = 1;
  while (i < environmentFrames.length - 1 && environmentFrames[i].h < hour) i++;
  const a = environmentFrames[i - 1],
    b = environmentFrames[i],
    t = clamp((hour - a.h) / (b.h - a.h || 1), 0, 1),
    out = {};
  for (const k of ['power', 'hemi', 'fill', 'exposure']) out[k] = lerp(a[k], b[k], t);
  out.bg = new THREE.Color(a.bg).lerp(new THREE.Color(b.bg), t);
  out.sun = new THREE.Color(a.sun).lerp(new THREE.Color(b.sun), t);
  return out;
}
function setEnvironmentHour(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return;
  weatherState.hour = clamp(h, 0, 24);
  state.environmentHour = weatherState.hour;
  applyWeatherLighting(true);
}
function setEnvironmentTimePreset(time) {
  setEnvironmentHour({ day: 11.5, golden: 16.5, night: 20 }[time] ?? 11.5);
}
function setEnvironmentSnow(on) {
  state.snow = !!on;
  // A deliberate enable after setting density to zero must have a visible result.
  if (on && state.intensity <= 0) {
    state.intensity = 32;
    $('snow-range').value = 32;
  }
  syncEnvironmentSnow();
}
function toggleEnvironmentSnow() {
  setEnvironmentSnow(!state.snow);
}
function setEnvironmentSnowAmount(value) {
  state.intensity = clamp(Number(value) || 0, 0, 100);
  $('snow-range').value = state.intensity;
  state.snow = state.intensity > 0;
  syncEnvironmentSnow();
}
function syncEnvironmentSnow() {
  const count = Math.floor((snowCount * clamp(state.intensity, 0, 100)) / 100),
    on = state.snow && count > 0 && !state.imagery && state.mode !== 'architecture';
  snow.visible = on;
  snowGeo.setDrawRange(0, count);
  $('snow-toggle').classList.toggle('on', state.snow);
  $('snow-toggle').setAttribute('aria-pressed', String(state.snow));
  $('snow-toggle').title = state.snow ? '关闭飘雪' : '开启飘雪';
  $('snow-value').value =
    state.intensity === 0
      ? '无雪'
      : state.intensity < 35
        ? '轻雪'
        : state.intensity < 70
          ? '纷雪'
          : '大雪';
  $('snow-toggle').querySelector('.word').textContent = state.snow ? '飘雪' : '飘雪关';
  weatherState.snowSignature = [state.snow, state.intensity, state.imagery, state.mode].join('|');
}
function setWeatherPreset(id, options = {}) {
  if (!weatherPresets[id]) return;
  weatherState.preset = id;
  state.weather = id;
  if (!options.preserveSnow) {
    const p = weatherPresets[id];
    state.intensity = p.snow;
    state.snow = p.snow > 0;
    state.wind = p.wind;
    $('snow-range').value = state.intensity;
    $('wind-range').value = state.wind;
    snowUniforms.uWind.value = state.wind / 100;
    $('wind-value').value = state.wind < 30 ? '微风' : state.wind < 65 ? '山风' : '劲风';
  }
  document.querySelectorAll('#weather-presets button').forEach((b) => {
    const active = b.dataset.weather === id;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  syncEnvironmentSnow();
  applyWeatherLighting(true);
}
function environmentFogDensity() {
  const p = weatherPresets[weatherState.preset],
    night = weatherState.hour < 6 || weatherState.hour >= 18;
  // Keep the whole mountain readable in the distant atlas view. At close range,
  // the full preset density restores the depth of the local fog.
  const span = state.mode === 'orbit' ? Math.max(3600, orbit.radius) : 3600;
  return (p.fog * (night ? 0.85 : 1) * 3600) / span;
}
function applyWeatherLighting(force = false) {
  const h = weatherState.hour,
    preset = weatherPresets[weatherState.preset],
    frame = environmentFrameAt(h);
  if (
    !force &&
    Math.abs(h - weatherState.lastHour) < 1 / 120 &&
    weatherState.lastPreset === weatherState.preset
  )
    return;
  const night = h < 6 || h >= 18,
    period = night ? 'night' : h < 7.5 || h >= 15.5 ? 'golden' : 'day',
    nightStrength =
      h < 12 ? 1 - THREE.MathUtils.smoothstep(h, 5.5, 7) : THREE.MathUtils.smoothstep(h, 17, 18.5);
  state.time = period;
  state.environmentHour = h;
  if (weatherState.lastNight !== night) {
    setNightScene(night);
    document.body.classList.toggle('night', night);
    weatherState.lastNight = night;
    drawMinimap();
  }
  nightUniform.value = nightStrength;
  hotelNightLayer.visible = nightStrength > 0.001;
  const cloudyDay = new THREE.Color('#cbd5dc'),
    cloudyNight = new THREE.Color('#182431'),
    bg = frame.bg
      .clone()
      .lerp(night ? cloudyNight : cloudyDay, preset.cloud * (night ? 0.4 : 0.56));
  scene.background.copy(bg);
  scene.fog.color.copy(bg);
  scene.fog.density = environmentFogDensity();
  ground.material.color.copy(bg);
  document.body.style.backgroundColor = '#' + bg.getHexString();
  sun.color.copy(frame.sun);
  sun.intensity = frame.power * lerp(preset.direct, Math.max(0.65, preset.direct), nightStrength);
  hemi.intensity = frame.hemi * preset.ambient;
  hemi.color.set(
    night
      ? '#98b8db'
      : preset.cloud > 0.4
        ? '#d9e5ed'
        : period === 'golden'
          ? '#d4dce9'
          : '#d9edff',
  );
  hemi.groundColor.set(night ? '#6f8599' : '#abb7ad');
  fill.intensity = frame.fill * preset.fill;
  fill.color.set(night ? '#9ebbd9' : '#d4e6ef');
  renderer.toneMappingExposure = frame.exposure * (preset.cloud > 0.4 ? 1.04 : 1);
  // West is +X and north is +Z in this model. The daytime arc crosses the southern sky.
  const angle = ((h - 6) / 12) * Math.PI,
    offset = night
      ? new V(-1600, 2200, 1200)
      : new V(-Math.cos(angle) * 3500, Math.max(180, Math.sin(angle) * 2600), -1500);
  palettes[period].sunPos = offset.toArray();
  sun.position.copy(sun.target.position).add(offset);
  warmMat.emissiveIntensity = lerp(0.15, 2, nightStrength);
  hotelLights.forEach((m) => (m.emissiveIntensity = lerp(0.08, 1.5, nightStrength)));
  snowUniforms.uOpacity.value = lerp(0.86, 0.9, nightStrength);
  if (snowUniforms.uNight) snowUniforms.uNight.value = night ? 1 : 0;
  if (
    force ||
    weatherState.lastPreset !== weatherState.preset ||
    !Number.isFinite(weatherState.lastShadowHour) ||
    Math.abs(h - weatherState.lastShadowHour) > 0.12
  ) {
    renderer.shadowMap.needsUpdate = true;
    weatherState.lastShadowHour = h;
  }
  $('time-label').value = environmentTimeLabel(h);
  if ($('environment-hour')) $('environment-hour').value = h;
  if ($('environment-hour-value')) $('environment-hour-value').value = environmentTimeLabel(h);
  document
    .querySelectorAll('#time-segments button')
    .forEach((b) => b.classList.toggle('active', b.dataset.time === period));
  weatherState.lastHour = h;
  weatherState.lastPreset = weatherState.preset;
  weatherState.lightUpdates++;
}
function initWeatherSystem() {
  if (weatherState.initialized) return;
  weatherState.initialized = true;
  const style = document.createElement('style');
  style.textContent =
    '.weather-heading{margin:18px 0 9px;font-size:12px;font-weight:500}.weather-note{font-size:10px;line-height:1.8;color:var(--muted);margin:9px 0 0}.weather-presets{display:grid;grid-template-columns:1fr 1fr;gap:6px}.weather-presets button{border:1px solid var(--line);border-radius:7px;min-height:36px;font-size:12px;padding:8px}.weather-presets button.active{color:#fff;background:#365e64;border-color:#365e64}.weather-clock{border-bottom:1px solid var(--line);padding-bottom:15px}.weather-clock .switch-row{font-size:11px;padding-bottom:0}.weather-clock .time-ticks{display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-top:7px}.weather-presets button:hover{border-color:#829fa0}.weather-time-title{display:flex;justify-content:space-between;font-size:11px;margin:15px 0 10px}.weather-clock input[type=range]{width:100%;accent-color:#547e7b}body.night .weather-presets button.active{background:#799b9c;color:#112d37}';
  document.head.append(style);
  const timeSetting = $('time-segments').parentElement,
    weatherPanel = document.createElement('div');
  weatherPanel.id = 'weather-controls';
  weatherPanel.innerHTML =
    '<h4 class="weather-heading">天气</h4><div class="weather-presets" id="weather-presets">' +
    Object.entries(weatherPresets)
      .map(
        ([id, p]) =>
          '<button data-weather="' + id + '" aria-pressed="false">' + p.label + '</button>',
      )
      .join('') +
    '</div><p class="weather-note">场景模拟 · 非实时天气<br>天气调整光照与雾效；飘雪可单独开关。</p>';
  timeSetting.before(weatherPanel);
  const clock = document.createElement('div');
  clock.className = 'weather-clock';
  clock.innerHTML =
    '<label class="weather-time-title" for="environment-hour">模拟时间 <output id="environment-hour-value">11:30</output></label><input type="range" id="environment-hour" min="0" max="24" step="0.05" value="11.5" aria-label="模拟时间，0至24小时"><div class="time-ticks"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div><div class="switch-row"><span>时间自动流逝 · 约 6 分钟一天</span><button id="environment-auto" class="switch" role="switch" aria-label="时间自动流逝" aria-checked="false"></button></div>';
  timeSetting.append(clock);
  $('environment-hour').oninput = (e) => setEnvironmentHour(Number(e.target.value));
  $('environment-auto').onclick = () => {
    weatherState.auto = !weatherState.auto;
    state.autoTime = weatherState.auto;
    $('environment-auto').setAttribute('aria-checked', String(weatherState.auto));
  };
  document
    .querySelectorAll('#weather-presets button')
    .forEach((b) => (b.onclick = () => setWeatherPreset(b.dataset.weather)));
  document
    .querySelectorAll('#time-segments button')
    .forEach((b) => (b.onclick = () => setEnvironmentTimePreset(b.dataset.time)));
  $('snow-toggle').onclick = toggleEnvironmentSnow;
  $('snow-range').oninput = (e) => setEnvironmentSnowAmount(e.target.value);
  // A fixed world lattice recycled around the camera keeps snow visible at every zoom.
  // Only the existing GPU point buffer changes; no per-frame particle upload is needed.
  const pos = snowGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const fract = (x) => x - Math.floor(x);
    pos.setXYZ(
      i,
      fract(i * 0.61803398875 + 0.17),
      fract(i * 0.75487766625 + 0.31),
      fract(i * 0.56984029099 + 0.73),
    );
  }
  pos.needsUpdate = true;
  snowUniforms.uVolume = { value: new V(1050, 950, 1050) };
  snowUniforms.uNight = { value: 0 };
  snowMaterial.vertexShader = `attribute float aRand;attribute float aSize;uniform float uTime;uniform float uWind;uniform float uDpr;uniform vec3 uVolume;varying float vFade;varying float vSeed;void main(){vec3 p=position*uVolume;float fall=10.+aRand*16.;p.x+=uTime*uWind*(9.+aRand*8.);p.z+=sin(uTime*.25+aRand*31.)*3.;p.y-=uTime*fall;p=mod(p-cameraPosition+uVolume*.5,uVolume)-uVolume*.5+cameraPosition;vec4 mv=viewMatrix*vec4(p,1.);float depth=-mv.z;gl_Position=projectionMatrix*mv;gl_PointSize=clamp((2.4+aSize*.6)*uDpr*230./max(depth,1.),1.8*uDpr,6.*uDpr);vFade=smoothstep(3.,26.,depth)*(1.-smoothstep(310.,650.,depth))*(.5+aRand*.45);vSeed=aRand;}`;
  snowMaterial.fragmentShader = `uniform float uOpacity;uniform float uNight;varying float vFade;varying float vSeed;void main(){float d=length(gl_PointCoord-vec2(.5));if(d>.5)discard;float edge=smoothstep(.22,.48,d);vec3 core=mix(vec3(.98,.99,1.),vec3(.87,.94,1.),uNight*.3);vec3 rim=mix(vec3(.47,.60,.68),vec3(.82,.91,1.),uNight);float a=(1.-smoothstep(.28,.5,d))*uOpacity*vFade;gl_FragColor=vec4(mix(core,rim,edge*.82),a);}`;
  snowMaterial.needsUpdate = true;
  snow.renderOrder = 7;
  weatherState.hour = { day: 11.5, golden: 16.5, night: 20 }[state.time] ?? 11.5;
  setWeatherPreset('clear', { preserveSnow: true });
}
function updateWeatherSystem(realDt) {
  if (!weatherState.initialized) return;
  const dt = state.paused ? 0 : Math.min(realDt, 0.1) * state.speed;
  if (state.snow && state.intensity > 0) {
    weatherState.snowClock += dt;
    snowUniforms.uTime.value = weatherState.snowClock;
    snowUniforms.uDpr.value = renderer.getPixelRatio();
  }
  if (weatherState.auto && dt > 0) {
    weatherState.hour = (weatherState.hour + (dt * 24) / 360) % 24;
    applyWeatherLighting();
  }
  scene.fog.density = environmentFogDensity();
  const signature = [state.snow, state.intensity, state.imagery, state.mode].join('|');
  if (signature !== weatherState.snowSignature) syncEnvironmentSnow();
}
