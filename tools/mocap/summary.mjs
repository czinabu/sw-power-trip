import fs from 'fs';
import { parseBVH, pose } from './bvh.mjs';
for (const file of process.argv.slice(2)){
  try {
  const bvh = parseBVH(fs.readFileSync(file, 'utf8'));
  const L = bvh.joints.find(j => j.name === 'LeftLeg').offset.length() + bvh.joints.find(j => j.name === 'LeftFoot').offset.length();
  const n = bvh.frames.length, sp = [];
  for (let f = 1; f < n - 12; f += 12){ const a = pose(bvh, f).Hips.p, b = pose(bvh, f + 12).Hips.p; sp.push((Math.hypot(b.x - a.x, b.z - a.z) / (12 * bvh.dt) / L).toFixed(1)); }
  console.log(file, n, (n * bvh.dt).toFixed(1) + 's', 'speed LL/s:', sp.join(' '));
  } catch (e){ console.log(file, 'ERR', e.message); }
}
