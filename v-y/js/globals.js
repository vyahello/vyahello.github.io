/* ============================================================
   globals.js — page-chrome behaviour:
     · spawn 18 floating particles with random vertical motion
     · lerp the cursor-glow orb toward the cursor (desktop only)
     · toggle .show on the floating monogram badge once the
       hero is scrolled past
   ============================================================ */

const CURSOR_LERP        = 0.12;
const HERO_BOTTOM_OFFSET = 100;   // px before hero exits that we flip the badge

/* ---- 3-layer parallax particle field ----
   Each layer is a separate child of #particles with its own children +
   scroll-driven transform. Near particles are larger / sharper / move
   faster on scroll; far particles are smaller / blurred / drift slowly —
   creates an honest sense of depth without WebGL.
*/
const PARTICLE_LAYERS = [
  // far: tiny, blurry, slow rise, drifts DOWN slightly on scroll
  { cls: 'pl-far',  count: 12, size: [0.8, 1.8], dur: [22, 38], opacity: [0.20, 0.40], parallax:  0.06 },
  // mid: classic gold motes (matches the original look)
  { cls: 'pl-mid',  count: 16, size: [2.0, 3.2], dur: [14, 26], opacity: [0.45, 0.75], parallax:  0.00 },
  // near: bigger, sharper, drifts UP on scroll (foreground rushes past)
  { cls: 'pl-near', count:  6, size: [3.4, 5.0], dur: [10, 18], opacity: [0.70, 0.95], parallax: -0.18 },
];

function rand(min, max) { return min + Math.random() * (max - min); }

export function spawnParticles(root) {
  if (!root) return;
  root.replaceChildren();
  const layers = [];
  for (const layer of PARTICLE_LAYERS) {
    const wrap = document.createElement('div');
    wrap.className = 'particle-layer ' + layer.cls;
    for (let i = 0; i < layer.count; i++) {
      const s   = document.createElement('span');
      const dur = rand(layer.dur[0], layer.dur[1]);
      const sz  = rand(layer.size[0], layer.size[1]);
      s.style.left              = (Math.random() * 100) + '%';
      s.style.width             = `${sz}px`;
      s.style.height            = `${sz}px`;
      s.style.animationDuration = `${dur}s`;
      s.style.animationDelay    = `${-Math.random() * dur}s`;
      s.style.opacity           = String(rand(layer.opacity[0], layer.opacity[1]));
      wrap.appendChild(s);
    }
    root.appendChild(wrap);
    layers.push({ el: wrap, parallax: layer.parallax });
  }
  // Skip parallax for reduced-motion users — they get static layers.
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  let pending = false;
  const tick = () => {
    pending = false;
    const y = window.scrollY;
    for (const l of layers) {
      if (l.parallax === 0) continue;
      l.el.style.transform = `translate3d(0, ${(y * l.parallax).toFixed(1)}px, 0)`;
    }
  };
  window.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(tick);
  }, { passive: true });
}

/* ---- Cursor-glow orb with lerp follow ----
   We track target via mousemove (passive) and rAF a constant
   lerp toward it so the orb feels weighty. */
function attachCursorGlow(glow) {
  if (!glow) return;
  if (!window.matchMedia('(hover: hover)').matches) return;

  let targetX = window.innerWidth  / 2;
  let targetY = window.innerHeight / 2;
  let curX = targetX;
  let curY = targetY;

  document.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    if (!glow.classList.contains('active')) glow.classList.add('active');
  }, { passive: true });

  document.addEventListener('mouseleave', () => glow.classList.remove('active'));

  // The lerp loop idles once converged (a permanent 60fps rAF kept the
  // compositor busy on laptops even with the pointer parked for minutes);
  // any mousemove restarts it.
  let running = false;

  function tick() {
    curX += (targetX - curX) * CURSOR_LERP;
    curY += (targetY - curY) * CURSOR_LERP;
    if (Math.abs(targetX - curX) + Math.abs(targetY - curY) < 0.1) {
      curX = targetX;
      curY = targetY;
      glow.style.transform = `translate(${curX}px, ${curY}px) translate(-50%, -50%)`;
      running = false;
      return;
    }
    glow.style.transform = `translate(${curX}px, ${curY}px) translate(-50%, -50%)`;
    requestAnimationFrame(tick);
  }

  function wake() {
    if (running) return;
    running = true;
    requestAnimationFrame(tick);
  }

  document.addEventListener('mousemove', wake, { passive: true });
  wake();
}

/* ---- Floating monogram badge ----
   Visible once we've scrolled past most of the hero. */
function attachFloatingMono(badge, hero) {
  if (!badge || !hero) return;
  // Cache the hero geometry — reading offsetTop/offsetHeight inside the
  // raw scroll handler forced a layout access per scroll event on iOS
  // momentum scrolling. Recomputed on resize (and once after load, when
  // web fonts may have shifted the hero's height).
  let heroBottom = 0;
  const measure = () => {
    heroBottom = hero.offsetTop + hero.offsetHeight - HERO_BOTTOM_OFFSET;
  };
  const onScroll = () => {
    badge.classList.toggle('show', window.scrollY > heroBottom);
  };
  measure();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measure(); onScroll(); }, { passive: true });
  window.addEventListener('load', () => { measure(); onScroll(); }, { once: true });
  onScroll();
}

/* ---- Scroll indicator ----
   IntersectionObserver-gated: visible only while hero is ≥95% in
   viewport. Naturally reappears if the user scrolls back to the top.
   No scroll-event listener — no iOS Safari edge cases. */
function attachScrollIndicator(indicator, hero) {
  if (!indicator || !hero || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        indicator.classList.toggle('visible', e.isIntersecting && e.intersectionRatio >= 0.95);
      }
    },
    { threshold: [0, 0.95, 1] },
  );
  io.observe(hero);
}

/* ---- Swatch shimmer ----
   When the dress-code palette enters the viewport, add .shimmering
   so swatchPop + shine sweep animate sequentially (CSS-driven).
   One-shot — disconnects after first intersection. */
function attachSwatchShimmer(swatches) {
  if (!swatches || !('IntersectionObserver' in window)) {
    swatches?.classList.add('shimmering');
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        swatches.classList.add('shimmering');
        io.disconnect();
        break;
      }
    }
  }, { threshold: 0.4 });
  io.observe(swatches);
}

export function initGlobals() {
  spawnParticles(document.getElementById('particles'));
  attachCursorGlow(document.getElementById('cursorGlow'));
  attachFloatingMono(document.getElementById('floatingMono'), document.getElementById('hero'));
  attachSwatchShimmer(document.getElementById('swatches'));
  attachScrollIndicator(document.getElementById('scrollIndicator'), document.getElementById('hero'));
}
