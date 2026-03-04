interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  z: number; // 0 = close, 1 = far
}

const MAX_SPEED = 0.4;

export class NodeNetwork {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nodes: Node[] = [];
  private colors: string[] = [];
  private raf: number | null = null;
  private width: number = 0;
  private height: number = 0;
  private mouse = { x: -9999, y: -9999 };
  private readonly MOUSE_RADIUS = 120;
  private readonly MOUSE_STRENGTH = 0.4;

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
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.mouse.x = -9999;
      this.mouse.y = -9999;
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
    if (this.width < 480) return 12;
    if (this.width < 768) return 30;
    if (this.width < 1024) return 40;
    return 45;
  }

  private createNodes(): Node[] {
    return Array.from({ length: this.nodeCount() }, () => {
      const z = Math.random(); // 0 = close, 1 = far
      const baseRadius = Math.random() * 15.5 + 9;
      return {
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * MAX_SPEED,
        vy: (Math.random() - 0.5) * MAX_SPEED,
        radius: baseRadius * (1 - z * 0.65), // far nodes are smaller
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        z,
      };
    });
  }

  private update(): void {
    for (const node of this.nodes) {
      // Slight organic drift (slower for far nodes)
      const drift = 0.008 * (1 - node.z * 0.6);
      node.vx += (Math.random() - 0.5) * drift;
      node.vy += (Math.random() - 0.5) * drift;

      // Clamp speed (far nodes move slower)
      const maxSpeed = MAX_SPEED * (1 - node.z * 0.5);
      const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (speed > maxSpeed) {
        node.vx = (node.vx / speed) * maxSpeed;
        node.vy = (node.vy / speed) * maxSpeed;
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

    // Mouse repulsion
    for (const node of this.nodes) {
      const dx = node.x - this.mouse.x;
      const dy = node.y - this.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.MOUSE_RADIUS && dist > 0) {
        const force = (1 - dist / this.MOUSE_RADIUS) * this.MOUSE_STRENGTH;
        node.vx += (dx / dist) * force;
        node.vy += (dy / dist) * force;
      }
    }

    // Collision between nodes (only same z-layer ± 0.3 collide)
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i];
        const b = this.nodes[j];

        if (Math.abs(a.z - b.z) > 0.3) continue; // far-apart depths don't collide

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.radius + b.radius;

        if (dist < minDist && dist > 0) {
          // Separate them
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;

          // Reflect velocities along collision normal
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const dot = dvx * nx + dvy * ny;
          a.vx -= dot * nx;
          a.vy -= dot * ny;
          b.vx += dot * nx;
          b.vy += dot * ny;
        }
      }
    }
  }

  private draw(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Sort so far nodes draw behind close nodes
    const sorted = [...this.nodes].sort((a, b) => b.z - a.z);

    // Draw connections
    const threshold = Math.min(this.width, this.height) * 0.22;
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const dx = sorted[i].x - sorted[j].x;
        const dy = sorted[i].y - sorted[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < threshold) {
          const opacity = (1 - dist / threshold) * 0.25;
          this.ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(sorted[i].x, sorted[i].y);
          this.ctx.lineTo(sorted[j].x, sorted[j].y);
          this.ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (const node of sorted) {
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
