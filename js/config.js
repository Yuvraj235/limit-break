/* ============================================================================
 * LIMIT BREAK — Tournament of Power (gesture fighting prototype)
 * config.js — every tunable number lives here. Logic files never hard-code
 * thresholds or timings; tune here without touching gameplay code.
 *
 * ── GEMINI API KEY ──────────────────────────────────────────────────────────
 *   Option A: paste your key into GEMINI.API_KEY below.
 *   Option B: leave it blank. On first launch the game asks for a key and keeps
 *             it only in this browser (localStorage "lb.geminiKey"). Change or
 *             clear it any time under Settings.
 *
 * ── MOCK FALLBACK ───────────────────────────────────────────────────────────
 *   With no key, the dialogue layer uses js/dialogue/mock.js (varied, original
 *   in-character lines). It also falls back per line whenever a Gemini call
 *   fails: network error, non-2xx response, empty reply, a timeout after
 *   GEMINI.TIMEOUT_MS, or the client-side rate cap GEMINI.MAX_RPM. The game is
 *   fully playable offline.
 *
 * ── SECURITY ────────────────────────────────────────────────────────────────
 *   A key used from the browser is visible to anyone who opens the page. That is
 *   fine for local prototyping; a public build must proxy Gemini via a server.
 * ========================================================================== */

export const GEMINI = {
  API_KEY: '',
  MODEL: 'gemini-3.6-flash',
  ENDPOINT: 'https://generativelanguage.googleapis.com/v1beta/models',
  // Text-to-speech models for fighter voices, tried in order until one answers (audio/voice.js).
  TTS_MODELS: ['gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-tts'],
  THINKING_LEVEL: 'low',        // dropped automatically if the model rejects it
  TIMEOUT_MS: 2500,
  MAX_RPM: 12,                  // client-side cap; extra requests use the mock
  MAX_OUTPUT_TOKENS: 256,
  TEMPERATURE: 1.0,
  STORAGE_KEY: 'geminiKey',
};

export const MEDIAPIPE = {
  MODULE: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs', // same build as the import map
  WORKER: true,              // run the models in a Web Worker (falls back to the main thread if unsupported)
  MODULE_FALLBACK: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
  WASM: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
  WASM_FALLBACK: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
  MODEL_URL: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  // Google's trained gesture classifier (same hand landmarks plus Closed_Fist / Open_Palm / Pointing_Up /
  // Victory / Thumb_Up / Thumb_Down / ILoveYou). Used first; the plain landmarker is the fallback.
  GESTURE_MODEL_URL: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
  // Body tracking (shoulders, hips, knees) for kicks and for judging "hands raised" against the body.
  POSE_MODEL_URL: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  POSE_EVERY: 2,             // run the body model every Nth camera frame (it is only needed for slower moves)
  POSE_MIN_VISIBILITY: 0.5,
  // Framing guide from the body tracker (shoulder width and height, in frame heights):
  FRAME_TOO_CLOSE_SW: 0.52,  // shoulders wider than this, or…
  FRAME_TOO_CLOSE_Y: 0.84,   // …shoulders this low in the picture = sit back
  FRAME_TOO_FAR_SW: 0.12,
  NUM_HANDS: 2,
  MIN_DETECT_CONF: 0.6,
  MIN_PRESENCE_CONF: 0.5,
  MIN_TRACK_CONF: 0.5,
};

export const CAMERA = {
  DESKTOP: { width: 640, height: 480 },
  MOBILE: { width: 480, height: 360 },
  FPS: 60,                   // ask for 60 fps; most webcams give 30, faster ones halve the frame delay
};

/* Logical stage: SVG and effects canvas share this coordinate space. */
export const STAGE = {
  W: 1600,
  H: 900,
  GROUND_Y: 700,
  PLATFORM_L: 140,
  PLATFORM_R: 1460,
  P1_HOME: 520,
  P2_HOME: 1080,
  MIN_GAP: 150,              // fighters never overlap closer than this
};

