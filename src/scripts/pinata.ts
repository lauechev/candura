import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshPhongMaterial,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

const DEG = Math.PI / 180;

// ── Lighting (one dial) ─────────────────────────────────────────────────────
// Overall brightness. Lower = dimmer. Tone mapping rolls off highlights so the
// colours never blow out the way the old MeshStandard + env-map setup did.
const EXPOSURE = 0.85;

// Subtle sheen. Higher SPECULAR = brighter highlight; higher SHININESS = a
// tighter, glossier dot. Kept low for just a hint of shine.
const SPECULAR = 0x608080;
const SHININESS = 37;

// ── Scene framing (world units) ─────────────────────────────────────────────
const FOV = 42;
const VH = 4.8; // target visible half-height; the cord anchors at the top edge
const CENTER_Y = -0.7; // piñata resting height — low on a long cord
const MIN_HALF_WIDTH = 2.4; // guarantee the star fits horizontally on narrow screens

// ── Piñata proportions ──────────────────────────────────────────────────────
const PINATA_SCALE = 0.7; // overall size of the hanging star
const BODY_R = 1.05;
const CONE_LEN = 1.5;
const CONE_R = 0.5;

// ── Confetti ────────────────────────────────────────────────────────────────
const CONFETTI_MAX = 320;
const CONFETTI_PER_BURST = 130;
const CONFETTI_GRAVITY = 12;
const CONFETTI_LIFE = 2.6;

/**
 * A hanging Three.js star piñata. Sways gently on its cord and bursts palette
 * confetti when clicked. Mirrors the constructor/start/destroy shape of the
 * other scripts in this folder (see NodeNetwork.ts).
 */
export class Pinata {
  private canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private lastTime = 0;
  private raf: number | null = null;

  private colors: Color[] = [];

  private pivot: Group; // anchored at the cord's top point; rotates to sway
  private pinata: Group; // the star itself, hanging below the pivot
  private cord: Mesh;

  // Sway = gentle idle sine + a spring-damped kick added on each click.
  private t = 0;
  private idleAmp: number;
  private kickAngle = 0;
  private kickVel = 0;

  // Confetti pool.
  private confetti: Points;
  private confettiVel: Float32Array;
  private confettiLife: Float32Array;
  private confettiCursor = 0;

  private raycaster = new Raycaster();
  private pointer = new Vector2();

  // Bound handlers so they can be removed in destroy().
  private onResize = () => this.layout();
  private onPointerDown = (e: PointerEvent) => this.handlePointer(e);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.idleAmp = prefersReduced ? 0 : 0.08;

    // Palette straight from the CSS custom properties (same source as the other
    // scripts) so the piñata and confetti always match the site colours.
    const style = getComputedStyle(document.documentElement);
    this.colors = ['--blue', '--purple', '--yellow', '--orange', '--pink', '--green', '--red'].map(
      (name) => new Color(style.getPropertyValue(name).trim())
    );

    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
    // Tone mapping gives a single, well-behaved exposure control and stops the
    // lit colours from clipping to white.
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = EXPOSURE;

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(FOV, 1, 0.1, 100);

