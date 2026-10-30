#!/usr/bin/env node
// create-service.js: crea un microservizio da template/ dentro un repository.
//
//   node create-service.js <name> [--repo=<path>] [--port=NNNN] [--description="..."] [--dry-run]
//
// Cosa fa, e niente altro:
//   - copia template/ in <repo>/services/<name>/ e sostituisce i segnaposto;
//   - aggiunge il servizio a <repo>/docker/compose/docker-compose.dev.yml (più
//     il secret di build npm_token, se manca);
//   - aggiunge le sue variabili a <repo>/docker/env/.env.dev.example, se c'è.
// Non installa, non avvia, non tocca database, pipeline né compose di TEST/PROD.
// Nessuna dipendenza: gira con il solo node, anche dentro i workspace.
"use strict";

const fs = require("fs");
const path = require("path");

const TEMPLATE = path.join(__dirname, "template");
const COMPOSE = "docker/compose/docker-compose.dev.yml";
const ENV_EXAMPLE = "docker/env/.env.dev.example";
const NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const VERSION = "0.1.0";

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { flags: {} };
  for (const a of argv) {
    const m = a.match(/^--([a-z-]+)(?:=(.*))?$/s);
    if (m) opts.flags[m[1]] = m[2] ?? true;
    else if (!opts.name) opts.name = a;
    else fail(`unexpected argument: ${a}`);
  }
  const known = new Set(["repo", "port", "description", "dry-run", "help"]);
  for (const k of Object.keys(opts.flags)) if (!known.has(k)) fail(`unknown option --${k}`);
  return opts;
}

const usage = () => console.log(
  "usage: node create-service.js <name> [--repo=<path>] [--port=NNNN] [--description=\"...\"] [--dry-run]\n"
  + "  <name>         kebab-case, e.g. payment-normalizer-service\n"
  + "  --repo         target repository (default: current directory)\n"
  + "  --port         container port (default: the first free one after the highest 50xx used here and in sibling repos)\n"
  + "  --description  one line, shown on the service landing page");

const pascal = (s) => s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("");
const snake = (s) => s.replace(/-/g, "_").toUpperCase();
const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

