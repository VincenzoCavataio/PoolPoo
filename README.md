# Biliardo 3D

Gioco di biliardo 3D per iOS e Android, costruito con Expo, expo-router, three.js
(via `@react-three/fiber`) e un solver di fisica scritto su misura.

## Perché SDK 54 e non l'ultima

**Il progetto è volutamente fermo a Expo SDK 54: non aggiornarlo senza motivo.**

Expo Go, l'app che permette di provare il gioco scansionando un QR code, sull'App
Store supporta SDK 54 (`expoGoSdkVersion: 54.0.0` in
`https://api.expo.dev/v2/versions/latest`). Un progetto su SDK 55 o superiore
rifiuta di aprirsi in Expo Go con *"Project is incompatible with this version of
Expo Go"*, e l'alternativa — un development build su iPhone fisico — richiede un
account Apple Developer a pagamento.

Il progetto nacque su SDK 57 e fu riportato a 54 per questo. Se in futuro Expo Go
supporterà un SDK più recente, l'aggiornamento è indolore: il codice del gioco non
tocca superfici specifiche dell'SDK, e l'unico vincolo esterno è che
`@react-three/fiber` 9 vuole `react >=19 <19.3` e `react-native >=0.78`.

## Comandi

```bash
npm start          # avvia il dev server Expo
npm run android    # apre su Android
npm run ios        # apre su iOS
npm test           # test fisica + regole (girano in Node, senza device)
npm run typecheck  # tsc --noEmit
npm run lint
```

## L'idea architetturale

**Fisica e regole sono TypeScript puro: non importano né three.js né React.** Il
rendering legge lo stato del mondo, non lo possiede.

Questo non è purismo, paga in quattro modi concreti:

| Conseguenza | Perché conta |
|---|---|
| Testabile in Node | Il tiro d'apertura si verifica con `npm test`, non a occhio su un telefono |
| Deterministico | I puzzle sono riproducibili; replay e undo diventano quasi gratis |
| Salvataggio = `JSON.stringify` | Il "continua" del menu è la serializzazione dello stato, niente altro |
| Rendering sostituibile | Se expo-gl sta stretto, si cambia il layer 3D senza toccare il gioco |

```
src/
├── game/
│   ├── core/          ← ZERO dipendenze. Il cuore.
│   │   ├── vec.ts         matematica 2D
│   │   ├── constants.ts   tutte le costanti fisiche, in unità SI
│   │   ├── table.ts       sponde come segmenti, buche come cerchi
│   │   ├── ball.ts        stato pallina (dati puri, nessun metodo)
│   │   ├── events.ts      log eventi del tiro + query per le regole
│   │   ├── world.ts       il solver
│   │   └── predict.ts     previsione analitica per la linea di mira
│   ├── rules/         ← anch'esse pure: leggono il log eventi, mai il mondo
│   │   ├── free.ts        partita libera a punteggio, 1–4 giocatori
│   │   ├── puzzle.ts      obiettivi e vincoli come dati
│   │   └── levels.ts      gli 8 livelli
│   ├── render/        ← qui e solo qui vive three.js
│   │   ├── coords.ts      l'unico posto dove sim → scena
│   │   ├── camera.ts      stato del rig (mutabile, fuori da React)
│   │   ├── locations.ts   ambienti e luci, come dati
│   │   ├── environment.tsx stanza, pavimento, lampade
│   │   ├── table-mesh.tsx tavolo, buche vere, mattonelle
│   │   ├── balls.tsx      due draw call per 16 palline
│   │   └── scene.tsx      camera, fog, loop della fisica
│   └── input/
│       └── gestures.ts    un dito mira, due orbitano, pinch zooma
├── store/             ← zustand: sessione, opzioni, progressi
├── components/        ← UI React Native
└── app/               ← rotte expo-router
```

## Il solver

Simulazione **2D** sul piano del panno, rendering 3D: è l'approccio standard del
biliardo ed è corretto finché le palline non lasciano il tavolo (nessun massé,
nessun jump shot).

