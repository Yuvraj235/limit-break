// Fighter voices for attack callouts. With a Gemini key, each line is spoken by one of Gemini's
// text-to-speech voices: generated once in the background, then kept in this browser (IndexedDB) so it
// plays instantly from then on. Until a clip exists, or without a key, the browser's built-in speech
// voices say the line. Voices only ever go to Google's Gemini API, with the player's own key.
import { GEMINI } from '../config.js';
import { bus } from '../core/events.js';
import { storage } from '../core/storage.js';

/* Original callouts per fighter. Arrays pick a random line. */
const LINES = {
  goku: {
    kame_charge: 'Ka... me... ha... me...', kame_fire: 'HAAAAAAAA!', spirit_charge: 'Everyone, lend me your energy!', spirit_throw: 'Spirit Bomb!',
    punch: ['Hah!', 'Hyah!', 'Take that!'], kick: 'Hyaaaah!', teleport: 'Instant Transmission!', kiblast: 'Ha!',
    kaioken: 'Kaioken!', ssj: 'Raaaaah!', ssj2: 'HAAAAAAAH!', ssj3: 'AAAAAAAAAAH!', ssj4: 'Super Saiyan 4!', ssj_god: 'Super Saiyan God!', ssj_blue: 'Super Saiyan Blue!', blue_kaioken: 'Kaioken times ten!', ui_sign: 'My body is moving on its own...', ui: 'This is Ultra Instinct.',
    hurt: ['Ugh!', 'Gah!'],
  },
  vegeta: {
    kame_charge: 'Galick...', kame_fire: 'GUN!', kame_full: 'FINAL... FLASH!', spirit_charge: 'Witness the pride of a Saiyan!', spirit_throw: 'Big Bang Supernova!',
    punch: ['Hah!', 'Too slow!', 'Hmph!'], kick: 'Hyaaah!', teleport: 'Over here!', kiblast: 'Hah!',
    ascended: 'Feel my power!', ssj: 'Raaaaah!', ssj2: 'HAAAAAH!', ssj_god: 'The power of a god!', ssj_blue: 'Super Saiyan Blue!', blue_evolved: 'Blue Evolution!', ultra_ego: 'ULTRA EGO!',
    hurt: ['Tch!', 'Grr!'],
  },
  beerus: { kame_fire: 'Sphere of Destruction.', spirit_throw: 'Hakai.', punch: ['Hmph.'], hurt: ['Hm.'] },
  gogeta: {
    kame_charge: 'Big Bang...', kame_fire: 'KAMEHAMEHA!', kame_full: 'BIG BANG KAMEHAMEHA, TIMES ONE HUNDRED!', spirit_throw: 'Stardust Breaker!',
    punch: ['Hah!', 'Too easy.'], kick: 'Hyah!', teleport: 'Over here.', kiblast: 'Hah!', ultimate: 'Soul... PUNISHER!',
    ssj: 'Raaah!', ssj4: 'Super Saiyan 4!', ssj_blue: 'Super Saiyan Blue!', ui_ego: 'Ultra Instinct... and Ultra Ego. Together.', hurt: ['Tch!'],
  },
  vegito: {
    kame_charge: 'Final...', kame_fire: 'KAMEHAMEHA!', kame_full: 'FINAL KAMEHAMEHA!', spirit_throw: 'Spirit Excalibur!',
    punch: ['Spirit Sword!', 'Hah!'], kick: 'Hyaah!', teleport: 'Too slow.', kiblast: 'Hah!', ultimate: 'Spirit Sword!',
    ssj: 'Raaah!', ssj_blue: 'Vegito Blue!', ui_ego: 'Now you\'re in real trouble.', hurt: ['Heh.'],
  },
};

