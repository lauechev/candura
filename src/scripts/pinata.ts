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
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  QuadraticBezierCurve3,
  Raycaster,
  RepeatWrapping,
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

// ── Clay finish ─────────────────────────────────────────────────────────────
// Matte clay with ONE small bright specular glint per rounded form (stylized
// clay render), not an overall sheen. The base stays flat; the glint is a
// tight clearcoat highlight caught from a single dedicated light.
const CLAY_ROUGHNESS = 0.75; // matte base — the clay itself
const CLEARCOAT = 0.5; // glint brightness (raise toward 0.7 if faint)
const CLEARCOAT_ROUGHNESS = 0.12; // glint size (lower toward 0.08 if too big)
const GLINT_INTENSITY = 1.6; // highlight light strength (2.4 if too faint on dark colours)
// High and camera-left so the glint rides each form's top silhouette edge.
const GLINT_POS = new Vector3(-4, 5, 4);

// ── Handmade imperfections ──────────────────────────────────────────────────
// Two scales of irregularity so the clay reads as hand-formed. At a glance the
// piñata looks the same: the dents are thumb-pressure waviness in the actual
// geometry, and the grain only roughens the specular glint, not the colour.
const DENT_FREQ = 2.2; // low frequency — a dent spans a big patch (~3–5 per cone length)
const DENT_AMP = 0.01; // TYPICAL dent depth as a fraction of each part's size (peaks ~3×)
const DENT_NOISE_RMS = 0.29; // measured rms of dentNoise; dividing by it makes DENT_AMP the typical depth
const GRAIN_SCALE = 0.01; // bump strength; invisible in flat light
const GRAIN_REPEAT = 5; // grain tiling on the body (smaller parts tile less)

// ── Scene framing (world units) ─────────────────────────────────────────────
const FOV = 42;
const VH = 4.8; // target visible half-height; the cord anchors at the top edge
const CENTER_Y = -0.7; // piñata resting height — low on a long cord
const MIN_HALF_WIDTH = 2.4; // guarantee the star fits horizontally on narrow screens
// Small screens: pull the camera back so the piñata reads a bit smaller and
// the star gets breathing room. layout() runs on resize, so this acts like a
// CSS media query.
const SMALL_SCREEN_W = 590; // px breakpoint
const SMALL_SCREEN_ZOOM_OUT = 1.2; // camera distance multiplier (≈17% smaller piñata)

// ── Piñata proportions ──────────────────────────────────────────────────────
const PINATA_SCALE = 0.7; // overall size of the hanging star
const BODY_R = 1.05;
// CONE_LEN and CONE_EMBED move together (tip stays at BODY_R + LEN − EMBED):
// the extra length is buried, keeping the visible point identical while the
// cone is thinner where it pierces the body — so the wavy frosting junction
// can't expose slivers of cone wall in the valleys between lips.
const CONE_LEN = 1.55;
const CONE_R = 0.56; // base width, halfway to the original 0.5
const CONE_EMBED = 0.5; // how deep each cone base sinks into the body
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
const STRAND_RADIUS = 0.019; // clay thickness — thin enough to read as string
const TASSEL_AXIS = 0.35; // how far the end travels along the cone axis
const TASSEL_DROOP = 0.8; // world-down pull (× length)
const TASSEL_FAN = 14 * DEG; // splay of the initial direction around the axis

// Tassel wiggle: a shader-only traveling wave (no physics sim). The root stays
// pinned to the cone tip, the free end swings most, and the wave runs
// root→tip so the strands read as string, not vibrating rods.
const TASSEL_FREQ = 16; // wiggle speed (rad/s of the sine)
const TASSEL_LAG = 3.0; // phase delay root→tip — the traveling-wave "whip"
const TASSEL_PEAK = 0.08; // impulse amplitude on whack (piñata-local units)
const TASSEL_HALF_LIFE = 0.4; // seconds for the whack impulse to halve
const TASSEL_IDLE = 0.008; // ~10% of peak, always on while the piñata sways

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
// Fraction of the piñata's own velocity the confetti inherits at emission, so
// a mid-swing burst travels with the piñata instead of hanging where it was
// clicked (which reads as bursting from empty space once the piñata swings
// on). Partial, not 1: paper confetti sheds speed to drag almost immediately.
const CONFETTI_INHERIT = 0.6;

