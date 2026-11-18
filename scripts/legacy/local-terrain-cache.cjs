const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto');
const root = path.resolve(__dirname, '..');
function fingerprint() {
  const files = fs
    .readdirSync(root)
    .filter((f) => f.endsWith('.js') && !/bundle|terrain-evaluation|local-terrain-cache/.test(f))
    .concat([
      'tools/build.cjs',
      'baked/piste-crossfall-reference.bin',
      'research/trail-reconciliation/audit.json',
      'research/trail-reconciliation/manual-review.json',
      'research/trail-reconciliation/surface-areas.json',
    ])
    .sort();
  const hash = crypto.createHash('sha256');
  for (const f of files) {
    hash.update(f + '\0');
    hash.update(fs.readFileSync(path.join(root, f)));
  }
  return { sha256: hash.digest('hex'), files };
}
function load() {
  const cache = JSON.parse(
    fs.readFileSync(path.join(root, 'research/restart-20261104/local-terrain-cache.json'), 'utf8'),
  );
  if (cache.version !== 1 || cache.fingerprint.sha256 !== fingerprint().sha256)
    throw Error(
      'Local terrain cache stale: rebuild uncached candidate and run tools/bake-local-terrain.cjs',
    );
  return 'window.__LOCAL_TERRAIN_CACHE__=' + JSON.stringify(cache) + ';\n';
}
module.exports = { fingerprint, load };
