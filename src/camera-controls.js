const canvas = renderer.domElement;
const pointers = new Map();
const rideLook = { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, fov: 35 };
const navigationRay = new THREE.Raycaster();
const navigationPlane = new THREE.Plane();
const navRight = new V(),
  navUp = new V(),
  navOut = new V(),
  navOffset = new V();
let dragMode = DELIVERY_MODE ? 'pan' : 'rotate';
let navigationGesture = null,
  wheelGesture = null;

function syncNavigationPose() {
  desired.theta = orbit.theta;
  desired.phi = orbit.phi;
  desired.radius = orbit.radius;
  desired.target.copy(orbit.target);
}

function navigationAnchor(point, allowEmpty = false) {
  camera.updateMatrixWorld();
  navigationRay.setFromCamera(pointerInScene({ clientX: point.x, clientY: point.y }), camera);
  if (state.mode === 'orbit') {
    const hit = navigationRay.intersectObject(terrain, false)[0];
    if (hit) return hit.point;
  }
  if (!allowEmpty) return null;
  navigationPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(navOut), orbit.target);
  return navigationRay.ray.intersectPlane(navigationPlane, new V());
}

// Translate in the view plane to keep a picked point under the cursor,
// including when the same gesture also changes the scale or orientation.
function holdNavigationAnchor(anchor, point) {
  if (!anchor) return;
  const bounds = sceneViewport;
  const s = Math.sin(desired.phi),
    c = Math.cos(desired.phi);
  const u = Math.sin(desired.theta),
    v = Math.cos(desired.theta);
  navRight.set(v, 0, -u);
  navUp.set(-u * c, s, -v * c);
  navOut.set(u * s, c, v * s);
  navOffset.copy(anchor).sub(desired.target);
  const depth = desired.radius - navOffset.dot(navOut);
  if (depth <= 0.5 || bounds.width === 0 || bounds.height === 0) return;
  const halfHeight = (depth * Math.tan((camera.fov * Math.PI) / 360)) / camera.zoom;
  const x = ((2 * (point.x - bounds.left)) / bounds.width - 1) * halfHeight * camera.aspect;
  const y = (1 - (2 * (point.y - bounds.top)) / bounds.height) * halfHeight;
  desired.target.addScaledVector(navRight, navOffset.dot(navRight) - x);
  desired.target.addScaledVector(navUp, navOffset.dot(navUp) - y);
}

function rotateAroundVisibleCentre() {
  if (state.mode !== 'orbit') return;
  const r = canvas.getBoundingClientRect();
  const pivot = navigationAnchor({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  if (!pivot) return;
  const delta = navOffset.copy(camera.position).sub(pivot);
  const distance = delta.length();
  if (distance < 8 || distance > 24000) return;
  desired.target.copy(pivot);
  desired.radius = distance;
  desired.theta += Math.atan2(
    Math.sin(Math.atan2(delta.x, delta.z) - desired.theta),
    Math.cos(Math.atan2(delta.x, delta.z) - desired.theta),
  );
  desired.phi = clamp(Math.acos(clamp(delta.y / distance, -1, 1)), 0.015, 1.565);
}

function pairPose() {
  const [a, b] = pointers.values(),
    dx = b.x - a.x,
    dy = b.y - a.y;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    distance: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx),
  };
}
function riding() {
  return state.mode === 'lift' || state.mode === 'ski';
}
function navigationMode(e) {
  if (e.buttons & 4) return 'pan';
  if (e.buttons & 2) return DELIVERY_MODE ? 'rotate' : 'pan';
  if (e.shiftKey) return dragMode === 'pan' ? 'rotate' : 'pan';
  return dragMode;
}
function markManualView() {
  $('view-home').classList.remove('active');
  $('view-top').classList.remove('active');
}

