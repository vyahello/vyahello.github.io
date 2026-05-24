/* ============================================================
   globals.js — page-chrome behaviour:
     · spawn 18 floating particles with random vertical motion
     · lerp the cursor-glow orb toward the cursor (desktop only)
     · toggle .show on the floating monogram badge once the
       hero is scrolled past
   ============================================================ */

const PARTICLE_COUNT     = 18;
const PARTICLE_MIN_DUR_S = 12;
const PARTICLE_MAX_DUR_S = 30;
const CURSOR_LERP        = 0.12;
const HERO_BOTTOM_OFFSET = 100;   // px before hero exits that we flip the badge

/* ---- 18 floating motes spawned into #particles ---- */
export function spawnParticles(root, count = PARTICLE_COUNT) {
  if (!root) return;
  root.replaceChildren();
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    const dur   = PARTICLE_MIN_DUR_S + Math.random() * (PARTICLE_MAX_DUR_S - PARTICLE_MIN_DUR_S);
    const delay = -Math.random() * dur;             // negative so motes are mid-rise on load
    const size  = 1.5 + Math.random() * 2.5;
    s.style.left              = (Math.random() * 100) + '%';
    s.style.width             = `${size}px`;
    s.style.height            = `${size}px`;
    s.style.animationDuration = `${dur}s`;
    s.style.animationDelay    = `${delay}s`;
    s.style.opacity           = String(0.3 + Math.random() * 0.5);
    root.appendChild(s);
  }
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

  function tick() {
    curX += (targetX - curX) * CURSOR_LERP;
    curY += (targetY - curY) * CURSOR_LERP;
    glow.style.transform = `translate(${curX}px, ${curY}px) translate(-50%, -50%)`;
    requestAnimationFrame(tick);
  }
  tick();
}

/* ---- Floating monogram badge ----
   Visible once we've scrolled past most of the hero. */
function attachFloatingMono(badge, hero) {
  if (!badge || !hero) return;
  const onScroll = () => {
    const heroBottom = hero.offsetTop + hero.offsetHeight - HERO_BOTTOM_OFFSET;
    badge.classList.toggle('show', window.scrollY > heroBottom);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
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
