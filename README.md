# Limit Break: Tournament of Power

A hand-gesture fighting game prototype that runs in the browser with no build step. Your webcam
and MediaPipe Hands drive Goku through an original Tournament-of-Power story: three rival
fighters, then Beerus, with a new transformation unlocking almost every chapter (Kaioken → Super
Saiyan → SSJ Blue → Ultra Instinct). Battle mode lets you play Goku, Vegeta, Gogeta or Vegito
against any opponent with every form unlocked. Gemini writes in-character lines live, and built-in
offline lines take over when there's no key or the network fails.

The fight is drawn in real 3D with Three.js: cel-shaded, ink-outlined fighters on a floating tiled
ring, flame-shell auras, layered beam cylinders, swirling energy spheres, shockwave rings, real
shadows and bloom. Settings → Graphics switches to the original 2D drawing (also used automatically
if the device has no WebGL).

Works on laptops (webcam, keyboard) and phones (front camera, on-screen buttons).

## Play online

**https://yuvraj235.github.io/limit-break/** (GitHub Pages, served straight from `main`; each push
updates it within a minute or two). Allow the camera when asked, or play with the on-screen
buttons and keyboard. A Gemini key pasted in Settings stays in that browser's local storage only.

## Run it

```bash
python3 tools/devserver.py
```

Then open http://localhost:8000. Any static server works; `tools/devserver.py` just turns off
caching so edits always reload. The camera needs a secure context, and `localhost` counts.

`tests/selftest.html` runs the gesture-classifier, combat and animation tests (open
http://localhost:8000/tests/selftest.html). `tests/realhands.html` runs the real hand model on
photos of real hands and shows how each one is classified. `tests/virtualcam.js` swaps the webcam
for a fake one that plays those photos as each gesture, to test the whole live path without a
person (see the comment at its top). `tests/rig.html?c=goku` shows every pose of a
character, and `?big=idle,powerup&form=ssj3` zooms in on chosen poses.

## Gemini key

- Put it in `GEMINI.API_KEY` in `js/config.js`, or
- leave that blank and paste it into the first-launch prompt or Settings. It stays in this
  browser's localStorage only.

The model is `GEMINI.MODEL` (`gemini-3.6-flash`). Each line falls back to the offline mock
(`js/dialogue/mock.js`) on a missing key, network error, non-2xx response, empty reply, timeout
(`GEMINI.TIMEOUT_MS`) or the client-side rate cap (`GEMINI.MAX_RPM`). A badge in the corner of
the fight says where lines are coming from.

A key used from a browser can be read by anyone who opens the page. That's fine for local play;
a public build needs a small server that proxies the Gemini call.

## Controls

Seven gestures, each scored from real-world hand geometry (checked against photos of real hands in
`tests/realhands.html`):

| Move | Hands (camera) | Keyboard | Touch |
|---|---|---|---|
| ✊ Power up / transform | Make a fist (two fists or shaking = faster). Hold at full ki to evolve | Hold P | Hold POWER |
| 👐 Ultimate Beam (Kamehameha · Galick Gun / Final Flash) | Cup both hands, wrists close; push forward (or drop the pose) to fire | Hold K, Space fires | Hold BEAM, release |
| 🙌 Spirit Bomb · Big Bang Supernova | BOTH open hands raised above your head (one hand never counts); lower to throw | Hold S | Hold BOMB, release |
| ✌️ Instant Transmission | Two-finger sign: vanish and reappear higher up, out of harm's way | T or ← / → | ◀✌ ✌▶ or swipe the stage |
| 👉 Ki blast barrage | Point one finger (homing shots) | Hold F | Hold BLAST |
| ✊ Punch | Jab a fist toward the camera (you blink in and strike; 3 in a row → heavy) | J | PUNCH |
| 🦵 Kick | Stand back so your legs show, then lift a knee or kick out (body tracking) | L | KICK |
| 🖐️ Energy Barrier | One open palm, fingers spread, facing the camera (any height). Absorbs ki blasts, −80% beam damage | Hold G | Hold BARRIER |
| 🥋 Neutral stance | Relaxed hands, or no hands | | |
| God form shortcut (once unlocked) | Keep powering up past Blue | U | UI / EGO / UI·EGO |
| 👉👈 Fusion, then its ultimate | Index fingertips touching. Again while fused = signature attack | X | FUSE, then ULT |
| Beam clash | Shake your fists | Mash Space or P | Tap fast |

Forms: Goku Base → Kaioken → SSJ → SSJ2 → SSJ3 → SSJ4 → Super Saiyan God → SSJ Blue → Blue Kaioken ×10 →
Ultra Instinct -Sign- → Mastered UI. Vegeta Base → Ascended → SSJ → SSJ2 → SSJ4 → Super Saiyan God → SSJ Blue →
Blue Evolved → Ultra Ego. Gogeta Base → SSJ → SSJ4 → SSJ Blue → Ultra Instinct Ego. Vegito Base →
SSJ → SSJ Blue → Ultra Instinct Ego.

**Fusion.** Point both index fingers at each other, tips touching (👉👈), press X, or tap FUSE. The
fused warrior keeps the transformation you had reached (Blue fuses into Blue), heals, refills ki,
regenerates ki the whole time, hits harder and takes less damage. Then the pair split with a
25-second cooldown.

| | Gogeta (Fusion Dance) | Vegito (Potara) |
|---|---|---|
| Lasts | 60 s | 90 s, but running out of ki in Blue or UI·Ego splits it early |
| Power / damage taken | ×1.42 / ×0.8 | ×1.32 / ×0.72 |
| Perk | Every ki blast fires from both hands | Punches and kicks are Spirit Sword slashes (+90 reach, +45% damage) |
| Beam | Big Bang Kamehameha (×100 when fully charged) | Final Kamehameha |
| Bomb | Stardust Breaker | Spirit Excalibur (a giant ki blade) |
| Ultimate (👉👈 again, X, ULT; 12 s cooldown) | Soul Punisher: unblockable, purges the foe's power surge | Spirit Sword Barrage: blink in, five unstoppable slashes |

**Ultra Instinct Ego** (fused warriors only): Ultra Instinct's auto-dodge and counters plus Ultra
Ego's battle lust (every hit taken adds power, up to +40%; Vegeta's Ultra Ego does this too).

