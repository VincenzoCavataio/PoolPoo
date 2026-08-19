/**
 * English catalogue.
 *
 * Typed against the Italian one, so a missing or misspelled key is a compile
 * error rather than a sentence that silently comes out in the wrong language.
 * Italian is the source of truth: add the key there first.
 */

import type { Entry } from './catalogue';
import type { it } from './it';

export const en: Record<keyof typeof it, Entry> = {
  // ------------------------------------------------------------------ common
  'common.back': 'Back',
  'common.close': 'Close',
  'common.cancel': 'Cancel',
  'common.checking': 'Checking…',
  'common.menu': 'Menu',

  // ------------------------------------------------------------------- title
  /**
   * The name, and it is the same in every language.
   *
   * `title.dimension` and `menu.subtitle` are the second half of the wordmark,
   * not a description of the game: "After Hours — Pool Hall" is one piece of
   * lettering, the way it would be painted on a door. Translating the second
   * half leaves the two halves in different languages, which reads as a
   * half-finished translation rather than as a name.
   *
   * The key is called `dimension` because it used to hold "Three dimensions".
   * Left as is: renaming it would touch every locale for no gain.
   */
  'title.wordmark': 'After Hours',
  'title.dimension': 'Pool Hall',
  'title.enter': 'Tap to enter',

  // -------------------------------------------------------------------- menu
  'menu.subtitle': 'Pool Hall',
  'menu.newGame': 'New game',
  'menu.newGameSub': 'Free play or puzzles',
  'menu.continue': 'Continue',
  'menu.noSave': 'No saved game',
  'menu.options': 'Options',
  'menu.savedFree': {
    one: 'Free play · {count} player',
    other: 'Free play · {count} players',
  },

  // ---------------------------------------------------------------- new game
  'newGame.title': 'New game',
  'newGame.subtitle': 'Two ways to play',
  'newGame.freeSection': 'Free play',
  'newGame.freeBody':
    'Full rack, 15 balls. A point for every ball potted, and potting keeps you at the table. Scratching or missing everything costs a point and hands the turn over.',
  'newGame.players': 'Players',
  'newGame.soloHint': 'On your own it is a high-score run.',
  'newGame.multiHint': '{count} players taking turns on the same device.',
  'newGame.startFree': 'Start free play',


  // ----------------------------------------------------------------- options
  'options.title': 'Options',
  'options.aimHelpers': 'Aiming aids',
  'options.aimLine': 'Aim line',
  'options.aimLineBody': 'Shows where the cue ball reaches before it touches anything.',
  'options.ghostBall': 'Ghost ball',
  'options.ghostBallBody': 'Adds the contact point and the direction the struck ball takes.',
  'options.sensitivity': 'Aim sensitivity',
  'options.sensitivityBody':
    'How far the shot turns for each drag. In the cue view a vertical drag raises and lowers the eye, and a pinch brings it closer to the ball.',
  'options.sensitivitySlow': 'Slow',
  'options.sensitivityMedium': 'Medium',
  'options.sensitivityFast': 'Fast',
  // --------------------------------------------------------------------- graphics
  'quality.section': 'Graphics',
  'quality.low': 'Low',
  'quality.lowFeel': 'A steady 30fps. One lamp, no reflections.',
  'quality.medium': 'Medium',
  'quality.mediumFeel': '60fps. Two lamps and reflections, without the cloth’s nap.',
  'quality.high': 'High',
  'quality.highFeel': '60fps. Every light, reflections, and cloth with its sheen.',

  'options.audio': 'Audio',
  'options.haptics': 'Vibration',
  'options.hapticsBody': 'A tap when you shoot, a different one when you pot.',
  'options.collisionHaptics': 'Vibration on collisions',
  'options.collisionHapticsBody':
    'A light tap on every ball contact. On a break you will feel a good many.',
  'options.language': 'Language',
  'options.languageAuto': 'Automatic',
  'options.languageBody': 'Automatic follows the phone’s language.',
  'options.data': 'Data',
  'options.resetSettings': 'Reset options',
  'options.clearSave': 'Delete saved game',
  'options.cleared': 'Deleted',
  'options.clearSaveTitle': 'Delete the saved game?',
  'options.clearSaveBody': 'The game in progress will not be recoverable.',
  'options.clearSaveConfirm': 'Delete',

  // -------------------------------------------------------------------- game
  'game.backToMenu': 'Back to menu',
  'game.aim': 'aim',
  'game.aimStrip': 'Drag to turn the cue, hold at the ends to keep turning',
  'game.aimLeft': 'Turn the aim left',
  'game.aimRight': 'Turn the aim right',
  'game.shoot': 'SHOOT',
  'game.goAim': 'AIM',
  'game.shootBlocked': 'From above you can only look: go back to the cue view to shoot',
  'game.shootLabel': 'Shoot',
  'game.goAimLabel': 'Go back to the cue view to shoot',
  'game.spin': 'spin',
  'game.spinLabel': 'Contact point on the cue ball',
  'game.switchView': 'Switch view',
  'game.resetCamera': 'Hold to reset the camera',

  // ------------------------------------------------------------ celebrations
  'celebration.potOne': 'Ball {number} down!',
  'celebration.potMany': '{count} balls!',
  'celebration.foul': 'Foul',
  'celebration.penalty': {
    one: '−{count} point',
    other: '−{count} points',
  },
  'celebration.skipReplay': 'Skip the replay',
  'celebration.replayHint': 'Replay · tap to skip',

  // ----------------------------------------------------------------- results
  'result.winner': '{name} wins',
  'result.draw': 'Draw',
  'result.points': {
    one: '{count} point',
    other: '{count} points',
  },
  'result.newGame': 'New game',

  // ------------------------------------------------------------------- rules
  'rules.player': 'Player {number}',
  'rules.foulScratch': 'Cue ball potted',
  'rules.foulNoContact': 'No ball hit',
  'rules.foulNoRail': 'No ball potted and no ball reached a rail',
  'rules.foulOffTable': 'Ball off the table',
  'rules.foulOffTableMany': '{count} balls off the table',
  'rules.gained': {
    one: '{name}: +{count} point',
    other: '{name}: +{count} points',
  },
  'rules.gainedMany': '{name}: +{points} points ({balls} balls)',
  'rules.foulPenalty': 'Foul: {reason} (−{count})',
  'rules.turnTo': '{name} to play',
  'rules.keepShooting': 'Shoot again',
  'rules.winsWith': '{name} wins with {count} points',
  'rules.drawAt': 'Draw at {count} points',
  'rules.resumed': 'Game resumed',



  // ------------------------------------------------------------------- music
  'music.title': 'Record player',
  'music.playing': 'Now playing',
  'music.paused': 'Paused',
  'music.changing': 'Changing record…',
  'music.musicVolume': 'Music',
  'music.sfxVolume': 'Effects',
  'music.onlyOne': 'One track for now. Add more in assets/bgm/ and to the manifest.',

  // ------------------------------------------------------------------ ball sets
  'ballSet.classic': 'Classic',
  'ballSet.classicFeel': 'Polished phenolic resin. The reference.',
  'ballSet.night': 'Night',
  'ballSet.nightFeel': 'Vivid colours, mirror finish: they throw the lamps back hard.',
  'ballSet.ivory': 'Ivory',
  'ballSet.ivoryFeel': 'Period clay, almost matte. Soft highlight, little of the room.',
  'ballSet.solid': 'Solids',
  'ballSet.solidFeel': 'No stripes: you read a ball by its colour alone.',

  // ---------------------------------------------------------------------- setup
  'setup.title': 'Setup',
  'setup.subtitle': 'Dress the table',
  'setup.place': 'Room',
  'setup.cloth': 'Cloth',
  'setup.balls': 'Balls',
  'setup.start': 'Start',

  // ------------------------------------------------------------------- cloth
  'cloth.verde': 'Green',
  'cloth.verdeFeel': 'Standard. The reference everything else is tuned against.',
  'cloth.blu': 'Blue',
  'cloth.bluFeel': 'Fast and lively: balls run further and the cushions give more back.',
  'cloth.bordeaux': 'Burgundy',
  'cloth.bordeauxFeel': 'Heavy and slow, dead cushions. Forgives too much power far less.',
  'cloth.grafite': 'Graphite',
  'cloth.grafiteFeel': 'Coarse: plenty of bite, and spin takes far better.',

  // --------------------------------------------------------------- locations
  'location.sala': 'Pool room',
  'location.salaBody': 'Wood, a hi-fi on the shelves, a turntable, plants and neon on the wall.',
  'location.garage': 'Garage',
  'location.garageBody': 'Concrete, cold strip light, speakers on the floor, cues and steel racks.',
  'location.arcade': 'Amusement arcade',
  'location.arcadeBody': 'Cabinets throwing coloured light, dark carpet and neon everywhere.',
  'location.terrazza': 'Rooftop at night',
  'location.terrazzaBody':
    'Outdoors under the moon, hanging lamps, potted plants and the city in the distance.',
  'location.studio': 'Studio',
  'location.studioBody': 'Neutral, bright and empty: the right choice for reading the physics.',

  // ----------------------------------------------------------- music devices
  'device.turntable': 'Turntable',
  'device.radioWork': 'Site radio',
  'device.jukebox': 'Jukebox',
  'device.boombox': 'Boombox',
  'device.monitor': 'Studio monitor',

  // ------------------------------------------------------------- level names
};
