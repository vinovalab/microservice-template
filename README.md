# Microservice Template

The skeleton a Node.js microservice starts from: an Express server that already
comes up with logging, status, settings, clean shutdown and a documentation
page, plus one module where you write what the service is actually for.

The template is **a folder, not a project you run**: you copy it into
`services/<service-name>/` of the target repository and replace the
placeholders. `create-service.js`, next to it, does that (below); by hand it
goes as described in [The placeholders](#the-placeholders).

## Read these first

- **[Using the service template](https://vinovalab.ai/work-with-us/use-of-template)** —
  what the template already solves, how to use the logger and the Redis bus, and
  how to add behaviour in its own file instead of growing `server.js`. Most of
  the reasons a first delivery gets returned are described there.
- **[Engineering guidelines](https://vinovalab.ai/work-with-us/engineering-guidelines)** —
  the conventions every delivery is reviewed against. A review that returns work
  cites the rule number.

## What you get without writing a line

For every generated service, `createMicroserviceServer` mounts on its own:

| endpoint | what it does |
|---|---|
| `GET /status/health` | machine-readable status — this is what the Dockerfile's `HEALTHCHECK` polls |
| `GET /health` | the same thing for a person |
| `GET /status/logLevel`, `PUT /status/logLevel/:level` | the log level changes at runtime, without a restart |
| `GET /dbLogger`, `PUT /dbLogger/:on\|off` | database logging, switched on and off at runtime |
| `GET /release` | the contents of `release.json` |
| `GET /settings`, `PUT /settings`, `POST /settings/reload` | the settings loaded from the database |
| `GET /` and `GET /docs/readme` | the service README, rendered as HTML |

The main module extends `BaseService` and has exactly two hooks to fill in:
`_onInit()` and `_onShutdown()`.

## With the script

```sh
node create-service.js payment-normalizer-service \
  --repo=../backbone-core --description="Normalises incoming payments."
```

No dependencies, just `node`. In the given repository (the current folder by
default) it:

- copies `template/` into `services/<name>/` and replaces every placeholder,
  checking at the end that none is left;
- adds the service at the end of `services:` in
  `docker/compose/docker-compose.dev.yml`, with the `npm_token` build secret
  (declaring it at the top too, if missing) and the `dev_app_net` network if the
  compose file uses it;
- adds the `# --- <name> ---` section to `docker/env/.env.dev.example`.

`--port` is optional: without it, the script takes the first free port after the
highest one between 5000 and 5099 used in this repository and in the
repositories next to it, because on DEV ports are shared. `--dry-run` shows what
it would do without writing anything.

It does not touch pipelines, `docker-compose.test.yml` or
`docker-compose.prod.yml`: they differ from repository to repository, and the
script lists at the end what is left to do by hand.

## Try it right now, with nothing around it

This is only to **see how it behaves**: clone, replace the placeholders, start
it, open a browser. It is not how a service runs in production — see "Running
locally" below for that.

```sh
git clone https://github.com/vinovalab/microservice-template.git
cd microservice-template
cp -r template /tmp/test-service && cd /tmp/test-service
```

Copy rather than working inside `template/`: the placeholders have to be
replaced, and replacing them in the clone spoils it for next time.

Then the substitution (the full list of placeholders is further down):

```sh
grep -rl '__' . | xargs sed -i \
  -e "s/__MICROSERVICE_NAME__/test-service/g" \
  -e "s/__SERVICE_FOLDER__/test-service/g" \
  -e "s/__REPO_FOLDER__/backbone-core/g" \
  -e "s/__CLASS_NAME__/TestService/g" \
  -e "s/__PORT__/5142/g" \
  -e "s/__VERSION__/0.1.0/g" \
  -e "s/__MODULE_VERSION__/0.1.0/g" \
  -e "s|__DATE__|$(date +%d/%m/%Y)|g" \
  -e "s|__SERVICE_MAIN_FILE__|modules/main.js|g" \
  -e "s|__DESCRIPTION__|A service used for testing.|g"
```

Installing requires the GitHub Packages token (see the dependency section
below): without it, `npm install` fails with a `401`.

```sh
npm install
```

Then start it. **The two switches are not optional for this test**: without
them the service waits for Redis and for the settings, never opens the port,
and looks stuck — the reason is explained under "Running locally".

```sh
REDIS_BUS_ENABLED=false PORT=5142 npm start
```

plus, in the `super({...})` call in `modules/main.js`:

```js
enableDbSettings: false,
enableEventsManifest: false,
```

### The web interface

At this point <http://localhost:5142> answers. It is a page served by the
service itself — no frontend to build — with a navigation bar and three
destinations:

| address | what it shows |
|---|---|
| `/` | service name, description, and the links below |
| `/docs/readme` | the service `README.md`, rendered as HTML |
| `/docs/readme.md` | the same file, raw |
| `/health` | status and port, in readable form |
| `/status/health` | the same status as JSON — this is what `HEALTHCHECK` polls |

It is the quickest way to check the service is alive and that the README is the
right one: the page renders **the service's own file**, so if `__DESCRIPTION__`
still appears there, the substitution was not complete.

From the command line:

```console
$ curl localhost:5142/status/health
{"status":"OK","module":"RESTServer","uptime":6.02}
```

## The placeholders

Replace all of them: the service **will not start** while any remain. `__PORT__`
in `server.js` is read as a variable, so starting up gives you
`ReferenceError: __PORT__ is not defined`.

| placeholder | example | where it appears |
|---|---|---|
| `__MICROSERVICE_NAME__` | `payment-normalizer-service` | `server.js`, `modules/main.js`, `package.json`, `release.json` |
| `__SERVICE_FOLDER__` | `payment-normalizer-service` | `Dockerfile` |
| `__REPO_FOLDER__` | `backbone-core` | `Dockerfile` — the repository folder inside the build context |
| `__CLASS_NAME__` | `PaymentNormalizerService` | `modules/main.js` |
| `__PORT__` | `5042` | `server.js`, `Dockerfile` |
| `__VERSION__` | `0.1.0` | `package.json`, `release.json` |
| `__MODULE_VERSION__` | `0.1.0` | `server.js`, `modules/main.js` |
| `__DESCRIPTION__` | `Normalises incoming payments.` | `package.json`, `server.js`, `README.md` |
| `__SERVICE_MAIN_FILE__` | `modules/main.js` | `nodemon.json` |
| `__DATE__` | `12/09/2026` | `release.json` |

A substitution that works, run inside the folder you have just copied:

```sh
NAME=payment-normalizer-service
CLASS=PaymentNormalizerService
PORT=5042
REPO=backbone-core
DESC="Normalises incoming payments."

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

grep -rn '__[A-Z_]*__' . || echo "no placeholders left"
```

That last line is not fussiness: a placeholder left in `release.json` breaks
nothing at startup, and gets discovered months later when someone reads a
version called `__VERSION__`.

## The `@vinovalab/backbone-shared` dependency

Everything the template does **not** contain — the server factory, `BaseService`,
the logger, the Redis bus, settings loading, the status router — lives in
`@vinovalab/backbone-shared`. That is what keeps the template three hundred
lines long instead of three thousand, and it is also why generated services all
behave the same way.

That package is published to **GitHub Packages, not to the public npm registry**:
installing it needs a token with `read:packages` and an `.npmrc` pointing the
namespace at the right registry.

```sh
# ~/.npmrc, or .npmrc in the service folder (never committed)
@vinovalab:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<TOKEN>
```

The `Dockerfile` takes it as a **build secret**, not as an `ARG`: an `ARG` value
ends up in the command string and is exported with the image cache. The compose
file must declare:

```yaml
build:
  context: ../../..          # from the compose in <repo>/docker/compose: the repositories folder
  dockerfile: <repo>/services/<name>/Dockerfile
  secrets: [npm_token]
secrets:
  npm_token:
    environment: NODE_AUTH_TOKEN
```

## Running locally

```sh
npm install          # needs the token described above
npm run dev          # nodemon
npm start            # node server.js
```

**On its own the service does not start, and it is worth knowing that up front.**
The HTTP server only begins listening **after** initialisation has finished, and
initialisation wants two things: a reachable Redis (`REDIS_URL`, `redis://redis:6379`
by default) and settings read from the data service (`DATAHUB_URL`). Without
Redis it retries the connection forever: no port open, `/status/health`
unreachable, and no fatal error — just reconnection lines. That is the right
behaviour in a cluster where Redis is about to come back, and it is bewildering
on the laptop of someone trying the template for the first time.

To make it run on its own, with nothing around it, two switches are enough:

```sh
REDIS_BUS_ENABLED=false PORT=5142 npm start
```

plus, in the `super({...})` call in `modules/main.js`:

```js
enableDbSettings: false,     // no settings from the database
enableEventsManifest: false, // no events manifest on the bus
```

It then starts in a second and answers for real:

```console
$ curl localhost:5142/status/health
{"status":"OK","module":"RESTServer","uptime":6.02}
```

These are development switches: a real service lives in the cluster with the bus
and the settings turned on, and that is where centralised logs, telemetry and
runtime configuration come from.