/* Hand geometry is measured in "hand units" (wrist → middle-finger knuckle). */
export const GESTURE = {
  CURL_OPEN_RATIO: 1.20,     // wrist→tip / wrist→pip at or above this = straight finger (real photos: 1.29–1.43)
  CURL_CLOSED_RATIO: 0.85,   // at or below this = fully curled (real fists: 0.59–0.75)
  FIST_MIN: 0.62,            // mean curl for a fist
  OPEN_MAX: 0.42,            // mean curl below this = open hand
  KAME_WRIST_MAX: 1.6,       // wrists closer than this start to count as "together" (cupped hands)
  KAME_WRIST_FULL: 1.1,      // real webcam: cupped hands measure 0.4–0.7
  RAISE_Y: 0.39,             // palm centre above this (0 = top of frame) = raised; calibration overrides.
  RAISE_SOFT: 0.05,          // real laptop webcam: hands at chest ≈ 0.44–0.55, raised ≈ 0.29–0.33
  POINT_INDEX_MAX: 0.32,     // index curl below this…
  POINT_OTHERS_MIN: 0.58,    // …while middle/ring/pinky curl above this = pointing
  SPREAD_MIN: 1.1,           // index↔pinky tip distance (hand units) where a palm starts to count as "wide"
  SPREAD_FULL: 1.25,         // real webcam: relaxed open hand 0.95–1.15, fanned palm 1.3–1.6, fist ~0.7
  // With body tracking, "raised" is measured against the shoulders instead of the frame:
  // With body tracking, "raised" is measured from the eyes, in shoulder-widths, wherever the player sits:
  RAISE_BODY_MIN: 0.1,       // palm a little above eye level starts to count…
  RAISE_BODY_FULL: 0.38,     // …and above the head counts fully (hands in front of the face don't)
};

export const SMOOTHING = {
  ONE_EURO_MIN_CUTOFF: 3.0,  // light smoothing even when still, so finger changes show up within a frame or two…
  ONE_EURO_BETA: 20.0,       // …and almost none while moving
  ONE_EURO_D_CUTOFF: 1.0,
  EMA_ALPHA: 0.62,           // per-frame score rise (1–2 frames to cross ENTER, ~50 ms)
  EMA_FALL: 0.34,            // slower fall so a dropped frame or two never ends a pose
  ENTER: 0.62,
  EXIT: 0.35,
  MARGIN: 0.35,              // a challenger must lead the current pose by this much (a real change leads by ~0.8)
  MIN_DWELL_MS: 200,         // between two different moves (stops flicker); entering a move from neutral is immediate
  REST_WRIST_Y: 0.92,        // a hand whose wrist is this low in the frame (dropped / resting) is ignored
};

export const MOTION = {
  TRACK_MIN_AGE_MS: 160,     // ignore motion of freshly appeared hands
  LOST_GRACE_MS: 220,        // keep a hand that vanished for this long (MediaPipe drops overlapping hands)
  DODGE_SPEED: 1.15,         // frame widths per second, sideways
  DODGE_WINDOW_MS: 140,
  DODGE_COOLDOWN_MS: 650,
  PUSH_SCALE: 0.13,          // hands grow 13% in frame → forward push
  PUSH_WINDOW_MS: 260,
  PUSH_COOLDOWN_MS: 600,
  SHAKE_WINDOW_MS: 450,
  SHAKE_LOW: 1.6,            // hand units per second
  SHAKE_HIGH: 7.0,
  STILL_EPS: 0.55,           // hand units per second
  UI_FOCUS_MS: 1100,
  PUNCH_GROWTH: 0.22,        // a fist that grows 22% in the frame (moves toward the camera)…
  PUNCH_MIN_AGE_MS: 350,     // …once it has been fully in view this long (a fist sliding into frame "grows" too)
  PUNCH_SPEED: 1.0,          // …or moves this fast (frame widths/s) is a punch
  PUNCH_WINDOW_MS: 200,
  PUNCH_COOLDOWN_MS: 260,
  KICK_KNEE_LIFT: 0.5,       // knee raised to within this many shoulder-widths below the hip (standing ≈ 1.0–1.2)
  KICK_REACH: 1.1,           // or ankle swung out sideways this many shoulder-widths from the hip
  KICK_STANCE_MS: 2500,      // a leg must have been seen standing this recently (stops a seated pose firing kicks)
  KICK_COOLDOWN_MS: 650,
  MERGE_DIST: 1.8,           // two wrists this close (hand units) may overlap and hide one hand…
  MERGE_HOLD_MS: 1000,       // …so the hidden one is kept this long while the other stays put (resets each time it reappears)
};