// La cartella del repo come la vedono i Dockerfile (contesto = la cartella che
// contiene i repo): quella già usata dagli altri servizi, altrimenti il nome.
function repoFolder(repo, compose) {
  const m = compose.match(/^\s+dockerfile:\s*["']?([^/\s"']+)\/services\//m);
  return m ? m[1] : path.basename(repo);
}

function projectName(repo, compose) {
  const m = compose.match(/^name:\s*["']?\$\{COMPOSE_PROJECT_NAME:-([^}]+)\}/m) || compose.match(/^name:\s*["']?([\w.-]+)/m);
  return m ? m[1] : `${path.basename(repo).toLowerCase()}-dev`;
}

// Porte già prese: quelle nelle righe con PORT o con un binding 127.0.0.1:
function usedPorts(...texts) {
  const used = new Set();
  for (const line of texts.join("\n").split("\n")) {
    if (!/PORT|127\.0\.0\.1:/.test(line)) continue;
    for (const m of line.matchAll(/\b(\d{4,5})\b/g)) used.add(Number(m[1]));
  }
  return used;
}

// I microservizi stanno fra 5000 e 5099 (5173 è Vite, 5432 Postgres): si prende
// la prima libera dopo la più alta già usata, e solo a range pieno si va oltre
function pickPort(used) {
  const taken = [...used].filter((p) => p >= 5000 && p <= 5099);
  let p = taken.length ? Math.max(...taken) + 1 : 5000;
  while (used.has(p)) p += 1;
  return p;
}

// Le porte su DEV sono di tutti i repo: si leggono anche quelli accanto a questo
function siblingTexts(repo) {
  const parent = path.dirname(repo);
  return fs.readdirSync(parent, { withFileTypes: true })
    .filter((d) => d.isDirectory() && path.join(parent, d.name) !== repo)
    .flatMap((d) => [COMPOSE, ENV_EXAMPLE].map((f) => path.join(parent, d.name, f)))
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f, "utf8"));
}

function composeBlock({ name, key, port, project, folder, devAppNet }) {
  const v = (k, def) => `"\${${key}_${k}:-${def}}"`;
  return [
    `  ${name}:`,
    "    build:",
    "      context: ../../..",
    `      dockerfile: ${folder}/services/${name}/Dockerfile`,
    "      secrets:",
    "        - npm_token",
    `    image: "\${${key}_IMAGE:-local/${name}}:\${${key}_VERSION:-dev}"`,
    `    container_name: ${v("CONTAINER_NAME", `${project}-${name}`)}`,
    "    restart: unless-stopped",
    "    environment:",
    '      ENV: "${ENV:-DEV}"',
    '      TZ: "${TIMEZONE:-UTC}"',
    `      PORT: ${v("CONTAINER_PORT", port)}`,
    '      LOG_LEVEL: "${LOG_LEVEL:-info}"',
    '      CORS_ORIGIN: "${CORS_ORIGIN:-}"',
    `      DATA_SERVICE_URL: ${v("DATA_SERVICE_URL", "http://data-service:5003")}`,
    `      AUTH_SERVICE_URL: ${v("AUTH_SERVICE_URL", "http://auth-service:5015")}`,
    '      REDIS_BUS_ENABLED: "${REDIS_BUS_ENABLED:-false}"',
    '      REDIS_HOST: "${REDIS_HOST:-redis}"',
    '      REDIS_PORT: "${REDIS_PORT:-6379}"',
    '      REDIS_PASSWORD: "${REDIS_PASSWORD:-}"',
    '      INTERNAL_JWT_PRIVATE_KEY: "${INTERNAL_JWT_PRIVATE_KEY:-}"',
    '      INTERNAL_JWT_PUBLIC_KEY: "${INTERNAL_JWT_PUBLIC_KEY:-}"',
    `      MICROSERVICE_NAME: ${name}`,
    "    ports:",
    `      - "127.0.0.1:\${${key}_HOST_PORT:-${port}}:\${${key}_CONTAINER_PORT:-${port}}"`,
    ...(devAppNet ? ["    networks:", "      dev_app_net:", `        aliases: [${name}]`] : []),
    "    healthcheck:",
    `      test: ["CMD-SHELL", "curl -fsS http://localhost:\${${key}_CONTAINER_PORT:-${port}}/status/health || exit 1"]`,
    "      interval: 10s",
    "      timeout: 5s",
    "      retries: 5",
    "      start_period: 15s",
    "",
  ].join("\n");
}

// Le righe di una chiave di primo livello (services:, networks:, secrets:)
function section(lines, key) {
  const start = lines.findIndex((l) => new RegExp(`^${key}:\\s*$`).test(l));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^[A-Za-z_]/.test(l));
  if (end < 0) end = lines.length;
  return { start, end, has: (child) => lines.slice(start + 1, end).some((l) => new RegExp(`^  ${child}:`).test(l)) };
}

// Il blocco va in fondo a services:, cioè prima della prima chiave di primo
// livello che segue services:; il secret npm_token serve al Dockerfile.
function addToCompose(compose, block) {
  const lines = compose.split("\n");
  const svc = section(lines, "services");
  if (!svc) fail(`${COMPOSE}: no top-level services: key`);
  let end = svc.end;
  while (end > svc.start + 1 && lines[end - 1].trim() === "") end -= 1;
  lines.splice(end, 0, "", ...block.trimEnd().split("\n"));
  const secrets = section(lines, "secrets");
  if (!secrets) {
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    lines.push("", "secrets:", "  npm_token:", "    environment: NODE_AUTH_TOKEN", "");
  } else if (!secrets.has("npm_token")) {
    lines.splice(secrets.start + 1, 0, "  npm_token:", "    environment: NODE_AUTH_TOKEN");
  }
  return lines.join("\n");
}

function envSection({ name, key, port, project }) {
  return [
    "",
    `# --- ${name} ---`,
    `${key}_IMAGE=local/${name}`,
    `${key}_VERSION=dev`,
    `${key}_CONTAINER_NAME=${project}-${name}`,
    `${key}_CONTAINER_PORT=${port}`,
    `${key}_HOST_PORT=${port}`,
    `${key}_DATA_SERVICE_URL=http://data-service:5003`,
    `${key}_AUTH_SERVICE_URL=http://auth-service:5015`,
    "",
  ].join("\n");
}

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isSymbolicLink()) return [];
    return d.isDirectory() ? listFiles(p, base) : [path.relative(base, p)];
  });
}

