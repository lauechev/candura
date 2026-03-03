interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

const MAX_SPEED = 0.3;

export class NodeNetwork {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nodes: Node[] = [];
  private colors: string[] = [];
  private raf: number | null = null;
  private width: number = 0;
  private height: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    const style = getComputedStyle(document.documentElement);
    this.colors = [
      style.getPropertyValue('--blue').trim(),
      style.getPropertyValue('--purple').trim(),
      style.getPropertyValue('--yellow').trim(),
      style.getPropertyValue('--orange').trim(),
      style.getPropertyValue('--pink').trim(),
      style.getPropertyValue('--green').trim(),
      style.getPropertyValue('--red').trim(),
    ];

    this.resize();
    this.nodes = this.createNodes();
    window.addEventListener('resize', () => {
      this.resize();
      this.nodes = this.createNodes();
    });
  }

  private resize(): void {
    const dpr = window.devicePixelRatio ?? 1;
    this.width = this.canvas.offsetWidth;
    this.height = this.canvas.offsetHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private nodeCount(): number {
    if (this.width < 480) return 15;
    if (this.width < 768) return 30;
    if (this.width < 1024) return 40;
    return 55;
  }

  private createNodes(): Node[] {
    return Array.from({ length: this.nodeCount() }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * MAX_SPEED,
      vy: (Math.random() - 0.5) * MAX_SPEED,
      radius: Math.random() * 3.5 + 3,
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
    }));
  }

  private update(): void {
    for (const node of this.nodes) {
      // Slight organic drift
      node.vx += (Math.random() - 0.5) * 0.008;
      node.vy += (Math.random() - 0.5) * 0.008;

      // Clamp speed
      const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (speed > MAX_SPEED) {
        node.vx = (node.vx / speed) * MAX_SPEED;
        node.vy = (node.vy / speed) * MAX_SPEED;
      }

      node.x += node.vx;
      node.y += node.vy;

      // Bounce off edges
      if (node.x < node.radius) {
        node.x = node.radius;
        node.vx *= -1;
      }
      if (node.x > this.width - node.radius) {
        node.x = this.width - node.radius;
        node.vx *= -1;
      }
      if (node.y < node.radius) {
        node.y = node.radius;
        node.vy *= -1;
      }
      if (node.y > this.height - node.radius) {
        node.y = this.height - node.radius;
        node.vy *= -1;
      }
    }
  }

  private draw(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw connections
    const threshold = Math.min(this.width, this.height) * 0.22;
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dx = this.nodes[i].x - this.nodes[j].x;
        const dy = this.nodes[i].y - this.nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < threshold) {
          const opacity = (1 - dist / threshold) * 0.25;
          this.ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
          this.ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
          this.ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (const node of this.nodes) {
      this.ctx.fillStyle = node.color;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  start(): void {
    const loop = () => {
      this.update();
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }
}
