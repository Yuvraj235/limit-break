// Virtual webcam for end-to-end checks. It replaces getUserMedia with a canvas stream that shows
// photos of real hands (MediaPipe's own test images) acting out each gesture, so the whole live path
// (camera → MediaPipe → gestures → combat) can be tested without a person in front of the camera.
//
// In the browser console on the game page:
//   const vc = await (await import('/tests/virtualcam.js')).installVirtualCam(__lb);
//   vc.set('fists');   // none · fists · point · peace · palm · relaxed · palmsChest · raised · cupped

const BASE = 'https://storage.googleapis.com/mediapipe-assets/';
const W = 640, H = 480;

const load = (name) => new Promise((res, rej) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => res(img);
  img.onerror = () => rej(new Error(`could not load ${name}`));
  img.src = `${BASE}${name}.jpg`;
});

/** Crops a photo; with cutout, its near-white studio background becomes transparent so hands can overlap. */
function crop(img, [x, y, w, h], cutout = false) {
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * w);
  c.height = Math.round(img.naturalHeight * h);
  const g = c.getContext('2d');
  g.drawImage(img, -img.naturalWidth * x, -img.naturalHeight * y);
  if (cutout) {
    const px = g.getImageData(0, 0, c.width, c.height);
    const d = px.data;
    for (let i = 0; i < d.length; i += 4) {
      const lo = Math.min(d[i], d[i + 1], d[i + 2]);
      if (lo > 215) d[i + 3] = 0;
      else if (lo > 185) d[i + 3] = ((215 - lo) / 30) * 255;
    }
    g.putImageData(px, 0, 0);
  }
  return c;
}

/**
 * Draws a hand photo with its pivot at (x, y); h = height in frame heights. pivot = how far above the
 * photo's bottom edge the wrist sits (fraction of its height), so rotations turn about the wrist.
 */
function drawHand(ctx, img, { x, y, h, rot = 0, mirror = false, pivot = 0, sx = 1 }) {
  const ih = H * h;
  const iw = ih * (img.width / img.height) * sx; // sx > 1 fans the fingers wider apart
  ctx.save();
  ctx.translate(x * W, y * H);
  ctx.rotate((rot * Math.PI) / 180);
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(img, -iw / 2, -ih * (1 - pivot), iw, ih);
  ctx.restore();
}

export async function installVirtualCam(app) {
  const [fist, point, victory, hands] = await Promise.all(['fist', 'pointing_up', 'victory', 'right_hands'].map(load));
  const palm = crop(hands, [0.5, 0, 0.5, 1], true); // one upright, fanned-out open palm on a transparent background
  const pair = (img, y, h, gap, rot = 0, pivot = 0) => [[img, { x: 0.5 - gap / 2, y, h, rot: -rot, mirror: true, pivot }], [img, { x: 0.5 + gap / 2, y, h, rot, pivot }]];
  const SCENES = {
    none: [],
    fists: pair(fist, 0.88, 0.46, 0.48),
    point: [[point, { x: 0.55, y: 0.9, h: 0.58 }]],
    peace: [[victory, { x: 0.55, y: 0.9, h: 0.58 }]],
    palm: [[palm, { x: 0.56, y: 0.9, h: 0.5, sx: 1.4 }]], // fingers deliberately fanned out
    relaxed: [[palm, { x: 0.56, y: 0.9, h: 0.5, sx: 0.85 }]], // one open hand, fingers loose
    palmsChest: pair(palm, 0.9, 0.46, 0.52),
    raised: pair(palm, 0.5, 0.48, 0.52),
    // heels of the palms together, fingers fanned outward
    cupped: pair(palm, 0.8, 0.46, 0.1, 30, 0.2),
  };

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  let scene = 'none';
  const draw = () => {
    ctx.fillStyle = '#5e5148';
    ctx.fillRect(0, 0, W, H);
    for (const [img, o] of SCENES[scene]) drawHand(ctx, img, o);
  };
  draw();
  const timer = setInterval(draw, 33);
  const stream = canvas.captureStream(30);
  const real = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async () => stream;

  app.disableCamera();
  await app.enableCamera();

  /**
   * Deterministic run: steps virtual time frame by frame (camera at 30 fps, game at 60 Hz), so the
   * result doesn't depend on how fast the browser is drawing. script = [[scene, ms], ...];
   * onFrame(tMs) runs after every camera frame.
   */
  // Yield to the page between frames. A MessageChannel isn't throttled in background tabs, unlike setTimeout.
  const breathe = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = r; ch.port2.postMessage(0); });
  let clock = 0; // virtual time keeps running across play() calls; it must never go backwards
  async function play(script, onFrame) {
    const cam = app.cameraInput;
    cam.camera._running = false; // stop live frames so they don't interleave with ours
    let t = (clock = Math.max(clock, performance.now()));
    for (const [name, ms] of script) {
      scene = name;
      draw();
      for (let el = 0; el < ms; el += 1000 / 30) {
        t = clock += 1000 / 30;
        await cam.process(canvas, t, t);
        const input = app.input.poll(t);
        for (let k = 0; k < 2; k++) app.combat?.update(1 / 60, k === 0 ? input : { ...input, events: [] });
        onFrame?.(t);
        if (Math.round(el) % 330 < 34) await breathe();
      }
    }
  }

  return {
    canvas,
    play,
    scenes: Object.keys(SCENES),
    get scene() { return scene; },
    set(name) { if (!SCENES[name]) throw new Error(`unknown scene ${name}`); scene = name; draw(); },
    /** Ad-hoc two-hand scene: kind = fist | point | peace | palm. */
    pair(kind, { y = 0.9, h = 0.46, gap = 0.5, rot = 0, pivot = 0 } = {}) {
      SCENES.custom = pair({ fist, point, peace: victory, palm }[kind], y, h, gap, rot, pivot);
      scene = 'custom';
      draw();
    },
    uninstall() {
      clearInterval(timer);
      if (real) navigator.mediaDevices.getUserMedia = real;
      app.disableCamera();
    },
  };
}
