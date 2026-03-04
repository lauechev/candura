interface BouncingImage {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

const COUNT = 7;

export class BouncingImages {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private items: BouncingImage[] = [];
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

  private makeItem(): BouncingImage {
    const depth = Math.random();
    const size = 70 + depth * 90;
    const speed = 0.07 + depth * 0.2;
    const angle = Math.random() * Math.PI * 2;

    return {
      x: size / 2 + Math.random() * (this.width - size),
      y: size / 2 + Math.random() * (this.height - size),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size,
      opacity: 0.8 + Math.random() * 0.2,
    };
  }

  private initItems() {
    this.items = [];
    const placed: BouncingImage[] = [];

    for (let i = 0; i < COUNT; i++) {
      let item!: BouncingImage;
      let attempts = 0;

      do {
        item = this.makeItem();
        attempts++;
      } while (
        attempts < 40 &&
        placed.some((p) => {
          const dx = p.x - item.x,
            dy = p.y - item.y;
          const minDist = (p.size + item.size) * 0.6;
          return dx * dx + dy * dy < minDist * minDist;
        })
      );

      placed.push(item);
      this.items.push(item);
    }
  }

  private update() {
    for (const item of this.items) {
      item.x += item.vx;
      item.y += item.vy;

      const halfW = item.size / 2;
      const halfH = item.size / (this.img.naturalWidth / this.img.naturalHeight || 1) / 2;

      if (item.x - halfW < 0) {
        item.x = halfW;
        item.vx = Math.abs(item.vx);
      }
      if (item.x + halfW > this.width) {
        item.x = this.width - halfW;
        item.vx = -Math.abs(item.vx);
      }
      if (item.y - halfH < 0) {
        item.y = halfH;
        item.vy = Math.abs(item.vy);
      }
      if (item.y + halfH > this.height) {
        item.y = this.height - halfH;
        item.vy = -Math.abs(item.vy);
      }
    }
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    if (!this.imgLoaded) return;

    const aspectRatio = this.img.naturalWidth / this.img.naturalHeight || 1;

    const sorted = [...this.items].sort((a, b) => a.size - b.size);

    for (const item of sorted) {
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
