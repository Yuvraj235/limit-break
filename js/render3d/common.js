// Shared pieces for the 3D view: stage ↔ world mapping, cel-shaded materials, outlines, glow textures.
import * as THREE from 'three';
import { STAGE } from '../config.js';

/** World units per stage pixel. The fight stays on the z = 0 plane; x/y map straight across. */
export const U = 0.01;
export const wx = (x) => (x - STAGE.W / 2) * U;
export const wy = (y) => (STAGE.GROUND_Y - y) * U;
export const DEG = Math.PI / 180;

/** [r,g,b] 0–255 (sRGB) or a CSS hex → THREE.Color in the working (linear) space. */
export function color(c, out = new THREE.Color()) {
  if (Array.isArray(c)) return out.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
  return out.set(c);
}

let gradient = null;
/** Three-step cel ramp for MeshToonMaterial. */
export function toonRamp() {
  if (gradient) return gradient;
  gradient = new THREE.DataTexture(new Uint8Array([96, 176, 255]), 3, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

/**
 * Cel-shaded material with an anime rim light. `fx` holds per-fighter uniforms shared by all of its
 * materials: rim color/strength (the aura tints the silhouette) and a white hit flash.
 */
export function toon(c, fx, opts = {}) {
  const m = new THREE.MeshToonMaterial({ color: c, gradientMap: toonRamp(), ...opts });
  if (fx) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.rimColor = fx.rimColor;
      sh.uniforms.rimStrength = fx.rimStrength;
      sh.uniforms.flash = fx.flash;
      sh.fragmentShader = 'uniform vec3 rimColor;\nuniform float rimStrength;\nuniform float flash;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
        float rimF = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
        outgoingLight += rimColor * smoothstep(0.5, 0.9, rimF) * rimStrength;
        outgoingLight = mix(outgoingLight, vec3(1.0), flash);
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'lb-toon-rim';
  }
  return m;
}

/**
 * Ink outline: back faces pushed out along the normals (the classic "inverted hull"). The push is
 * done in view space and grows with distance, so the line stays about the same width on screen
 * whatever the part's own scale.
 */
export function outlineMaterial(c = '#14101c', thickness = 0.0016) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: color(c) }, thickness: { value: thickness }, opacity: { value: 1 } },
    vertexShader: `uniform float thickness;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        mv.xyz += normalize(normalMatrix * normal) * thickness * -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 color; uniform float opacity;
      void main() { gl_FragColor = vec4(color, opacity);
      #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });
}

let glowTex = null;
/** Soft white radial glow, tinted per sprite. */
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Additive glow sprite. */
export function glowSprite(c = '#ffffff', size = 1, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: color(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  s.scale.setScalar(size);
  return s;
}

/**
 * Closed tube with an elliptical cross-section through a list of rings {y, rx, rz, ox}. Used for
 * torsos, hips and belts. colorFn(t, theta) may return a THREE.Color per vertex.
 */
export function ringsGeometry(rings, segs = 28, colorFn = null) {
  const pos = [], cols = [], idx = [];
  const y0 = rings[0].y, y1 = rings.at(-1).y;
  const tmp = new THREE.Color();
  const push = (x, y, z, t, th) => {
    pos.push(x, y, z);
    if (colorFn) { const c = colorFn(t, th, tmp.setRGB(1, 1, 1)) || tmp.setRGB(1, 1, 1); cols.push(c.r, c.g, c.b); }
  };
  for (const r of rings) {
    const t = (r.y - y0) / (y1 - y0 || 1);
    for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * Math.PI * 2;
      push((r.ox || 0) + Math.cos(th) * r.rx, r.y, Math.sin(th) * r.rz, t, th);
    }
  }
  const row = segs + 1;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  // caps
  const capB = pos.length / 3; push(rings[0].ox || 0, y0, 0, 0, 0);
  const capT = pos.length / 3; push(rings.at(-1).ox || 0, y1, 0, 1, 0);
  const last = (rings.length - 1) * row;
  for (let j = 0; j < segs; j++) { idx.push(capB, j, j + 1); idx.push(capT, last + j + 1, last + j); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Rounded, tapered limb hanging from the joint at y = 0 down to y = -L (muscle bulge mid-way). */
export function limbGeometry(L, r0, r1, bulge = 0, segs = 14) {
  const pts = [];
  for (let i = 4; i >= 0; i--) { const th = (i / 4) * Math.PI / 2; pts.push(new THREE.Vector2(r1 * Math.cos(th), -L - r1 * Math.sin(th))); }
  for (let i = 7; i >= 1; i--) { const t = i / 8; pts.push(new THREE.Vector2(r0 + (r1 - r0) * t + bulge * Math.sin(Math.PI * t), -L * t)); }
  for (let i = 0; i <= 4; i++) { const th = (i / 4) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.001, r0 * Math.cos(th)), r0 * Math.sin(th))); }
  pts[0].x = 0.001;
  return new THREE.LatheGeometry(pts, segs);
}
