// print a clip's foot contacts and speed so a cycle can be picked: node tools/mocap/inspect.mjs file.bvh
import fs from 'fs';
import { parseBVH, pose } from './bvh.mjs';
const bvh = parseBVH(fs.readFileSync(process.argv[2], 'utf8'));
const L = bvh.joints.find(j => j.name === 'LeftLeg').offset.length() + bvh.joints.find(j => j.name === 'LeftFoot').offset.length();
console.log('frames', bvh.frames.length, 'dt', bvh.dt, 'leg', L.toFixed(2));
const P = bvh.frames.map((_, f) => pose(bvh, f));
const minL = Math.min(...P.map(p => p.LeftFoot.p.y)), minR = Math.min(...P.map(p => p.RightFoot.p.y));
for (let f = 0; f < P.length; f += 6){
  const p = P[f], q = P[Math.min(P.length - 1, f + 1)];
  const v = (a, b) => Math.hypot(b.x - a.x, b.z - a.z) / bvh.dt / L;
  const s = (n, m) => `${((p[n].p.y - m) / L).toFixed(2)}/${v(p[n].p, q[n].p).toFixed(1)}`;
  console.log(f, 'L', s('LeftFoot', minL), 'R', s('RightFoot', minR), 'hipsV', v(p.Hips.p, q.Hips.p).toFixed(2), 'hipY', (p.Hips.p.y / L).toFixed(2));
}
