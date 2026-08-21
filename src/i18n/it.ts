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

  // ----------------------------------------------------------------- loading
  'loading.title': 'Si prepara il tavolo',
  'loading.subtitle': 'Caricamento',

  // ---------------------------------------------------------------- trophies
  'trophy.title': 'Trofei',
  'trophy.subtitle': 'Traguardi',
  'trophy.tally': '{earned} di {total}',
  'trophy.locked': 'Bloccato',
  'trophy.secret': 'Trofeo nascosto',
  'trophy.secretHint': 'Scoprilo giocando',
  'trophy.unlocked': 'Trofeo sbloccato',
  'trophy.reset': 'Azzera i trofei',
  'trophy.resetBody': 'Cancella tutti i traguardi raggiunti. Non si torna indietro.',

  'trophy.groupProgress': 'Percorso',
  'trophy.groupSkill': 'Colpi',
  'trophy.groupMode': 'Le discipline',
  'trophy.groupFeat': 'Imprese',
  'trophy.groupSecret': 'Nascosti',

  'trophy.firstShot': 'Primo colpo',
  'trophy.firstShotHint': 'Gioca il tuo primo tiro',
  'trophy.firstPot': 'Prima buca',
  'trophy.firstPotHint': 'Manda in buca la tua prima pallina',
  'trophy.firstWin': 'Prima vittoria',
  'trophy.firstWinHint': 'Vinci una partita',
  'trophy.tenGames': 'Habitué',
  'trophy.tenGamesHint': 'Vinci dieci partite',
  'trophy.hundredPots': 'Cento buche',
  'trophy.hundredPotsHint': 'Manda in buca cento palline',

  'trophy.doublePot': 'Doppietta',
  'trophy.doublePotHint': 'Due palline in un solo colpo',
  'trophy.triplePot': 'Tripletta',
  'trophy.triplePotHint': 'Tre palline in un solo colpo',
  'trophy.cushionPot': 'Di sponda',
  'trophy.cushionPotHint': 'Vai a segno dopo aver toccato una sponda',
  'trophy.spinPot': 'Con effetto',
  'trophy.spinPotHint': 'Vai a segno con un forte effetto laterale',
  'trophy.breakPot': 'Spacco fortunato',
  'trophy.breakPotHint': 'Manda in buca sullo spacco',
  'trophy.runOfThree': 'Serie',
  'trophy.runOfThreeHint': 'Tre tiri di fila a segno',

  'trophy.cleanGame': 'Partita pulita',
  'trophy.cleanGameHint': 'Vinci senza commettere falli',
  'trophy.noScratch': 'Mai in buca',
  'trophy.noScratchHint': 'Vinci senza mandare in buca la bianca',
  'trophy.shutout': 'Cappotto',
  'trophy.shutoutHint': 'Vinci senza che nessun altro segni',

  'trophy.offTheTable': 'Fuori sede',
  'trophy.offTheTableHint': 'Hai buttato una pallina giù dal tavolo',
  'trophy.lightsOut': 'Si chiude',
  'trophy.lightsOutHint': 'Hai spento la luce della sala',
  'trophy.dj': 'Il disc jockey',
  'trophy.djHint': 'Hai cambiato musica dal giradischi',
  'trophy.grandTour': 'Giro delle sale',
  'trophy.grandTourHint': 'Hai giocato in tutte le sale',
  'trophy.collector': 'Collezionista',
  'trophy.collectorHint': 'Hai provato tutti i set di palline',
  'trophy.longRun': 'In serie aperta',
  'trophy.longRunHint': 'Sei tiri di fila a segno',

  'trophy.fiftyGames': 'Habitué',
  'trophy.fiftyGamesHint': 'Cinquanta partite finite',
  'trophy.thousandPots': 'Mille',
  'trophy.thousandPotsHint': 'Mille palline imbucate in tutto',
  'trophy.allDisciplines': 'Poliedrico',
  'trophy.allDisciplinesHint': 'Hai vinto almeno una partita in ogni modalità',
  'trophy.quadPot': 'Poker',
  'trophy.quadPotHint': 'Quattro palline con un solo tiro',
  'trophy.twoCushionPot': 'Due sponde',
  'trophy.twoCushionPotHint': 'La bianca tocca due sponde prima della buca',
  'trophy.drawPot': 'Di ritorno',
  'trophy.drawPotHint': 'Imbuchi con un colpo di ritiro',
  'trophy.bigBreak': 'Spaccata',
  'trophy.bigBreakHint': 'Tre palline sullo spacco',
  'trophy.runOfFive': 'Cinque di fila',
  'trophy.runOfFiveHint': 'Cinque tiri consecutivi a segno',
  'trophy.longPot': 'Da lontano',
  'trophy.longPotHint': 'Imbuchi colpendo una pallina a mezzo tavolo di distanza',
  'trophy.softTouch': 'Tocco leggero',
  'trophy.softTouchHint': 'Imbuchi con un tiro appena accennato',

  'trophy.eightFirstWin': 'Americana',
  'trophy.eightFirstWinHint': 'Vinci la tua prima americana',
  'trophy.eightOnTheBlack': 'Chiusa in nera',
  'trophy.eightOnTheBlackHint': 'Vinci imbucando la nera',
  'trophy.eightClearGroup': 'Gruppo finito',
  'trophy.eightClearGroupHint': 'Finisci il tuo gruppo e vai sulla nera',
  'trophy.eightTeamWin': 'In due',
  'trophy.eightTeamWinHint': 'Vinci un’americana a squadre',
  'trophy.eightOutnumbered': 'Uno contro due',
  'trophy.eightOutnumberedHint': 'Vinci da solo contro una coppia',
  'trophy.eightTenWins': 'Habitué del bar',
  'trophy.eightTenWinsHint': 'Dieci americane vinte',

  'trophy.calledFirstWin': 'Detto e fatto',
  'trophy.calledFirstWinHint': 'Vinci la tua prima americana dichiarata',
  'trophy.calledAsSaid': 'Uomo di parola',
  'trophy.calledAsSaidHint': 'Venticinque dichiarazioni rispettate',
  'trophy.calledRunOfThree': 'Tre su tre',
  'trophy.calledRunOfThreeHint': 'Tre dichiarate di fila',
  'trophy.calledBlack': 'La nera annunciata',
  'trophy.calledBlackHint': 'Chiudi dichiarando la buca della nera',
  'trophy.calledSidePocket': 'Buca centrale',
  'trophy.calledSidePocketHint': 'Dichiari e imbuchi in una buca centrale',

  'trophy.straightFirstWin': 'Continua',
  'trophy.straightFirstWinHint': 'Vinci il tuo primo 14.1',
  'trophy.straightRerack': 'Si ricomincia',
  'trophy.straightRerackHint': 'Arriva al castello rifatto',
  'trophy.straightAcrossRacks': 'Serie continua',
  'trophy.straightAcrossRacksHint': 'Una serie che sopravvive al nuovo castello',
  'trophy.straightRunOfEight': 'Otto in fila',
  'trophy.straightRunOfEightHint': 'Otto tiri consecutivi a segno nel 14.1',
  'trophy.straightHalfTarget': 'A metà strada',
  'trophy.straightHalfTargetHint': 'Arrivi a metà del punteggio obiettivo',

  'trophy.freeCleanSweep': 'Tavolo pulito',
  'trophy.freeCleanSweepHint': 'Vinci una partita libera senza falli né bianche in buca',
  'trophy.freeDoubleFigures': 'Doppia cifra',
  'trophy.freeDoubleFiguresHint': 'Vinci una partita libera con dieci punti o più',

  'trophy.beatEasy': 'Primo scalpo',
  'trophy.beatEasyHint': 'Batti una CPU facile',
  'trophy.beatMedium': 'Avversario serio',
  'trophy.beatMediumHint': 'Batti una CPU media',
  'trophy.beatHard': 'Il migliore del locale',
  'trophy.beatHardHint': 'Batti una CPU difficile',
  'trophy.beatHardTen': 'Nessuna pietà',
  'trophy.beatHardTenHint': 'Dieci vittorie contro una CPU difficile',
  'trophy.beatThreeCpus': 'Uno contro tutti',
  'trophy.beatThreeCpusHint': 'Vinci contro tre o più CPU insieme',
  'trophy.beatHardClean': 'Lezione',
  'trophy.beatHardCleanHint': 'Batti una CPU difficile senza commettere falli',

  'trophy.wireToWire': 'Sempre avanti',
  'trophy.wireToWireHint': 'Vinci senza essere mai stato superato',
  'trophy.comeback': 'Rimonta',
  'trophy.comebackHint': 'Vinci dopo essere stato sotto di cinque',

  'trophy.ownGoal': 'Autogol',
  'trophy.ownGoalHint': 'Hai imbucato la nera in anticipo',
  'trophy.bothEnds': 'I due capi',
  'trophy.bothEndsHint': 'Due palline nello stesso tiro, ai due estremi del tavolo',
  'trophy.namedYourself': 'Piacere mio',
  'trophy.namedYourselfHint': 'Hai dato un nome al giocatore',

  // ------------------------------------------------------------------- modes
  'mode.section': 'Scegli la partita',
  'mode.title': 'Come si gioca',
  'mode.solo': 'Da solo',
  'mode.soloBody': 'Il tavolo tutto per te, senza avversari',
  'mode.cpu': 'Contro il computer',
  'mode.cpuBody': 'Da uno a quattro avversari, ognuno con la sua bravura',
  'mode.human': 'Tra amici',
  'mode.humanBody': 'Più persone sullo stesso telefono, a turno',

  // -------------------------------------------------------------- discipline
  'discipline.title': 'Che partita',

  // ------------------------------------------------------------------ call
  'call.pickBall': 'Quale pallina',
  'game.callFirst': 'Dichiara',
  'call.pickPocket': 'La {number} in quale buca',
  'call.pocketCornerNw': 'Angolo in alto a sinistra',
  'call.pocketCornerNe': 'Angolo in alto a destra',
  'call.pocketCornerSw': 'Angolo in basso a sinistra',
  'call.pocketCornerSe': 'Angolo in basso a destra',
  'call.pocketSideN': 'Buca centrale destra',
  'call.pocketSideS': 'Buca centrale sinistra',
  'call.declared': '{number} → {pocket}',
  'discipline.free': 'Partita libera',
  'discipline.freeBody':
    'Tutte e quindici in gioco, un punto a pallina. Chi imbuca continua. Vince chi ha più punti quando il tavolo si svuota.',
  'discipline.eight': 'Americana',
  'discipline.eightBody':
    'Pieni contro mezze. Il primo che imbuca dopo lo spacco sceglie il gruppo; chi finisce il suo chiude con la nera. In quattro si gioca a squadre.',
  'discipline.eightCalled': 'Americana dichiarata',
  'discipline.eightCalledBody':
    'Come l’americana, ma prima di ogni tiro devi dire quale pallina e in quale buca. Se entra altrove non conta.',
  'discipline.straight': '14.1 continua',
  'discipline.straightBody':
    'Ogni pallina vale un punto, sempre dichiarata, fino a 25. Quando ne resta una si rifanno le altre quattordici e la serie continua.',

  'difficulty.title': 'Chi gioca',
  'difficulty.easy': 'Facile',
  'difficulty.medium': 'Medio',
  'difficulty.hard': 'Difficile',
  'difficulty.cpuName': 'Computer {number}',
  'difficulty.roleCpu': 'Computer',
  'difficulty.roleYou': 'Tu',
  'difficulty.rolePlayer': 'Giocatore {number}',

  // -------------------------------------------------------------------- name
  'name.askTitle': 'Come ti chiami?',
  'name.askBody': 'Serve solo per il tabellone. Puoi cambiarlo dalle opzioni.',
  'name.placeholder': 'Il tuo nome',
  'name.confirm': 'Piacere',
  'name.skip': 'Più tardi',
  'name.change': 'Il tuo nome',
  'name.changeBody': 'Come vieni chiamato nel tabellone e nel saluto.',
  'name.fallback': 'Giocatore',

  'greeting.welcome': 'Bentornato!',

  // -------------------------------------------------------------------- menu
  'menu.subtitle': 'Pool Hall',
  'menu.newGame': 'Nuova partita',
  'menu.newGameSub': 'Partita libera oppure puzzle',
  'menu.continue': 'Continua',
  'menu.noSave': 'Nessuna partita salvata',
  'menu.lightSwitch': 'Luce della sala',
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
  'newGame.opponents': 'Avversari',
  'newGame.players': 'Giocatori',
  'newGame.cpuHint': {
    one: 'Un avversario controllato dal computer.',
    other: '{count} avversari controllati dal computer.',
  },
  'newGame.humanHint': {
    one: 'Un avversario, a turno sullo stesso dispositivo.',
    other: '{count} avversari, a turno sullo stesso dispositivo.',
  },
  'newGame.nextDifficulty': 'Scegli gli avversari',
  'newGame.nextSeats': 'Chi gioca',
  'newGame.next': 'Allestisci il tavolo',


  // ----------------------------------------------------------------- options
  'options.title': 'Opzioni',
  'options.aimHelpers': 'Aiuti di mira',
  'options.aimLine': 'Linea di mira',
  'options.aimLineBody': 'Mostra dove arriva la bianca prima di toccare qualcosa.',
  'options.ghostBall': 'Pallina fantasma',
  'options.ghostBallBody': 'Aggiunge il punto d’impatto e la direzione della pallina colpita.',
  'options.motionTrail': 'Scia',
  'options.motionTrailBody': 'Le palline veloci lasciano una breve scia del loro colore.',
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
  'options.you': 'Tu e il tuo telefono',
  'options.play': 'Come si gioca',
  'options.languageAuto': 'Auto',
  'options.languageBody': 'Automatica segue la lingua del telefono.',
  'options.resetSettings': 'Ripristina le opzioni',
  'options.resetSettingsBody': 'Tutte le opzioni tornano come erano all’inizio.',
  'options.resetSettingsConfirm': 'Ripristina',
  'options.clearSave': 'Cancella la partita salvata',
  'options.cleared': 'Cancellata',
  'options.resetSection': 'Reset',
  'options.resetShort': 'Impostazioni',
  'options.clearSaveShort': 'Partita',
  'options.resetTrophiesShort': 'Trofei',
  'options.version': 'Versione {version}',
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
  'result.frameOver': 'Partita finita',
  'result.winners': 'Vincono {names}',
  'result.won': 'Vince',
  'result.lost': 'Perde',
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

  // ------------------------------------------------------------- 8-ball
  'rules.foulEightFirst': 'Hai colpito la nera per prima',
  'rules.foulWrongGroup': 'Hai colpito una pallina avversaria per prima',
  'rules.eightWon': '{name} chiude con la nera',
  'rules.eightLost': '{name} imbuca la nera in anticipo',
  'rules.tookSolids': '{name} prende i pieni',
  'rules.tookStripes': '{name} prende le mezze',
  'rules.potted': '{name} imbuca',
  'rules.pottedMany': '{name} imbuca {count} palline',
  'rules.foulTurnOver': 'Fallo: {reason}',

  // -------------------------------------------------------------- 14.1
  'rules.rerack': 'Si rifanno le quattordici',
  'rules.rerackFull': 'Tavolo vuoto: castello completo',
  'rules.solids': 'Pieni',
  'rules.stripes': 'Mezze',
  'rules.open': 'Aperto',
  'rules.runOf': {
    one: 'Serie di {count}',
    other: 'Serie di {count}',
  },
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
  'setup.start': 'Inizia a giocare',

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
