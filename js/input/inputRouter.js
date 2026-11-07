import { clamp } from '../core/math.js';
import { G } from './gestureDefs.js';

/**
 * Merges camera, touch and keyboard into one intent stream. Buttons and keys win over the camera
 * while held, so a player can mix them freely. Gameplay code only ever reads the router.
 */
export class InputRouter {
  constructor({ camera, keyboard, touch }) {
    this.camera = camera;
    this.keyboard = keyboard;
    this.touch = touch;
    this.state = { pose: G.IDLE, since: 0, intensity: 0, shake: 0, stillness: 0, push: 0, source: 'none', events: [] };
    this.frameAt = 0;
  }

  poll(now) {
    const cam = this.camera?.state;
    const camEvents = this.camera ? this.camera.drain() : [];
    const events = [...camEvents, ...this.keyboard.drain(), ...(this.touch ? this.touch.drain() : [])];

    let pose = G.IDLE, since = 0, intensity = 1, source = 'none';
    const kp = this.keyboard.pose();
    const tp = this.touch?.pose();
    if (kp) { pose = kp; since = this.keyboard.since(kp); source = 'keys'; }
    else if (tp) { pose = tp; since = this.touch.since(tp); source = 'touch'; }
    else if (cam && cam.pose !== G.IDLE) { pose = cam.pose; since = cam.since; intensity = cam.intensity; source = 'camera'; }

    const shake = cam ? cam.shake : 0;
    const mash = Math.max(this.keyboard.mashRate(now) / 8, this.touch ? this.touch.mashRate(now) / 7 : 0);
    const camPush = cam && cam.pose === G.POWER ? 0.35 + 0.65 * shake : 0;
    const heldPower = pose === G.POWER && source !== 'camera' ? 0.3 : 0;

    if (pose !== this.state.pose) since = since || now;
    this.state = {
      pose,
      since,
      intensity,
      shake: source === 'camera' ? shake : 0,
      stillness: cam ? cam.stillness : 0,
      push: clamp(Math.max(mash, camPush, heldPower)),
      source,
      events,
    };
    if (this.camera) this.frameAt = this.camera.debug.frameAt;
    return this.state;
  }
}
