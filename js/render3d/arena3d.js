// The 3D arena: a tiled ring floating in a starry void, with a rocky underside, crystal pillars,
// drifting rubble, spectator pods and a nebula sky. Cracks spread across the tiles as the fight
// damages the ring. The ring top is the ground plane (y = 0); its rim sits at the ring-out edges.
import * as THREE from 'three';
import { STAGE } from '../config.js';
import { U, color, toon, glowSprite } from './common.js';

const THEMES = {
  void: { sky: ['#06030f', '#1f0d45', '#0b0822'], nebula: ['#6a2bd9', '#1fb5c9', '#c2309a'], pods: true, edge: '#5ff2ff', tile: '#8a83b4', key: '#fff2e6', hemi: ['#a9b4ff', '#2a1d48'] },
  training: { sky: ['#0b1736', '#3b2a6b', '#e07a52'], nebula: ['#ff9a5a', '#5a7bff', '#ffcf6a'], pods: false, edge: '#ffd27a', tile: '#9c8fa8', key: '#ffd9b0', hemi: ['#ffc9a0', '#2e2140'] },
  final: { sky: ['#0a0210', '#3a0b3d', '#1a0614'], nebula: ['#b3249b', '#6b1fd1', '#ff4e5a'], pods: true, edge: '#d48bff', tile: '#7d6e9a', key: '#ffe0f0', hemi: ['#d7a3ff', '#2a0f2e'] },
};

let seed = 4242;
const srand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const sr = (a, b) => a + srand() * (b - a);

export const RING_R = ((STAGE.PLATFORM_R - STAGE.PLATFORM_L) / 2) * U + 0.08;

