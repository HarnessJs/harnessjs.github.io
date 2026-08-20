#!/usr/bin/env node
/**
 * Validação da documentação, sem dependência nova.
 *
 * Roda antes do build porque o VitePress só reclama de link morto **relativo**;
 * link absoluto (`/pt/fundamentals/agents`) ele publica quebrado sem avisar — e
 * é a forma que este site usa em todo lugar, porque a página existe em dois
 * idiomas e o caminho precisa dizer qual.
 *
 * As quatro checagens:
 *
 * 1. **paridade** — toda página de `en/` tem a irmã em `pt/`, e vice-versa;
 * 2. **links internos** — todo `](/…)` aponta para arquivo que existe;
 * 3. **vazamento de idioma** — nada em `en/` linka para `/pt/…`, nem o contrário;
 * 4. **sidebar** — todo link do manifesto (`.vitepress/ia.js`) existe no disco,
 *    e todo arquivo publicado está no manifesto.
 */
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { IA, SHIPPED, allPaths } from "../.vitepress/ia.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LANGS = ["en", "pt"];

/** Pastas que não são conteúdo. */
const IGNORED = new Set(["node_modules", ".vitepress", ".git", "public", "scripts"]);

/**
 * Arquivos que estão na pasta mas não são página do site — os mesmos que o
 * `srcExclude` do VitePress tira do build. Os links deles apontam para arquivos
 * do repositório, e não para URLs.
 */
const NOT_A_PAGE = new Set(["README.md"]);

const problems = [];
const fail = (file, message) => problems.push({ file, message });

/** Todos os `.md` do site, em caminho relativo à raiz de `docs/`. */
async function markdownFiles(dir = root) {
  /** @type {string[]} */
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (IGNORED.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await markdownFiles(full)));
    else if (entry.name.endsWith(".md") && !NOT_A_PAGE.has(relative(root, full))) {
      found.push(relative(root, full));
    }
  }
  return found;
}

/**
 * A URL de uma página vira o arquivo que a gera. `cleanUrls` está ligado, então
 * `/en/get-started/introduction` é `en/get-started/introduction.md`, e `/en/` é
 * `en/index.md`.
 */
function fileForUrl(url) {
  const clean = url.replace(/[#?].*$/, "").replace(/\/$/, "/index");
  const path = clean.replace(/^\//, "");
  for (const candidate of [`${path}.md`, join(path, "index.md")]) {
    if (existsSync(join(root, candidate))) return candidate;
  }
  return null;
}

// ── 1 e 3. paridade e vazamento de idioma ───────────────────────────────────
const files = await markdownFiles();

for (const file of files) {
  const [lang, ...rest] = file.split("/");
  if (!LANGS.includes(lang)) continue;

  const other = LANGS.find((l) => l !== lang);
  const twin = join(other, ...rest);
  if (!existsSync(join(root, twin))) {
    fail(file, `sem tradução: falta ${twin}`);
  }
}

// ── 2. links internos ───────────────────────────────────────────────────────
for (const file of files) {
  const raw = await readFile(join(root, file), "utf8");
  const lang = file.split("/")[0];

  // Bloco de código e código inline saem antes: o que está ali é exemplo, não
  // navegação. Uma página que **explica** a sintaxe `](/…)` não tem link morto.
  const body = raw
    .replace(/^```[\s\S]*?^```/gm, "")
    .replace(/`[^`\n]*`/g, "");

  // `](/algo)` — só link absoluto interno. Externos e âncoras ficam de fora.
  for (const [, url] of body.matchAll(/\]\((\/[^)\s]*)\)/g)) {
    if (url.startsWith("//")) continue; // protocol-relative é externo
    if (/\.(png|jpg|jpeg|svg|gif|webp|ico|txt|html|json)$/.test(url)) {
      if (!existsSync(join(root, "public", url.replace(/^\//, "")))) {
        fail(file, `asset inexistente: ${url}`);
      }
      continue;
    }
    if (!fileForUrl(url)) fail(file, `link morto: ${url}`);

    const target = url.split("/")[1];
    if (LANGS.includes(lang) && LANGS.includes(target) && target !== lang) {
      fail(file, `link cruza o idioma: ${url} numa página em /${lang}/`);
    }
  }
}

// ── 4. sidebar ↔ disco ──────────────────────────────────────────────────────
const declared = new Set();
for (const lang of LANGS) {
  for (const url of allPaths(lang)) {
    declared.add(`${url.replace(/^\//, "")}.md`);
    if (!fileForUrl(url)) {
      fail(".vitepress/ia.js", `sidebar aponta para página inexistente: ${url}`);
    }
  }
}

for (const file of files) {
  const [lang, section] = file.split("/");
  if (!LANGS.includes(lang)) continue;
  if (file === `${lang}/index.md`) continue; // home do idioma
  if (!SHIPPED.includes(section)) continue; // seção ainda não publicada
  if (!declared.has(file)) {
    fail(file, "página órfã: existe no disco, mas não está em .vitepress/ia.js");
  }
}

// ── relatório ───────────────────────────────────────────────────────────────
const pending = IA.filter((s) => !SHIPPED.includes(s.slug));
if (pending.length) {
  const total = pending.reduce((n, s) => n + s.pages.length, 0);
  console.log(
    `ℹ  ${pending.length} seções ainda não publicadas (${total} páginas por idioma): ` +
      pending.map((s) => s.slug).join(", "),
  );
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problema(s):\n`);
  for (const { file, message } of problems) console.error(`  ${file}\n    ${message}`);
  console.error("");
  process.exit(1);
}

const shippedPages = allPaths("en").length;
console.log(
  `✓ documentação consistente — ${shippedPages} páginas por idioma, ` +
    `${LANGS.length} idiomas, links e paridade validados`,
);
