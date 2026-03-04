interface FloatingImage {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  targetOpacity: number;
  fadeSpeed: number;
  active: boolean;
  offScreenTimer: number;
}

const TOTAL = 15;
const MAX_ACTIVE = 7;
const MIN_ACTIVE = 5;

export class FloatingImages {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private items: FloatingImage[] = [];
  private img: HTMLImageElement;
  private imgLoaded = false;
  private raf: number | null = null;
  private width = 0;
  private height = 0;
  private resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, imageSrc: string) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    this.img = new Image();
    this.img.onload = () => (this.imgLoaded = true);
    this.img.src = imageSrc;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.initItems();
  }

  private resize() {
    this.width = this.canvas.offsetWidth;
    this.height = this.canvas.offsetHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  private makeItem(active: boolean): FloatingImage {
    const depth = Math.random();
    const size = 70 + depth * 100; // 70px (far) → 270px (near)
    const speed = 0.008 + depth * 0.297; // slow far, faster near
    const angle = Math.random() * Math.PI * 2;

    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size,
      opacity: 0,
      targetOpacity: active ? 0.75 + Math.random() * 0.25 : 0,
      fadeSpeed: 0.003 + Math.random() * 0.004,
      active,
      offScreenTimer: 0,
    };
  }

  private spawnFromEdge(): Partial<FloatingImage> {
    const depth = Math.random();
    const size = 70 + depth * 170;
    const speed = 0.08 + depth * 0.35;
    const side = Math.floor(Math.random() * 4);

    let x = 0,
      y = 0;
    if (side === 0) {
      x = -size / 2;
      y = Math.random() * this.height;
    } else if (side === 1) {
      x = this.width + size / 2;
      y = Math.random() * this.height;
    } else if (side === 2) {
      x = Math.random() * this.width;
      y = -size / 2;
    } else {
      x = Math.random() * this.width;
      y = this.height + size / 2;
    }

    // drift toward center-ish area with some randomness
    const cx = this.width * (0.3 + Math.random() * 0.4);
    const cy = this.height * (0.3 + Math.random() * 0.4);
    const dx = cx - x,
      dy = cy - y;
    const len = Math.sqrt(dx * dx + dy * dy);

    return {
      x,
      y,
      size,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      opacity: 0,
      targetOpacity: 0.75 + Math.random() * 0.25,
      fadeSpeed: 0.003 + Math.random() * 0.004,
      active: true,
      offScreenTimer: 0,
    };
  }

  private initItems() {
    this.items = [];
    const placed: FloatingImage[] = [];

    for (let i = 0; i < TOTAL; i++) {
      const item = this.makeItem(i < MAX_ACTIVE);

      if (i < MAX_ACTIVE) {
        let attempts = 0;
        let x = 0,
          y = 0;
        do {
          x = Math.random() * this.width;
          y = Math.random() * this.height;
          attempts++;
        } while (
          attempts < 30 &&
          placed.some((p) => {
            const dx = p.x - x,
              dy = p.y - y;
            const minDist = (p.size + item.size) * 0.7;
            return dx * dx + dy * dy < minDist * minDist;
          })
        );
        item.x = x;
        item.y = y;
        placed.push(item);
      }

      this.items.push(item);
    }
  }

  private isOffScreen(item: FloatingImage): boolean {
    const pad = item.size;
    return item.x < -pad || item.x > this.width + pad || item.y < -pad || item.y > this.height + pad;
  }

  private update() {
    let activeCount = this.items.filter((i) => i.active).length;

    for (const item of this.items) {
      if (item.active) {
        item.x += item.vx;
        item.y += item.vy;

        if (this.isOffScreen(item)) {
          item.targetOpacity = 0;
        }

        // lerp opacity
        const diff = item.targetOpacity - item.opacity;
        item.opacity += diff * item.fadeSpeed * 10;
        if (Math.abs(diff) < 0.001) item.opacity = item.targetOpacity;

        // deactivate once fully faded out off-screen
        if (item.opacity <= 0.001 && item.targetOpacity === 0) {
          item.opacity = 0;
          item.active = false;
          item.offScreenTimer = 120 + Math.floor(Math.random() * 240);
          activeCount--;
        }
      } else {
        const belowMin = activeCount < MIN_ACTIVE;
        if (item.offScreenTimer > 0 && !belowMin) {
          item.offScreenTimer--;
        } else if (activeCount < MAX_ACTIVE) {
          Object.assign(item, this.spawnFromEdge());
          activeCount++;
        }
      }
    }
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    if (!this.imgLoaded) return;

    const aspectRatio = this.img.naturalWidth / this.img.naturalHeight || 1;

    // draw small (far) images first so large ones render on top
    const visible = this.items.filter((i) => i.active && i.opacity > 0).sort((a, b) => a.size - b.size);

    for (const item of visible) {
      const w = item.size;
      const h = item.size / aspectRatio;
      this.ctx.globalAlpha = item.opacity;
      this.ctx.drawImage(this.img, item.x - w / 2, item.y - h / 2, w, h);
    }

    this.ctx.globalAlpha = 1;
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
  }
}
