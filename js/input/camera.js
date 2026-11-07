import { CAMERA } from '../config.js';
import { device } from '../core/quality.js';

/** Webcam wrapper. Calls onFrame once per new video frame (requestVideoFrameCallback when available). */
export class CameraSource {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.status = 'off'; // off | requesting | live | denied | nocamera | unsupported | error
    this.error = null;
    this._running = false;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
  }

  get live() { return this.status === 'live'; }
  get aspect() { return (this.video.videoWidth || 4) / (this.video.videoHeight || 3); }

  async start() {
    if (this.live) return true;
    if (!navigator.mediaDevices?.getUserMedia) { this.status = 'unsupported'; return false; }
    const res = device.mobile ? CAMERA.MOBILE : CAMERA.DESKTOP;
    this.status = 'requesting';
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: res.width },
          height: { ideal: res.height },
          frameRate: { ideal: CAMERA.FPS, max: 60 },
        },
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      if (!this.video.videoWidth) {
        await new Promise((r) => this.video.addEventListener('loadedmetadata', r, { once: true }));
      }
      this.status = 'live';
      return true;
    } catch (err) {
      this.error = err;
      const name = err?.name || '';
      this.status = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
        : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nocamera' : 'error';
      console.warn('[camera]', this.status, err);
      return false;
    }
  }

  onFrame(cb) {
    if (this._running) return;
    this._running = true;
    const v = this.video;
    let errors = 0;
    const safe = (now, meta) => {
      try { cb(now, meta); } catch (err) { if (errors++ < 5) console.error('[camera] frame handler failed', err); }
    };
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      const loop = (now, meta) => {
        if (!this._running) return;
        safe(now, meta);
        v.requestVideoFrameCallback(loop);
      };
      v.requestVideoFrameCallback(loop);
    } else {
      let lastTime = -1;
      const loop = (now) => {
        if (!this._running) return;
        if (v.currentTime !== lastTime && v.readyState >= 2) { lastTime = v.currentTime; safe(now, null); }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  stop() {
    this._running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.status = 'off';
  }
}
