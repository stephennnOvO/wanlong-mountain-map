function polylineCurve(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(lengths.at(-1) + points[i].distanceTo(points[i - 1]));
  const total = lengths.at(-1) || 1;
  class Path extends THREE.Curve {
    getPoint(t, target = new V()) {
      const d = clamp(t, 0, 1) * total;
      let lo = 0,
        hi = lengths.length - 1;
      while (lo + 1 < hi) {
        const m = (lo + hi) >> 1;
        if (lengths[m] < d) lo = m;
        else hi = m;
      }
      const f = (d - lengths[lo]) / (lengths[hi] - lengths[lo] || 1);
      return target.copy(points[lo]).lerp(points[hi], f);
    }
    getLength() {
      return total;
    }
  }
  return new Path();
}
trails.forEach((t) => {
  if (!t.mapped) {
    t.points = [];
    return;
  }
  const control = t.geo.map((c) => posAtMap(mapPixel(c), 1.4)),
    raw = polylineCurve(control);
  t.points = [];
  for (let k = 1; k < control.length; k++) {
    const a = control[k - 1],
      b = control[k],
      steps = Math.max(1, Math.ceil(a.distanceTo(b) / 6));
    for (let j = 0; j < steps; j++) t.points.push(a.clone().lerp(b, j / steps));
  }
  t.points.push(control.at(-1).clone());
  t.points.forEach((p) => (p.y = heightAt(p.x, p.z) + 1.4));
  correctPondSideTrail(t);
  t.curve = polylineCurve(t.points);
  t.modelLength = t.curve.getLength();
  t.demMax = Math.max(...t.points.map((p) => p.y)) + GEO.baseElevation - 1.4;
  t.demMin = Math.min(...t.points.map((p) => p.y)) + GEO.baseElevation - 1.4;
  prepareTrailFootprint(t);
  indexTrailFootprint(t);
  const piste = trailRibbon(t, '#f9fcfc');
  piste.material.colorWrite = false;
  piste.material.depthWrite = false;
  piste.receiveShadow = false;
  piste.userData = { kind: 'trail', id: t.id };
  pisteGroup.add(piste);
  pickables.push(piste);
  t.mesh = piste;
  t.colorBand = trailRibbon(t, levels[t.level].color, 0.26, 0.7);
  t.colorBand.material.colorWrite = false;
  t.colorBand.material.depthWrite = false;
  t.colorBand.position.y = 0.6;
  t.colorBand.visible = false;
  pisteGroup.add(t.colorBand);
  t.center = lineFromPoints(
    t.points.map((p) => p.clone().add(new V(0, 1, 0))),
    '#7eabb6',
    0.42,
  );
  t.center.visible = false;
  pisteGroup.add(t.center);
  t.points.forEach((p, i) => {
    if (i % 3 === 0) pathSamples.push({ x: p.x, z: p.z, w: t.widths[i].minus + t.widths[i].plus });
  });
});