Ogni pallina porta una **velocità angolare completa**: `w.x` e `w.y` sono gli assi
di rotolamento, `w.z` è l'effetto laterale.

Una pallina appena colpita **striscia**: il suo punto di contatto si muove sul
panno, e lì agisce l'attrito cinetico, che le toglie velocità e la mette in
rotazione finché non rotola senza strisciare. Da questo unico meccanismo esce
quasi tutta la sensazione di gioco:

- colpita al centro perde **esattamente due settimi** della velocità prima di
  mettersi a rotolare;
- colpita in alto **prosegue** dopo l'impatto (seguito);
- colpita in basso **si ferma e torna indietro** (arretro).

Nessuno di questi casi è programmato a parte: cadono fuori dalla fase di
strisciamento. Il punto d'impatto della stecca a distanza `a` dal centro produce
`5v/(2R²)·a` di rotazione, ed è il motivo per cui un colpo a `0.4R` sopra il
centro — e nessun'altra altezza — fa partire la pallina già in rotolamento.

I test lo misurano invece di darlo per scontato: arretro −0.23 m, stun +0.08 m,
seguito +0.39 m dallo stesso punto di contatto.

Per ogni sub-step:

1. **Attrito di Coulomb**, non damping lineare: decelerazione costante, così le
   palline si fermano davvero invece di strisciare all'infinito con velocità
   asintotica. La distanza a due fasi misurata sta all'1% dalla teoria, e un
   colpo al punto di rotolamento naturale allo 0.4%.
2. **Urto sfera-sfera**: masse uguali, impulso `j = −(1+e)·vₙ/2` lungo la
   congiungente dei centri, applicato solo se le palline si avvicinano.
3. **Sponde**: riflessione della normale con restituzione, attrito tangenziale.
   Le sponde sono *segmenti*, quindi le bocche delle buche esistono da sole e le
   estremità fanno da mascelle.
4. **Anti-tunneling**: sub-step adattivi, tarati perché nessuna pallina percorra
   più di mezzo raggio per sub-step. Senza, una pallina a velocità di spacco
   attraverserebbe un'altra in un singolo tick.

**Il determinismo è un requisito, non un effetto collaterale.** `step()` avanza
solo di tick interi da `PHYSICS.fixedDt`, l'ordine di iterazione è fisso e non si
legge mai un orologio né un numero casuale. Il renderer usa un accumulatore: il
timing dei frame cambia *quando* la fisica gira, mai cosa calcola.

## Le due modalità

**Libera** — 1 a 4 giocatori. Un punto per pallina, chi imbuca continua. Bianca
in buca o nessuna pallina colpita: fallo, −1 punto, turno all'avversario. Con un
solo giocatore diventa una sfida al punteggio, senza codice separato.

**Puzzle** — 8 livelli. Un obiettivo (`pocket-all`, `pocket-set`,
`pocket-in-order`, `pocket-into`) più vincoli (`no-cue-pocket`,
`must-hit-first`, `forbid-pocket`, `cushions-before-pot`), tutti valutati sul log
eventi. Aggiungere "imbuca la 5 di sponda senza toccare la 8" è una voce in
`levels.ts`, non un ramo nel game loop.

## Camera e ambiente

**La camera è guidata dal gioco, non da un menu.** Mirare ti mette dietro la
bianca in prima persona; tirare ti solleva in alto a guardare il colpo; quando le
palline si fermano torni giù dietro la stecca. Le due viste esistono, ma chi le
sceglie di norma è la partita.

Mentre miri puoi salire in vista Tavolo per studiare il tavolo, ma **da lassù non
si tira**: il pulsante diventa «MIRA» e ti riporta dietro la bianca. Si allinea un
colpo da dietro la stecca, non dal soffitto.

Non c'è più nessun selettore di cosa muove il dito, perché **è la vista a
deciderlo**:

