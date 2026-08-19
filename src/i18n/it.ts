/**
 * Italian catalogue — the source of truth.
 *
 * `MessageKey` is derived from this object, so every other language is checked
 * against it at compile time. Add a key here first.
 *
 * Keys are grouped by where they appear rather than by meaning: when a screen
 * changes, everything it says is in one place.
 */

import type { Entry } from './catalogue';

export const it = {
  // ------------------------------------------------------------------ common
  'common.back': 'Indietro',
  'common.close': 'Chiudi',
  'common.cancel': 'Annulla',
  'common.checking': 'Controllo…',
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
  'title.enter': 'Tocca per entrare',

  // -------------------------------------------------------------------- menu
  'menu.subtitle': 'Pool Hall',
  'menu.newGame': 'Nuova partita',
  'menu.newGameSub': 'Partita libera oppure puzzle',
  'menu.continue': 'Continua',
  'menu.noSave': 'Nessuna partita salvata',
  'menu.options': 'Opzioni',
  'menu.savedFree': {
    one: 'Partita libera · {count} giocatore',
    other: 'Partita libera · {count} giocatori',
  },

  // ---------------------------------------------------------------- new game
  'newGame.title': 'Nuova partita',
  'newGame.subtitle': 'Due modi di giocare',
  'newGame.freeSection': 'Partita libera',
  'newGame.freeBody':
    'Castello completo, 15 palline. Un punto per pallina imbucata, e chi imbuca continua a tirare. Bianca in buca o nessuna pallina colpita costa un punto e passa il turno.',
  'newGame.players': 'Giocatori',
  'newGame.soloHint': 'Con un solo giocatore è una sfida al punteggio.',
  'newGame.multiHint': '{count} giocatori a turno sullo stesso dispositivo.',
  'newGame.startFree': 'Inizia partita libera',


  // ----------------------------------------------------------------- options
  'options.title': 'Opzioni',
  'options.aimHelpers': 'Aiuti di mira',
  'options.aimLine': 'Linea di mira',
  'options.aimLineBody': 'Mostra dove arriva la bianca prima di toccare qualcosa.',
  'options.ghostBall': 'Pallina fantasma',
  'options.ghostBallBody': 'Aggiunge il punto d’impatto e la direzione della pallina colpita.',
  'options.sensitivity': 'Sensibilità della mira',
  'options.sensitivityBody':
    'Quanto ruota il tiro per ogni trascinamento. In vista mira il trascinamento verticale alza e abbassa l’occhio, e la pizzicata lo avvicina alla bianca.',
  'options.sensitivitySlow': 'Lenta',
  'options.sensitivityMedium': 'Media',
  'options.sensitivityFast': 'Rapida',
  // ------------------------------------------------------------------ grafica
  'quality.section': 'Grafica',
  'quality.low': 'Bassa',
  'quality.lowFeel': '30 fps stabili. Una lampada, niente riflessi.',
  'quality.medium': 'Media',
  'quality.mediumFeel': '60 fps. Due lampade e riflessi, senza il velo del panno.',
  'quality.high': 'Alta',
  'quality.highFeel': '60 fps. Tutte le luci, riflessi e panno con la sua peluria.',

  'options.audio': 'Audio',
  'options.haptics': 'Vibrazione',
  'options.hapticsBody': 'Un colpetto quando tiri, uno diverso quando imbuchi.',
  'options.collisionHaptics': 'Vibrazione sulle collisioni',
  'options.collisionHapticsBody':
    'Un tocco leggero a ogni contatto fra palline. Su uno spacco se ne sentono parecchi.',
  'options.language': 'Lingua',
  'options.languageAuto': 'Automatica',
  'options.languageBody': 'Automatica segue la lingua del telefono.',
  'options.data': 'Dati',
  'options.resetSettings': 'Ripristina le opzioni',
  'options.clearSave': 'Cancella la partita salvata',
  'options.cleared': 'Cancellata',
  'options.clearSaveTitle': 'Cancellare la partita salvata?',
  'options.clearSaveBody': 'La partita in corso non sarà più recuperabile.',
  'options.clearSaveConfirm': 'Cancella',

  // -------------------------------------------------------------------- game
  'game.backToMenu': 'Torna al menu',
  'game.aim': 'mira',
  'game.aimStrip': 'Trascina per ruotare la stecca, tieni ai bordi per continuare',
  'game.aimLeft': 'Ruota la mira a sinistra',
  'game.aimRight': 'Ruota la mira a destra',
  'game.shoot': 'TIRA',
  'game.goAim': 'MIRA',
  'game.shootBlocked': 'Dall’alto puoi solo guardare: torna in mira per tirare',
  'game.shootLabel': 'Tira',
  'game.goAimLabel': 'Torna in vista mira per tirare',
  'game.spin': 'effetto',
  'game.spinLabel': 'Punto di impatto sulla bianca',
  'game.switchView': 'Cambia vista',
  'game.resetCamera': 'Tieni premuto per reimpostare la camera',

  // ------------------------------------------------------------ celebrations
  'celebration.potOne': 'Palla {number} in buca!',
  'celebration.potMany': '{count} palline!',
  'celebration.foul': 'Fallo',
  'celebration.penalty': {
    one: '−{count} punto',
    other: '−{count} punti',
  },
  'celebration.skipReplay': 'Salta il replay',
  'celebration.replayHint': 'Replay · tocca per saltare',

  // ----------------------------------------------------------------- results
  'result.winner': 'Vince {name}',
  'result.draw': 'Pareggio',
  'result.points': {
    one: '{count} punto',
    other: '{count} punti',
  },
  'result.newGame': 'Nuova partita',

  // ------------------------------------------------------------------- rules
  'rules.player': 'Giocatore {number}',
  'rules.foulScratch': 'Bianca in buca',
  'rules.foulNoContact': 'Nessuna pallina colpita',
  'rules.foulNoRail': 'Nessuna pallina in buca né a sponda',
  'rules.foulOffTable': 'Pallina fuori dal tavolo',
  'rules.foulOffTableMany': '{count} palline fuori dal tavolo',
  'rules.gained': {
    one: '{name}: +{count} punto',
    other: '{name}: +{count} punti',
  },
  'rules.gainedMany': '{name}: +{points} punti ({balls} palline)',
  'rules.foulPenalty': 'Fallo: {reason} (−{count})',
  'rules.turnTo': 'Turno a {name}',
  'rules.keepShooting': 'Continui tu',
  'rules.winsWith': 'Vince {name} con {count} punti',
  'rules.drawAt': 'Pareggio a {count} punti',
  'rules.resumed': 'Partita ripresa',



  // ------------------------------------------------------------------- music
  'music.title': 'Giradischi',
  'music.playing': 'In riproduzione',
  'music.paused': 'In pausa',
  'music.changing': 'Cambio disco…',
  'music.musicVolume': 'Musica',
  'music.sfxVolume': 'Effetti',
  'music.onlyOne': 'Una sola traccia per ora. Aggiungine altre in assets/bgm/ e nel manifest.',

  // --------------------------------------------------------- set di palline
  'ballSet.classic': 'Classiche',
  'ballSet.classicFeel': 'Resina fenolica lucida. Il riferimento.',
  'ballSet.night': 'Notte',
  'ballSet.nightFeel': 'Colori accesi e lucidatura estrema: riflettono forte.',
  'ballSet.ivory': 'Avorio',
  'ballSet.ivoryFeel': 'Argilla d’epoca, quasi opaca. Luce morbida, poca stanza riflessa.',
  'ballSet.solid': 'Tinta unita',
  'ballSet.solidFeel': 'Niente righe: riconosci le palline solo dal colore.',

  // ---------------------------------------------------------------- allestimento
  'setup.title': 'Allestimento',
  'setup.subtitle': 'Prepara il tavolo',
  'setup.place': 'Sala',
  'setup.cloth': 'Panno',
  'setup.balls': 'Palline',
  'setup.start': 'Inizia',

  // ------------------------------------------------------------------- cloth
  'cloth.verde': 'Verde',
  'cloth.verdeFeel': 'Standard. Il riferimento con cui è tarato tutto il resto.',
  'cloth.blu': 'Blu',
  'cloth.bluFeel': 'Veloce e vivo: le palline corrono di più e le sponde restituiscono meglio.',
  'cloth.bordeaux': 'Bordeaux',
  'cloth.bordeauxFeel': 'Pesante e lento, sponde smorzate. Perdona meno la potenza di troppo.',
  'cloth.grafite': 'Grafite',
  'cloth.grafiteFeel': 'Ruvido: mordente alto, l’effetto attacca molto di più.',

  // --------------------------------------------------------------- locations
  'location.sala': 'Sala biliardo',
  'location.salaBody': 'Legno, hi-fi a scaffale, giradischi, piante e neon alla parete.',
  'location.garage': 'Garage',
  'location.garageBody': 'Cemento, neon freddo, casse per terra, stecche e scaffali metallici.',
  'location.arcade': 'Sala giochi',
  'location.arcadeBody': 'Cabinati che sputano luce colorata, moquette scura e neon a raffica.',
  'location.terrazza': 'Terrazza notturna',
  'location.terrazzaBody':
    'All’aperto sotto la luna, lampade appese, piante in vaso e la città lontana.',
  'location.studio': 'Studio',
  'location.studioBody': 'Neutro, luminoso e vuoto: la scelta giusta per vedere bene la fisica.',

  // ----------------------------------------------------------- music devices
  'device.turntable': 'Giradischi',
  'device.radioWork': 'Radio da lavoro',
  'device.jukebox': 'Jukebox',
  'device.boombox': 'Boombox',
  'device.monitor': 'Monitor da studio',

  // ------------------------------------------------------------- level names
} as const satisfies Record<string, Entry>;
