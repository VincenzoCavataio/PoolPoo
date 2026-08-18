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
  'title.kicker': 'Pool room',
  'title.wordmark': 'Billiards',
  'title.dimension': 'Three dimensions',
  'title.enter': 'Tap to enter',

  // -------------------------------------------------------------------- menu
  'menu.subtitle': 'Three dimensions',
  'menu.newGame': 'New game',
  'menu.newGameSub': 'Free play or puzzles',
  'menu.continue': 'Continue',
  'menu.noSave': 'No saved game',
  'menu.options': 'Options',
  'menu.stars': 'Stars collected',
  'menu.savedFree': {
    one: 'Free play · {count} player',
    other: 'Free play · {count} players',
  },
  'menu.savedPuzzle': 'Puzzle · {name}',

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
  'newGame.puzzleSection': 'Puzzles',
  'newGame.puzzleBody':
    '{count} levels with a limited number of shots and one precise goal: pot certain balls, in a certain order, or into a certain pocket. The fewer shots you take, the more stars you earn.',
  'newGame.chooseLevel': 'Choose a level',

  // ------------------------------------------------------------------ levels
  'levels.title': 'Levels',
  'levels.subtitle': '{earned} of {total} stars',
  'levels.locked': 'Earn a star on the previous level',
  'levels.budget': '{shots} shots · {three} for three stars',

  // ----------------------------------------------------------------- options
  'options.title': 'Options',
  'options.environment': 'Room',
  'options.environmentAll': 'All {count} available. Stars collected: {earned} of {total}.',
  'options.environmentLocked': 'Needs {count} stars to unlock',
  'options.cloth': 'Cloth',
  'options.clothBody':
    'The cloth is not just a colour: it changes friction, roll and how the cushions answer.',
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
  'options.audio': 'Audio',
  'options.haptics': 'Vibration',
  'options.hapticsBody': 'A tap when you shoot, a different one when you pot.',
  'options.collisionHaptics': 'Vibration on collisions',
  'options.collisionHapticsBody':
    'A light tap on every ball contact. On a break you will feel a good many.',
  'options.mixerHint':
    'Music and effect volumes live on the player in the room: during a game, open the panel with the ♪ button next to the camera controls, or tap the unit on its shelf when it is in view.',
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
  'options.resetProgress': 'Reset puzzle progress',
  'options.resetProgressTitle': 'Reset progress?',
  'options.resetProgressBody': 'You will lose every star, unlocked level and unlocked room.',
  'options.resetProgressConfirm': 'Reset',

  // -------------------------------------------------------------------- game
  'game.backToMenu': 'Back to menu',
  'game.power': 'Power',
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
  'game.resetCamera': 'Reset the camera',
  'game.music': 'Music',
  'game.viewCue': 'Cue',
  'game.viewTable': 'Table',
  'game.viewLabel': '{name} view',
  'game.shotsLeft': {
    one: '{count} shot',
    other: '{count} shots',
  },

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
  'result.solved': 'Solved',
  'result.failed': 'Not this time',
  'result.shotsUsed': '{used} of {total}',
  'result.nextLevel': 'Next level',
  'result.replay': 'Play again',
  'result.retry': 'Try again',
  'result.allLevels': 'You have finished every level: {count} stars in total.',

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

  // ------------------------------------------------------------ puzzle rules
  'puzzle.potted': 'Potted the {number}',
  'puzzle.pottedMany': 'Potted {count} balls',
  'puzzle.solvedIn': {
    one: 'Solved in {count} shot',
    other: 'Solved in {count} shots',
  },
  'puzzle.failed': 'Puzzle failed',
  'puzzle.failForbidden': 'The {number} was not meant to go down',
  'puzzle.failWrongFirst': 'You had to hit the {number} first',
  'puzzle.failNoContact': 'You did not hit any ball',
  'puzzle.failOutOfOrder': 'Out of order: the {number} was next',
  'puzzle.failWrongPocket': 'Wrong pocket',
  'puzzle.failOutOfShots': 'Out of shots',
  'puzzle.failOneCushion': 'Something has to reach a cushion before a ball drops',
  'puzzle.failCushions': 'At least {count} cushions are needed before a ball drops',

  // ------------------------------------------------------------ puzzle goals
  'goal.pocketAll': 'Pot every ball',
  'goal.pocketSet': 'Pot the {numbers}',
  'goal.pocketInOrder': 'Pot in order: {numbers}',
  'goal.pocketInto': 'Pot the {number} into the marked pocket',

  // ------------------------------------------------------------------- music
  'music.title': 'Record player',
  'music.playing': 'Now playing',
  'music.paused': 'Paused',
  'music.changing': 'Changing record…',
  'music.musicVolume': 'Music',
  'music.sfxVolume': 'Effects',
  'music.onlyOne': 'One track for now. Add more in assets/bgm/ and to the manifest.',

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
  'level.primo-colpo': 'First shot',
  'level.primo-colpoHint':
    'The 3 is already lined up with the pocket. Aim at its centre and use very little power.',
  'level.doppietta': 'One after the other',
  'level.doppiettaHint':
    'Two balls, two corners. The first is served up; for the second, think about where the cue ball ends.',
  'level.in-ordine': 'One, two, three',
  'level.in-ordineHint': 'Keep to the order: one ball down out of sequence and the puzzle is lost.',
  'level.niente-nera': 'Not the black',
  'level.niente-neraHint': 'Pot the 4 and the 5. If the 8 drops, you have lost.',
  'level.prima-la-5': 'The 5 first',
  'level.prima-la-5Hint': 'The cue ball has to touch the 5 before any other ball.',
  'level.di-sponda': 'Off a cushion',
  'level.di-spondaHint': 'Before any ball drops, something has to have touched a cushion.',
  'level.buca-scelta': 'That pocket',
  'level.buca-sceltaHint':
    'The 9 has to go into the top middle pocket. A corner does not count.',
  'level.ripulisci': 'Clear the table',
  'level.ripulisciHint': 'Five balls, seven shots. Every ball has its pocket: find it.',
};
