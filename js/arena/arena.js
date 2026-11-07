import { STAGE } from '../config.js';
import { el } from '../characters/parts.js';
import { quality } from '../core/quality.js';

let seed = 1337;
const srand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const sr = (a, b) => a + srand() * (b - a);

const THEMES = {
  void: { sky: ['#06030f', '#1f0d45', '#0b0822'], nebula: ['#6a2bd9', '#1fb5c9', '#c2309a'], pods: true, edge: '#5ff2ff' },
  training: { sky: ['#0b1736', '#3b2a6b', '#e07a52'], nebula: ['#ff9a5a', '#5a7bff', '#ffcf6a'], pods: false, edge: '#ffd27a' },
  final: { sky: ['#0a0210', '#3a0b3d', '#1a0614'], nebula: ['#b3249b', '#6b1fd1', '#ff4e5a'], pods: true, edge: '#d48bff' },
};

/**
 * Tournament-of-Power style arena: a tiled ring floating in a starry void, crystal pillars,
 * drifting rubble and spectator pods. Three layers take different camera parallax.
 */
export class Arena {
  constructor(svg) {
    this.svg = svg;
    const defs = el('defs', {}, svg);
    const lg = (id, stops, x2 = 0, y2 = 1) => {
      const g = el('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, defs);
      return stops.map(([o, c]) => el('stop', { offset: o, 'stop-color': c }, g));
    };
    const rg = (id, c) => {
      const g = el('radialGradient', { id }, defs);
      el('stop', { offset: '0%', 'stop-color': c, 'stop-opacity': 0.55 }, g);
      el('stop', { offset: '100%', 'stop-color': c, 'stop-opacity': 0 }, g);
      return g;
    };
    this.skyStops = lg('ar-sky', [['0%', '#06030f'], ['55%', '#1f0d45'], ['100%', '#0b0822']]);
    this.nebulae = [rg('ar-neb0', '#6a2bd9'), rg('ar-neb1', '#1fb5c9'), rg('ar-neb2', '#c2309a')];
    lg('ar-top', [['0%', '#8d86b8'], ['100%', '#5b557f']]);
    lg('ar-face', [['0%', '#4a4468'], ['100%', '#221d38']]);
    lg('ar-rock', [['0%', '#2c2645'], ['100%', '#0d0a1a']]);
    lg('ar-pillar', [['0%', '#8a96ff'], ['35%', '#3d46b5'], ['100%', '#10123a']], 1, 1);
    lg('ar-tint', [['0%', '#ffffff'], ['100%', '#ffffff']]);

    this.far = el('g', { class: 'arena-far' }, svg);
    this.mid = el('g', { class: 'arena-mid' }, svg);
    this.near = el('g', { class: 'arena-near' }, svg);
    this._buildFar();
    this._buildMid();
    this._buildPlatform();
    this.tint = el('rect', { x: -400, y: -300, width: 2400, height: 1500, fill: '#ffffff', opacity: 0, class: 'arena-tint' }, svg);
    this.setTheme('void');
  }

  _buildFar() {
    el('rect', { x: -500, y: -400, width: 2600, height: 1700, fill: 'url(#ar-sky)' }, this.far);
    el('ellipse', { cx: 380, cy: 260, rx: 620, ry: 300, fill: 'url(#ar-neb0)' }, this.far);
    el('ellipse', { cx: 1250, cy: 180, rx: 520, ry: 240, fill: 'url(#ar-neb1)' }, this.far);
    el('ellipse', { cx: 900, cy: 520, rx: 760, ry: 260, fill: 'url(#ar-neb2)' }, this.far);
    const stars = el('g', {}, this.far);
    const n = quality.settings.stars;
    for (let i = 0; i < n; i++) {
      const r = sr(0.6, 2.2);
      el('circle', { cx: sr(-300, 1900), cy: sr(-200, 760), r, fill: '#fff', opacity: sr(0.3, 0.95), class: i % 7 === 0 ? 'twinkle' : '', style: `animation-delay:${sr(0, 3).toFixed(2)}s` }, stars);
    }
    // spectator pods in a wide arc
    this.pods = el('g', { class: 'pods' }, this.far);
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const x = 120 + t * 1360;
      const y = 120 + Math.pow(t * 2 - 1, 2) * 110;
      const g = el('g', { transform: `translate(${x},${y})`, class: 'pod', style: `animation-delay:${(i * 0.37).toFixed(2)}s` }, this.pods);
      el('path', { d: 'M-38,6 Q-38,-22 0,-24 Q38,-22 38,6 Q38,18 0,20 Q-38,18 -38,6Z', fill: '#221d44', stroke: '#4a3f8a', 'stroke-width': 2 }, g);
      el('path', { d: 'M-22,-2 Q0,-18 22,-2Z', fill: '#8fd3ff', opacity: 0.55 }, g);
      el('rect', { x: -4, y: 20, width: 8, height: 30, fill: '#1a1636' }, g);
      el('circle', { cx: 0, cy: 54, r: 4, fill: '#8fd3ff', opacity: 0.8 }, g);
    }
  }

