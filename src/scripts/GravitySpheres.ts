interface Sphere {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  mass: number;
  gravity: number;
}

const RESTITUTION = 0.9;
const DAMPING = 0.9;
const FLOOR_FRICTION = 0.65;
const SLEEP_SPEED = 0.1;
const MOUSE_ATTRACT_RADIUS = 500;
const MOUSE_ATTRACT_FORCE = 6;
const MOUSE_REPEL_RADIUS = 170;
const MOUSE_REPEL_FORCE = 50;

export class GravitySpheres {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private spheres: Sphere[] = [];
  private raf: number | null = null;
  private width = 0;
  private height = 0;

  private mouseX = 0;
  private mouseY = 0;
  private isMouseDown = false;
  private isMouseInCanvas = false;
  private isDesktop = false;

  private resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    this.isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.initSpheres();
    this.bindEvents();
  }

  private resize() {
    this.width = this.canvas.offsetWidth;
    this.height = this.canvas.offsetHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  private initSpheres() {
    const style = getComputedStyle(document.documentElement);
    const isMobile = window.matchMedia('(max-width: 760px)').matches;
    const palette = [
      { var: '--blue', radius: 85 },
      { var: '--purple', radius: 65 },
      { var: '--yellow', radius: 90 },
      { var: '--orange', radius: 70 },
      { var: '--pink', radius: 75 },
      { var: '--green', radius: 60 },
      { var: '--red', radius: 80 },
    ];
    const radiusScale = isMobile ? 0.58 : 1.1;

    this.spheres = [];
    for (let rep = 0; rep < 2; rep++) {
      for (const { var: v, radius: baseRadius } of palette) {
        const color = style.getPropertyValue(v).trim();
        const radius = baseRadius * radiusScale * (0.75 + Math.random() * 0.5);
        const gravity = 0.4 + Math.random() * 0.65;
        const startAbove = 400 + Math.random() * 100;
        const y = -radius - startAbove;
        const vy = Math.sqrt(2 * gravity * startAbove);
        this.spheres.push({
          x: Math.random() * this.width,
          y,
          vx: (Math.random() - 0.5) * 2,
          vy,
          radius,
          color,
          mass: radius * radius,
          gravity,
        });
      }
    }
  }

  private bindEvents() {
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('mouseenter', this.onMouseEnter);
    this.canvas.addEventListener('mouseleave', this.onMouseLeave);
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });
    window.addEventListener('touchend', this.onMouseUp);
  }

  private getCanvasPos(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private onMouseEnter = () => {
    this.isMouseInCanvas = true;
  };
  private onMouseLeave = () => {
    this.isMouseInCanvas = false;
  };

  private onMouseDown = (e: MouseEvent) => {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    this.mouseX = pos.x;
    this.mouseY = pos.y;
    this.isMouseDown = true;
  };

  private onMouseMove = (e: MouseEvent) => {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    this.mouseX = pos.x;
    this.mouseY = pos.y;
  };

  private onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    const pos = this.getCanvasPos(t.clientX, t.clientY);
    this.mouseX = pos.x;
    this.mouseY = pos.y;
    this.isMouseDown = true;
  };

  private onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    const pos = this.getCanvasPos(t.clientX, t.clientY);
    this.mouseX = pos.x;
    this.mouseY = pos.y;
  };

  private onMouseUp = () => {
    this.isMouseDown = false;
  };

  private resolveCollision(a: Sphere, b: Sphere) {
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = a.radius + b.radius;
    if (dist >= minDist || dist === 0) return;

    const nx = dx / dist,
      ny = dy / dist;
    const overlap = minDist - dist;
    const total = a.mass + b.mass;

    a.x -= nx * overlap * (b.mass / total);
    a.y -= ny * overlap * (b.mass / total);
    b.x += nx * overlap * (a.mass / total);
    b.y += ny * overlap * (a.mass / total);

    const dvx = a.vx - b.vx,
      dvy = a.vy - b.vy;
    const dvn = dvx * nx + dvy * ny;
    if (dvn > 0) return;

    const e = Math.abs(dvn) < 3 ? 0 : RESTITUTION * 0.5;
    const impulse = (-(1 + e) * dvn) / (1 / a.mass + 1 / b.mass);
    a.vx += (impulse / a.mass) * nx;
    a.vy += (impulse / a.mass) * ny;
    b.vx -= (impulse / b.mass) * nx;
    b.vy -= (impulse / b.mass) * ny;
  }

  private update() {
    for (const s of this.spheres) {
      const onFloor = s.y + s.radius >= this.height - 1;
      if (!onFloor || Math.abs(s.vy) > 0.5) s.vy += s.gravity;

      // Desktop hover → repel spheres near cursor
      if (this.isDesktop && this.isMouseInCanvas && !this.isMouseDown) {
        const dx = s.x - this.mouseX,
          dy = s.y - this.mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_REPEL_RADIUS && dist > 1) {
          const force = MOUSE_REPEL_FORCE * (1 - dist / MOUSE_REPEL_RADIUS);
          s.vx += (dx / dist) * force;
          s.vy += (dy / dist) * force;
        }
      }

      // Mouse held → gravity well pulls all spheres
      if (this.isMouseDown) {
        const dx = this.mouseX - s.x,
          dy = this.mouseY - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_ATTRACT_RADIUS && dist > 1) {
          const force = MOUSE_ATTRACT_FORCE * (1 - dist / MOUSE_ATTRACT_RADIUS);
          s.vx += (dx / dist) * force;
          s.vy += (dy / dist) * force;
        }
      }

      s.vx *= DAMPING;
      s.vy *= DAMPING;
      s.x += s.vx;
      s.y += s.vy;

      if (s.y + s.radius > this.height) {
        s.y = this.height - s.radius;
        s.vy *= -RESTITUTION;
        s.vx *= FLOOR_FRICTION;
        if (Math.abs(s.vy) < 5) s.vy = 0;
      }
      if (s.x - s.radius < 0) {
        s.x = s.radius;
        s.vx *= -RESTITUTION;
      }
      if (s.x + s.radius > this.width) {
        s.x = this.width - s.radius;
        s.vx *= -RESTITUTION;
      }

      if (Math.abs(s.vx) < SLEEP_SPEED && Math.abs(s.vy) < SLEEP_SPEED) {
        s.vx = 0;
        s.vy = 0;
      }
    }

    for (let i = 0; i < this.spheres.length; i++)
      for (let j = i + 1; j < this.spheres.length; j++) this.resolveCollision(this.spheres[i], this.spheres[j]);
  }

  private drawSphere(s: Sphere) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    for (const s of this.spheres) this.drawSphere(s);
  }

  private loop = () => {
    this.update();
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  start() {
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('mouseenter', this.onMouseEnter);
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onMouseUp);
  }
}
