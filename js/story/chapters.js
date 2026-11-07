// Story mode. Original script; chapters are pure data so new arcs and fighters slot in here.
const L = (s, t) => ({ s, t });

export const CHAPTERS = [
  {
    id: 'training', num: 0, title: 'Training Grounds', subtitle: 'Wake up your ki', theme: 'training',
    opponent: 'shadow', ai: 'shadow', tier: 1, timeLimit: 0, p2PlotArmor: true, plotArmor: true, tutorial: true,
    intro: [
      L('narrator', 'A quiet mountain clearing at dusk. Goku trains alone, except for his own shadow.'),
      L('goku', 'Okay, Shadow! Let\'s run through everything, one move at a time!'),
      L('shadow', 'Show me your hands. I will follow.'),
    ],
    outro: [
      L('goku', 'Whew! My body remembers every move now.'),
      L('narrator', 'Far above the clouds, a pair of golden eyes opens from a very long nap.'),
      L('beerus', 'Goku. Pack light. You\'re coming to a tournament.'),
    ],
  },
  {
    id: 'summons', num: 1, title: 'The Summons', subtitle: 'vs Garrok, the Iron Bull', theme: 'void',
    opponent: 'garrok', ai: 'garrok', tier: 2,
    tip: 'Garrok telegraphs with ! (block it: 🖐️ open palm barrier) and !! (unblockable: ✌️ Instant Transmission away).',
    intro: [
      L('narrator', 'The Void Between Universes. A ring of stone floats in endless starlight.'),
      L('beerus', 'Twelve universes, one ring. Lose, and I will be very cross with you.'),
      L('goku', 'Fighters from other universes? That\'s the best news I\'ve heard all year!'),
      L('arbiter', 'From Universe 4, the Iron Bull: Garrok!'),
      L('garrok', 'Iron doesn\'t bend, gold-hair. Neither do I.'),
    ],
    outro: [
      L('garrok', 'Hrrk... you hit... harder than iron.'),
      L('goku', 'You too! My arms are still buzzing!'),
      L('beerus', 'Acceptable. Barely. Don\'t get comfortable.'),
    ],
  },
  {
    id: 'afterimages', num: 2, title: 'Afterimages', subtitle: 'vs Vessa, the Gale', theme: 'void',
    opponent: 'vessa', ai: 'vessa', tier: 3, // SSJ2
    tip: 'Vessa blinks in close. Flash ✌️ to Instant Transmission out of reach.',
    intro: [
      L('narrator', 'Round two. The ring is quiet now. Too quiet.'),
      L('vessa', 'You\'re the one who beat the Bull? He was slow. I am not.'),
      L('goku', 'Fast, huh? Then I\'d better keep my eyes open!'),
      L('arbiter', 'From Universe 9, the Gale: Vessa!'),
    ],
    outro: [
      L('vessa', '...You kept up. Nobody keeps up.'),
      L('goku', 'You were so fast I could barely see you! Teach me that step sometime!'),
      L('beerus', 'He\'s grinning again. Why is he always grinning?'),
    ],
  },
  {
    id: 'colossus', num: 3, title: 'The Colossus', subtitle: 'vs Thorn-Ka', theme: 'void',
    opponent: 'thornka', ai: 'thornka', tier: 4, // SSJ3
    tip: 'Answer Thorn-Ka\'s beam with your own 👐 beam for a clash, then shake your fists (or mash Space / tap) to push!',
    intro: [
      L('narrator', 'The ring shudders. Something enormous steps onto the stone.'),
      L('thornka', 'I have watched stars form and fade, small one. You are a spark.'),
      L('goku', 'Sparks start fires, big guy. Show me what you\'ve got!'),
      L('arbiter', 'From Universe 2, the Colossus: Thorn-Ka!'),
    ],
    outro: [
      L('thornka', 'Patience... was not enough. Remarkable.'),
      L('goku', 'Phew. That was like punching a mountain.'),
      L('beerus', 'Enough appetizers. I\'ll test you myself.'),
      L('beerus', 'Don\'t make me regret skipping dessert.'),
    ],
  },
  {
    id: 'pride', num: 4, title: 'Pride of the Prince', subtitle: 'vs Vegeta', theme: 'void',
    opponent: 'vegeta', ai: 'saiyan', p2Form: 'ssj2', tier: 6, // unlocks Super Saiyan 4 and Super Saiyan God
    tip: 'Vegeta matches you beam for beam. Push past SSJ3 into Super Saiyan 4, then Super Saiyan God: hold ✊ at full ki.',
    intro: [
      L('narrator', 'Between rounds, a second Saiyan lands on the ring. Arms crossed. Of course.'),
      L('vegeta', 'Kakarot. Did you really think this tournament was yours alone?'),
      L('goku', 'Vegeta! I was hoping you\'d show up!'),
      L('beerus', 'Two Saiyans in one ring. Try not to break it before the real matches.'),
      L('narrator', 'Goku closes his eyes. A warm, red ki he has felt only once before stirs inside him.'),
      L('narrator', 'SUPER SAIYAN 4 and SUPER SAIYAN GOD unlocked. Climb past Super Saiyan 3 to reach them.'),
    ],
    outro: [
      L('vegeta', 'Tch. Don\'t get used to winning. I\'m only getting started.'),
      L('goku', 'That was great! Same time tomorrow?'),
      L('beerus', 'Enough. You\'ve warmed up. Now you face me.'),
    ],
  },
  {
    id: 'beyond', num: 5, title: 'Beyond the Limit', subtitle: 'vs Beerus: the test', theme: 'void',
    opponent: 'beerus', ai: 'beerus1', tier: 7, plotArmor: true, timeLimit: 0, winAtFoeHp: 0.5, p2IdlePose: 'idle',
    tip: 'Beerus is barely trying. Survive... something inside you is waking up.',
    intro: [
      L('narrator', 'The God of Destruction steps into the ring. The spectator pods fall silent.'),
      L('beerus', 'Hands behind my back, Goku. Make me use them.'),
      L('goku', 'With pleasure, Lord Beerus!'),
    ],
    triggers: [
      {
        id: 'uiSign', when: { p1HpBelow: 0.25 }, effect: 'uiSign',
        cutscene: [
          L('narrator', 'Goku hits the stone. For a moment, everything goes quiet.'),
          L('goku', 'My body\'s... too heavy... no. It\'s light.'),
          L('beerus', 'His ki just vanished? No... it\'s everywhere at once.'),
          L('narrator', 'Silver light fills his eyes. His body moves before his mind can.'),
          L('goku', 'I can see it. All of it.'),
          L('narrator', 'ULTRA INSTINCT -SIGN- unlocked. It is now the top of your power-up chain: keep powering up past Blue (or press U / tap UI).'),
        ],
      },
    ],
    outro: [
      L('beerus', 'Ha... HA! You actually landed a real hit on me.'),
      L('beerus', 'Fine. No more hands behind my back.'),
      L('goku', 'Wait, you were holding back THAT much?'),
    ],
  },
  {
    id: 'destruction', num: 6, title: 'The God of Destruction', subtitle: 'vs Beerus: full power', theme: 'final',
    opponent: 'beerus', ai: 'beerus2', tier: 8, uiUnlocked: true, p2IdlePose: 'idle_serious', foeSerious: true,
    tip: 'Purple runes mean HAKAI: ✌️ Instant Transmission out before it lands! Counter his Sphere of Destruction with a 👐 beam.',
    intro: [
      L('narrator', 'The final match. The ring cracks under the weight of a god\'s true power.'),
      L('beerus', 'This is the real me, Saiyan. Try not to vanish.'),
      L('goku', 'I\'ve been waiting for this my whole life!'),
    ],
    triggers: [
      {
        id: 'mui', when: { p2HpBelow: 0.5 }, effect: 'mui',
        cutscene: [
          L('narrator', 'The silver in Goku\'s eyes spreads to his hair.'),
          L('beerus', 'Silver hair... so you\'ve finally completed the technique.'),
          L('goku', 'I\'m not thinking anymore. I\'m just... here.'),
          L('narrator', 'MASTERED ULTRA INSTINCT. Every attack is dodged, and answered.'),
        ],
      },
    ],
    outro: [
      L('beerus', '...Enough. I yield. Tell no one.'),
      L('goku', 'That was the most fun I\'ve ever had! Again tomorrow?'),
      L('beerus', 'Tomorrow, you\'re buying dinner.'),
      L('narrator', 'But somewhere, a prince is already training harder.'),
    ],
  },
  {
    id: 'ego', num: 7, title: 'The Prince\'s Pride', subtitle: 'as Vegeta vs Beerus', theme: 'final',
    player: 'vegeta', opponent: 'beerus', ai: 'beerus1', tier: 7, plotArmor: true, timeLimit: 0, winAtFoeHp: 0.5, p2IdlePose: 'idle',
    tip: 'You are Vegeta. Beerus is holding back, and that is the insult. Survive, and your pride will answer.',
    intro: [
      L('narrator', 'Later. The ring is empty except for a prince and a god.'),
      L('vegeta', 'Lord Beerus. Teach me what you didn\'t teach Kakarot.'),
      L('beerus', 'You want the power of destruction? Then stop protecting yourself.'),
    ],
    triggers: [
      {
        id: 'ego', when: { p1HpBelow: 0.3 }, effect: 'ego',
        cutscene: [
          L('narrator', 'Vegeta stops guarding. Every blow lands, and every blow makes him stronger.'),
          L('vegeta', 'I don\'t need calm. I don\'t need instinct. I am the Prince of all Saiyans!'),
          L('beerus', 'Purple ki... the ego of a destroyer. Interesting.'),
          L('narrator', 'ULTRA EGO unlocked. Vegeta\'s god form: keep powering up past Blue Evolved (or press U / tap EGO).'),
        ],
      },
    ],
    outro: [
      L('beerus', 'Hmph. Not bad, Prince. Don\'t let it go to your head.'),
      L('vegeta', 'Too late. Kakarot, I\'m coming for you.'),
    ],
  },
  {
    id: 'finale', num: 8, title: 'Limit Breakers', subtitle: 'Mastered UI vs Ultra Ego', theme: 'final',
    opponent: 'vegeta', ai: 'saiyan_final', p2Form: 'ultra_ego', tier: 8, uiUnlocked: true, muiUnlocked: true, foeSerious: true,
    tip: 'The final rivalry. Climb all the way to Mastered Ultra Instinct (or press U / tap UI) and finish it.',
    intro: [
      L('narrator', 'The tournament is over. Two Saiyans stay behind on the cracked ring.'),
      L('vegeta', 'No gods. No rules. Just you and me, Kakarot.'),
      L('goku', 'Heh. I\'ve been looking forward to this more than anything.'),
      L('beerus', 'Somebody bring snacks. This one could take a while.'),
    ],
    outro: [
      L('vegeta', '...Again. Tomorrow. I won\'t lose twice.'),
      L('goku', 'You bet! Hey, wanna get something to eat first?'),
      L('narrator', 'Two rivals, still climbing. THE END, until the next limit breaks.'),
    ],
  },
  {
    id: 'void', num: 9, title: 'The Void Empress', subtitle: 'Arc 2 · vs Zeltra', theme: 'final',
    opponent: 'zeltra', ai: 'zeltra', tier: 8, uiUnlocked: true, muiUnlocked: true,
    tip: 'Zeltra fights from range and bends space. Close in with ✊ punches, block her volleys, and watch for her VOID ASCENSION.',
    intro: [
      L('narrator', 'Weeks later. The sky over the ring tears open like cloth.'),
      L('zeltra', 'Your little tournament woke something old, Saiyan. I am what answers.'),
      L('goku', 'Whoa... I can\'t even sense your ki. That\'s amazing!'),
      L('zeltra', 'You will feel it soon enough.'),
    ],
    outro: [
      L('zeltra', 'Strong... but you are only one. My partner is not so polite.'),
      L('goku', 'Partner? Oh boy.'),
    ],
  },
  {
    id: 'berserker', num: 10, title: 'The Berserker', subtitle: 'Arc 2 · as Vegeta vs Brakk', theme: 'void',
    player: 'vegeta', opponent: 'brakk', ai: 'brakk', tier: 7, uiUnlocked: true,
    tip: 'Brakk hits like a planet. Teleport ✌️ out of his slams and punish him with combos. He goes BERSERK at low health.',
    intro: [
      L('narrator', 'Elsewhere, a horned giant smashes through the ring\'s outer wall.'),
      L('brakk', 'WHERE IS THE STRONGEST? BRAKK WANTS THE STRONGEST!'),
      L('vegeta', 'You\'re looking at him. Try not to bore me.'),
    ],
    outro: [
      L('brakk', 'Brakk... lost? Then Brakk joins with Zeltra. Together, no one stops us.'),
      L('vegeta', 'Joins? ...Kakarot. We need to talk.'),
    ],
  },
  {
    id: 'fusion', num: 11, title: 'Fusion', subtitle: 'Arc 2 finale · Gogeta vs Zelbrakk', theme: 'final', fusion: true,
    opponent: 'zelbrakk', ai: 'zelbrakk', tier: 8, uiUnlocked: true, muiUnlocked: true, foeSerious: true,
    tip: 'FUSE! Point both index fingers at each other with the tips touching (👉👈), press X, or tap FUSE. Gogeta lasts 60 seconds.',
    intro: [
      L('narrator', 'Zeltra and Brakk touch fingertips. Two powers collapse into one: ZELBRAKK.'),
      L('zelbrakk', 'TWO HEARTS. ONE CALAMITY. KNEEL.'),
      L('vegeta', 'Fine. Just this once, Kakarot. Do the dance.'),
      L('goku', 'Fu... sion... HA! Let\'s go, Vegeta!'),
      L('narrator', 'FUSION unlocked: point your index fingers at each other, tips touching (👉👈), or press X / tap FUSE.'),
    ],
    outro: [
      L('zelbrakk', 'Impossible... two... beat... two...'),
      L('gogeta', 'I\'m neither Goku nor Vegeta. I\'m the one who\'s going to beat you. And I just did.'),
      L('narrator', 'The fusion fades. Two rivals, shoulder to shoulder, look at the stars. THE END, of Arc 2.'),
    ],
  },
  {
    id: 'potara', num: 12, title: 'The Potara', subtitle: 'Arc 3 · Vegito vs Beerus', theme: 'final', fusion: 'vegito',
    opponent: 'beerus', ai: 'beerus2', tier: 8, uiUnlocked: true, muiUnlocked: true, foeSerious: true, p2IdlePose: 'idle_serious',
    tip: 'POTARA: 👉👈 (or X / FUSE) makes VEGITO for 90 s. His punches and kicks are Spirit Sword slashes. While fused, 👉👈 again = SPIRIT SWORD BARRAGE. Careful: running out of ki in Blue splits the Potara early.',
    intro: [
      L('narrator', 'A Supreme Kai appears on the ring holding two small earrings. Wear one each, and two become one.'),
      L('vegeta', 'Jewellery. Absolutely not.'),
      L('goku', 'C\'mon, Vegeta! Beerus wants a real fight, and he\'s not holding back today.'),
      L('beerus', 'Two Saiyans in one body? Now THAT I would skip dessert for.'),
      L('narrator', 'POTARA unlocked: 👉👈, X, or FUSE. Vegito lasts longer than Gogeta and shrugs off more damage.'),
    ],
    outro: [
      L('beerus', 'Hmph. Fine. I admit that one was... delicious.'),
      L('vegito', 'Thanks for the warm-up, Lord Beerus.'),
      L('narrator', 'Far above the ring, something with a cracked halo has been watching.'),
    ],
  },
  {
    id: 'ultra', num: 13, title: 'Ultra Fusion', subtitle: 'Arc 3 finale · Gogeta vs Aurex', theme: 'final', fusion: 'gogeta', fusionTime: 150,
    opponent: 'aurex', ai: 'aurex', tier: 8, uiUnlocked: true, muiUnlocked: true, foeSerious: true,
    tip: 'FUSE into Gogeta (👉👈 / X). Halfway through, Ultra Instinct and Ultra Ego merge into ULTRA INSTINCT EGO: it dodges on its own and grows stronger with every hit. 👉👈 while fused = SOUL PUNISHER, which purges Aurex\'s surge.',
    intro: [
      L('narrator', 'The stars go out one by one. A figure descends, a cracked halo spinning over its head.'),
      L('aurex', 'Instinct that moves on its own. Ego that grows with every wound. Both in one ring. It cannot be allowed.'),
      L('vegeta', 'Then we give it both at once. Kakarot, the dance. Now.'),
      L('goku', 'Fu... sion... HA!'),
      L('narrator', 'Fusion Dance: 👉👈, X, or FUSE. This time it lasts 150 seconds.'),
    ],
    triggers: [
      {
        id: 'uiEgo', when: { p2HpBelow: 0.5 }, effect: 'uiEgo',
        cutscene: [
          L('narrator', 'Inside the fused body, two answers to the same question meet: calm, and pride.'),
          L('gogeta', 'Goku\'s body moves before I think. Vegeta\'s pride gets stronger every time I bleed.'),
          L('aurex', 'Silver and violet... both limits, broken together. Impossible.'),
          L('narrator', 'ULTRA INSTINCT EGO awakened: it auto-dodges, counters, and every hit taken adds power. Press U / tap UI·EGO later to return to it.'),
        ],
      },
    ],
    outro: [
      L('aurex', 'Two hearts... one will... so this is what lies beyond the limit.'),
      L('gogeta', 'Beyond the limit? We\'re just getting started.'),
      L('narrator', 'The halo shatters into starlight. Two Saiyans, one legend. THE END, of Arc 3.'),
    ],
  },
];