| | Vista Mira (prima persona) | Vista Tavolo |
|---|---|---|
| Trascina in orizzontale | ruota il tiro | orbita |
| Trascina in verticale | alza e abbassa l'occhio | inclina |
| Pizzica | avvicina l'occhio alla bianca | avvicina la camera |

In prima persona i due assi non litigano mai perché la mira legge solo il
movimento orizzontale.

C'è anche una **striscia di mira** nel pannello di tiro, a un terzo della
sensibilità: si trascina per ruotare la stecca. Serve perché in prima persona la
camera è agganciata alla linea di tiro, quindi girare la mira fa ruotare tutto il
mondo e **non c'è niente che si muova sotto il dito** — la striscia dà una cosa
ferma contro cui spingere, ed è il controllo giusto quando serve mezzo grado
invece di dieci. Per lo stesso motivo la stecca in prima persona non è più
nascosta ma accorciata quanto basta a fermarsi prima dell'occhio: senza, non c'è
nessun riferimento visivo che ruoti quando miri.

Sono cadute due soluzioni precedenti, per motivi che vale la pena ricordare.
«Un dito mira, due dita orbitano» era inservibile: il secondo dito non appoggia
mai nello stesso frame del primo, quindi ogni orbita cominciava con uno scatto
della linea di tiro, e trascinamento a due dita e pizzicata si contendono lo
stesso movimento. Il selettore esplicito «Mira/Camera» che l'aveva sostituito
funzionava, ma era un interruttore in più da gestire per una cosa che il gioco sa
già.

## Il replay

Quando una pallina entra, il gioco **rigioca il colpo al rallentatore** con la
camera appoggiata alla buca, poi torna alla mira.

Non viene registrato nulla, frame per frame o altro: **il colpo viene
semplicemente rigiocato**. Si serializza il mondo prima del tiro, e a colpo finito
si ricostruisce un secondo mondo da quello snapshot, gli si dà lo stesso angolo e
la stessa potenza, lo si manda avanti *senza disegnare* fino a settecento
millesimi prima che la palla cada, e da lì lo si fa girare a quattro decimi di
velocità. È il motivo per cui il determinismo era un requisito e non un vezzo: un
solver che non ripete esattamente lo stesso colpo non può fare niente di tutto
questo.

Il mondo vero resta intatto nel suo stato finale sotto il replay, quindi quando
il replay finisce non c'è niente da ripristinare.

Lo stato del rig vive in `camera.ts` come **stato mutabile di modulo**, non in
React, per la stessa ragione dell'accumulatore della fisica: cambia a ogni frame
e a ogni movimento del dito, e nessun componente deve ri-renderizzarsi per
questo. La camera interpola verso la posizione desiderata con
`alpha = 1 − e^(−k·dt)`, che è indipendente dal frame rate.

Gli ambienti (`locations.ts`) sono **cinque e sono dati puri**. Pavimento, pareti,
nebbia, colore di sfondo, lampade e arredo sono tutti campi di un oggetto, quindi
l'intero look del gioco si tara da un solo file senza toccare un componente.

| Ambiente | Stelle |
|---|---|
| Sala biliardo | libero |
| Garage | 4 |
| Sala giochi | 9 |
| Terrazza notturna | 15 |
| Studio | 21 |

`effectiveLocation` fa da rete: se i progressi vengono azzerati mentre sei in un
ambiente che non hai più, il gioco ricade sul primo invece di renderizzare una
stanza a cui non hai diritto.

L'arredo (`props.tsx`) è scaffalatura con impianto hi-fi a separati, TV a tubo
catodico, vinili, cassette, casse a pavimento, neon, rastrelliera per le stecche,
quadro e sgabelli. Sono circa **ottanta scatole e cilindri disegnati in una
decina di draw call**: non si muovono mai, quindi vengono dichiarati come dati e
poi **fusi per materiale** in una geometria ciascuno. Ottanta `<mesh>` sarebbero
ottanta draw call sul bridge di expo-gl, ed è esattamente il prezzo che questo
progetto non può pagare per la scenografia. La fusione è scritta a mano invece di
importare `three/addons`: deve gestire solo posizione e normale, e `toNonIndexed`
rende la concatenazione banale.

