// Numbered lift types are supplied by data.js; this module never infers or changes them.
// Stylised vehicle dimensions follow the existing collision envelope, not maker drawings.
// Offset detail is baked into BoxGeometry and mirrored in userData for collision OBBs.
const vehicleDetailMats = {
  paint: material('#b83e31', { roughness: 0.34, metalness: 0.22 }),
  trim: material('#d9dfdc', { roughness: 0.3, metalness: 0.72 }),
  dark: material('#24343b', { roughness: 0.4, metalness: 0.3 }),
  glazing: material('#59747b', {
    roughness: 0.13,
    metalness: 0.2,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  }),
  seat: material('#35454a', { roughness: 0.87, metalness: 0.02 }),
  seatAccent: material('#8b3933', { roughness: 0.78, metalness: 0.02 }),
};
function vehicleHangingEnvelope(lift) {
  if (lift.type === 'gondola') return { drop: 5.35, halfWidth: 1.325, halfLength: 1.2 };
  const count = Math.max(1, Math.min(6, Math.round(Number(lift.capacity) || 4)));
  return { drop: 3.84, halfWidth: (count > 4 ? 3.3 : 3.2) / 2, halfLength: 0.6 };
}
function vehicleDefinitions(lift) {
  const defs = [],
    m = vehicleDetailMats;
  // Rounding is a vertex deformation of a BoxGeometry, retaining its dimensional metadata.
  function part(w, h, d, mat, x, y, z = 0, r = 0) {
    const geo = new THREE.BoxGeometry(w, h, d, r ? 4 : 1, r ? 3 : 1, r ? 4 : 1);
    if (r) {
      r = Math.min(r, w / 2, h / 2, d / 2);
      const p = geo.attributes.position,
        n = geo.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i),
          py = p.getY(i),
          pz = p.getZ(i),
          cx = Math.max(-w / 2 + r, Math.min(w / 2 - r, px)),
          cy = Math.max(-h / 2 + r, Math.min(h / 2 - r, py)),
          cz = Math.max(-d / 2 + r, Math.min(d / 2 - r, pz)),
          dx = px - cx,
          dy = py - cy,
          dz = pz - cz,
          len = Math.hypot(dx, dy, dz) || 1;
        p.setXYZ(i, cx + (dx / len) * r, cy + (dy / len) * r, cz + (dz / len) * r);
        n.setXYZ(i, dx / len, dy / len, dz / len);
      }
      p.needsUpdate = true;
      n.needsUpdate = true;
    }
    geo.translate(x, 0, z);
    // Collision integration reads this center offset alongside the nominal box dimensions.
    geo.userData = {
      vehicleDetail: true,
      vehicleOffset: [x, 0, z],
      nominalSize: [w, h, d],
      ropeAligned: y > 0.05,
    };
    defs.push([geo, mat, y]);
  }
  if (lift.type === 'gondola') {
    // Rounded lower shell, continuous tinted glazing, shallow light roof and belt mouldings.
    part(2.45, 0.64, 2.2, m.paint, 0, -5.03, 0, 0.16);
    part(2.46, 1.3, 2.18, m.glazing, 0, -4.06, 0, 0.19);
    part(2.65, 0.2, 2.4, m.trim, 0, -3.31, 0, 0.085);
    part(2.5, 0.1, 2.22, m.dark, 0, -4.69, 0, 0.04);
    part(2.53, 0.075, 2.25, m.paint, 0, -3.47, 0, 0.03);
    // Central double-door seam, four corner posts and rear glazing mullion.
    part(0.045, 1.17, 0.065, m.dark, 0, -4.075, 1.105);
    for (const x of [-1.115, 1.115])
      for (const z of [-0.995, 0.995]) part(0.075, 1.22, 0.11, m.paint, x, -4.055, z);
    part(0.05, 1.17, 0.065, m.dark, 0, -4.075, -1.105);
    part(0.22, 0.045, 0.06, m.trim, 0.1, -4.25, 1.15);
    // Two opposed upholstered benches, visible through the glazing; nominal 8-place interior.
    for (const z of [-0.69, 0.69]) part(1.94, 0.14, 0.42, m.seat, 0, -4.6, z, 0.045);
    // Hanger rises continuously from the roof to the rope grip.
    // The hanger passes outside the sheave plane; the grip sits over the rope.
    part(0.15, 3.33, 0.15, m.trim, 0.42, -1.545);
    part(0.6, 0.16, 0.24, m.dark, 0.72, 0.2);
    part(0.32, 0.1, 0.42, m.trim, 0.65, 0.32);
    part(0.16, 0.075, 0.12, m.trim, 0.3, 0.2);
  } else {
    const count = Math.max(1, Math.min(6, Math.round(Number(lift.capacity) || 4))),
      w = count > 4 ? 3.3 : 3.2,
      seatW = (w - 0.2) / count;
    part(w, 0.12, 0.85, m.dark, 0, -3.66);
    // Separate pads make the four- and six-place carriers visibly distinguishable.
    for (let i = 0; i < count; i++)
      part(
        seatW - 0.025,
        0.11,
        0.7,
        i % 2 ? m.seatAccent : m.seat,
        (i - (count - 1) / 2) * seatW,
        -3.545,
        0,
        0.025,
      );
    part(w - 0.18, 0.57, 0.12, m.seat, 0, -3.13, -0.32, 0.04);
    for (const x of [-w / 2 + 0.045, w / 2 - 0.045])
      part(0.075, 1.05, 0.075, m.trim, x, -3.285, -0.32);
    for (const x of [-w / 2 + 0.045, w / 2 - 0.045])
      part(0.085, 0.08, 0.65, m.dark, x, -3.12, 0.015);
    // Lowered restraint, two footrest hangers and the continuous foot support.
    part(w - 0.12, 0.065, 0.075, m.trim, 0, -3.12, 0.49);
    for (const x of [-0.6, 0.6]) part(0.06, 0.66, 0.065, m.trim, x, -3.45, 0.49);
    part(1.62, 0.07, 0.22, m.dark, 0, -3.805, 0.49);
    part(w, 0.1, 0.1, m.trim, 0, -2.71, -0.32);
    part(0.13, 2.83, 0.13, m.trim, 0.42, -1.295, -0.32);
    part(0.35, 0.1, 0.35, m.dark, 0.6, 0.2);
    part(0.16, 0.075, 0.12, m.trim, 0.3, 0.2);
  }
  return defs;
}
