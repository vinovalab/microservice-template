"use strict";

const fs = require("fs/promises");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const html = [];
  let inCode = false;
  let paragraph = [];
  let listOpen = false;
  const closeParagraph = () => { if (paragraph.length) html.push(`<p>${paragraph.join(" ")}</p>`); paragraph = []; };
  const closeList = () => { if (listOpen) html.push("</ul>"); listOpen = false; };
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      closeParagraph(); closeList();
      html.push(inCode ? "</code></pre>" : "<pre><code>");
      inCode = !inCode;
      continue;
    }
    if (inCode) { html.push(`${escapeHtml(line)}\n`); continue; }
    if (!trimmed) { closeParagraph(); closeList(); continue; }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeParagraph(); closeList();
      html.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      closeParagraph();
      if (!listOpen) { html.push("<ul>"); listOpen = true; }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }
    paragraph.push(inlineMarkdown(trimmed));
  }
  closeParagraph(); closeList();
  if (inCode) html.push("</code></pre>");
  return html.join("\n");
}

function renderPage({ serviceName, title, body }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(serviceName)} - ${escapeHtml(title)}</title><style>
  :root{color-scheme:light dark;--bg:#f7f8fa;--fg:#17202a;--muted:#5f6b7a;--border:#d7dde5;--link:#175cd3;--code:#111827}@media(prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#9da7b3;--border:#30363d;--link:#79c0ff;--code:#161b22}}body{margin:0;font:15px/1.55 system-ui,sans-serif;color:var(--fg);background:var(--bg)}main{max-width:980px;margin:auto;padding:32px 20px 64px}nav{display:flex;gap:12px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--border)}a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}h1,h2,h3,h4{line-height:1.2;margin:1.4em 0 .55em}h1{margin-top:0;font-size:30px}.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.tile{border:1px solid var(--border);border-radius:8px;padding:16px}pre{padding:14px 16px;overflow:auto;background:var(--code);color:#f8fafc;border-radius:8px}code{font-family:ui-monospace,monospace}</style></head><body><main><nav><a href="/">Home</a><a href="/docs/readme">README</a><a href="/health">Health</a></nav>${body}</main></body></html>`;
}

function registerReadmeLanding({ app, getService, logger, serviceName, description, readmePath, port }) {
  app.get("/", (_req, res) => res.type("html").send(renderPage({
    serviceName, title: "Home", body: `<h1>${escapeHtml(serviceName)}</h1><p class="muted">${escapeHtml(description)}</p><div class="grid"><section class="tile"><h2>README</h2><p><a href="/docs/readme">Open HTML</a> · <a href="/docs/readme.md">Raw Markdown</a></p></section><section class="tile"><h2>Health</h2><p><a href="/health">Open Health</a> · <a href="/status/health">Raw JSON</a></p></section></div>`,
  })));
  app.get("/docs/readme", async (_req, res) => {
    try {
      const markdown = await fs.readFile(readmePath, "utf8");
      res.type("html").send(renderPage({ serviceName, title: "README", body: `<article>${markdownToHtml(markdown)}</article>` }));
    } catch (err) {
      logger.error(`[GET /docs/readme] ${err.message}`);
      res.status(500).json({ error: "Unable to read README.md" });
    }
  });
  app.get("/docs/readme.md", async (_req, res) => {
    try { res.type("text/markdown").send(await fs.readFile(readmePath, "utf8")); }
    catch (err) { logger.error(`[GET /docs/readme.md] ${err.message}`); res.status(500).json({ error: "Unable to read README.md" }); }
  });
  app.get("/health", (_req, res) => res.type("html").send(renderPage({
    serviceName, title: "Health", body: `<h1>Health</h1><p>Status: <strong>${escapeHtml(getService()?.status || "STARTING")}</strong></p><p>Port: ${escapeHtml(port)}</p><p><a href="/status/health">Raw health JSON</a></p>`,
  })));
}

module.exports = { escapeHtml, markdownToHtml, registerReadmeLanding, renderPage };
