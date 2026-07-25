import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  QuadraticBezierCurve3,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

const DEG = Math.PI / 180;

// ── Lighting (one dial) ─────────────────────────────────────────────────────
// Overall brightness. Lower = dimmer. Tone mapping rolls off highlights so the
// colours never blow out the way the old MeshStandard + env-map setup did.
const EXPOSURE = 0.85;

// ── Scene framing (world units) ─────────────────────────────────────────────
const FOV = 42;
const VH = 4.8; // target visible half-height; the cord anchors at the top edge
const CENTER_Y = -0.7; // piñata resting height — low on a long cord
const MIN_HALF_WIDTH = 2.4; // guarantee the star fits horizontally on narrow screens

// ── Piñata proportions ──────────────────────────────────────────────────────
const PINATA_SCALE = 0.7; // overall size of the hanging star
const BODY_R = 1.05;
const CONE_LEN = 1.35; // short points, halfway to the original 1.5
const CONE_R = 0.56; // base width, halfway to the original 0.5
const CONE_EMBED = 0.3; // how deep each cone base sinks into the body
const CONE_TIP_R = CONE_R * 0.13; // rounded-tip sphere blunting the apex

// ── Palette ─────────────────────────────────────────────────────────────────
// The piñata's colours, in stripe order. Resolved from the site CSS custom
// properties at construction (same source as the other scripts) so the piñata
// and confetti always match the site colours. This list is the only colour
// source for the body bands, the cones, and confetti.
const PALETTE = ['--blue', '--purple', '--yellow', '--orange', '--pink', '--green', '--red'];

// One colour per cone, ordered by cone position (0 = up, then 162°/234°/306°/18°,
// then front +z, back −z). Each is a distinct palette entry — no two cones share.
const CONE_COLORS = ['--blue', '--purple', '--orange', '--pink', '--green', '--red', '--yellow'];
// Each cone's rounded tip cap, a contrasting colour (never its cone's own).
// cone:      blue       purple     orange    pink       green       red       yellow
const TIP_COLORS = ['--yellow', '--green', '--blue', '--green', '--purple', '--blue', '--purple'];

// ── Tassels ─────────────────────────────────────────────────────────────────
// Curved clay strands that leave along the cone axis then droop toward world
// down (the droop is baked from each cone's rest orientation — no physics).
const TASSEL_STRANDS = 5; // strands per tip
const STRAND_LEN = 0.75; // base strand length …
const STRAND_LEN_VAR = 0.2; // … varied ±20% per strand
const STRAND_RADIUS = 0.03; // clay thickness (~2–3% of cone length)
const TASSEL_AXIS = 0.35; // how far the end travels along the cone axis
const TASSEL_DROOP = 0.8; // world-down pull (× length)
const TASSEL_FAN = 14 * DEG; // splay of the initial direction around the axis