export const TIMING = {
  POSE_STIFFNESS: 15,
  POSE_FAST: 26,
  POSE_SLOW: 8,
  KAME_CHARGE_MS: 1800,
  KAME_MIN_CHARGE: 0.25,
  SPIRIT_CHARGE_MS: 4200,
  SPIRIT_MIN_CHARGE: 0.3,
  BEAM_SPEED: 2800,
  BEAM_HOLD_MS: 650,
  BEAM_FADE_MS: 380,
  SPIRIT_FLIGHT_MS: 1150,
  KIBLAST_REPEAT_MS: 360,
  KIBLAST_SPEED: 1500,
  TRANSFORM_HOLD_MS: 1100,
  TRANSFORM_MS: 900,
  DODGE_MS: 240,
  DODGE_IFRAMES_MS: 380,
  DODGE_DIST: 170,
  DODGE_COOLDOWN_MS: 520,
  HIT_STUN_MS: 380,
  BLOCK_STUN_MS: 150,
  KNOCKDOWN_MS: 900,
  ROUND_TIME_S: 150,
  INTRO_BANNER_MS: 1500,
  KO_SLOWMO_MS: 1200,
  RESULT_DELAY_MS: 1900,
  HITSTOP_LIGHT_MS: 35,
  HITSTOP_HEAVY_MS: 110,
  RINGOUT_FALL_MS: 1300,
  AUTO_ADVANCE_MS: 6500,
  TYPE_CPS: 55,              // cutscene typewriter characters per second
};

export const COMBAT = {
  HP: 1000,
  KI_MAX: 100,
  KI_REGEN_IDLE: 3,
  KI_GAIN_POWER: 28,
  KI_TWO_FISTS: 1.5,
  KI_SHAKE_BONUS: 1.0,
  KIBLAST: { cost: 4, dmg: 22, kb: 30, radius: 14 },
  KAME: { costBase: 12, costCharge: 28, dmgBase: 50, dmgCharge: 170, kbBase: 60, kbCharge: 200, widthBase: 26, widthCharge: 60 },
  SPIRIT: { dmgBase: 160, dmgCharge: 340, kbBase: 160, kbCharge: 260, radiusBase: 40, radiusCharge: 150 },
  GUARD_REDUCTION: 0.75,      // Energy Barrier vs punches and rushes
  BARRIER_BEAM_REDUCTION: 0.8, // vs beams and spheres; ki blasts are absorbed completely
  HOVER: 44,                   // fighters float this high above the ring (airborne stance)
  TELEPORT_DIST: 240,          // Instant Transmission sideways jump
  PUNCH: { dmg: 24, kb: 28, reach: 150, cooldown: 0.24 },
  KICK: { dmg: 40, kb: 110, reach: 165, cooldown: 0.5 },   // knocks down only as a combo finisher (after 3 hits)
  MELEE_DASH_MS: 140,          // a melee move from range dashes in first
  FUSION_S: 60,                // default fusion length; each fusion sets its own in characters/fusion.js
  FUSION_COOLDOWN_S: 25,       // …then the two need this long before fusing again
  FUSION_POWER: 1.35,
  ULTIMATE_COOLDOWN_S: 12,     // a fused warrior's signature attack (👉👈 again while fused, X, or ULT)
  SOUL_PUNISHER: { dmg: 200, kb: 280, radius: 64, flightMs: 700 },   // Gogeta: unblockable, purges the foe's power surge
  SWORD_BARRAGE: { hits: 5, gap: 0.14, dmg: 30, finisher: 84, kb: 300 }, // Vegito: blink in, five Spirit Sword slashes
  SPIRIT_SWORD: { reach: 90, dmg: 1.45 },   // Vegito's punches and kicks become ki-blade slashes
  EGO_RAGE: { perHit: 0.04, max: 0.4 },     // Ultra Ego forms: each hit taken adds power, up to +40%
  UI_EGO_DODGE: 0.8,                         // Ultra Instinct Ego: auto-dodge chance (and it counters)
  TELEPORT_ALT: [110, 210],    // …and the altitude it reappears at before settling back
  HOMING: 5,                   // how hard player ki blasts steer toward the target
  GUARD_KI_DRAIN: 4,
  GUARD_KB_MULT: 0.35,
  FRICTION: 5.5,
  RECOVER_SPEED: 140,
  UI_SIGN_DODGE: 0.7,
  UI_DODGE: 1.0,
  UI_COUNTER_DMG: 90,
  UI_MIN_KI: 30,
  STRUGGLE_RATE: 0.38,
  STRUGGLE_MAX_MS: 7000,
  STRUGGLE_WIN_MULT: 1.6,
};