// ── Value noise (for the dents) ─────────────────────────────────────────────
// Tiny dependency-free 3D value noise: hashed integer lattice, smoothstep
// blend, two octaves. Ample quality for barely-there low-frequency dents.
const hash3 = (xi: number, yi: number, zi: number): number => {
  let h = (Math.imul(xi, 374761393) + Math.imul(yi, 668265263) + Math.imul(zi, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245) | 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295; // 0 … 1
};

const valueNoise3 = (x: number, y: number, z: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fy = y - yi;
  const fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);
  let n = 0;
  for (let c = 0; c < 8; c++) {
    const cx = c & 1;
    const cy = (c >> 1) & 1;
    const cz = (c >> 2) & 1;
    const w = (cx ? sx : 1 - sx) * (cy ? sy : 1 - sy) * (cz ? sz : 1 - sz);
    n += w * hash3(xi + cx, yi + cy, zi + cz);
  }
  return n * 2 - 1; // −1 … 1
};

const dentNoise = (x: number, y: number, z: number): number =>
  valueNoise3(x, y, z) * 0.7 + valueNoise3(x * 2.17, y * 2.17, z * 2.17) * 0.3;

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

  // One shared grain canvas, three tilings (body / cones / small parts) so the
  // grain's world-space scale stays roughly consistent across part sizes.
  private grainBody: CanvasTexture;
  private grainCones: CanvasTexture;
  private grainSmall: CanvasTexture;

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

  // Piñata world velocity (finite-differenced each frame) for CONFETTI_INHERIT.
  private prevWorldPos = new Vector3();
  private worldVel = new Vector3();
  private tmpWorldPos = new Vector3();

  // Tassel wiggle state. The uniform objects are shared by reference across
  // every strand material, so two writes per frame drive them all.
  private tasselUniforms = { uTime: { value: 0 }, uAmp: { value: 0 } };
  private tasselImpulse = 0;

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

    this.grainBody = Pinata.makeGrainTexture();
    this.grainBody.repeat.set(GRAIN_REPEAT, GRAIN_REPEAT);
    this.grainCones = this.grainBody.clone();
    this.grainCones.repeat.set(2, 2);
    this.grainCones.needsUpdate = true;
    this.grainSmall = this.grainBody.clone();
    this.grainSmall.repeat.set(1, 1);
    this.grainSmall.needsUpdate = true;

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

    // One strong, high, off-to-the-side light whose only visible job is the
    // tight clearcoat glint; it casts no shadows so it can't wash the scene.
    const glint = new DirectionalLight(0xffffff, GLINT_INTENSITY);
    glint.position.copy(GLINT_POS);
    this.scene.add(glint);

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
    this.pinata.getWorldPosition(this.prevWorldPos); // so frame one's velocity is 0
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
  }

  /** Matte clay with a tight clearcoat glint — every piñata surface uses this. */
  private clayMaterial(color: Color, grain: CanvasTexture): MeshPhysicalMaterial {
    return new MeshPhysicalMaterial({
      color,
      metalness: 0,
      roughness: CLAY_ROUGHNESS,
      clearcoat: CLEARCOAT,
      clearcoatRoughness: CLEARCOAT_ROUGHNESS,
      bumpMap: grain,
      bumpScale: GRAIN_SCALE,
    });
  }

  /**
   * Clay material plus the tassel wiggle: a vertex-shader traveling wave along
   * aSwing, amplitude uAmp·aAlong² (root pinned, tip swings most). uTime/uAmp
   * are the shared this.tasselUniforms objects. The injected code is identical
   * for every strand, so three compiles a single program for all of them.
   */
  private tasselMaterial(color: Color): MeshPhysicalMaterial {
    const mat = this.clayMaterial(color, this.grainSmall);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.tasselUniforms.uTime;
      shader.uniforms.uAmp = this.tasselUniforms.uAmp;
      shader.vertexShader =
        'attribute float aAlong;\nattribute float aPhase;\nattribute vec3 aSwing;\n' +
        'uniform float uTime;\nuniform float uAmp;\n' +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed += aSwing *
          (uAmp * aAlong * aAlong * sin(uTime * ${TASSEL_FREQ.toFixed(1)} - aAlong * ${TASSEL_LAG.toFixed(1)} + aPhase));`
      );
    };
    return mat;
  }

  /**
   * Per-vertex wiggle inputs for one strand piece. `along` fixes aAlong for
   * the whole geometry (the end cap rides the tip at 1); when null it is read
   * from uv.x, which TubeGeometry already writes as i / tubularSegments — the
   * normalized distance along the strand.
   */
  private static addWiggleAttributes(geo: BufferGeometry, phase: number, swing: Vector3, along: number | null): void {
    const count = geo.getAttribute('position').count;
    const uv = geo.getAttribute('uv') as BufferAttribute;
    const aAlong = new Float32Array(count);
    const aPhase = new Float32Array(count);
    const aSwing = new Float32Array(count * 3);
    for (let k = 0; k < count; k++) {
      aAlong[k] = along ?? uv.getX(k);
      aPhase[k] = phase;
      aSwing[k * 3] = swing.x;
      aSwing[k * 3 + 1] = swing.y;
      aSwing[k * 3 + 2] = swing.z;
    }
    geo.setAttribute('aAlong', new BufferAttribute(aAlong, 1));
    geo.setAttribute('aPhase', new BufferAttribute(aPhase, 1));
    geo.setAttribute('aSwing', new BufferAttribute(aSwing, 3));
  }

  /**
   * Handmade dents: displace vertices along their normals with low-frequency
   * noise, then rebuild normals. `size` scales dent depth to the part; `seed`
   * de-correlates parts so no two dent identically. `apexFade` eases the
   * amplitude to zero between two local-y values — used near a cone's apex,
   * whose coincident vertices carry per-face normals and would split apart if
   * displaced undamped.
   */
  private dentGeometry(geo: BufferGeometry, size: number, seed: number, apexFade?: { from: number; to: number }): void {
    const pos = geo.getAttribute('position') as BufferAttribute;
    const nor = geo.getAttribute('normal') as BufferAttribute;
    const ox = seed * 17.31;
    const oy = seed * 9.17;
    const oz = seed * 23.71;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      let amp = DENT_AMP * size;
      if (apexFade) {
        const t = Math.min(Math.max((y - apexFade.from) / (apexFade.to - apexFade.from), 0), 1);
        amp *= 1 - t * t * (3 - 2 * t);
      }
      const d = (amp / DENT_NOISE_RMS) * dentNoise(x * DENT_FREQ + ox, y * DENT_FREQ + oy, z * DENT_FREQ + oz);
      pos.setXYZ(i, x + nor.getX(i) * d, y + nor.getY(i) * d, z + nor.getZ(i) * d);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /**
   * The grain bump: one small tileable canvas of softened random speckle.
   * Invisible in flat light; it makes the clearcoat glint slightly ragged and
   * alive instead of a clean hotspot. Shading only — colours are untouched.
   */
  private static makeGrainTexture(): CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const v = new Float32Array(size * size);
    for (let i = 0; i < v.length; i++) v[i] = Math.random();
    // One wrapping box-blur pass: soft speckle, not pixel salt, still tileable.
    const blurred = new Float32Array(size * size);
    let bMin = 1;
    let bMax = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            s += v[((y + dy + size) % size) * size + ((x + dx + size) % size)];
          }
        }
        const g = s / 9;
        blurred[y * size + x] = g;
        if (g < bMin) bMin = g;
        if (g > bMax) bMax = g;
      }
    }
    // The blur crushes contrast (sd 0.29 → ~0.10); stretch back to the full
    // range so it softens the speckle's shape without flattening its height.
    for (let i = 0; i < blurred.length; i++) {
      const g = ((blurred[i] - bMin) / (bMax - bMin)) * 255;
      const o = i * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = g;
      img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new CanvasTexture(canvas);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    return tex;
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
      // 24 height segments give the flank rows to dent (with 1, the only rows
      // are the fade-locked apex and the buried base rim — nothing can move).
      const coneGeo = new ConeGeometry(CONE_R, CONE_LEN, 64, 24, true);
      this.dentGeometry(coneGeo, CONE_LEN, 1 + i, { from: CONE_LEN * 0.3, to: CONE_LEN / 2 });
      const cone = new Mesh(coneGeo, this.clayMaterial(color, this.grainCones));
      cone.castShadow = true;
      cone.receiveShadow = true;
      cone.quaternion.setFromUnitVectors(up, d); // point the tip outward
      cone.position.copy(d).multiplyScalar(BODY_R + CONE_LEN / 2 - CONE_EMBED);

      // Blunt the apex with a small sphere in a contrasting clay colour. Child
      // of the cone → inherits its transform.
      const tipColor = this.colors[PALETTE.indexOf(TIP_COLORS[i % TIP_COLORS.length])];
      const tipGeo = new SphereGeometry(CONE_TIP_R, 24, 16);
      this.dentGeometry(tipGeo, CONE_TIP_R, 11 + i);
      const tipCap = new Mesh(tipGeo, this.clayMaterial(tipColor, this.grainSmall));
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
      // Grain only — no vertex dents; the thin strands would kink.
      const color = this.colors[(i + 1) % this.colors.length];
      const mat = this.tasselMaterial(color);

      // Fan the launch direction into a cone around the axis.
      const alpha = (i / TASSEL_STRANDS) * Math.PI * 2;
      const perp = u
        .clone()
        .multiplyScalar(Math.cos(alpha))
        .add(v.clone().multiplyScalar(Math.sin(alpha)));
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

      // One constant swing direction per strand: ⊥ to the chord, mostly
      // horizontal (fallback axis when the chord hangs near-vertical), plus a
      // random phase so the strands never wiggle in unison.
      const chord = p2.clone().sub(p0);
      const swingRef = Math.abs(chord.y) / chord.length() > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
      const swing = new Vector3().crossVectors(chord, swingRef).normalize();
      const phase = Math.random() * Math.PI * 2;

      const curve = new QuadraticBezierCurve3(p0, p1, p2);
      const tubeGeo = new TubeGeometry(curve, 16, STRAND_RADIUS, 8, false);
      Pinata.addWiggleAttributes(tubeGeo, phase, swing, null);
      const strand = new Mesh(tubeGeo, mat);
      strand.castShadow = true;
      this.pinata.add(strand);

      // Rounded free end (the p0 end is buried in the cone tip). It carries
      // aAlong = 1 with the strand's phase/swing, so it rides the moving tip.
      const capGeo = new SphereGeometry(STRAND_RADIUS, 12, 8);
      Pinata.addWiggleAttributes(capGeo, phase, swing, 1);
      const endCap = new Mesh(capGeo, mat);
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
    const cols = U + 1; // duplicated seam column — exists only to carry u = 1 for the grain uvs
    const vertCount = (V + 1) * cols;
    const positions = new Float32Array(vertCount * 3);
    const aBand = new Float32Array(vertCount);
    const uvs = new Float32Array(vertCount * 2);
    for (let j = 0; j <= V; j++) {
      const b = (j / V) * NUM_BANDS;
      const t = b - Math.floor(b); // 0 at a boundary → 1 at the band's top
      // Smoothed sawtooth: a short rounded ramp up to the lip, then a steep
      // falloff — a clear stacked-layer ledge along this whole row.
      const profile = smoothstep(0, 0.08, t) * Math.pow(1 - t, 3.5);
      const phi = b * (Math.PI / SCALLOPS_PER_BAND); // height-drift phase (≈ h·NB·…)
      for (let i = 0; i <= U; i++) {
        const theta = ((i % U) / U) * Math.PI * 2; // i = U duplicates i = 0 exactly
        const w = Math.sin(theta * SCALLOPS_PER_BAND + phi); // −1 … +1
        const h = Math.min(Math.max((b - WAVE_DEPTH * w) / NUM_BANDS, 0), 1);
        const y = BODY_R * (2 * h - 1);
        const rh0 = Math.sqrt(Math.max(BODY_R * BODY_R - y * y, 0));
        // Overhang lip, deeper at the dips (w → +1); faded to nothing at poles.
        const lipScale = 1 + 0.3 * 0.5 * (1 + w);
        const disp = FROSTING_AMP * profile * lipScale * (rh0 / BODY_R);
        const rh = rh0 + disp;
        // Handmade dent, keyed to the pre-lip sphere point and pushed along the
        // sphere normal so it flows smoothly across the band lips instead of
        // breaking them. Shared seam/pole vertices get identical inputs.
        const bx = rh0 * Math.cos(theta);
        const bz = rh0 * Math.sin(theta);
        const dd = ((DENT_AMP * BODY_R) / DENT_NOISE_RMS) * dentNoise(bx * DENT_FREQ, y * DENT_FREQ, bz * DENT_FREQ);
        const idx = j * cols + i;
        positions[idx * 3] = rh * Math.cos(theta) + (bx / BODY_R) * dd;
        positions[idx * 3 + 1] = y + (y / BODY_R) * dd;
        positions[idx * 3 + 2] = rh * Math.sin(theta) + (bz / BODY_R) * dd;
        aBand[idx] = b;
        uvs[idx * 2] = i / U;
        uvs[idx * 2 + 1] = j / V;
      }
    }

    // Quad indices between consecutive rows. The seam pair (i = 0 / i = U)
    // shares positions, and its normals are stitched below, so lighting stays
    // exactly as continuous as the old wrapped-index topology rendered it.
    // This winding gives outward-facing normals.
    const index: number[] = [];
    for (let j = 0; j < V; j++) {
      for (let i = 0; i < U; i++) {
        const a = j * cols + i;
        const b1 = a + 1;
        const c = (j + 1) * cols + i;
        const d = c + 1;
        index.push(a, c, b1, b1, c, d);
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('aBand', new BufferAttribute(aBand, 1));
    geo.setAttribute('uv', new BufferAttribute(uvs, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    // Stitch the seam pair's normals: each duplicate only saw the faces on its
    // own side, so average them to restore the wrapped result.
    const nrm = geo.getAttribute('normal') as BufferAttribute;
    for (let j = 0; j <= V; j++) {
      const a = j * cols;
      const s = a + U;
      const nx = nrm.getX(a) + nrm.getX(s);
      const ny = nrm.getY(a) + nrm.getY(s);
      const nz = nrm.getZ(a) + nrm.getZ(s);
      const l = Math.hypot(nx, ny, nz) || 1;
      nrm.setXYZ(a, nx / l, ny / l, nz / l);
      nrm.setXYZ(s, nx / l, ny / l, nz / l);
    }

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

    const mat = new MeshPhysicalMaterial({
      roughness: CLAY_ROUGHNESS,
      metalness: 0,
      clearcoat: CLEARCOAT,
      clearcoatRoughness: CLEARCOAT_ROUGHNESS,
      bumpMap: this.grainBody,
      bumpScale: GRAIN_SCALE,
      flatShading: false,
    });
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
      shader.fragmentShader = `varying float vBand;\nuniform vec3 uPalette[${NUM_BANDS}];\n` + shader.fragmentShader;
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
    // Must stay getWorldPosition-at-emission: it updates the matrix chain
    // itself, so the origin tracks the current sway even though pointer events
    // arrive outside the render loop.
    const origin = new Vector3();
    this.pinata.getWorldPosition(origin);

    const pos = this.confetti.geometry.getAttribute('position') as BufferAttribute;
    const col = this.confetti.geometry.getAttribute('color') as BufferAttribute;

    for (let n = 0; n < CONFETTI_PER_BURST; n++) {
      const i = this.confettiCursor;
      this.confettiCursor = (this.confettiCursor + 1) % CONFETTI_MAX;

      pos.setXYZ(i, origin.x, origin.y, origin.z);

      // Outward on a sphere with an upward bias, so it pops then rains down —
      // plus a share of the piñata's own velocity so a mid-swing burst travels
      // with it instead of hanging behind.
      const dir = new Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize();
      const speed = 3 + Math.random() * 5;
      this.confettiVel[i * 3] = dir.x * speed + this.worldVel.x * CONFETTI_INHERIT;
      this.confettiVel[i * 3 + 1] = dir.y * speed + this.worldVel.y * CONFETTI_INHERIT;
      this.confettiVel[i * 3 + 2] = dir.z * speed + this.worldVel.z * CONFETTI_INHERIT;
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
      // A little kick, in the direction of the hit, for delight — and a burst
      // of tassel wiggle that decays over the next second.
      this.kickVel += (this.pointer.x >= 0 ? -1 : 1) * 2.2;
      this.tasselImpulse = TASSEL_PEAK;
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
    let camZ = Math.max(fitHeightZ, fitWidthZ);
    if (w <= SMALL_SCREEN_W) camZ *= SMALL_SCREEN_ZOOM_OUT;

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

      // Tassel wiggle: the whack impulse decays; a whisper of idle motion
      // stays while the piñata sways (and is off with reduced motion).
      this.tasselImpulse *= Math.pow(0.5, dt / TASSEL_HALF_LIFE);
      this.tasselUniforms.uTime.value = this.t;
      this.tasselUniforms.uAmp.value = this.tasselImpulse + (this.idleAmp > 0 ? TASSEL_IDLE : 0);

      // Finite-difference the piñata's world velocity for confetti inheritance.
      this.pinata.getWorldPosition(this.tmpWorldPos);
      if (dt > 0) {
        this.worldVel.subVectors(this.tmpWorldPos, this.prevWorldPos).divideScalar(dt);
      }
      this.prevWorldPos.copy(this.tmpWorldPos);

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
        if (withMap.bumpMap) withMap.bumpMap.dispose();
        mat.dispose();
      }
    });
    this.renderer.dispose();
  }
}