// Il testo della descrizione cambia forma a seconda del file che la ospita
function quoteFor(file, text) {
  if (/\.(js|json)$/.test(file)) return JSON.stringify(text).slice(1, -1);
  return text;
}

function main() {
  const { name, flags } = parseArgs(process.argv.slice(2));
  if (flags.help || !name) { usage(); process.exit(name ? 0 : 1); }
  if (!NAME_RE.test(name) || name.length > 50) fail("name must be kebab-case, e.g. payment-normalizer-service (max 50 chars)");
  if (!fs.existsSync(TEMPLATE)) fail(`template not found at ${TEMPLATE}`);

  const repo = path.resolve(typeof flags.repo === "string" ? flags.repo : process.cwd());
  const composePath = path.join(repo, COMPOSE);
  if (!fs.existsSync(composePath)) fail(`${COMPOSE} not found in ${repo}`);
  const dest = path.join(repo, "services", name);
  if (fs.existsSync(dest)) fail(`services/${name} already exists`);

  const compose = fs.readFileSync(composePath, "utf8");
  if (new RegExp(`^  ${name}:\\s*$`, "m").test(compose)) fail(`service ${name} is already in ${COMPOSE}`);
  const envPath = path.join(repo, ENV_EXAMPLE);
  const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : null;

  const used = usedPorts(compose, envText || "", ...siblingTexts(repo));
  let port;
  if (flags.port !== undefined) {
    port = Number(flags.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) fail("port must be a number between 1024 and 65535");
    if (used.has(port)) fail(`port ${port} is already used in this repository or in one next to it`);
  } else {
    port = pickPort(used);
  }

  const description = String(flags.description === true ? "" : flags.description ?? "").replace(/\s+/g, " ").trim()
    || `${name} microservice.`;
  if (description.length > 200) fail("description must be at most 200 characters");

  const ctx = {
    name, port, key: snake(name),
    project: projectName(repo, compose),
    folder: repoFolder(repo, compose),
    devAppNet: Boolean(section(compose.split("\n"), "networks")?.has("dev_app_net")),
  };
  const values = {
    __MICROSERVICE_NAME__: name,
    __SERVICE_FOLDER__: name,
    __REPO_FOLDER__: ctx.folder,
    __CLASS_NAME__: pascal(name),
    __PORT__: String(port),
    __VERSION__: VERSION,
    __MODULE_VERSION__: VERSION,
    __DATE__: today(),
    __SERVICE_MAIN_FILE__: "modules/main.js",
    __DESCRIPTION__: description,
  };

  const files = listFiles(TEMPLATE).map((rel) => {
    let text = fs.readFileSync(path.join(TEMPLATE, rel), "utf8");
    for (const [k, v] of Object.entries(values)) text = text.split(k).join(k === "__DESCRIPTION__" ? quoteFor(rel, v) : v);
    const left = text.match(/__[A-Z_]+__/g);
    if (left) fail(`template/${rel}: placeholder ${left[0]} has no value`);
    return [rel, text];
  });
  const nextCompose = addToCompose(compose, composeBlock(ctx));
  const nextEnv = envText === null ? null : `${envText.trimEnd()}\n${envSection(ctx)}`;

  console.log(`${flags["dry-run"] ? "would create" : "creating"} ${name} in ${repo}`);
  console.log(`  port ${port}, class ${values.__CLASS_NAME__}, Dockerfile path ${ctx.folder}/services/${name}/Dockerfile`);
  for (const [rel] of files) console.log(`  + services/${name}/${rel}`);
  console.log(`  ~ ${COMPOSE}`);
  if (nextEnv !== null) console.log(`  ~ ${ENV_EXAMPLE}`);
  if (flags["dry-run"]) return;

  for (const [rel, text] of files) {
    const p = path.join(dest, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
  }
  fs.writeFileSync(composePath, nextCompose);
  if (nextEnv !== null) fs.writeFileSync(envPath, nextEnv);

  console.log(`\ndone. Next:
  - write the service in services/${name}/modules/ (read services/${name}/README.md first);
  - build and run it: ./compose.sh up -d --build ${name}, or Rebuild from the workspace console;
  - for TEST/PROD add it by hand to the pipeline and to docker-compose.test.yml / docker-compose.prod.yml.`);
}

main();