/* Form gameplay numbers. Each character's ladder and visuals live in characters/*.js. */
export const FORMS = {
  base:         { name: 'Base',                      short: 'BASE',    mult: 1.0,  drain: 0 },
  kaioken:      { name: 'Kaioken',                   short: 'KAIOKEN', mult: 1.12, drain: 0.9 },
  ascended:     { name: 'Ascended Saiyan',           short: 'ASCEND',  mult: 1.12, drain: 0.9 },
  ssj:          { name: 'Super Saiyan',              short: 'SSJ',     mult: 1.25, drain: 1.0 },
  ssj2:         { name: 'Super Saiyan 2',            short: 'SSJ2',    mult: 1.38, drain: 1.5 },
  ssj3:         { name: 'Super Saiyan 3',            short: 'SSJ3',    mult: 1.5,  drain: 3.2 },  // strong but burns ki fast
  ssj4:         { name: 'Super Saiyan 4',            short: 'SSJ4',    mult: 1.56, drain: 2.0 },  // primal: red aura, wild black hair
  ssj_god:      { name: 'Super Saiyan God',          short: 'GOD',     mult: 1.6,  drain: 1.6 },  // calmer and cheaper than SSJ3
  ssj_blue:     { name: 'Super Saiyan Blue',         short: 'BLUE',    mult: 1.68, drain: 2.2 },
  blue_kaioken: { name: 'Blue Kaioken ×10',          short: 'BLUE×10', mult: 1.85, drain: 4.6 },  // huge power, drains fast
  blue_evolved: { name: 'Super Saiyan Blue Evolved', short: 'EVOLVED', mult: 1.75, drain: 2.8 },
  ui_sign:      { name: 'Ultra Instinct -Sign-',     short: 'UI',      mult: 1.6,  drain: 3.5 },
  ui:           { name: 'Mastered Ultra Instinct',   short: 'MUI',     mult: 1.95, drain: 2.5 },
  ultra_ego:    { name: 'Ultra Ego',                 short: 'EGO',     mult: 1.9,  drain: 2.6, defense: 1.3 },
  ui_ego:       { name: 'Ultra Instinct Ego',        short: 'UI·EGO',  mult: 2.15, drain: 2.3, defense: 1.3 },  // fused warriors only: UI's dodges + Ego's battle lust
};
/* Default ladder (Goku). The god-tier forms at the end unlock through the story, not by tier. */
export const FORM_LADDER = ['base', 'kaioken', 'ssj', 'ssj2', 'ssj3', 'ssj4', 'ssj_god', 'ssj_blue', 'blue_kaioken'];
export const GOD_FORMS = ['ui_sign', 'ui'];

export const QUALITY = {
  high:   { particles: 2400, dpr: 2,   lightning: true,  afterimages: 3, auraDensity: 1.0,  stars: 170 },
  medium: { particles: 1300, dpr: 1.5, lightning: true,  afterimages: 2, auraDensity: 0.65, stars: 110 },
  low:    { particles: 600,  dpr: 1,   lightning: false, afterimages: 1, auraDensity: 0.4,  stars: 60 },
  MIN_FPS: 42,
  DOWNGRADE_AFTER_MS: 2500,
};

export const DIALOGUE = {
  BUBBLE_MS: 2900,
  GLOBAL_GAP_MS: 1100,
  SPEAKER_COOLDOWN_MS: 3200,
  MAX_STALE_MS: 3600,
  MAX_WORDS: 16,
  HISTORY: 3,
};

export const AUDIO = { MASTER: 0.7 };

export const STORAGE_PREFIX = 'lb.';
