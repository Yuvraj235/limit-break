// Offline dialogue: varied, original in-character lines per speaker and event.
// {foe} = opponent name, {form} = current form name. Picks avoid recent repeats.

const LINES = {
  goku: {
    intro: [
      'Whoa, you look tough! This is gonna be fun!', 'Let\'s give it everything we\'ve got, {foe}!', 'I\'ve been itching for a fight like this!',
      'Don\'t hold back on me, okay?', 'Alright, warm-up\'s over. Let\'s go!', 'You\'re strong. I can feel it from here!',
    ],
    kame_charge: [
      'Ka... me... ha... me...', 'Gathering it all into my hands!', 'Here it comes, stay right there!', 'Just a little more power...',
      'Feel that? It\'s only getting bigger!', 'Focus... focus... almost!', 'Kaaa... meee...',
    ],
    kame_fire: [
      'HAAAAAAA!', 'Kamehameha!', 'Take this one head-on!', 'Full power, straight at you!', 'Let\'s see you handle THAT!', 'Waaaaah!',
    ],
    spirit_charge: [
      'Everyone, lend me your energy!', 'The trees, the stars, the oceans... give me a little!', 'This takes a while, so bear with me!',
      'Come on, just a bit more energy!', 'It\'s getting huge up there!', 'All of you, I need your strength!',
    ],
    spirit_throw: [
      'Here goes everything!', 'This one\'s from all of us!', 'Spirit Bomb, go!', 'Catch this if you can!', 'Hope you\'re ready for this!',
    ],
    powerup: [
      'Hraaaaah!', 'I\'m just getting warmed up!', 'More... I need more!', 'Feel that power rising?', 'Here I come, higher and higher!',
      'Nngh... almost there!',
    ],
    transform_ssj: [
      'Now it\'s Super Saiyan time.', 'Golden hair, golden power. Let\'s go!', 'Okay. No more playing around.', 'This should even things out!',
    ],
    transform_ssj2: [
      'Past Super Saiyan, and still climbing!', 'Feel the lightning? That\'s Super Saiyan 2!', 'Let\'s crank it up a notch!',
      'Sorry, I\'m not done climbing yet!',
    ],
    transform_ssj3: [
      'This form burns energy fast, so let\'s finish quick!', 'Super Saiyan 3! Hope you\'re ready!', 'Whew, my hair\'s gotten long!',
      'This is about as far as my body goes... for now!',
    ],
    transform_kaioken: [
      'Kaioken! Let\'s see how long my body can take it!', 'Times two... no, times more!', 'Red means go!', 'Kaioken! Hang on tight!',
    ],
    transform_god: ['So this is a god\'s ki... it\'s so calm.', 'Super Saiyan God! Feels warm.', 'Red hair, huh? I kinda like it!'],
    transform_blue: [
      'Super Saiyan Blue. Time to get serious!', 'This is the power of a god, with a Saiyan twist!', 'Blue suits me, huh?',
      'Calm on the inside, wild on the outside!',
    ],
    ui_sign: [
      'My body... is moving on its own?', 'Everything feels so quiet.', 'I don\'t have to think. I just move.', 'Huh. I can see it all coming.',
    ],
    ui_mastered: [
      'So this is what calm feels like.', 'No more holding back. Not even a little.', 'I can hear everything. Even your heartbeat.',
      'Let\'s finish this, Lord Beerus.',
    ],
    hit: ['Oof! Nice one!', 'Ow, that one stung!', 'Hah, you\'re good!', 'Gotta stay sharp...', 'Not bad... not bad at all!', 'Ugh! Okay, my turn!'],
    block: ['Blocked it!', 'Too slow!', 'Nope, saw that coming!', 'That all you got?'],
    dodge: ['Missed me!', 'Over here!', 'Whoa, close one!', 'Too slow!', 'Gotta be quicker than that!'],
    struggle: ['Push... harder!', 'I\'m not losing this!', 'Come on, come on!', 'Grrr... give it everything!', 'Just a little more!'],
    struggle_win: ['Got you!', 'Pushed right through!', 'That\'s the power of not giving up!'],
    struggle_lose: ['Whoa, they\'re stronger!', 'Ack! Too much!', 'Gotta train harder...'],
    win: ['That was awesome! Let\'s fight again sometime!', 'Phew! Great match!', 'You were amazing! I\'m starving now.', 'Whew. Good fight!'],
    lose: ['Ugh... not yet...', 'I\'m not done... just give me a second...', 'Heh... you got me this time.', 'Next time, I\'ll win!'],
    low_ki: ['I\'m running on empty... power up!', 'Outta juice! Gotta recharge!', 'Need more ki first!'],
    taunt: ['C\'mon, show me something!', 'Is that your best?', 'I can do this all day!'],
    attack: ['Here I come!', 'Hyah!', 'Catch!', 'Coming through!'],
    special: ['Ka... me... ha... me... HAAA!', 'Full power, here it comes!', 'Try and stop this one!'],
    low_hp: ['Heh... you\'re really strong!', 'Okay, now I\'m excited!', 'Not done yet!'],
  },
  vegeta: {
    intro: ['Look closely. This is what a prince fights like.', 'You\'re in my way. Move or be moved.', 'I didn\'t come here to lose.', 'Let\'s get this over with.'],
    kame_charge: ['Feel that? That\'s royal energy!', 'Stand still, if you dare!', 'Galick... Gun...', 'Charging... don\'t blink.'],
    kame_fire: ['FIRE!', 'Disappear!', 'Taste this!', 'Gone!'],
    spirit_charge: ['A star, just for you.', 'Watch the sky burn.', 'This one ends it.'],
    spirit_throw: ['Big Bang... Supernova!', 'Burn!', 'Take it!'],
    powerup: ['HAAAAH!', 'Higher! HIGHER!', 'My pride won\'t let me stop here!', 'Nngh... more!', 'You think THIS is my limit?'],
    transform_ascended: ['I\'ve gone past my limits. Again.', 'Ascended. Try to keep up.', 'Feel the difference?'],
    transform_ssj: ['Super Saiyan. Bow.', 'Golden, like a prince should be.', 'Now we fight properly.'],
    transform_god: ['A god\'s power. Mine now.', 'Red suits a prince.', 'Divine ki, Saiyan pride.'],
    transform_evolved: ['Blue Evolution. I surpass even this!', 'You thought Blue was my limit?', 'Evolved. Unlike you.'],
    transform_ssj2: ['Super Saiyan 2. Feel the lightning!', 'Higher still!'],
    transform_blue: ['Blue. The power of a god, mastered by me.', 'You wanted a real fight? Here it is.', 'Calm. Focused. Lethal.'],
    ultra_ego: ['ULTRA EGO! Hit me harder!', 'Every blow just feeds me.', 'I don\'t dodge. I destroy.', 'This is MY path!'],
    hit: ['Tch!', 'Is that all?', 'Lucky shot.', 'You\'ll pay for that!', 'Hmph. Barely felt it.'],
    block: ['Pathetic.', 'Too predictable.', 'Blocked. Obviously.'],
    dodge: ['Too slow!', 'Behind you.', 'Missed, fool.', 'Over here.'],
    struggle: ['I will NOT lose to you!', 'Push, you fool!', 'Grrrrah!', 'My pride is on the line!'],
    struggle_win: ['Overpowered!', 'That\'s the difference between us!', 'Hah! Broken!'],
    struggle_lose: ['Impossible!', 'Grr... not like this!', 'Curse you!'],
    win: ['As it should be.', 'Remember who beat you.', 'Hmph. Not bad. For a warm-up.'],
    lose: ['This... isn\'t over.', 'Next time, I win. Count on it.', 'Grr... I\'ll train twice as hard.'],
    low_ki: ['Tch... running low.', 'I need more power!', 'Out of ki? Unacceptable.'],
    taunt: ['Come on! Fight me!', 'Is that your best?', 'Stop holding back!'],
    attack: ['Take this!', 'Hah!', 'Too slow!', 'Here I come!'],
    special: ['Final... FLASH!', 'Galick Gun, FIRE!', 'Witness real power!'],
    low_hp: ['You actually hurt me... now I\'m angry.', 'Hah... finally, a worthy fight.', 'I refuse to fall here!'],
  },
  gogeta: {
    intro: ['Fusion complete. Let\'s see how long you last.', 'Two Saiyans, one body. You\'re in trouble.'],
    kame_fire: ['Big Bang... KAMEHAMEHA!', 'Take this!'], spirit_throw: ['Stardust Breaker!'], powerup: ['Watch closely.', 'Hah!'],
    hit: ['Heh. Is that it?', 'Not bad.'], dodge: ['Too slow.', 'Missed.'], win: ['That\'s what a fusion can do.'], lose: ['Tch... time\'s up...'],
    struggle: ['Push!', 'Not a chance!'], struggle_win: ['Overpowered!'], struggle_lose: ['Hmph!'], low_ki: ['Gotta recharge.'], taunt: ['Come on!'],
    attack: ['Here I come.'], special: ['Final Kamehameha!'], low_hp: ['Okay, now I\'m serious.'],
  },
  vegito: {
    intro: ['Two Saiyans, one body, zero chance for you.', 'Relax. I\'ll make this quick... ish.'],
    kame_fire: ['FINAL KAMEHAMEHA!', 'Eat this!'], spirit_throw: ['Spirit Excalibur!'], powerup: ['Now you\'ve done it.', 'Watch this.'],
    hit: ['Was that supposed to hurt?', 'Cute.'], dodge: ['Too slow.', 'Nope.'], win: ['Told you. Potara\'s the real deal.'], lose: ['The earrings... they\'re fading...'],
    struggle: ['Push!', 'You call that a beam?'], struggle_win: ['Overpowered!'], struggle_lose: ['Hmph!'], low_ki: ['Careful, careful...'], taunt: ['Come on, try harder.'],
    attack: ['Spirit Sword!', 'Here I come.'], special: ['Spirit Sword!'], low_hp: ['Okay. No more playing around.'],
  },
  aurex: {
    intro: ['You broke your limits. Balance demands I break you.', 'Kneel, and judgement will be gentle.'], attack: ['Be still.', 'Judgement.', 'Fall.'], special: ['Erasure.', 'Halo Lance.'],
    hit: ['A mortal touched an angel. Remarkable.', 'Your instincts are... loud.'], low_hp: ['Then I unseal the halo.'], struggle: ['Light does not yield.'],
    win: ['Order is restored.'], lose: ['Two hearts... one will... how...'], hakai: ['Erase.', 'Unmake.'], deflect: ['No.'],
  },
  brakk: {
    intro: ['BRAKK SMASH THE STRONGEST!', 'You small. Brakk big.'], attack: ['RAAAH!', 'SMASH!', 'BRAKK HITS!'], special: ['GROUND BREAKER!'],
    hit: ['Ha! Tickles!', 'More! Hit Brakk more!'], low_hp: ['Brakk... ANGRY NOW!'], struggle: ['PUSH!'], win: ['Brakk strongest!'], lose: ['Brakk... fell...'],
  },
  zeltra: {
    intro: ['The void is patient. I am not.', 'Kneel, and it will not hurt.'], attack: ['Fall.', 'Vanish.', 'Scatter.'], special: ['Collapse.', 'Void Lance.'],
    hit: ['Interesting.', 'You touched me. Bold.'], low_hp: ['Then I stop holding back.'], struggle: ['The void devours light.'], win: ['Silence.'], lose: ['This is... not the end.'],
  },
  zelbrakk: {
    intro: ['TWO HEARTS. ONE CALAMITY.', 'KNEEL BEFORE THE FUSION.'], attack: ['CRUSH!', 'VANISH!', 'FALL!'], special: ['VOID BREAKER!', 'CALAMITY!'],
    hit: ['NOTHING!', 'PATHETIC!'], low_hp: ['WE... WILL NOT... SPLIT!'], struggle: ['DEVOUR!'], win: ['ONE REMAINS.'], lose: ['SPLITTING... APART...'],
  },
  beerus: {
    intro: ['Entertain me, Saiyan. I skipped a nap for this.', 'Let\'s see if you\'re worth the trip.', 'Don\'t bore me, Goku. I warn you once.', 'I\'ll use one hand. Maybe.'],
    attack: ['Pay attention.', 'Too slow.', 'Hmph.', 'Is this the best mortals have?', 'Keep up.'],
    special: ['Destruction is a craft, you know.', 'Watch closely. You only see this once.', 'Feel honored.'],
    hit: ['Hm. That actually tickled.', 'You dare?', 'Interesting...', 'Not bad, for a mortal.'],
    low_hp: ['Now I\'m genuinely annoyed.', 'You\'ve earned my full attention.', 'Hah... so this is what fun feels like.'],
    struggle: ['Push all you like.', 'Your arms will give out first.', 'Adorable effort.'],
    win: ['As expected. Now, where is the pudding?', 'Train harder. Then come bother me.', 'That was... marginally entertaining.'],
    lose: ['Hmph. Fine. You win this round.', 'Don\'t let it go to your head, Saiyan.', 'Well. That was worth waking up for.'],
    deflect: ['A ball of borrowed energy? Please.', 'Shoo.', 'Cute. No.'],
    hakai: ['Hakai.', 'Disappear.', 'Be erased.', 'Destruction.'],
  },
  garrok: {
    intro: ['Iron doesn\'t bend. Neither does Garrok.', 'I\'ll flatten you, little gold-hair.', 'Stand still. It hurts less.'],
    attack: ['CHARGE!', 'Out of my way!', 'Feel the iron!', 'HRRAH!'],
    special: ['The ground answers to Garrok!', 'Shatter!'],
    hit: ['Hah! Barely a dent!', 'Grr! Lucky shot!', 'My armor holds!'],
    low_hp: ['Iron... cracks... but holds!', 'Not finished yet!'],
    struggle: ['RAAAH!', 'Push!'],
    win: ['Universe 4 stands!', 'Hah! Too soft!'],
    lose: ['Iron... fell...', 'You hit harder... than iron.'],
  },
  vessa: {
    intro: ['Blink and you\'ll miss me. Actually, you\'ll miss me anyway.', 'Try to keep up, Saiyan.', 'Wind waits for no one.'],
    attack: ['Too slow!', 'Here and gone!', 'Feel the breeze?', 'Catch me!'],
    special: ['Gale step!', 'Now you see me—'],
    hit: ['Tch! Lucky!', 'You actually touched me?', 'Okay, that one counts.'],
    low_hp: ['No more playing nice.', 'Fine. Full speed.'],
    struggle: ['Wind pushes back!'],
    win: ['Untouchable, as promised.', 'Universe 9 flies on.'],
    lose: ['The wind... stopped...', 'Fast... but not fast enough.'],
  },
  thornka: {
    intro: ['Mountains are patient. So am I.', 'You are a spark. I am a crystal.', 'Come, small one.'],
    attack: ['Crystals... rise.', 'Be still.', 'Inevitable.'],
    special: ['Prism of ages.', 'Shine... and end.'],
    hit: ['A scratch on stone.', 'Hmm.', 'You chip the surface.'],
    low_hp: ['Cracks... reveal the core.', 'You... reach deep.'],
    struggle: ['Stone does not yield.', 'Push against a mountain.'],
    win: ['Patience prevails.', 'As crystal forms, so ends the spark.'],
    lose: ['Even stone... turns to sand.', 'A worthy... erosion.'],
  },
  shadow: {
    intro: ['Show me what you remember.', 'I am your echo. Move.'],
    attack: ['Read the motion.', 'React.'],
    hit: ['Good.', 'Again.'],
    win: ['Breathe. Then again.'],
    lose: ['Well done.'],
  },
  arbiter: {
    round_start: ['Fighters, take your marks! Begin!', 'The arena is sealed. Let the battle commence!', 'Two universes. One ring. Fight!'],
    eliminated: ['Out of the ring! Eliminated!', 'A fighter falls into the void! Eliminated!', 'Ring out! That universe loses a warrior!'],
    ko: ['Knockout! The fighter cannot continue!', 'Down and out! The match is decided!'],
    time_up: ['Time! The judges decide!', 'The clock runs dry! Time is up!'],
  },
};

const recent = new Map();

export function mockLine(speaker, event, ctx = {}) {
  const pool = LINES[speaker]?.[event] || LINES[speaker]?.attack || LINES.goku[event] || ['...'];
  const key = `${speaker}:${event}`;
  const used = recent.get(key) || [];
  const fresh = pool.map((_, i) => i).filter((i) => !used.includes(i));
  const pick = (fresh.length ? fresh : pool.map((_, i) => i))[Math.floor(Math.random() * (fresh.length || pool.length))];
  used.push(pick);
  while (used.length > Math.max(1, Math.floor(pool.length / 2))) used.shift();
  recent.set(key, used);
  return pool[pick].replace('{foe}', ctx.foe?.name || 'pal').replace('{form}', ctx.self?.form || '');
}

export const hasMockLines = (speaker, event) => !!LINES[speaker]?.[event];