const dragControl = $('drag-mode');
function updateDragControl() {
  const rotate = dragMode === 'rotate',
    name = rotate ? '旋转' : '移动';
  dragControl.querySelector('.word').textContent = name;
  dragControl.querySelector('.icon').textContent = rotate ? '⟳' : '✥';
  dragControl.classList.toggle('on', rotate);
  dragControl.setAttribute('aria-pressed', String(rotate));
  dragControl.setAttribute('aria-label', '拖动模式：' + name + '，点击切换');
  dragControl.title = '拖动模式：' + name + '，点击切换';
}
updateDragControl();
dragControl.onclick = () => {
  dragMode = dragMode === 'pan' ? 'rotate' : 'pan';
  updateDragControl();
  toast(dragMode === 'pan' ? '拖动地图以移动' : '拖动地图以旋转');
};

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
function startNavigationPointer(e, label = null) {
  if (pointers.size >= 2) return;
  if (!['orbit', 'architecture', 'lift', 'ski'].includes(state.mode)) exitExperience(false);
  const point = { x: e.clientX, y: e.clientY };
  if (!pointers.size)
    navigationGesture = {
      origin: point,
      label,
      moved: false,
      multi: false,
      mode: null,
      pair: null,
      anchor: null,
    };
  if (label) e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, point);
  wheelGesture = null;
  if (pointers.size === 2) {
    navigationGesture.multi = true;
    navigationGesture.moved = true;
    if (!riding()) {
      syncNavigationPose();
      navigationGesture.pair = pairPose();
      navigationGesture.anchor = navigationAnchor(navigationGesture.pair, true);
      markManualView();
    }
  }
  $('tooltip').hidden = true;
}
canvas.addEventListener('pointerdown', (e) => startNavigationPointer(e));
$('labels').addEventListener('pointerdown', (e) => {
  const label = e.target.closest('button');
  if (label) startNavigationPointer(e, label);
});
$('labels').addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointermove', (e) => {
  const previous = pointers.get(e.pointerId);
  if (!previous) {
    if (riding()) {
      $('tooltip').hidden = true;
      canvas.style.cursor = 'grab';
    } else hover(e);
    return;
  }
  const point = { x: e.clientX, y: e.clientY },
    g = navigationGesture;
  pointers.set(e.pointerId, point);
  if (!g.moved && Math.hypot(point.x - g.origin.x, point.y - g.origin.y) < 4) return;
  g.moved = true;
  if (riding()) {
    if (pointers.size === 1) {
      rideLook.targetYaw -= (point.x - previous.x) * 0.005;
      rideLook.targetPitch = clamp(
        rideLook.targetPitch + (point.y - previous.y) * 0.004,
        -1.1,
        1.1,
      );
    }
    return;
  }
  if (pointers.size === 2) {
    const next = pairPose(),
      old = g.pair;
    if (next.distance >= 10 && old?.distance >= 10) {
      const angle = next.angle - old.angle;
      desired.theta += Math.atan2(Math.sin(angle), Math.cos(angle));
      desired.radius = clamp((desired.radius * old.distance) / next.distance, 8, 24000);
      holdNavigationAnchor(g.anchor, next);
    }
    g.pair = next;
    return;
  }
  const mode = navigationMode(e);
  let from = previous;
  if (g.mode !== mode) {
    // Rebase the gesture when switching mode or lifting one of two fingers.
    // Small sub-threshold movements do not change the camera on a tap.
    if (!g.mode && !g.multi) from = g.origin;
    syncNavigationPose();
    g.mode = mode;
    if (mode === 'pan') g.anchor = navigationAnchor(from, true);
    else rotateAroundVisibleCentre();
    markManualView();
  }
  if (mode === 'pan') holdNavigationAnchor(g.anchor, point);
  else {
    desired.theta -= (point.x - from.x) * 0.004;
    desired.phi = clamp(desired.phi - (point.y - from.y) * 0.003, 0.015, 1.565);
  }
  canvas.style.cursor = 'grabbing';
});
function endNavigationPointer(e, cancelled) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  const g = navigationGesture;
  if (pointers.size) {
    g.pair = null;
    g.mode = null;
    return;
  }
  navigationGesture = null;
  canvas.style.cursor = 'grab';
  if (!cancelled && !riding() && !g.moved && !g.multi && e.button === 0) {
    if (g.label?.isConnected) g.label.click();
    else if (!g.label) pick(e);
  }
}
canvas.addEventListener('pointerup', (e) => endNavigationPointer(e, false));
canvas.addEventListener('pointercancel', (e) => endNavigationPointer(e, true));
canvas.addEventListener('lostpointercapture', (e) => endNavigationPointer(e, true));
canvas.addEventListener('pointerleave', () => {
  $('tooltip').hidden = true;
});
function navigateWheel(e) {
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
  const delta = clamp(e.deltaY * unit, -300, 300);
  if (!delta) return;
  if (riding()) {
    camera.fov = rideLook.fov = clamp(camera.fov + delta * 0.018, 28, 75);
    camera.updateProjectionMatrix();
    return;
  }
  if (state.mode !== 'orbit' && state.mode !== 'architecture') exitExperience(false);
  const time = performance.now(),
    point = { x: e.clientX, y: e.clientY };
  if (
    !wheelGesture ||
    time - wheelGesture.time > 170 ||
    Math.hypot(point.x - wheelGesture.x, point.y - wheelGesture.y) > 4 ||
    desired.radius !== wheelGesture.radius ||
    desired.theta !== wheelGesture.theta ||
    desired.phi !== wheelGesture.phi
  ) {
    syncNavigationPose();
    wheelGesture = {
      ...point,
      anchor: navigationAnchor(point),
      theta: desired.theta,
      phi: desired.phi,
    };
  }
  const radius = clamp(desired.radius * Math.exp(delta * 0.00125), 8, 24000);
  const anchor = wheelGesture.anchor;
  if (anchor)
    desired.target
      .sub(anchor)
      .multiplyScalar(radius / desired.radius)
      .add(anchor);
  desired.radius = radius;
  wheelGesture.time = time;
  wheelGesture.radius = radius;
  markManualView();
}
canvas.addEventListener('wheel', navigateWheel, { passive: false });
$('labels').addEventListener('wheel', navigateWheel, { passive: false });
