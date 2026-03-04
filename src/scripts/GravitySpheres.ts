interface Sphere {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  mass: number;
  dragged: boolean;
  gravity: number;
}

const GRAVITY = 0.28;
const RESTITUTION = 0.38;
const DAMPING = 0.88;
const FLOOR_FRICTION = 0.65;
const SLEEP_SPEED = 0.08;
const MOUSE_ATTRACT_RADIUS = 500;
const MOUSE_ATTRACT_FORCE = 6;

export class GravitySpheres {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private spheres: Sphere[] = [];
  private raf: number | null = null;
  private width = 0;
  private height = 0;

  private mouseX = 0;
  private mouseY = 0;
  private prevMouseX = 0;
  private prevMouseY = 0;
  private isMouseDown = false;
  private draggedSphere: Sphere | null = null;
  private isOnSphere = false;

  private resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

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
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const palette = [
      { var: '--blue', radius: 85 },
      { var: '--purple', radius: 65 },
      { var: '--yellow', radius: 90 },
      { var: '--orange', radius: 70 },
      { var: '--pink', radius: 75 },
      { var: '--green', radius: 60 },
      { var: '--red', radius: 80 },
    ];
    const mobilePalette = palette.slice(0, 6);
    const radiusScale = isMobile ? 0.55 : 1;

    this.spheres = [];
    for (let rep = 0; rep < 2; rep++) {
      for (const { var: v, radius: baseRadius } of isMobile ? mobilePalette : palette) {
        const color = style.getPropertyValue(v).trim();
        const radius = baseRadius * radiusScale * (0.75 + Math.random() * 0.5);
        const gravity = 0.15 + Math.random() * 0.35;
        const startAbove = 400 + Math.random() * 100;
        const y = -radius - startAbove;
        // initial velocity as if already falling from that height
        const vy = Math.sqrt(2 * gravity * startAbove);
        this.spheres.push({
          x: Math.random() * this.width,
          y,
          vx: (Math.random() - 0.5) * 2,
          vy,
          radius,
          color,
          mass: radius * radius,
          dragged: false,
          gravity,
        });
      }
    }
  }

  private bindEvents() {
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });
    window.addEventListener('touchend', this.onMouseUp);
  }

  private getCanvasPos(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private onMouseDown = (e: MouseEvent) => {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    this.mouseX = pos.x;
    this.mouseY = pos.y;
    this.prevMouseX = pos.x;
    this.prevMouseY = pos.y;
    this.isMouseDown = true;
    this.tryGrab(pos.x, pos.y);
  };

  private onMouseMove = (e: MouseEvent) => {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    this.prevMouseX = this.mouseX;
    this.prevMouseY = this.mouseY;
    this.mouseX = pos.x;
    this.mouseY = pos.y;
    if (this.draggedSphere) {
      this.draggedSphere.x = pos.x;
      this.draggedSphere.y = pos.y;
    }
  };

  private onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    const pos = this.getCanvasPos(t.clientX, t.clientY);
    this.mouseX = pos.x;
    this.mouseY = pos.y;
    this.prevMouseX = pos.x;
    this.prevMouseY = pos.y;
    this.isMouseDown = true;
    this.tryGrab(pos.x, pos.y);
  };

  private onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    const pos = this.getCanvasPos(t.clientX, t.clientY);
    this.prevMouseX = this.mouseX;
    this.prevMouseY = this.mouseY;
    this.mouseX = pos.x;
    this.mouseY = pos.y;
    if (this.draggedSphere) {
      this.draggedSphere.x = pos.x;
      this.draggedSphere.y = pos.y;
    }
  };

  private onMouseUp = () => {
    if (this.draggedSphere) {
      this.draggedSphere.vx = (this.mouseX - this.prevMouseX) * 2.5;
      this.draggedSphere.vy = (this.mouseY - this.prevMouseY) * 2.5;
      this.draggedSphere.dragged = false;
      this.draggedSphere = null;
    }
    this.isMouseDown = false;
    this.isOnSphere = false;
  };

  private tryGrab(x: number, y: number) {
    // sort so topmost (largest index drawn last) is picked first
    for (let i = this.spheres.length - 1; i >= 0; i--) {
      const s = this.spheres[i];
      const dx = s.x - x,
        dy = s.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < s.radius) {
        this.draggedSphere = s;
        s.dragged = true;
        s.vx = 0;
        s.vy = 0;
        this.isOnSphere = true;
        return;
      }
    }
    this.isOnSphere = false;
  }

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

    if (!a.dragged) {
      a.x -= nx * overlap * (b.mass / total);
      a.y -= ny * overlap * (b.mass / total);
    }
    if (!b.dragged) {
      b.x += nx * overlap * (a.mass / total);
      b.y += ny * overlap * (a.mass / total);
    }

    const dvx = a.vx - b.vx,
      dvy = a.vy - b.vy;
    const dvn = dvx * nx + dvy * ny;
    if (dvn > 0) return;

    const impulse = (-(1 + RESTITUTION * 0.5) * dvn) / (1 / a.mass + 1 / b.mass);
    if (!a.dragged) {
      a.vx += (impulse / a.mass) * nx;
      a.vy += (impulse / a.mass) * ny;
    }
    if (!b.dragged) {
      b.vx -= (impulse / b.mass) * nx;
      b.vy -= (impulse / b.mass) * ny;
    }
  }

  private update() {
    for (const s of this.spheres) {
      if (s.dragged) continue;

      s.vy += s.gravity;

      // Mouse held on empty space → gravity well pulls all spheres
      if (this.isMouseDown && !this.isOnSphere) {
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

      // sleep when nearly still
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

    // Draw cursor hint when attracting
    if (this.isMouseDown && !this.isOnSphere) {
      const grad = this.ctx.createRadialGradient(
        this.mouseX,
        this.mouseY,
        0,
        this.mouseX,
        this.mouseY,
        MOUSE_ATTRACT_RADIUS
      );
      grad.addColorStop(0, 'rgba(0,0,0,0.06)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.02)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.beginPath();
      this.ctx.arc(this.mouseX, this.mouseY, MOUSE_ATTRACT_RADIUS, 0, Math.PI * 2);
      this.ctx.fillStyle = grad;
      this.ctx.fill();
    }

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
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onMouseUp);
  }
}