/** Training steps for chapter 0. Counters are fed by combat events in the director. */
export const TUTORIAL = [
  { id: 'calibrate', title: 'Calibrate', text: 'Sit back until both hands fit in the camera preview. Show both open palms, then raise them high.', keys: 'Camera only (skipped otherwise)', cameraOnly: true },
  { id: 'power', title: '✊ Power Up', text: 'Make a fist to POWER UP. Keep holding at full ki to evolve into Kaioken!', keys: 'Hold P · POWER', done: (d) => d.combat.p1.form !== 'base' },
  { id: 'kiblast', title: '👉 Ki Blast', text: 'Point one finger to fire homing KI BLASTS. Land 3 hits.', keys: 'Hold F · BLAST', counter: 'kiblast', target: 3 },
  { id: 'punch', title: '✊ Punch', text: 'Jab a fist toward the camera to PUNCH. Land 3 punches.', keys: 'J · PUNCH', counter: 'punch', target: 3 },
  { id: 'kick', title: '🦵 Kick', text: 'Step back so your legs are in view, then lift a knee or kick out. Land 1 kick.', keys: 'L · KICK', counter: 'kick', target: 1, giveUpS: 18, giveUpText: 'Kicks need your legs in view: stand back from the camera, or use L / the KICK button.' },
  { id: 'kame', title: '👐 Ultimate Beam', text: 'Cup your hands with the wrists close together to charge. Push them forward to fire!', keys: 'Hold K, Space fires · hold BEAM, release', counter: 'kame', target: 1 },
  { id: 'guard', title: '🖐️ Energy Barrier', text: 'Incoming! Show one open palm to the camera, fingers spread wide, to raise a BARRIER. Block 2 hits.', keys: 'Hold G · BARRIER', counter: 'block', target: 2, force: 'volley' },
  { id: 'dodge', title: '✌️ Instant Transmission', text: 'Flash a two-finger ✌️ sign to TELEPORT out of the way. Teleport 2 times.', keys: '← → or T · TELEPORT', counter: 'dodge', target: 2, force: 'rush' },
  { id: 'spirit', title: '🙌 Spirit Bomb', text: 'Raise BOTH open hands above your head to gather a SPIRIT BOMB. Lower them to throw it!', keys: 'Hold S · hold BOMB, release', counter: 'spirit', target: 1 },
];

