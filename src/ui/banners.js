// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Centre-screen banners.


/* ============================================================
   UI
   ============================================================ */
let bannerTimeout = null;
// opts.kicker: a small gold tag above the headline (e.g. NEW ABILITY) · opts.key: a key to show as a keycap in the subline
// co-op missions: while the host runs its mission, every banner it shows is also sent over (net/foefire.js sets fn)
export const bannerTap = { fn: null };
export function showBanner(main, sub, dur, opts){
  if (bannerTap.fn) bannerTap.fn(main, sub, dur, opts);
  const b = document.getElementById('banner');
  document.getElementById('bannerh').textContent = main;
  const p = document.getElementById('bannerp');
  p.textContent = sub;
  if (opts && opts.key){
    const kc = document.createElement('span'); kc.className = 'kc'; kc.textContent = opts.key;
    p.append(' ', kc);
  }
  document.getElementById('bannerk').textContent = (opts && opts.kicker) || '';
  b.classList.toggle('kick', !!(opts && opts.kicker));
  b.style.opacity = '1';
  if (bannerTimeout) clearTimeout(bannerTimeout);
  if (dur < 100) bannerTimeout = setTimeout(()=>{ b.style.opacity = '0'; }, dur*1000);
}