In Battle mode pick which fusion Goku/Vegeta can perform, or play Gogeta or Vegito fused all fight.

**Enemies** power up at low health (Garrok's Iron Rage, Vessa's Storm Dance, Thorn-Ka's Crystal
Overdrive, Brakk's Berserk, Zeltra's Void Ascension, Zelbrakk's Calamity Form). New in Arc 2: Zeltra
the Void Empress, Brakk the Berserker, and their fusion Zelbrakk. Arc 3's final boss is Aurex, the
Fallen Angel (dodges like an angel, Erasure attacks, unseals his halo at low health).

Story (14 chapters). Arc 1: Training (Kaioken) · Garrok (SSJ) · Vessa (SSJ2) · Thorn-Ka (SSJ3) ·
Vegeta (SSJ4 and SSJ God) · Beerus's test (Blue; UI -Sign- awakens) · Beerus at full power (Blue
Kaioken; Mastered UI) · as Vegeta vs Beerus (Ultra Ego awakens) · finale: MUI vs Ultra Ego. Arc 2:
Zeltra · as Vegeta vs Brakk · Fusion: Gogeta vs Zelbrakk. Arc 3: The Potara: Vegito vs Beerus ·
Ultra Fusion: Gogeta vs Aurex (Ultra Instinct Ego awakens mid-fight).

Sound and voices are off by default; the 🔊 button and Settings → Voices turn them on.

Hand and body tracking run in a Web Worker (js/input/visionWorker.js), so drawing the fight never
delays reading your hands; a gesture change registers in about 66–130 ms.