/* Battle mode: any playable fighter vs any foe, every form unlocked. */
export const BATTLE_FOES = [
  { id: 'garrok', ai: 'garrok' },
  { id: 'vessa', ai: 'vessa' },
  { id: 'thornka', ai: 'thornka' },
  { id: 'beerus', ai: 'beerus2', serious: true },
  { id: 'goku', ai: 'saiyan', form: 'ssj_blue' },
  { id: 'vegeta', ai: 'saiyan', form: 'ssj_blue' },
  { id: 'brakk', ai: 'brakk' },
  { id: 'zeltra', ai: 'zeltra' },
  { id: 'zelbrakk', ai: 'zelbrakk', serious: true },
  { id: 'aurex', ai: 'aurex', serious: true },
];

export function battleChapter(player, foeId) {
  const foe = BATTLE_FOES.find((f) => f.id === foeId) || BATTLE_FOES[0];
  return {
    id: 'battle', battle: true, num: 0, title: 'Battle', subtitle: '', theme: foe.serious ? 'final' : 'void',
    player, opponent: foe.id, ai: foe.ai, p2Form: foe.form, foeSerious: foe.serious, p2IdlePose: foe.serious ? 'idle_serious' : undefined,
    tier: 10, uiUnlocked: true, muiUnlocked: true, intro: [], outro: [],
  };
}