    // Soft, even lighting: a hemisphere fill (sky → ground) plus a gentle key
    // for form. No environment map, no specular — the Lambert materials below
    // only take diffuse light, so there are no hot highlights.
    this.scene.add(new HemisphereLight(0xffffff, 0xdedede, 2.2));
    const key = new DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 3, 4);
    this.scene.add(key);

    // pivot (top) → cord + pinata hang beneath it.
    this.pivot = new Group();
    this.scene.add(this.pivot);

    this.cord = new Mesh(new CylinderGeometry(0.01, 0.01, 1, 6), new MeshBasicMaterial({ color: 0x3a3a3a }));
    this.pivot.add(this.cord);

    this.pinata = new Group();
    this.pinata.scale.setScalar(PINATA_SCALE);
    this.pivot.add(this.pinata);
    this.buildPinata();

    this.confetti = this.buildConfetti();
    this.confettiVel = new Float32Array(CONFETTI_MAX * 3);
    this.confettiLife = new Float32Array(CONFETTI_MAX);
    this.scene.add(this.confetti);

    this.layout();
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
  }

  // ── Build the star piñata ─────────────────────────────────────────────────
  private buildPinata(): void {
    // Palette order: [blue, purple, yellow, orange, pink, green, red].
    const [blue, purple, yellow, orange, pink, green, red] = this.colors;

    // Central body: full rainbow stripe.
    const bodyStripes = this.makeStripeTexture(this.colors);
    const body = new Mesh(
      new SphereGeometry(BODY_R, 32, 24),
      new MeshPhongMaterial({ map: bodyStripes, specular: SPECULAR, shininess: SHININESS })
    );
    this.pinata.add(body);

    // Each cone a different colour (yellow is reserved for the tips), cycled
    // across the seven points.
    const coneColors = [blue, purple, orange, pink, green, red];

    // Seven radiating points (classic piñata estrella): five around the front
    // face 72° apart with one pointing straight up, plus one front and one back.
    const dirs: Vector3[] = [];
    for (let i = 0; i < 5; i++) {
      const a = 90 * DEG + i * 72 * DEG;
      dirs.push(new Vector3(Math.cos(a), Math.sin(a), 0));
    }
    dirs.push(new Vector3(0, 0, 1));
    dirs.push(new Vector3(0, 0, -1));

    const up = new Vector3(0, 1, 0);
    dirs.forEach((dir, i) => {
      const d = dir.clone().normalize();
      const cone = new Mesh(
        new ConeGeometry(CONE_R, CONE_LEN, 18, 1, true),
        new MeshPhongMaterial({
          map: this.makeTipTexture(coneColors[i % coneColors.length], yellow),
          specular: SPECULAR,
          shininess: SHININESS,
        })
      );
      cone.quaternion.setFromUnitVectors(up, d); // point the tip outward
      cone.position.copy(d).multiplyScalar(BODY_R + CONE_LEN / 2 - 0.25);
      this.pinata.add(cone);

      // A little tassel at each tip.
      const tip = d.clone().multiplyScalar(BODY_R + CONE_LEN - 0.25);
      this.addTassel(tip, d, this.colors[i % this.colors.length]);
    });
  }

  /** A small tuft of drooping strands at a cone tip. */
  private addTassel(tip: Vector3, dir: Vector3, color: Color): void {
    const strands = 5;
    for (let i = 0; i < strands; i++) {
      const strandLen = 0.75;
      const strand = new Mesh(
        new CylinderGeometry(0.015, 0.05, strandLen, 4),
        new MeshPhongMaterial({
          color: this.colors[(i + 1) % this.colors.length],
          specular: SPECULAR,
          shininess: SHININESS,
        })
      );
      // Splay outward along the tip direction, then let it droop downward.
      const droop = dir
        .clone()
        .multiplyScalar(0.9)
        .add(new Vector3((Math.random() - 0.5) * 0.5, -0.9, (Math.random() - 0.5) * 0.5))
        .normalize();
      strand.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), droop);
      // Attach the strand's top end at the cone tip.
      strand.position.copy(tip).add(droop.clone().multiplyScalar(strandLen / 2));
      this.pinata.add(strand);
    }
    void color;
  }

  /** Horizontal bands of the given colours baked into a texture → stripe look. */
  private makeStripeTexture(colors: Color[]): CanvasTexture {
    const bands = colors.length * 2;
    const bandPx = 20;
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = bands * bandPx;
    const ctx = c.getContext('2d')!;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = '#' + colors[i % colors.length].getHexString();
      ctx.fillRect(0, i * bandPx, c.width, bandPx);
    }
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }

  /** A solid cone colour with a coloured tip band (top row → the cone apex). */
  private makeTipTexture(base: Color, tip: Color): CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#' + base.getHexString();
    ctx.fillRect(0, 0, c.width, c.height);
    // Canvas top row maps to the cone apex (uv.y = 1 with the default flipY).
    ctx.fillStyle = '#' + tip.getHexString();
    ctx.fillRect(0, 0, c.width, 14);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }

  // ── Confetti ──────────────────────────────────────────────────────────────
  private buildConfetti(): Points {
    const geo = new BufferGeometry();
    const positions = new Float32Array(CONFETTI_MAX * 3);
    const colors = new Float32Array(CONFETTI_MAX * 3);
    // Park everything far below the frame until it's used.
    for (let i = 0; i < CONFETTI_MAX; i++) positions[i * 3 + 1] = -9999;
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    const mat = new PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    const points = new Points(geo, mat);
    // The particles start parked far below the frame, so the auto-computed
    // bounding sphere would frustum-cull the whole object and it would never
    // render even once seeded at the piñata. Disable culling.
    points.frustumCulled = false;
    return points;
  }

  private burst(): void {
    const origin = new Vector3();
    this.pinata.getWorldPosition(origin);

    const pos = this.confetti.geometry.getAttribute('position') as BufferAttribute;
    const col = this.confetti.geometry.getAttribute('color') as BufferAttribute;

    for (let n = 0; n < CONFETTI_PER_BURST; n++) {
      const i = this.confettiCursor;
      this.confettiCursor = (this.confettiCursor + 1) % CONFETTI_MAX;

      pos.setXYZ(i, origin.x, origin.y, origin.z);

      // Outward on a sphere with an upward bias, so it pops then rains down.
      const dir = new Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize();
      const speed = 3 + Math.random() * 5;
      this.confettiVel[i * 3] = dir.x * speed;
      this.confettiVel[i * 3 + 1] = dir.y * speed;
      this.confettiVel[i * 3 + 2] = dir.z * speed;
      this.confettiLife[i] = CONFETTI_LIFE * (0.7 + Math.random() * 0.3);

      const color = this.colors[(Math.random() * this.colors.length) | 0];
      col.setXYZ(i, color.r, color.g, color.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  private updateConfetti(dt: number): void {
    const pos = this.confetti.geometry.getAttribute('position') as BufferAttribute;
    let dirty = false;
    for (let i = 0; i < CONFETTI_MAX; i++) {
      if (this.confettiLife[i] <= 0) continue;
      this.confettiLife[i] -= dt;
      this.confettiVel[i * 3 + 1] -= CONFETTI_GRAVITY * dt;

      const x = pos.getX(i) + this.confettiVel[i * 3] * dt;
      const y = pos.getY(i) + this.confettiVel[i * 3 + 1] * dt;
      const z = pos.getZ(i) + this.confettiVel[i * 3 + 2] * dt;

      if (this.confettiLife[i] <= 0) {
        pos.setXYZ(i, 0, -9999, 0); // park it out of frame
      } else {
        pos.setXYZ(i, x, y, z);
      }
      dirty = true;
    }
    if (dirty) pos.needsUpdate = true;
  }

  // ── Interaction ───────────────────────────────────────────────────────────
  private handlePointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.pinata, true);
    if (hit.length > 0) {
      this.burst();
      // A little kick, in the direction of the hit, for delight.
      this.kickVel += (this.pointer.x >= 0 ? -1 : 1) * 2.2;
    }
  }

  // ── Layout / camera framing ───────────────────────────────────────────────
  private layout(): void {
    const w = this.canvas.clientWidth || this.canvas.offsetWidth || 1;
    const h = this.canvas.clientHeight || this.canvas.offsetHeight || 1;
    this.renderer.setSize(w, h, false);

    const aspect = w / h;
    const tan = Math.tan((FOV * DEG) / 2);
    const fitHeightZ = VH / tan;
    const fitWidthZ = MIN_HALF_WIDTH / (tan * aspect);
    const camZ = Math.max(fitHeightZ, fitWidthZ);

    this.camera.aspect = aspect;
    this.camera.position.set(0, 0, camZ);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    const topY = camZ * tan; // world Y at the top edge of the frame
    this.pivot.position.set(0, topY, 0);
    this.pinata.position.y = CENTER_Y - topY;

    const cordLen = topY - (CENTER_Y + BODY_R * PINATA_SCALE);
    this.cord.scale.y = cordLen;
    this.cord.position.y = -cordLen / 2;
  }

  // ── Loop ──────────────────────────────────────────────────────────────────
  start(): void {
    this.lastTime = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      this.t += dt;

      // Idle sway + spring-damped click kick.
      this.kickVel += (-14 * this.kickAngle - 3 * this.kickVel) * dt;
      this.kickAngle += this.kickVel * dt;
      this.pivot.rotation.z = Math.sin(this.t * 0.8) * this.idleAmp + this.kickAngle;

      // A slow drift so the 3D star reads (skipped when idle sway is off).
      if (this.idleAmp > 0) this.pinata.rotation.y += dt * 0.25;

      this.updateConfetti(dt);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);

    this.scene.traverse((obj) => {
      const mesh = obj as Mesh | Points;
      if ((mesh as Mesh).geometry) (mesh as Mesh).geometry.dispose();
      const mat = (mesh as Mesh).material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) {
        const withMap = mat as MeshPhongMaterial;
        if (withMap.map) withMap.map.dispose();
        mat.dispose();
      }
    });
    this.renderer.dispose();
  }
}