Other keys: D debug overlay (FPS, inference time, frame-to-screen latency, live gesture scores,
per-hand fist/spread/height readings). On a phone, tap the camera preview for the same overlay.
M mute, Esc pause.

`!` over an enemy means you can block; `!!` means it's unblockable, so teleport.

**Calibrate your hands first** (title screen → "Calibrate your hands"). It records your own relaxed
hand, fist, point, ✌️, wide palm, and chest/raised hand heights in about 35 seconds, then checks the
shapes are distinct. Each hand is read by three opinions: finger geometry, Google's trained
MediaPipe Gesture Recognizer (fist, open palm, pointing, victory, thumbs) and your recorded
templates, which count most. A thumb sticking out never counts as a finger, and a hand resting at
the bottom of the frame is ignored.

**Voices.** Attack callouts are spoken. With a Gemini key they use Gemini text-to-speech voices
(each line is generated once in the background, then kept in the browser); otherwise the
computer's built-in voices speak them. Settings → Voices switches or mutes them.

**Look.** The 3D camera follows the same moves the 2D one did, with bigger swings: it orbits on beams,
bombs, transformations and finishers, shakes on hits and freezes for a beat on heavy ones. Strikes
lunge toward the camera, heavy hits get manga-style impact lines, and fighters turn three-quarters
toward you so you see their faces. Quality (Settings) sets resolution, shadows and bloom.

Body tracking (MediaPipe Pose, lite) runs next to hand tracking: it finds your shoulders, hips and
knees, so kicks work and "hands raised" is measured against your shoulders wherever you sit.

`http://localhost:8000/?check` runs a guided live gesture check and logs what the camera sees to the
dev server (`tools/devserver.py` prints the log path), handy for tuning thresholds to a real webcam.

If a gesture isn't recognised: make sure both hands fit in the camera preview (sit back), use
even lighting, and open the debug overlay to see what each hand reads.

Training (chapter 0) walks through every gesture and calibrates the "hands raised" line to your
own camera framing.

## Play on your phone

Phones only allow camera access over HTTPS. With the dev server running, a temporary tunnel
gives you an HTTPS link:

```bash
cloudflared tunnel --url http://localhost:8000
```

Open the `https://….trycloudflare.com` link it prints on your phone, prop the phone up so the
front camera sees both hands, and play. Stop the tunnel with Ctrl-C when you're done; the link
dies with it. The on-screen buttons work without the camera too.

## Code map

```
js/config.js          every tunable number: gesture thresholds, smoothing, timings, damage, FX, Gemini
js/input/             camera → MediaPipe → tracks (One-Euro filtered) → features → pose scores →
                      debounce state machine, plus motion gestures; keyboard and touch feed the same router
js/characters/        skeleton rig (the animation brain for both views) + character definitions
js/render3d/          Three.js view: arena, cel-shaded fighters posed from the rig, 3D effects, camera
js/combat/            fighters, moves, hit resolution, ring-outs, AI profiles, beam struggles
js/fx/                pooled particles, auras, beams, spheres, lightning, shockwaves
js/arena/             Tournament-of-Power stage and the 2D camera (shake, zoom, hit-stop)
js/story/             chapter script, cutscene player, director (triggers, tutorial, saves)
js/dialogue/          Gemini client, offline mock lines, personas, event → line mapping
js/audio/sfx.js       synthesized sound effects (WebAudio, no files)
js/ui/                HUD and menus
```

Adding a fighter: write a definition next to `js/characters/rivals.js` (proportions, palette,
part builders, poses), register it in `js/characters/index.js`, give it an AI profile in
`js/combat/ai.js` and a persona in `js/dialogue/personas.js`, then reference it from a chapter
in `js/story/chapters.js`.

## Licensing

This is a fan-made prototype. Goku, Beerus and the Tournament of Power belong to Bird Studio,
Shueisha and Toei Animation. The art, story and dialogue here are original, but releasing this
commercially needs a license from the rights holders. Garrok, Vessa and Thorn-Ka are original
characters.