  _buildMid() {
    const pillar = (x, w, top, broken) => {
      const tip = broken ? `L${x + w * 0.5},${top + 30} L${x + w * 0.15},${top + 6}` : `L${x + w / 2},${top - 50}`;
      el('path', { d: `M${x},950 L${x},${top} ${tip} L${x + w},${top + (broken ? 40 : 0)} L${x + w},950Z`, fill: 'url(#ar-pillar)', stroke: '#8fa0ff', 'stroke-width': 2, opacity: 0.92 }, this.mid);
      el('path', { d: `M${x + w * 0.3},940 L${x + w * 0.3},${top + 20}`, stroke: '#b9c3ff', 'stroke-width': 2, opacity: 0.4 }, this.mid);
    };
    pillar(-40, 70, 260, false);
    pillar(150, 54, 380, true);
    pillar(1395, 58, 330, true);
    pillar(1560, 74, 220, false);
    for (let i = 0; i < 7; i++) {
      const x = sr(80, 1520), y = sr(170, 520), s = sr(18, 52);
      const g = el('g', { class: 'bob', style: `animation-delay:${sr(0, 4).toFixed(2)}s;animation-duration:${sr(4, 7).toFixed(2)}s` }, this.mid);
      el('path', { d: `M${x - s},${y} L${x - s * 0.4},${y - s * 0.7} L${x + s * 0.6},${y - s * 0.6} L${x + s},${y + s * 0.1} L${x + s * 0.2},${y + s * 0.8} L${x - s * 0.7},${y + s * 0.5}Z`, fill: 'url(#ar-rock)', stroke: '#4d4475', 'stroke-width': 2 }, g);
    }
  }

  _buildPlatform() {
    const g = this.near;
    el('path', { d: 'M130,770 L300,835 L520,868 L800,905 L1080,868 L1300,835 L1470,770Z', fill: 'url(#ar-rock)', stroke: '#3c335e', 'stroke-width': 3 }, g);
    el('path', { d: 'M120,712 L1480,712 L1470,772 L130,772Z', fill: 'url(#ar-face)', stroke: '#1a1530', 'stroke-width': 3 }, g);
    const blocks = el('g', { stroke: '#2b2546', 'stroke-width': 2, opacity: 0.8 }, g);
    for (let x = 220; x < 1480; x += 140) el('path', { d: `M${x},714 L${x - 2},770` }, blocks);
    el('path', { d: 'M126,742 L1474,742' }, blocks);
    el('path', { d: 'M170,672 L1430,672 L1480,712 L120,712Z', fill: 'url(#ar-top)', stroke: '#2a2445', 'stroke-width': 3 }, g);
    const tiles = el('g', { stroke: '#4a4470', 'stroke-width': 1.6, opacity: 0.7 }, g);
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      el('path', { d: `M${170 + t * 1260},672 L${120 + t * 1360},712` }, tiles);
    }
    el('path', { d: 'M145,692 L1455,692' }, tiles);
    this.edge = el('path', { d: 'M120,712 L1480,712', stroke: '#5ff2ff', 'stroke-width': 3, opacity: 0.85, class: 'edge-glow' }, g);
    el('path', { d: 'M170,672 L1430,672', stroke: '#5ff2ff', 'stroke-width': 1.5, opacity: 0.35 }, g);
    for (const x of [STAGE.PLATFORM_L - 10, STAGE.PLATFORM_R + 10]) {
      el('rect', { x: x - 6, y: 640, width: 12, height: 72, rx: 3, fill: '#2a2550', stroke: '#5ff2ff', 'stroke-width': 1.5 }, g);
      el('circle', { cx: x, cy: 636, r: 7, fill: '#5ff2ff', class: 'twinkle' }, g);
    }
    const crackDs = [
      'M520,676 L545,688 L532,697 L560,708', 'M980,673 L1000,684 L986,694 L1012,710', 'M760,680 L742,692 L772,700 L750,711',
      'M1220,675 L1240,689 L1224,699 L1250,710', 'M330,678 L352,690 L338,699 L366,710', 'M640,674 L700,690 L680,700 L740,711 M700,690 L728,684',
    ];
    this.cracks = crackDs.map((d) => el('path', { d, stroke: '#0e0a1c', 'stroke-width': 3, fill: 'none', opacity: 0, 'stroke-linecap': 'round' }, g));
  }

  setTheme(name) {
    const th = THEMES[name] || THEMES.void;
    this.theme = name;
    th.sky.forEach((c, i) => this.skyStops[i].setAttribute('stop-color', c));
    th.nebula.forEach((c, i) => this.nebulae[i].querySelectorAll('stop').forEach((s) => s.setAttribute('stop-color', c)));
    this.pods.style.display = th.pods ? '' : 'none';
    this.edge.setAttribute('stroke', th.edge);
  }

  setDamage(k) {
    const shown = Math.round(k * this.cracks.length);
    this.cracks.forEach((c, i) => c.setAttribute('opacity', i < shown ? 0.85 : 0));
  }

  setTint(color, amount) {
    this.tint.setAttribute('fill', color);
    this.tint.setAttribute('opacity', amount.toFixed(3));
  }

  applyCamera(cam) {
    this.far.setAttribute('transform', `matrix(${cam.parallax(0.12).map((v) => v.toFixed(3)).join(',')})`);
    this.mid.setAttribute('transform', `matrix(${cam.parallax(0.45).map((v) => v.toFixed(3)).join(',')})`);
    this.near.setAttribute('transform', `matrix(${cam.matrix.map((v) => v.toFixed(3)).join(',')})`);
  }
}