/* Gemini prebuilt voice and built-in speech settings per fighter. */
const CAST = {
  goku: { voice: 'Puck', pitch: 1.2, rate: 1.1, style: 'an energetic, cheerful young martial-arts hero shouting mid-battle' },
  vegeta: { voice: 'Fenrir', pitch: 0.8, rate: 1.05, style: 'a proud, fierce warrior prince shouting with intensity mid-battle' },
  beerus: { voice: 'Charon', pitch: 0.6, rate: 0.95, style: 'a calm, bored, menacing god speaking quietly' },
  gogeta: { voice: 'Orus', pitch: 0.95, rate: 1.05, style: 'a calm, overwhelmingly confident fused warrior with a doubled voice' },
  vegito: { voice: 'Fenrir', pitch: 1.0, rate: 1.1, style: 'a cocky, teasing fused warrior, cool and amused' },
};

const KEY_PREFIX = 'v1';

/* Tiny IndexedDB key-value store; every call fails soft (private mode, blocked storage). */
const idb = {
  db: null,
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((res, rej) => {
      const req = indexedDB.open('limit-break-voices', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('clips');
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    return this.db;
  },
  async get(k) {
    try {
      const db = await this.open();
      return await new Promise((res) => { const r = db.transaction('clips').objectStore('clips').get(k); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
    } catch { return null; }
  },
  async set(k, v) {
    try {
      const db = await this.open();
      await new Promise((res) => { const tx = db.transaction('clips', 'readwrite'); tx.objectStore('clips').put(v, k); tx.oncomplete = res; tx.onerror = res; });
    } catch { /* storage unavailable: the clip just isn't kept */ }
  },
};

export class Voices {
  constructor(app) {
    this.app = app;
    this.mode = storage.get('voiceMode2', 'off'); // off by default; auto (Gemini when keyed, else built-in) | builtin | off
    this.buffers = new Map();   // cache key → AudioBuffer
    this.queue = [];
    this.busy = false;
    this.ttsModel = null;
    this.ttsBroken = false;
    this.lastAt = new Map();
    this.speechVoice = null;
    if ('speechSynthesis' in window) {
      const pick = () => {
        const vs = speechSynthesis.getVoices().filter((v) => /^en(-|_|$)/i.test(v.lang));
        this.speechVoice = vs.find((v) => /premium|enhanced|natural|neural/i.test(v.name)) || vs.find((v) => v.localService) || vs[0] || null;
      };
      pick();
      speechSynthesis.addEventListener?.('voiceschanged', pick);
    }
    this._listen();
  }

  setMode(m) { this.mode = m; storage.set('voiceMode2', m); }
  get gemini() { return this.mode === 'auto' && this.app.dialogue.hasKey && !this.ttsBroken; }

  _listen() {
    const say = (f, event, opts) => this.say(f, event, opts);
    bus.on('combat:start', ({ combat }) => { for (const f of combat.fighters) this.prepare(f.def.id); });
    bus.on('combat:charge', ({ fighter, kind }) => { if (kind === 'kame') say(fighter, 'kame_charge'); else if (kind === 'spirit') say(fighter, 'spirit_charge'); });
    bus.on('combat:fire', ({ fighter, kind, power }) => {
      if (kind === 'kame') say(fighter, power >= 0.75 && LINES[fighter.def.id]?.kame_full ? 'kame_full' : 'kame_fire', { force: true });
      else if (kind === 'spirit') say(fighter, 'spirit_throw', { force: true });
      else if (kind === 'kiblast') say(fighter, 'kiblast', { gap: 1400 });
    });
    bus.on('combat:strike', ({ fighter, kind }) => say(fighter, kind, { gap: 450 }));
    bus.on('combat:dodge', ({ fighter, teleport }) => { if (teleport) say(fighter, 'teleport', { gap: 2500 }); });
    bus.on('combat:transform', ({ fighter, form }) => say(fighter, form, { force: true }));
    bus.on('combat:ultimate', ({ fighter }) => say(fighter, 'ultimate', { force: true }));
    bus.on('combat:hit', ({ target, heavy }) => { if (heavy) say(target, 'hurt', { gap: 1500 }); });
  }

  /** Speak a callout for a fighter (skips quietly if the fighter has no line for it). */
  say(fighter, event, { force = false, gap = 600 } = {}) {
    if (this.mode === 'off' || this.app.sfx.muted) return;
    const id = fighter?.def?.id;
    let text = LINES[id]?.[event];
    if (!text) return;
    if (Array.isArray(text)) text = text[Math.floor(Math.random() * text.length)];
    const now = performance.now();
    if (!force && now - (this.lastAt.get(id) || 0) < gap) return;
    this.lastAt.set(id, now);
    const buf = this.buffers.get(this._key(id, text));
    if (buf) this._play(buf);
    else this._speak(id, text);
  }

  /** Load cached Gemini clips for a fighter and queue the missing ones for generation. */
  async prepare(id) {
    if (!this.gemini || !LINES[id] || !CAST[id]) return;
    const texts = Object.values(LINES[id]).flat();
    for (const text of texts) {
      const key = this._key(id, text);
      if (this.buffers.has(key)) continue;
      const stored = await idb.get(key);
      if (stored) { this._decode(key, stored); continue; }
      if (!this.queue.some((q) => q.key === key)) this.queue.push({ key, id, text });
    }
    this._pump();
  }

  async _pump() {
    if (this.busy || !this.queue.length || !this.gemini) return;
    this.busy = true;
    while (this.queue.length && this.gemini) {
      const job = this.queue.shift();
      try {
        const pcm = await this._tts(job.id, job.text);
        if (pcm) { await idb.set(job.key, pcm); this._decode(job.key, pcm); }
      } catch (err) {
        if (err.status === 429) { this.queue.unshift(job); await new Promise((r) => setTimeout(r, 20000)); continue; }
        console.warn('[voice] Gemini speech failed, using built-in voices', err);
        this.ttsBroken = true;
      }
      await new Promise((r) => setTimeout(r, 1500)); // stay well under free-tier rate limits
    }
    this.busy = false;
  }

  /** One Gemini TTS call → base64 16-bit PCM at 24 kHz. Tries each configured model until one works. */
  async _tts(id, text) {
    const cast = CAST[id];
    const models = this.ttsModel ? [this.ttsModel] : GEMINI.TTS_MODELS;
    for (const model of models) {
      const res = await fetch(`${GEMINI.ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.app.dialogue.key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Say it like ${cast.style}: ${text}` }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cast.voice } } } },
        }),
      });
      if (res.status === 404 || res.status === 400) continue; // model not available here: try the next
      if (!res.ok) { const e = new Error(`Gemini TTS HTTP ${res.status}`); e.status = res.status; throw e; }
      const json = await res.json();
      const data = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
      if (!data) throw new Error('Gemini TTS returned no audio');
      this.ttsModel = model;
      return data;
    }
    throw new Error('no Gemini TTS model available');
  }

  _decode(key, b64) {
    const ctx = this.app.sfx.ctx;
    if (!ctx) { setTimeout(() => this._decode(key, b64), 1000); return; } // audio unlocks on first tap/key
    const bin = atob(b64);
    const n = bin.length >> 1;
    const buf = ctx.createBuffer(1, n, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      ch[i] = (v > 32767 ? v - 65536 : v) / 32768;
    }
    this.buffers.set(key, buf);
  }

  _play(buf) {
    const { ctx, master } = this.app.sfx;
    if (!ctx || !master) return;
    this._src?.stop?.();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = 1.4;
    src.connect(gain).connect(master);
    src.start();
    this._src = src;
  }

  _speak(id, text) {
    if (!('speechSynthesis' in window)) return;
    const cast = CAST[id] || { pitch: 1, rate: 1.05 };
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\.\.\./g, ','));
    if (this.speechVoice) u.voice = this.speechVoice;
    u.pitch = cast.pitch;
    u.rate = cast.rate;
    u.volume = 1;
    speechSynthesis.speak(u);
  }

  _key(id, text) { return `${KEY_PREFIX}|${CAST[id]?.voice}|${text}`; }
}
