interface FollowImage {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  size: number;
  offsetX: number;
  offsetY: number;
  stiffness: number;
  damping: number;
  opacity: number;
}

const COUNT = 8;

export class MouseFollowImages {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private items: FollowImage[] = [];
  private img: HTMLImageElement;
  private imgLoaded = false;
  private raf: number | null = null;
  private width = 0;
  private height = 0;
  private mouseX = 0;
  private mouseY = 0;
  private isHovering = false;
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

    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mouseleave', this.onMouseLeave);
    canvas.addEventListener('mouseenter', this.onMouseEnter);
  }

  private resize() {
    this.width = this.canvas.offsetWidth;
    this.height = this.canvas.offsetHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
  };

  private onMouseEnter = () => { this.isHovering = true; };
  private onMouseLeave = () => { this.isHovering = false; };

  private initItems() {
    this.items = [];
    const placed: FollowImage[] = [];

    for (let i = 0; i < COUNT; i++) {
      const size = 40 + Math.random() * 60;
      const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.6;
      const radius = 60 + Math.random() * 120;

      let bx = 0, by = 0, attempts = 0;
      do {
        bx = size / 2 + Math.random() * (this.width - size);
        by = size / 2 + Math.random() * (this.height - size);
        attempts++;
      } while (
        attempts < 40 &&
        placed.some((p) => {
          const dx = p.baseX - bx, dy = p.baseY - by;
          return dx * dx + dy * dy < (p.size + size) * (p.size + size) * 0.5;
        })
      );

      const item: FollowImage = {
        x: bx,
        y: by,
        vx: 0,
        vy: 0,
        baseX: bx,
        baseY: by,
        size,
        offsetX: Math.cos(angle) * radius,
        offsetY: Math.sin(angle) * radius,
        stiffness: 0.012 + Math.random() * 0.018, // low = floaty/slow
        damping: 0.82 + Math.random() * 0.1,      // high = smooth deceleration
        opacity: 0.75 + Math.random() * 0.25,
      };

      placed.push(item);
      this.items.push(item);
    }
  }

  private update() {
    for (const item of this.items) {
      const tx = this.isHovering
        ? this.mouseX + item.offsetX
        : item.baseX;
      const ty = this.isHovering
        ? this.mouseY + item.offsetY
        : item.baseY;

      // spring force toward target
      item.vx += (tx - item.x) * item.stiffness;
      item.vy += (ty - item.y) * item.stiffness;

      // dampen velocity
      item.vx *= item.damping;
      item.vy *= item.damping;

      item.x += item.vx;
      item.y += item.vy;
    }
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    if (!this.imgLoaded) return;

    const aspectRatio = this.img.naturalWidth / this.img.naturalHeight || 1;
    const sorted = [...this.items].sort((a, b) => a.size - b.size);

    for (const item of sorted) {
      const w = item.size;
      const h = w / aspectRatio;
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
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
    this.canvas.removeEventListener('mouseenter', this.onMouseEnter);
  }
}
