// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Centre-screen banners.


/* ============================================================
   UI
   ============================================================ */
let bannerTimeout = null;
export function showBanner(main, sub, dur){
  const b = document.getElementById('banner');
  document.getElementById('bannerh').textContent = main;
  document.getElementById('bannerp').textContent = sub;
  b.style.opacity = '1';
  if (bannerTimeout) clearTimeout(bannerTimeout);
  if (dur < 100) bannerTimeout = setTimeout(()=>{ b.style.opacity = '0'; }, dur*1000);
}