**I lampadari svaniscono man mano che la camera sale verso di loro.** Appesi a un
metro e mezzo sul panno finivano esattamente tra il giocatore e il tavolo nella
vista dall'alto. La luce non cambia mai — sfumano solo paralume, cavo e lampadina,
che si guadagnano il posto solo da un'inquadratura bassa.

## Audio

**La musica appartiene alla stanza, non al gioco.** In ogni location c'è un
apparecchio coerente con l'ambiente — giradischi in sala, radio in garage,
jukebox in sala giochi, boombox in terrazza — e la musica parte entrando in
partita e si ferma uscendo, perché è quell'oggetto che sta suonando.

Inquadrandolo compare un fumetto con una nota; toccandolo si apre il cambia-disco.
Il disco gira mentre suona ed esce dal centro del pannello quando cambi traccia,
sullo stesso orologio del giradischi 3D: entrambi leggono `changing` dallo stesso
store, quindi il disco sullo schermo e quello sul mobile si scambiano insieme.

Due scelte che vale la pena conoscere:

- **L'apparecchio è l'unico prop fuori dalla fusione statica.** Tutto il resto
  dell'arredo è fuso per materiale perché non si muove mai; questo deve essere
  toccabile, girare e animarsi, quindi costa qualche draw call e se le merita.
- **Il tocco non passa da un raycaster.** Il canvas è già avvolto da un gesture
  detector e i due si contenderebbero lo stesso tocco. L'apparecchio proietta da
  sé la propria posizione sullo schermo a ogni frame, e il gesto misura la
  distanza in pixel.

Aggiungere una traccia costa un file in `assets/bgm/` e una riga in
`src/game/audio/tracks.ts`. Non si può fare altrimenti: React Native risolve
`require` a build time da un percorso letterale, quindi le tracce non si possono
scoprire scansionando una cartella.

### Gli effetti sono sintetizzati

Non ci sono librerie di campioni in questo progetto e niente con cui registrare,
quindi gli impatti sono costruiti da zero in `synth.ts`: una pallina colpita è
una brevissima raffica di rumore più un paio di parziali che risuonano, la sponda
è la stessa idea un'ottava sotto e molto più smorzata, la buca è un sonaglio
seguito da un tonfo. `npm run sfx:build` li riscrive nei WAV.

Sono **segnaposto onesti**: leggeranno come suoni da biliardo e pesano un
centinaio di kilobyte in tutto, ma non sono registrazioni e si sostituiscono
lasciando cadere dei file veri sopra quelli generati.

Il volume esce dal log eventi del solver, che porta già la velocità d'impatto su
ogni contatto: per questo una sicura sussurra e uno spacco spacca. Il rumore
viene da un generatore con seme, non da `Math.random`, così ogni build produce
byte identici e i test hanno senso.

## I test

45 test, tutti in Node:

```
npm run test:core    23 test: attrito, effetto, urti, sponde, buche, determinismo, mira
npm run test:rules   28 test: punteggio, obiettivi, e la risolvibilità dei livelli
npm run test:render   9 test: l'atlante dei numeri sulle palline
npm run test:audio    7 test: gli effetti sonori sintetizzati
```

Il **panno è una scelta fisica**, non un colore: verde standard, blu veloce con
sponde vive, bordeaux pesante con sponde smorzate, grafite ruvido dove l'effetto
attacca molto di più. Ogni tavolo viene costruito con il profilo del panno scelto.

Due meritano una nota:

- **Previsione contro solver**: `predict.ts` calcola analiticamente cosa colpirà
  la bianca; il test spara davvero e verifica che il solver sia d'accordo, su un
  ventaglio di 25 angoli. Se i due modelli divergono, il test lo dice.
- **Font delle palline**: i numeri sono rasterizzati in JS, quindi il test conta
  i pixel — celle che sconfinano, glifi identici, inchiostro sul bordo dove
  finirebbe sulla curva del badge, cifre fuori centro, e che il campo sia
  davvero un distance field e non sia regredito a bitmap dal bordo netto.
