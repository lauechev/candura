/**
 * Click-to-pop confetti for plain DOM elements.
 *
 * The piñata bursts its confetti as WebGL points inside its own 3D scene
 * (see pinata.ts); that machinery can't be pointed at an arbitrary <img>, so
 * this redraws the same effect in 2D on a shared overlay canvas. The palette
 * and the burst physics below are the piñata's, converted from world units to
 * pixels — a pop here should read as the same confetti.
 */

// Same list, in the same order, as PALETTE in pinata.ts.
const PALETTE = ['--blue', '--purple', '--yellow', '--orange', '--pink', '--green', '--red'];

// Piñata values (CONFETTI_PER_BURST / _GRAVITY / _LIFE and the 3–8 unit launch
// speed) scaled by ~45px per world unit, the piñata's own on-screen scale.
const PER_BURST = 130;
const GRAVITY = 540; // px/s²
const LIFE = 2.6; // seconds, varied 0.7–1× per particle
const SPEED_MIN = 135; // px/s
const SPEED_RANGE = 225;
const SIZE = 4; // square side in px
const FADE = 0.5; // seconds of fade-out at the end of a particle's life

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let raf: number | null = null;
let lastTime = 0;
let colors: string[] = [];

/** Full-viewport, click-through overlay the bursts are drawn on. */
function ensureCanvas(): CanvasRenderingContext2D {
  if (ctx) return ctx;

  canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:400';
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d')!;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    canvas!.width = window.innerWidth * dpr;
    canvas!.height = window.innerHeight * dpr;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const style = getComputedStyle(document.documentElement);
  colors = PALETTE.map((name) => style.getPropertyValue(name).trim());

  return ctx;
}

function frame(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);

  particles = particles.filter((p) => {
    p.life -= dt;
    if (p.life <= 0) return false;
    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    ctx!.globalAlpha = Math.min(p.life / FADE, 1);
    ctx!.fillStyle = p.color;
    ctx!.fillRect(p.x - SIZE / 2, p.y - SIZE / 2, SIZE, SIZE);
    return true;
  });
  ctx!.globalAlpha = 1;

  // Idle between pops rather than burning a rAF forever.
  raf = particles.length > 0 ? requestAnimationFrame(frame) : null;
}

/** Bursts confetti outward from a viewport point, with the piñata's upward bias. */
export function burst(x: number, y: number): void {
  ensureCanvas();

  for (let i = 0; i < PER_BURST; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Biased upward so it pops, then rains down (the piñata's dir.y bias).
    const up = Math.random() * 0.9 + 0.1;
    const speed = SPEED_MIN + Math.random() * SPEED_RANGE;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: -up * speed,
      life: LIFE * (0.7 + Math.random() * 0.3),
      color: colors[(Math.random() * colors.length) | 0],
    });
  }

  if (raf === null) {
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

/**
 * Makes every element matching `selector` pop: it shrinks while held (via the
 * `is-popping` class, styled by the caller) and bursts confetti from its
 * center on click. With reduced motion the confetti is skipped and only the
 * press state remains.
 */
export function attachConfettiPop(selector: string): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const release = () => el.classList.remove('is-popping');

    el.addEventListener('pointerdown', () => el.classList.add('is-popping'));
    el.addEventListener('pointerup', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('pointercancel', release);

    el.addEventListener('click', () => {
      if (reduced) return;
      const rect = el.getBoundingClientRect();
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
  });
}
