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
  'title.kicker': 'Sala da biliardo',
  'title.wordmark': 'Biliardo',
  'title.dimension': 'Tre dimensioni',
  'title.enter': 'Tocca per entrare',

  // -------------------------------------------------------------------- menu
  'menu.subtitle': 'Tre dimensioni',
  'menu.newGame': 'Nuova partita',
  'menu.newGameSub': 'Partita libera oppure puzzle',
  'menu.continue': 'Continua',
  'menu.noSave': 'Nessuna partita salvata',
  'menu.options': 'Opzioni',
  'menu.stars': 'Stelle raccolte',
  'menu.savedFree': {
    one: 'Partita libera · {count} giocatore',
    other: 'Partita libera · {count} giocatori',
  },
  'menu.savedPuzzle': 'Puzzle · {name}',

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
  'newGame.puzzleSection': 'Puzzle',
  'newGame.puzzleBody':
    '{count} livelli con un numero limitato di colpi e un obiettivo preciso: imbucare certe palline, in un certo ordine, o in una certa buca. Meno colpi usi, più stelle prendi.',
  'newGame.chooseLevel': 'Scegli un livello',

  // ------------------------------------------------------------------ levels
  'levels.title': 'Livelli',
  'levels.subtitle': '{earned} di {total} stelle',
  'levels.locked': 'Prendi una stella nel livello precedente',
  'levels.budget': '{shots} colpi · {three} per tre stelle',

  // ----------------------------------------------------------------- options
  'options.title': 'Opzioni',
  'options.environment': 'Ambiente',
  'options.environmentAll': 'Tutti e {count} disponibili. Stelle raccolte: {earned} su {total}.',
  'options.environmentLocked': 'Servono {count} stelle per sbloccarlo',
  'options.cloth': 'Panno',
  'options.clothBody':
    'Il panno non è solo un colore: cambia attrito, scorrimento e resa delle sponde.',
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
  'options.audio': 'Audio',
  'options.haptics': 'Vibrazione',
  'options.hapticsBody': 'Un colpetto quando tiri, uno diverso quando imbuchi.',
  'options.collisionHaptics': 'Vibrazione sulle collisioni',
  'options.collisionHapticsBody':
    'Un tocco leggero a ogni contatto fra palline. Su uno spacco se ne sentono parecchi.',
  'options.mixerHint':
    'I volumi di musica ed effetti stanno sull’apparecchio nella stanza: in partita, tocca il giradischi (o la radio, o il jukebox) per aprirlo.',
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
  'options.resetProgress': 'Azzera i progressi puzzle',
  'options.resetProgressTitle': 'Azzerare i progressi?',
  'options.resetProgressBody':
    'Perderai tutte le stelle, i livelli sbloccati e gli ambienti sbloccati.',
  'options.resetProgressConfirm': 'Azzera',

  // -------------------------------------------------------------------- game
  'game.backToMenu': 'Torna al menu',
  'game.power': 'Potenza',
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
  'game.resetCamera': 'Reimposta la camera',
  'game.viewCue': 'Mira',
  'game.viewTable': 'Tavolo',
  'game.viewLabel': 'Vista {name}',
  'game.shotsLeft': {
    one: '{count} colpo',
    other: '{count} colpi',
  },

  // ------------------------------------------------------------ celebrations
  'celebration.potOne': 'Palla {number} in buca!',
  'celebration.potMany': '{count} palline!',
  'celebration.foul': 'Fallo',
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
  'result.solved': 'Risolto',
  'result.failed': 'Non ci siamo',
  'result.shotsUsed': '{used} su {total}',
  'result.nextLevel': 'Livello successivo',
  'result.replay': 'Rigioca',
  'result.retry': 'Riprova',
  'result.allLevels': 'Hai finito tutti i livelli: {count} stelle in totale.',

  // ------------------------------------------------------------------- rules
  'rules.player': 'Giocatore {number}',
  'rules.foulScratch': 'Bianca in buca',
  'rules.foulNoContact': 'Nessuna pallina colpita',
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

  // ------------------------------------------------------------ puzzle rules
  'puzzle.potted': 'Imbucata la {number}',
  'puzzle.pottedMany': 'Imbucate {count} palline',
  'puzzle.solvedIn': {
    one: 'Risolto in {count} colpo',
    other: 'Risolto in {count} colpi',
  },
  'puzzle.failed': 'Puzzle fallito',
  'puzzle.failForbidden': 'La {number} non doveva entrare',
  'puzzle.failWrongFirst': 'Dovevi colpire prima la {number}',
  'puzzle.failNoContact': 'Non hai colpito nessuna pallina',
  'puzzle.failOutOfOrder': 'Fuori ordine: toccava alla {number}',
  'puzzle.failWrongPocket': 'Buca sbagliata',
  'puzzle.failOutOfShots': 'Colpi esauriti',
  'puzzle.failOneCushion': 'Serve almeno una sponda prima di imbucare',
  'puzzle.failCushions': 'Servono almeno {count} sponde prima di imbucare',

  // ------------------------------------------------------------ puzzle goals
  'goal.pocketAll': 'Imbuca tutte le palline',
  'goal.pocketSet': 'Imbuca la {numbers}',
  'goal.pocketInOrder': 'Imbuca in ordine: {numbers}',
  'goal.pocketInto': 'Imbuca la {number} nella buca indicata',

  // ------------------------------------------------------------------- music
  'music.title': 'Giradischi',
  'music.playing': 'In riproduzione',
  'music.paused': 'In pausa',
  'music.changing': 'Cambio disco…',
  'music.musicVolume': 'Musica',
  'music.sfxVolume': 'Effetti',
  'music.onlyOne': 'Una sola traccia per ora. Aggiungine altre in assets/bgm/ e nel manifest.',
  'music.deviceHint': 'Tocca l’apparecchio nella stanza per cambiare musica',

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
  'level.primo-colpo': 'Primo colpo',
  'level.primo-colpoHint': 'La 3 è già in linea con la buca. Mira al centro e dai poca potenza.',
  'level.doppietta': 'Doppietta',
  'level.doppiettaHint':
    'Due palline, due angoli. La prima è servita, per la seconda pensa a dove lasci la bianca.',
  'level.in-ordine': 'Uno, due, tre',
  'level.in-ordineHint': 'Rispetta l’ordine: se ne entra una fuori sequenza il puzzle è perso.',
  'level.niente-nera': 'Niente nera',
  'level.niente-neraHint': 'Imbuca la 4 e la 5. Se cade la 8, hai perso.',
  'level.prima-la-5': 'Prima la 5',
  'level.prima-la-5Hint': 'La bianca deve toccare la 5 prima di ogni altra pallina.',
  'level.di-sponda': 'Di sponda',
  'level.di-spondaHint': 'Prima che una pallina entri, qualcosa deve aver toccato una sponda.',
  'level.buca-scelta': 'Buca scelta',
  'level.buca-sceltaHint': 'La 9 deve entrare nella buca centrale in alto. In un angolo non vale.',
  'level.ripulisci': 'Ripulisci il tavolo',
  'level.ripulisciHint': 'Cinque palline, sette colpi. Ogni pallina ha la sua buca: trovala.',
} as const satisfies Record<string, Entry>;
