# Microservice Template

Lo scheletro da cui nasce un microservizio Node.js: un server Express che si
avvia già con logging, stato, settings, spegnimento pulito e una pagina di
documentazione, e un modulo dove scrivere quello che il servizio deve
davvero fare.

Il template è **una cartella**, non un progetto da avviare: si copia dentro
`services/<nome-servizio>/` del repository di destinazione e si sostituiscono i
segnaposto. È la forma in cui viene usato oggi, ed è anche la forma che serve a
uno script di scaffolding, quando ci sarà.

## Da leggere prima

- **[Using the service template](https://vinovalab.ai/work-with-us/use-of-template)** —
  cosa il template risolve già, come si usano logger e bus Redis, e come si
  aggiungono funzioni in un file proprio invece di far crescere `server.js`.
  È lì che sta descritta la maggior parte dei motivi per cui una prima consegna
  viene respinta.
- **[Engineering guidelines](https://vinovalab.ai/work-with-us/engineering-guidelines)** —
  le convenzioni contro cui ogni consegna viene giudicata. Una revisione che
  respinge cita il numero della regola.

## Cosa si ottiene senza scrivere una riga

`createMicroserviceServer` monta da solo, per ogni servizio generato:

| endpoint | cosa fa |
|---|---|
| `GET /status/health` | stato leggibile da una macchina — è quello che interroga l'`HEALTHCHECK` del Dockerfile |
| `GET /health` | la stessa cosa per una persona |
| `GET /status/logLevel`, `PUT /status/logLevel/:level` | il livello di log si cambia a caldo, senza riavviare |
| `GET /dbLogger`, `PUT /dbLogger/:on\|off` | logging su database, acceso e spento a caldo |
| `GET /release` | contenuto di `release.json` |
| `GET /settings`, `PUT /settings`, `POST /settings/reload` | i settings caricati dal database |
| `GET /` e `GET /docs/readme` | il README del servizio, reso in HTML |

Il modulo principale eredita da `BaseService` e ha due soli agganci da
riempire: `_onInit()` e `_onShutdown()`.

## I segnaposto

Sostituirli tutti: il servizio **non parte** finché restano. `__PORT__` in
`server.js` è letto come una variabile, e all'avvio si ottiene
`ReferenceError: __PORT__ is not defined`.

| segnaposto | esempio | dove compare |
|---|---|---|
| `__MICROSERVICE_NAME__` | `payment-normalizer-service` | `server.js`, `modules/main.js`, `package.json`, `release.json` |
| `__SERVICE_FOLDER__` | `payment-normalizer-service` | `Dockerfile` |
| `__REPO_FOLDER__` | `backbone-core` | `Dockerfile` — la cartella del repository dentro il contesto di build |
| `__CLASS_NAME__` | `PaymentNormalizerService` | `modules/main.js` |
| `__PORT__` | `5042` | `server.js`, `Dockerfile` |
| `__VERSION__` | `0.1.0` | `package.json`, `release.json` |
| `__MODULE_VERSION__` | `0.1.0` | `server.js`, `modules/main.js` |
| `__DESCRIPTION__` | `Normalizza i pagamenti in arrivo.` | `package.json`, `server.js`, `README.md` |
| `__SERVICE_MAIN_FILE__` | `modules/main.js` | `nodemon.json` |
| `__DATE__` | `12/09/2026` | `release.json` |

Una sostituzione che funziona, da eseguire nella cartella appena copiata:

```sh
NAME=payment-normalizer-service
CLASS=PaymentNormalizerService
PORT=5042
REPO=backbone-core
DESC="Normalizza i pagamenti in arrivo."

grep -rl '__' . | xargs sed -i \
  -e "s/__MICROSERVICE_NAME__/$NAME/g" \
  -e "s/__SERVICE_FOLDER__/$NAME/g" \
  -e "s/__REPO_FOLDER__/$REPO/g" \
  -e "s/__CLASS_NAME__/$CLASS/g" \
  -e "s/__PORT__/$PORT/g" \
  -e "s/__VERSION__/0.1.0/g" \
  -e "s/__MODULE_VERSION__/0.1.0/g" \
  -e "s|__DATE__|$(date +%d/%m/%Y)|g" \
  -e "s|__SERVICE_MAIN_FILE__|modules/main.js|g" \
  -e "s|__DESCRIPTION__|$DESC|g"

grep -rn '__[A-Z_]*__' . || echo "nessun segnaposto rimasto"
```

L'ultima riga non è pignoleria: un segnaposto dimenticato in `release.json` non
rompe niente all'avvio e si scopre mesi dopo, quando qualcuno legge una versione
che si chiama `__VERSION__`.

## La dipendenza da `@vinovalab/backbone-shared`

Tutto ciò che il template **non** contiene — server factory, `BaseService`,
logger, bus Redis, caricamento dei settings, router di stato — vive in
`@vinovalab/backbone-shared`. È ciò che tiene il template lungo trecento righe
invece di tremila, ed è anche il motivo per cui i servizi generati si comportano
tutti allo stesso modo.

Quel pacchetto è pubblicato su **GitHub Packages e non su npm pubblico**: per
installarlo serve un token con `read:packages` e un `.npmrc` che punti il
namespace al registry giusto.

```sh
# ~/.npmrc, oppure .npmrc nella cartella del servizio (mai committato)
@vinovalab:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<TOKEN>
```

Il `Dockerfile` lo prende come **secret di build**, non come `ARG`: il valore di
un `ARG` finisce nella stringa del comando e viene esportato con la cache
dell'immagine. Il compose deve dichiarare:

```yaml
build:
  context: ../..
  dockerfile: <repo>/services/<nome>/Dockerfile
  secrets: [npm_token]
secrets:
  npm_token:
    environment: NODE_AUTH_TOKEN
```

## Provarlo subito, senza niente intorno

Serve solo per **vedere come si comporta**: si clona, si sostituiscono i
segnaposto, si avvia, si apre il browser. Non è il modo in cui un servizio vive
in produzione — per quello si veda più avanti.

```sh
git clone https://github.com/vinovalab/microservice-template.git
cd microservice-template
cp -r template /tmp/prova-servizio && cd /tmp/prova-servizio
```

Si copia invece di lavorare in `template/` perché i segnaposto vanno sostituiti,
e sostituirli nel clone significa sporcarlo per la prossima volta.

Poi la sostituzione (l'elenco completo dei segnaposto è più sotto):

```sh
grep -rl '__' . | xargs sed -i \
  -e "s/__MICROSERVICE_NAME__/prova-servizio/g" \
  -e "s/__SERVICE_FOLDER__/prova-servizio/g" \
  -e "s/__REPO_FOLDER__/backbone-core/g" \
  -e "s/__CLASS_NAME__/ProvaServizio/g" \
  -e "s/__PORT__/5142/g" \
  -e "s/__VERSION__/0.1.0/g" \
  -e "s/__MODULE_VERSION__/0.1.0/g" \
  -e "s|__DATE__|$(date +%d/%m/%Y)|g" \
  -e "s|__SERVICE_MAIN_FILE__|modules/main.js|g" \
  -e "s|__DESCRIPTION__|Un servizio di prova.|g"
```

L'installazione richiede il token di GitHub Packages (si veda la sezione sulla
dipendenza): senza, `npm install` fallisce con un `401`.

```sh
npm install
```

Infine si avvia. **I due interruttori non sono facoltativi in questa prova**:
senza, il servizio aspetta Redis e i settings, non apre la porta e sembra
bloccato — il perché è spiegato in «Avviare in locale».

```sh
REDIS_BUS_ENABLED=false PORT=5142 npm start
```

più, nel `super({...})` di `modules/main.js`:

```js
enableDbSettings: false,
enableEventsManifest: false,
```

### L'interfaccia web

A questo punto <http://localhost:5142> risponde. È una pagina servita dal
servizio stesso — nessun frontend da costruire — con una barra di navigazione e
tre destinazioni:

| indirizzo | cosa mostra |
|---|---|
| `/` | nome del servizio, descrizione, e i collegamenti qui sotto |
| `/docs/readme` | il `README.md` del servizio reso in HTML |
| `/docs/readme.md` | lo stesso file, grezzo |
| `/health` | stato e porta, in forma leggibile |
| `/status/health` | lo stesso stato in JSON — è quello che interroga l'`HEALTHCHECK` |

È il modo più rapido per verificare che il servizio sia vivo e che il README sia
quello giusto: la pagina rende **il file del servizio**, quindi se lì compare
ancora `__DESCRIPTION__` la sostituzione non è stata completa.

Per la prova da riga di comando:

```console
$ curl localhost:5142/status/health
{"status":"OK","module":"RESTServer","uptime":6.02}
```

## Avviare in locale

```sh
npm install          # richiede il token di cui sopra
npm run dev          # nodemon
npm start            # node server.js
```

**Di suo il servizio non parte da solo, e conviene saperlo prima.** Il server
HTTP si mette in ascolto solo **dopo** che l'inizializzazione è finita, e
l'inizializzazione vuole due cose: un Redis raggiungibile (`REDIS_URL`, di
default `redis://redis:6379`) e i settings letti dal servizio dati
(`DATAHUB_URL`). Senza Redis resta a ritentare la connessione all'infinito:
nessuna porta aperta, `/status/health` irraggiungibile e nessun errore fatale —
solo righe di riconnessione. È il comportamento giusto in un cluster dove Redis
sta per tornare, ed è sconcertante sul portatile di chi prova il template per la
prima volta.

Per farlo girare da solo, senza niente intorno, bastano due interruttori:

```sh
REDIS_BUS_ENABLED=false PORT=5142 npm start
```

e, nel `super({...})` di `modules/main.js`:

```js
enableDbSettings: false,     // niente settings dal database
enableEventsManifest: false, // niente manifest degli eventi sul bus
```

Così parte in un secondo e risponde davvero:

```console
$ curl localhost:5142/status/health
{"status":"OK","module":"RESTServer","uptime":6.02}
```

Sono interruttori da sviluppo: un servizio vero vive nel cluster con il bus e i
settings accesi, ed è da lì che arrivano log centralizzati, telemetria e
configurazione a caldo.