- **Risolvibilità dei livelli**: un solver a forza bruta cerca una soluzione per
  ogni livello entro il budget di colpi, poi la *rigioca* per confermarla. Un
  puzzle impossibile è il bug che il playtesting scopre più lentamente e più
  costosamente, quindi viene verificato meccanicamente.

## Scelte tecniche da sapere

- **Fisica su misura invece di un motore.** `@react-three/rapier` è WebAssembly e
  Hermes non supporta WASM: su nativo non parte. `@react-three/cannon` usa un Web
  Worker, che in React Native non esiste. Restava `cannon-es` diretto, ma i motori
  generici fanno tremare le palline a riposo e sono difficili da tarare, mentre il
  biliardo è un caso analitico noto.
- **Mai `setState` per frame.** La simulazione scrive nelle matrici di un
  `InstancedMesh` tramite ref dentro `useFrame`. React sente parlare di un tiro
  solo quando si ferma.
- **Due draw call per 16 palline, numeri compresi.** Un `InstancedMesh` per le
  palline, uno per le ombre di contatto. Righe, badge bianco e numero vengono da
  una patch al materiale standard: un attributo per istanza più la latitudine del
  vertice, non 16 texture, che avrebbero significato 16 materiali e 16 draw call.
- **I numeri sono un font vettoriale generato a runtime.** React Native non ha
  `canvas`, quindi non c'è niente in cui disegnare del testo né un font con cui
  disegnarlo. Invece di 16 PNG da caricare, `ball-numbers.ts` descrive le cifre
  come **contorni vettoriali** — tratti fatti di rette e archi appiattiti — e li
  rasterizza in un **signed distance field**, non in pixel.

  La distinzione è tutto il punto: un glifo bitmap ingrandito sul badge di una
  pallina mostra i propri pixel, mentre un distance field memorizza quanto dista
  ogni texel dal bordo del tratto, così lo shader ricostruisce un bordo pulito a
  qualunque dimensione con un solo `smoothstep`.

  Ogni cifra avanza secondo **la propria larghezza**, non secondo una scatola
  condivisa: un 1 è molto più stretto di un 5, e centrare la scatola invece
  dell'inchiostro lo lascia visibilmente spostato su un badge, che è un cerchio,
  dove essere fuori centro si vede. Se ne è accorto un test, non un occhio.

## Materiali e luce

Un materiale fisico ha bisogno di **qualcosa da riflettere**, altrimenti il metallo
diventa nero, una pallina laccata mostra solo due puntini speculari e la scena
sembra di plastica. La soluzione consueta è una HDRI, cioè un megabyte di
immagine da spedire.

`environment-map.ts` invece **dipinge un ambiente equirettangolare dai colori
della stanza stessa** — bagliore del soffitto, tono delle pareti, tono del
pavimento, più un punto caldo per lampada — e lo prefiltra. Il risultato è che le
palline riflettono davvero il locale in cui stanno: legno caldo in sala, neon
freddo in garage, viola nella sala giochi.

Il prefiltro fa render-to-texture, che non tutti i contesti GL mobili
supportano: viene **tentato, non dato per scontato**. Se fallisce, la scena resta
con le sue luci e perde solo i riflessi.

Sopra a questo:

- **Palline**: `clearcoat`, che è letteralmente la vernice lucida di una pallina
  da biliardo — un secondo strato speculare molto più nitido sopra il colore.
- **Panno**: `sheen`. La stoffa da biliardo è un tappeto di fibre corte che prende
  luce di striscio; senza quel bordo luminoso il piano è verde piatto dipinto.
  Stesso trattamento per tappeto, foglie e imbottiture.
- **Sponde e legni**: clearcoat da vernice, così le lampade lasciano un riflesso
  lungo il bordo invece di una macchia opaca.