export class Arena3D {
  constructor(scene, quality) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.quality = quality;
    this.t = 0;
    this._sky();
    this._lights();
    this._platform();
    this._pillars();
    this._rubble();
    this._pods();
    this.setTheme('void');
  }

  _sky() {
    this.skyU = { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyU,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; varying vec3 vDir;
        void main(){ float h = normalize(vDir).y;
          vec3 col = h > 0.0 ? mix(c1, c0, smoothstep(0.0, 0.75, h)) : mix(c1, c2, smoothstep(0.0, -0.45, h));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    sky.renderOrder = -10;
    this.group.add(sky);
    // stars
    const n = this.quality === 'low' ? 700 : 1600;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = sr(-1, 1), th = sr(0, Math.PI * 2), r = 330;
      const s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(th) * s * r, u * r * 0.9 + 20, Math.sin(th) * s * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    this.group.add(this.stars);
    // nebula clouds
    this.nebulae = [];
    for (const [x, y, z, s] of [[-140, 60, -260, 260], [170, 90, -240, 220], [20, -20, -300, 320], [-260, 10, -60, 200], [260, 30, -80, 200]]) {
      const sp = glowSprite('#ffffff', s, 0.32);
      sp.material.fog = false;
      sp.position.set(x, y, z);
      this.group.add(sp);
      this.nebulae.push(sp);
    }
  }

  _lights() {
    this.hemi = new THREE.HemisphereLight('#a9b4ff', '#2a1d48', 1.6);
    this.group.add(this.hemi);
    this.key = new THREE.DirectionalLight('#fff2e6', 2.4);
    this.key.position.set(-6, 12, 9);
    if (this.quality === 'high') {
      this.key.castShadow = true;
      this.key.shadow.mapSize.set(1024, 1024);
      const c = this.key.shadow.camera;
      c.left = -9; c.right = 9; c.top = 9; c.bottom = -4; c.near = 1; c.far = 40;
      this.key.shadow.bias = -0.0008;
      this.key.shadow.normalBias = 0.02;
    }
    this.group.add(this.key, this.key.target);
    this.rim = new THREE.DirectionalLight('#7fe8ff', 1.6);
    this.rim.position.set(4, 6, -10);
    this.group.add(this.rim);
  }

  _platform() {
    const R = RING_R;
    // Tile texture, with cracks drawn on top as damage grows.
    const N = 1024;
    this.tileBase = document.createElement('canvas');
    this.tileBase.width = this.tileBase.height = N;
    this.tileCanvas = document.createElement('canvas');
    this.tileCanvas.width = this.tileCanvas.height = N;
    this.tileTex = new THREE.CanvasTexture(this.tileCanvas);
    this.tileTex.colorSpace = THREE.SRGBColorSpace;
    this.tileTex.anisotropy = 4;
    this.cracks = [];
    for (let i = 0; i < 14; i++) {
      const pts = [];
      let x = sr(0.2, 0.8) * N, y = (0.5 + sr(-0.12, 0.12)) * N;
      const ang = sr(0, Math.PI * 2);
      for (let k = 0; k < 7; k++) { pts.push([x, y]); x += Math.cos(ang + sr(-0.8, 0.8)) * sr(18, 46); y += Math.sin(ang + sr(-0.8, 0.8)) * sr(18, 46); }
      this.cracks.push(pts);
    }
    const top = new THREE.MeshLambertMaterial({ map: this.tileTex });
    const side = toon('#3b3560');
    const bottom = toon('#1d1830');
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.97, 0.42, 72, 1), [side, top, bottom]);
    plat.position.y = -0.21;
    plat.receiveShadow = true;
    this.group.add(plat);
    this.tileMat = top;
    // a lower step and glowing rims
    const step = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.97, R * 0.9, 0.5, 64, 1), toon('#2c2748'));
    step.position.y = -0.66;
    this.group.add(step);
    this.edgeMat = new THREE.MeshBasicMaterial({ color: '#5ff2ff' });
    for (const [r, y, th] of [[R, 0.0, 0.035], [R * 0.97, -0.42, 0.025]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, th, 6, 120), this.edgeMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      this.group.add(ring);
    }
    // rocky underside
    const rock = new THREE.ConeGeometry(R * 0.92, 6, 30, 6, true);
    rock.rotateX(Math.PI);
    const p = rock.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 2.9) continue;
      const k = 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.22;
      p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k);
    }
    const faceted = rock.toNonIndexed();
    faceted.computeVertexNormals();
    const under = new THREE.Mesh(faceted, toon('#2a2342'));
    under.position.y = -0.9 - 3;
    this.group.add(under);
    // ring-out marker posts
    this.postMats = [];
    for (const x of [-R + 0.1, R - 0.1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.75, 8), toon('#2a2550'));
      post.position.set(x, 0.37, 1.4);
      this.group.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), this.edgeMat);
      lamp.position.set(x, 0.8, 1.4);
      this.group.add(lamp);
    }
  }

  _drawTiles(tile) {
    const c = this.tileBase, x = c.getContext('2d'), N = c.width;
    const base = new THREE.Color(tile);
    x.fillStyle = '#2a2445';
    x.fillRect(0, 0, N, N);
    const n = 18, s = N / n;
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
      const v = 0.86 + ((i * 31 + k * 17) % 7) / 40;
      const cc = base.clone().multiplyScalar(v);
      x.fillStyle = `#${cc.getHexString()}`;
      x.fillRect(i * s + 3, k * s + 3, s - 6, s - 6);
      x.fillStyle = 'rgba(255,255,255,0.12)';
      x.fillRect(i * s + 3, k * s + 3, s - 6, 4);
      x.fillStyle = 'rgba(0,0,0,0.18)';
      x.fillRect(i * s + 3, k * s + s - 7, s - 6, 4);
    }
    // centre circle and start lines
    x.strokeStyle = 'rgba(255,255,255,0.22)';
    x.lineWidth = 6;
    x.beginPath(); x.arc(N / 2, N / 2, N * 0.16, 0, Math.PI * 2); x.stroke();
    this._damageShown = -1;
    this.setDamage(this._damage || 0, true);
  }

  setTheme(name) {
    const th = THEMES[name] || THEMES.void;
    this.theme = th;
    color(th.sky[0], this.skyU.c0.value);
    color(th.sky[1], this.skyU.c1.value);
    color(th.sky[2], this.skyU.c2.value);
    this.nebulae.forEach((s, i) => color(th.nebula[i % 3], s.material.color));
    this.edgeMat.color.set(th.edge);
    this.key.color.set(th.key);
    this.hemi.color.set(th.hemi[0]);
    this.hemi.groundColor.set(th.hemi[1]);
    this._hemiBase = this.hemi.color.clone();
    this.rim.color.set(th.edge);
    this.pods.visible = th.pods;
    this.scene.fog = new THREE.Fog(new THREE.Color(th.sky[1]), 26, 140);
    this._drawTiles(th.tile);
  }

  setDamage(k, force = false) {
    this._damage = k;
    const shown = Math.round(k * this.cracks.length);
    if (shown === this._damageShown && !force) return;
    this._damageShown = shown;
    const x = this.tileCanvas.getContext('2d');
    x.drawImage(this.tileBase, 0, 0);
    x.strokeStyle = 'rgba(14,10,28,0.9)';
    x.lineCap = 'round';
    x.lineJoin = 'round';
    for (let i = 0; i < shown; i++) {
      const pts = this.cracks[i];
      x.lineWidth = 5;
      x.beginPath();
      pts.forEach(([a, b], j) => (j ? x.lineTo(a, b) : x.moveTo(a, b)));
      x.stroke();
    }
    this.tileTex.needsUpdate = true;
  }

  setTint(c, amount) {
    if (!this._hemiBase) return;
    this.hemi.color.copy(this._hemiBase).lerp(new THREE.Color(c), Math.min(0.6, amount * 4));
  }

  _pillars() {
    const mat = toon('#3d46b5', null, { emissive: '#3a48ff', emissiveIntensity: 0.35 });
    const tipMat = toon('#8a96ff', null, { emissive: '#7f8cff', emissiveIntensity: 0.6 });
    for (const [x, z, h, r, broken] of [[-16, -10, 10, 0.6, false], [-10, -18, 13, 0.7, true], [12, -17, 11, 0.65, false], [18, -9, 8, 0.55, true], [-24, -2, 7, 0.55, true], [25, -4, 9.5, 0.6, false], [2, -32, 16, 0.9, false]]) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, h + 14, 6), mat);
      body.position.y = (h - 14) / 2;
      g.add(body);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(r * 0.85, broken ? 0.9 : 2.6, 6), tipMat);
      tip.position.y = h + (broken ? 0.3 : 1.3);
      if (broken) tip.rotation.z = 0.5;
      g.add(tip);
      g.position.set(x, 0, z);
      g.rotation.y = sr(0, 1);
      this.group.add(g);
    }
  }

  _rubble() {
    const n = this.quality === 'low' ? 18 : 40;
    this.rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), toon('#433b66'), n);
    this.rockData = [];
    for (let i = 0; i < n; i++) {
      let x, z;
      do { x = sr(-32, 32); z = sr(-34, 4); } while (Math.hypot(x, z) < RING_R + 3);
      this.rockData.push({ x, y: sr(-6, 9), z, s: sr(0.2, 1.1), rx: sr(0, 6), ry: sr(0, 6), sp: sr(0.1, 0.4), ph: sr(0, 6) });
    }
    this.group.add(this.rocks);
    this._m4 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  _pods() {
    this.pods = new THREE.Group();
    const shell = toon('#221d44');
    const glass = new THREE.MeshBasicMaterial({ color: '#8fd3ff', transparent: true, opacity: 0.75 });
    const stalk = toon('#1a1636');
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * (0.12 + (i / 11) * 0.76);
      const g = new THREE.Group();
      g.position.set(Math.cos(a) * -36, 9 + Math.sin(i * 1.3) * 1.5, -Math.sin(a) * 36);
      g.scale.setScalar(0.85);
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), shell);
      body.scale.set(1.5, 0.75, 1.5);
      g.add(body);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass);
      dome.position.y = 0.35;
      g.add(dome);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), stalk);
      st.position.y = -1.7;
      g.add(st);
      g.userData.ph = i * 0.37;
      this.pods.add(g);
    }
    this.group.add(this.pods);
  }

  update(dt) {
    this.t += dt;
    const { _m4: m, _q: q, _e: e, _v: v, _s: s } = this;
    this.rockData.forEach((r, i) => {
      e.set(r.rx + this.t * r.sp, r.ry + this.t * r.sp * 0.7, 0);
      q.setFromEuler(e);
      v.set(r.x, r.y + Math.sin(this.t * 0.6 + r.ph) * 0.3, r.z);
      s.setScalar(r.s);
      m.compose(v, q, s);
      this.rocks.setMatrixAt(i, m);
    });
    this.rocks.instanceMatrix.needsUpdate = true;
    if (this.pods.visible) this.pods.children.forEach((g) => { g.position.y += Math.sin(this.t * 1.2 + g.userData.ph) * 0.002; });
    this.edgeMat.color.set(this.theme.edge).multiplyScalar(0.8 + 0.2 * Math.sin(this.t * 2.4));
  }
}
