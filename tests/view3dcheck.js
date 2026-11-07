// Console helpers for checking the 3D view without a camera or a visible tab (the browser pane
// throttles animation frames while hidden, so these step the game by hand).
//   const t = await import('/tests/view3dcheck.js'); await t.setup(); t.fight('pride'); t.step(60);
import { quality } from '../js/core/quality.js';
import { CHAPTERS } from '../js/story/chapters.js';

const app = () => window.__lb;

export async function setup(preset = 'high') {
  for (let i = 0; i < 60 && !app()?.view3d; i++) await new Promise((r) => setTimeout(r, 100));
  quality.set(preset, false);
  quality.locked = true;
  app().screens.pause = () => {};
  return !!app().view3d;
}

/** Advance n frames at 60 fps; run=false freezes the fight but keeps rigs, effects and camera moving. */
export function step(n = 1, run = true, input = null) {
  const a = app();
  for (let i = 0; i < n; i++) {
    const c = a.combat;
    if (run && c && !c.paused) c.update(1 / 60, input || a.input.poll(performance.now()));
    c?.syncRigs(1 / 60);
    if (c && !a.cam.override) a.cam.follow(c.p1, c.p2);
    a.cam.update(1 / 60);
    a.fx.update(1 / 60);
  }
  a.view3d.render(a.combat, a.cam, a.fx, 1 / 60);
}

export function fight(id, extra = {}) {
  const a = app();
  const ch = { ...CHAPTERS.find((c) => c.id === id), ...extra };
  a.screens.hide();
  a.cutscene.active = false;
  a.startFight(ch);
  a.combat.state = 'fight';
  a.hud.clearBubbles?.();
  step(5, false);
  return a.combat;
}

/** Frame one fighter close up. */
export function close(f, zoom = 2.4, dy = 140) {
  const a = app();
  a.cam.hold(f.x + 30 * f.facing, f.y - dy, zoom);
  for (let i = 0; i < 90; i++) a.cam.update(1 / 60);
  step(1, false);
}

export function wide() { app().cam.hold(null); step(60, false); }
export const chapters = CHAPTERS;
