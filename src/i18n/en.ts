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

  // ----------------------------------------------------------------- loading
  'loading.title': 'Setting the table',
  'loading.subtitle': 'Loading',

  // ---------------------------------------------------------------- trophies
  'trophy.title': 'Trophies',
  'trophy.subtitle': 'Achievements',
  'trophy.tally': '{earned} of {total}',
  'trophy.locked': 'Locked',
  'trophy.secret': 'Hidden trophy',
  'trophy.secretHint': 'Find it by playing',
  'trophy.unlocked': 'Trophy unlocked',
  'trophy.reset': 'Reset trophies',
  'trophy.resetBody': 'Clears every achievement earned so far. There is no undo.',

  'trophy.groupProgress': 'Progress',
  'trophy.groupSkill': 'Shots',
  'trophy.groupMode': 'The disciplines',
  'trophy.groupFeat': 'Feats',
  'trophy.groupSecret': 'Hidden',

  'trophy.firstShot': 'First shot',
  'trophy.firstShotHint': 'Play your first shot',
  'trophy.firstPot': 'First pot',
  'trophy.firstPotHint': 'Pot your first ball',
  'trophy.firstWin': 'First win',
  'trophy.firstWinHint': 'Win a game',
  'trophy.tenGames': 'Regular',
  'trophy.tenGamesHint': 'Win ten games',
  'trophy.hundredPots': 'Century',
  'trophy.hundredPotsHint': 'Pot a hundred balls',

  'trophy.doublePot': 'Double',
  'trophy.doublePotHint': 'Two balls in one shot',
  'trophy.triplePot': 'Treble',
  'trophy.triplePotHint': 'Three balls in one shot',
  'trophy.cushionPot': 'Off the cushion',
  'trophy.cushionPotHint': 'Pot after the cue ball finds a cushion',
  'trophy.spinPot': 'With side',
  'trophy.spinPotHint': 'Pot with heavy side spin on',
  'trophy.breakPot': 'Lucky break',
  'trophy.breakPotHint': 'Pot on the break',
  'trophy.runOfThree': 'On a run',
  'trophy.runOfThreeHint': 'Three scoring shots in a row',

  'trophy.cleanGame': 'Clean game',
  'trophy.cleanGameHint': 'Win without a single foul',
  'trophy.noScratch': 'Never in off',
  'trophy.noScratchHint': 'Win without potting the cue ball',
  'trophy.shutout': 'Whitewash',
  'trophy.shutoutHint': 'Win without anybody else scoring',

  'trophy.offTheTable': 'Off the table',
  'trophy.offTheTableHint': 'You knocked a ball onto the floor',
  'trophy.lightsOut': 'Closing time',
  'trophy.lightsOutHint': 'You turned the room light off',
  'trophy.dj': 'The disc jockey',
  'trophy.djHint': 'You changed the record',
  'trophy.grandTour': 'Grand tour',
  'trophy.grandTourHint': 'You played in every room',
  'trophy.collector': 'Collector',
  'trophy.collectorHint': 'You tried every set of balls',
  'trophy.longRun': 'Long run',
  'trophy.longRunHint': 'Six scoring shots in a row',

  'trophy.fiftyGames': 'Regular',
  'trophy.fiftyGamesHint': 'Fifty games finished',
  'trophy.thousandPots': 'A thousand',
  'trophy.thousandPotsHint': 'A thousand balls potted in total',
  'trophy.allDisciplines': 'All-rounder',
  'trophy.allDisciplinesHint': 'Win a game in every discipline',
  'trophy.quadPot': 'Four at once',
  'trophy.quadPotHint': 'Four balls from a single shot',
  'trophy.twoCushionPot': 'Two cushions',
  'trophy.twoCushionPotHint': 'The cue ball finds two rails before the pot',
  'trophy.drawPot': 'On the draw',
  'trophy.drawPotHint': 'Pot a ball playing heavy screw',
  'trophy.bigBreak': 'Big break',
  'trophy.bigBreakHint': 'Three balls from the break',
  'trophy.runOfFive': 'Five in a row',
  'trophy.runOfFiveHint': 'Five scoring shots one after another',
  'trophy.longPot': 'The long one',
  'trophy.longPotHint': 'Pot a ball half a table away',
  'trophy.softTouch': 'Soft touch',
  'trophy.softTouchHint': 'Pot a ball with the gentlest of shots',

  'trophy.eightFirstWin': 'Eight-ball',
  'trophy.eightFirstWinHint': 'Win your first game of eight-ball',
  'trophy.eightOnTheBlack': 'On the black',
  'trophy.eightOnTheBlackHint': 'Win by potting the black',
  'trophy.eightClearGroup': 'Group cleared',
  'trophy.eightClearGroupHint': 'Clear your group and go on the black',
  'trophy.eightTeamWin': 'Doubles',
  'trophy.eightTeamWinHint': 'Win an eight-ball game with a partner',
  'trophy.eightOutnumbered': 'One against two',
  'trophy.eightOutnumberedHint': 'Win alone against a pair',
  'trophy.eightTenWins': 'House player',
  'trophy.eightTenWinsHint': 'Ten eight-ball games won',

  'trophy.calledFirstWin': 'As called',
  'trophy.calledFirstWinHint': 'Win your first called game',
  'trophy.calledAsSaid': 'Good for your word',
  'trophy.calledAsSaidHint': 'Twenty-five calls made good',
  'trophy.calledRunOfThree': 'Three for three',
  'trophy.calledRunOfThreeHint': 'Three called pots in a row',
  'trophy.calledBlack': 'The black, called',
  'trophy.calledBlackHint': 'Finish by naming the black’s pocket',
  'trophy.calledSidePocket': 'Middle pocket',
  'trophy.calledSidePocketHint': 'Call a middle pocket and make it',

  'trophy.straightFirstWin': 'Continuous',
  'trophy.straightFirstWinHint': 'Win your first game of straight pool',
  'trophy.straightRerack': 'Rack them again',
  'trophy.straightRerackHint': 'Play on to a fresh rack',
  'trophy.straightAcrossRacks': 'Across the racks',
  'trophy.straightAcrossRacksHint': 'A run that survives the re-rack',
  'trophy.straightRunOfEight': 'Eight in a row',
  'trophy.straightRunOfEightHint': 'Eight scoring shots in straight pool',
  'trophy.straightHalfTarget': 'Halfway',
  'trophy.straightHalfTargetHint': 'Reach half the target score',

  'trophy.freeCleanSweep': 'Clean sweep',
  'trophy.freeCleanSweepHint': 'Win a free game with no fouls and no scratches',
  'trophy.freeDoubleFigures': 'Double figures',
  'trophy.freeDoubleFiguresHint': 'Win a free game with ten points or more',

  'trophy.beatEasy': 'First scalp',
  'trophy.beatEasyHint': 'Beat an easy computer',
  'trophy.beatMedium': 'Real opposition',
  'trophy.beatMediumHint': 'Beat a medium computer',
  'trophy.beatHard': 'Best in the house',
  'trophy.beatHardHint': 'Beat a hard computer',
  'trophy.beatHardTen': 'No mercy',
  'trophy.beatHardTenHint': 'Ten wins against a hard computer',
  'trophy.beatThreeCpus': 'Against the room',
  'trophy.beatThreeCpusHint': 'Win against three or more computers at once',
  'trophy.beatHardClean': 'A lesson',
  'trophy.beatHardCleanHint': 'Beat a hard computer without a single foul',

  'trophy.wireToWire': 'Never headed',
  'trophy.wireToWireHint': 'Win having led from the first shot',
  'trophy.comeback': 'Comeback',
  'trophy.comebackHint': 'Win after trailing by five',

  'trophy.ownGoal': 'Own goal',
  'trophy.ownGoalHint': 'You potted the black too early',
  'trophy.bothEnds': 'Both ends',
  'trophy.bothEndsHint': 'Two balls in one shot, at opposite ends of the table',
  'trophy.namedYourself': 'Pleased to meet you',
  'trophy.namedYourselfHint': 'You gave the player a name',

  // ------------------------------------------------------------------- modes
  'mode.section': 'Pick a game',
  'mode.title': 'How you play',
  'mode.solo': 'On your own',
  'mode.soloBody': 'The table to yourself, nobody to beat',
  'mode.cpu': 'Against the computer',
  'mode.cpuBody': 'One to seven opponents, each as good as you like',
  'mode.human': 'With friends',
  'mode.humanBody': 'Several people on one phone, taking turns',

  // -------------------------------------------------------------- discipline
  'discipline.title': 'Which game',

  // ------------------------------------------------------------------ call
  'call.pickBall': 'Which ball',
  'game.callFirst': 'Call it',
  'call.pickPocket': 'The {number} into which pocket',
  'call.pocketCornerNw': 'Top left corner',
  'call.pocketCornerNe': 'Top right corner',
  'call.pocketCornerSw': 'Bottom left corner',
  'call.pocketCornerSe': 'Bottom right corner',
  'call.pocketSideN': 'Right middle pocket',
  'call.pocketSideS': 'Left middle pocket',
  'call.declared': '{number} → {pocket}',
  'discipline.free': 'Free play',
  'discipline.freeBody':
    'All fifteen in play, a point a ball. Potting keeps you at the table. Most points when it empties wins.',
  'discipline.eight': 'Eight-ball',
  'discipline.eightBody':
    'Solids against stripes. The first ball potted after the break picks your group; clear yours, then the black. Four players is teams.',
  'discipline.eightCalled': 'Eight-ball, called',
  'discipline.eightCalledBody':
    'Eight-ball, but you name the ball and the pocket before each shot. Anywhere else does not count.',
  'discipline.straight': 'Straight pool',
  'discipline.straightBody':
    'Every ball a point, always called, to 25. When one is left the other fourteen go back up and the run carries on.',

  'difficulty.title': 'Who is playing',
  'difficulty.easy': 'Easy',
  'difficulty.medium': 'Medium',
  'difficulty.hard': 'Hard',
  'difficulty.cpuName': 'Computer {number}',
  'difficulty.roleCpu': 'Computer',
  'difficulty.roleYou': 'You',
  'difficulty.rolePlayer': 'Player {number}',

  // -------------------------------------------------------------------- name
  'name.askTitle': 'What should we call you?',
  'name.askBody': 'Only for the scoreboard. You can change it in the options.',
  'name.placeholder': 'Your name',
  'name.confirm': 'Pleased to meet you',
  'name.skip': 'Later',
  'name.change': 'Your name',
  'name.changeBody': 'What the scoreboard and the greeting call you.',
  'name.fallback': 'Player',

  'greeting.welcome': 'Welcome back!',

  // -------------------------------------------------------------------- menu
  'menu.subtitle': 'Pool Hall',
  'menu.newGame': 'New game',
  'menu.newGameSub': 'Free play or puzzles',
  'menu.continue': 'Continue',
  'menu.noSave': 'No saved game',
  'menu.lightSwitch': 'Room light',
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
  'newGame.opponents': 'Opponents',
  'newGame.players': 'Players',
  'newGame.cpuHint': {
    one: 'One opponent played by the computer.',
    other: '{count} opponents played by the computer.',
  },
  'newGame.humanHint': {
    one: 'One opponent, taking turns on the same device.',
    other: '{count} opponents, taking turns on the same device.',
  },
  'newGame.nextDifficulty': 'Choose the opponents',
  'newGame.nextSeats': 'Who is playing',
  'newGame.next': 'Dress the table',


  // ----------------------------------------------------------------- options
  'options.title': 'Options',
  'options.aimHelpers': 'Aiming aids',
  'options.aimLine': 'Aim line',
  'options.aimLineBody': 'Shows where the cue ball reaches before it touches anything.',
  'options.ghostBall': 'Ghost ball',
  'options.ghostBallBody': 'Adds the contact point and the direction the struck ball takes.',
  'options.motionTrail': 'Trail',
  'options.motionTrailBody': 'Fast balls leave a short trail in their own colour.',
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
  'options.you': 'You and your phone',
  'options.play': 'How it plays',
  'options.languageAuto': 'Auto',
  'options.languageBody': 'Automatic follows the phone’s language.',
  'options.resetSettings': 'Reset options',
  'options.resetSettingsBody': 'Every option goes back to how it started.',
  'options.resetSettingsConfirm': 'Reset',
  'options.clearSave': 'Delete saved game',
  'options.cleared': 'Deleted',
  'options.resetSection': 'Reset',
  'options.resetShort': 'Options',
  'options.clearSaveShort': 'Save',
  'options.resetTrophiesShort': 'Trophies',
  'options.version': 'Version {version}',
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
  'result.frameOver': 'Frame over',
  'result.winners': '{names} win',
  'result.won': 'Won',
  'result.lost': 'Lost',
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

  // ------------------------------------------------------------- 8-ball
  'rules.foulEightFirst': 'Hit the black first',
  'rules.foulWrongGroup': 'Hit the other group first',
  'rules.eightWon': '{name} finishes on the black',
  'rules.eightLost': '{name} potted the black early',
  'rules.tookSolids': '{name} takes the solids',
  'rules.tookStripes': '{name} takes the stripes',
  'rules.potted': '{name} pots',
  'rules.pottedMany': '{name} pots {count}',
  'rules.foulTurnOver': 'Foul: {reason}',

  // -------------------------------------------------------------- 14.1
  'rules.rerack': 'The fourteen go back up',
  'rules.rerackFull': 'Table cleared: a full rack',
  'rules.solids': 'Solids',
  'rules.stripes': 'Stripes',
  'rules.open': 'Open',
  'rules.runOf': {
    one: 'Run of {count}',
    other: 'Run of {count}',
  },
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
  'setup.start': 'Start playing',

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