- **Metalli**: `metalness` 0.95 vero, che ha senso solo grazie all'ambiente.
- **Tone mapping filmico** invece del taglio netto: una luce puntiforme vicina a
  una pallina lucida sfonderebbe il bianco, e i riflessi diventerebbero dischi
  piatti.
- **Niente shadow map.** Sul bridge WebGL di expo-gl un pass di ombre costa più di
  quel che rende; le palline hanno ombre di contatto finte e molto più economiche.
- **La geometria delle sponde è generata dai segmenti del solver**, così ciò che
  si vede e ciò che la fisica crede non possono divergere.
- **Le buche sono fori veri**, non dischi neri dipinti sul panno: il panno è una
  `ShapeGeometry` con sei buchi circolari, ritagliati ai raggi di cattura che usa
  il solver. I dischi dipinti funzionavano dall'alto ma si tradivano appena la
  camera scendeva all'altezza della stecca, cosa che ora può fare. Le sponde
  scendono fino al corpo del tavolo per chiudere la cavità che i fori aprono.
- **L'interno delle buche è non illuminato, di proposito.** Con materiali
  standard e le lampade a piombo, l'interno di ogni tubo veniva illuminato come
  un cilindro lucido e le buche sembravano oggetti appiccicati al tavolo invece
  che aperture. `MeshBasicMaterial` scuro, `BackSide` (si vede solo da dentro) e
  un anello scuro sul panno che dà un bordo alla bocca.
- **La HUD detta l'inquadratura.** Ogni pannello misura la propria altezza con
  `onLayout` e la comunica al rig, che usa `setViewOffset` per inquadrare il
  tavolo nella fascia libera invece che nell'intero viewport. Prima il pannello
  di tiro copriva le buche vicine; ora una HUD più alta rimpicciolisce il tavolo
  invece di nasconderlo, e cambiarne l'altezza corregge la cornice da sé.
- **Le pareti sono quattro piani rivolti all'interno, senza soffitto.** Un cubo
  con le facce invertite avrebbe inghiottito la camera quando si allontana sopra
  l'altezza del soffitto, o mostrato il suo esterno nascondendo il tavolo.
- **La camera si inquadra sul viewport reale.** `fov` è verticale: su uno schermo
  in portrait il campo orizzontale è circa la metà, e una camera tarata su un
  formato taglia le sponde su un altro.

## Cosa manca

Note oneste su ciò che non c'è, in ordine di quanto si nota giocando:

- **Font delle palline minimale.** Le cifre ci sono, ma sono un bitmap 5×7
  generato in codice: leggibile e nello spirito, non tipografia. Un font vero
  vorrebbe texture o SDF.
- **Valori delle luci da tarare a occhio.** Le intensità in `locations.ts` sono
  scelte a ragione ma non verificate su uno schermo reale. Sono unità
  fisiche di three.js, dove una luce direzionale dà irradianza diretta mentre una
  puntiforme decade come `intensità / distanza²`: per questo le lampade stanno
  intorno a 6 e le luci di riempimento sotto 1. Se una stanza risulta troppo buia
  o slavata, i numeri sono tutti in quell'unico file.
- **Squirt.** Colpendo di lato la bianca parte leggermente fuori dalla linea di
  mira, e questo non è modellato: la linea di mira resta onesta anche con
  l'effetto laterale al massimo.
- **Suoni registrati.** Gli effetti sono sintesi, non campioni: decorosi, non
  belli. Sostituibili senza toccare codice.
- **Bianca in mano.** Dopo un fallo la bianca torna automaticamente al punto di
  battuta invece di essere riposizionabile.
- **Regole 8-ball / 9-ball.** La modalità libera è a punteggio, scelta perché
  scala da 1 a n giocatori senza cambiare forma.
- **Verifica su device.** Fisica e regole sono coperte dai test e il bundle iOS
  compila, ma il rendering GL non è ancora stato eseguito su un telefono: è
  l'unico pezzo che i test non possono raggiungere. Si prova con `npm start` e la
  scansione del QR da Expo Go.