// ── Frosting body (claymation candy look) ───────────────────────────────────
// The central body is one high-res sphere whose vertices are displaced into
// stacked frosting layers. Each band's boundary is a wavy line that dips up and
// down around the circumference (frosting dripping downward); the band bulges
// out at that boundary so the layer overhangs the one below.
const NUM_BANDS = 7; // frosting layers down the body — few enough to stay chunky
const SCALLOPS_PER_BAND = 10; // dips around each band's wavy boundary
const FROSTING_AMP = 0.12 * BODY_R; // radial overhang amplitude (~12% of radius)
const WAVE_DEPTH = 0.3; // vertical dip of a boundary, in band-height units

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

    // Resolve PALETTE (see top of file) against the live stylesheet.
    const style = getComputedStyle(document.documentElement);
    this.colors = PALETTE.map((name) => new Color(style.getPropertyValue(name).trim()));

    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
    // Tone mapping gives a single, well-behaved exposure control and stops the
    // lit colours from clipping to white.
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = EXPOSURE;
    this.renderer.outputColorSpace = SRGBColorSpace;
    // Soft self-shadows (frosting lips onto the body) add clay depth. There is
    // no ground plane, so nothing outside the piñata catches a shadow.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(FOV, 1, 0.1, 100);

    // A hemisphere fill (sky → ground) kept low enough that the raking key
    // light's self-shadows on the frosting lips stay visible.
    this.scene.add(new HemisphereLight(0xffffff, 0xdedede, 1.4));
    const key = new DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 2.5, 2.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 25;
    key.shadow.camera.left = -3;
    key.shadow.camera.right = 3;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -3;
    key.shadow.bias = -0.0004;
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
    // Central body: stacked frosting layers in the palette colours.
    const body = this.makeFrostingBody();
    this.pinata.add(body);

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

      // Matte clay cone, one solid palette colour, its own colour running all
      // the way to a soft rounded tip (no separate yellow tip band).
      const color = this.colors[PALETTE.indexOf(CONE_COLORS[i % CONE_COLORS.length])];
      const mat = new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
      const cone = new Mesh(new ConeGeometry(CONE_R, CONE_LEN, 64, 1, true), mat);
      cone.castShadow = true;
      cone.receiveShadow = true;
      cone.quaternion.setFromUnitVectors(up, d); // point the tip outward
      cone.position.copy(d).multiplyScalar(BODY_R + CONE_LEN / 2 - CONE_EMBED);

      // Blunt the apex with a small sphere in a contrasting clay colour. Child
      // of the cone → inherits its transform.
      const tipColor = this.colors[PALETTE.indexOf(TIP_COLORS[i % TIP_COLORS.length])];
      const tipMat = new MeshStandardMaterial({ color: tipColor, roughness: 0.85, metalness: 0 });
      const tipCap = new Mesh(new SphereGeometry(CONE_TIP_R, 24, 16), tipMat);
      tipCap.position.set(0, CONE_LEN / 2, 0);
      tipCap.castShadow = true;
      cone.add(tipCap);
      this.pinata.add(cone);

      // Drooping clay strands at each tip (the up cone's is the top tassel).
      const tip = d.clone().multiplyScalar(BODY_R + CONE_LEN - CONE_EMBED);
      this.addTassel(tip, d);
    });
  }

  /**
   * A tuft of curved clay strands at a cone tip. Each strand leaves the tip
   * along the cone axis, then arcs toward world-down and hangs — so up/side
   * cones' strands drape over and the bottom cones' hang nearly straight. The
   * droop is baked from the cone's rest orientation (no physics); strands live
   * under this.pinata like the old ones, so sway/spin/raycast are unchanged.
   */
  private addTassel(tip: Vector3, dir: Vector3): void {
    const down = new Vector3(0, -1, 0);
    // A basis perpendicular to the cone axis, to fan the strands around it.
    const ref = Math.abs(dir.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    const u = new Vector3().crossVectors(dir, ref).normalize();
    const v = new Vector3().crossVectors(dir, u).normalize();

    for (let i = 0; i < TASSEL_STRANDS; i++) {
      const color = this.colors[(i + 1) % this.colors.length];
      const mat = new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });

      // Fan the launch direction into a cone around the axis.
      const alpha = (i / TASSEL_STRANDS) * Math.PI * 2;
      const perp = u.clone().multiplyScalar(Math.cos(alpha)).add(v.clone().multiplyScalar(Math.sin(alpha)));
      const sdir = dir
        .clone()
        .multiplyScalar(Math.cos(TASSEL_FAN))
        .add(perp.multiplyScalar(Math.sin(TASSEL_FAN)))
        .normalize();

      const len = STRAND_LEN * (1 + (Math.random() - 0.5) * 2 * STRAND_LEN_VAR);
      const jitter = new Vector3((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12).multiplyScalar(len);
      const p0 = tip.clone();
      const p1 = tip.clone().add(sdir.clone().multiplyScalar(len * 0.5)); // leave along the axis
      const p2 = tip
        .clone()
        .add(sdir.clone().multiplyScalar(len * TASSEL_AXIS))
        .add(down.clone().multiplyScalar(len * TASSEL_DROOP))
        .add(jitter); // then droop toward world-down

      const curve = new QuadraticBezierCurve3(p0, p1, p2);
      const strand = new Mesh(new TubeGeometry(curve, 16, STRAND_RADIUS, 8, false), mat);
      strand.castShadow = true;
      this.pinata.add(strand);

      // Rounded free end (the p0 end is buried in the cone tip).
      const endCap = new Mesh(new SphereGeometry(STRAND_RADIUS, 12, 8), mat);
      endCap.position.copy(p2);
      endCap.castShadow = true;
      this.pinata.add(endCap);
    }
  }

  /**
   * The frosting body. Rather than displacing a sphere — whose horizontal
   * vertex rows cut diagonally across the wavy band boundaries and alias the
   * lip crease into a staircase — the geometry is built directly in WAVED BAND
   * SPACE: the v grid line *is* the band coordinate b, so every band boundary,
   * lip crest and crease runs along a constant-v edge loop and stays smooth at
   * any resolution. The true sphere height is recovered per vertex by inverting
   * the wave. Bands are coloured per pixel in the fragment shader from b.
   */
  private makeFrostingBody(): Mesh {
    const U = 192; // columns around (wrapped seam)
    const V = 512; // rows top→bottom; the ledge profile lives along v

    // Colour per band, cycling the palette; skip an entry if the cycle would
    // ever land the same colour on two adjacent bands.
    const bandColors: Color[] = [];
    let ci = 0;
    for (let b = 0; b < NUM_BANDS; b++) {
      if (b > 0 && this.colors[ci % this.colors.length].equals(bandColors[b - 1])) ci++;
      bandColors.push(this.colors[ci % this.colors.length]);
      ci++;
    }

    const smoothstep = (edge0: number, edge1: number, x: number) => {
      const s = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
      return s * s * (3 - 2 * s);
    };

    // Build the grid in band space. Each row j fixes the band coordinate b
    // directly; inverting the wave (b = h·NB + WAVE_DEPTH·sin(θ·scallops + φ))
    // recovers the true height h → the point on the sphere. The ledge push is a
    // 1-D function of fract(b), so its crest/crease is a constant-v edge loop.
    const vertCount = (V + 1) * U;
    const positions = new Float32Array(vertCount * 3);
    const aBand = new Float32Array(vertCount);
    for (let j = 0; j <= V; j++) {
      const b = (j / V) * NUM_BANDS;
      const t = b - Math.floor(b); // 0 at a boundary → 1 at the band's top
      // Smoothed sawtooth: a short rounded ramp up to the lip, then a steep
      // falloff — a clear stacked-layer ledge along this whole row.
      const profile = smoothstep(0, 0.08, t) * Math.pow(1 - t, 3.5);
      const phi = b * (Math.PI / SCALLOPS_PER_BAND); // height-drift phase (≈ h·NB·…)
      for (let i = 0; i < U; i++) {
        const theta = (i / U) * Math.PI * 2;
        const w = Math.sin(theta * SCALLOPS_PER_BAND + phi); // −1 … +1
        const h = Math.min(Math.max((b - WAVE_DEPTH * w) / NUM_BANDS, 0), 1);
        const y = BODY_R * (2 * h - 1);
        const rh0 = Math.sqrt(Math.max(BODY_R * BODY_R - y * y, 0));
        // Overhang lip, deeper at the dips (w → +1); faded to nothing at poles.
        const lipScale = 1 + 0.3 * 0.5 * (1 + w);
        const disp = FROSTING_AMP * profile * lipScale * (rh0 / BODY_R);
        const rh = rh0 + disp;
        const idx = j * U + i;
        positions[idx * 3] = rh * Math.cos(theta);
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = rh * Math.sin(theta);
        aBand[idx] = b;
      }
    }

    // Quad indices between consecutive rows, wrapping the seam (i → (i+1)%U) so
    // positions and normals stay continuous without a duplicated column. This
    // winding gives outward-facing normals.
    const index: number[] = [];
    for (let j = 0; j < V; j++) {
      for (let i = 0; i < U; i++) {
        const a = j * U + i;
        const b1 = j * U + ((i + 1) % U);
        const c = (j + 1) * U + i;
        const d = (j + 1) * U + ((i + 1) % U);
        index.push(a, c, b1, b1, c, d);
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('aBand', new BufferAttribute(aBand, 1));
    geo.setIndex(index);
    geo.computeVertexNormals();

    // Bands are coloured in the fragment shader (below) rather than per vertex,
    // so the colour edge follows the sine boundary at pixel resolution instead
    // of getting quantised to the triangulation. Flatten the palette to a
    // vec3[] uniform (linear rgb — same values the old vertex colours used).
    const paletteFlat = new Float32Array(NUM_BANDS * 3);
    bandColors.forEach((c, b) => {
      paletteFlat[b * 3] = c.r;
      paletteFlat[b * 3 + 1] = c.g;
      paletteFlat[b * 3 + 2] = c.b;
    });

    const mat = new MeshStandardMaterial({ roughness: 0.85, metalness: 0, flatShading: false });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uPalette = { value: paletteFlat };

      // Carry the per-vertex band coordinate b to the fragment stage.
      shader.vertexShader = 'attribute float aBand;\nvarying float vBand;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vBand = aBand;'
      );

      // Pick the band colour per pixel from floor(b). The colour boundary
      // (integer b) is exactly the geometric lip (fract(b) = 0), so the two
      // coincide, both riding the constant-b edge loop.
      shader.fragmentShader =
        `varying float vBand;\nuniform vec3 uPalette[${NUM_BANDS}];\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          int band = int(clamp(floor(vBand), 0.0, float(${NUM_BANDS - 1})));
          diffuseColor.rgb = uPalette[band];
        }`
      );
    };

    const body = new Mesh(geo, mat);
    body.scale.set(1, 0.92, 1); // slight squash → chubby
    body.castShadow = true;
    body.receiveShadow = true;
    return body;
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
        const withMap = mat as MeshStandardMaterial;
        if (withMap.map) withMap.map.dispose();
        mat.dispose();
      }
    });
    this.renderer.dispose();
  }
}
