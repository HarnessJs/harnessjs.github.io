#!/usr/bin/env node
/**
 * Devolve o link a referências que o `unlink-pending.mjs` transformou em texto
 * enquanto a seção alvo não existia.
 *
 * Casa o texto contra os títulos do manifesto, e só em duas posições onde uma
 * referência é inequívoca: um bullet numa lista "Related"/"Relacionado", e uma
 * frase "See X." / "Veja X.". Menção em prosa fica de fora de propósito —
 * "Hooks" aparece dezenas de vezes como substantivo comum.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { IA, href } from "../.vitepress/ia.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** título exato -> caminho, por idioma. */
const byTitle = { en: new Map(), pt: new Map() };
for (const section of IA) {
  for (const page of section.pages) {
    for (const lang of ["en", "pt"]) {
      byTitle[lang].set(page.title[lang], href(lang, section.slug, page.slug));
    }
  }
}

async function mdFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await mdFiles(full)));
    else if (e.name.endsWith(".md")) out.push(full);
  }
  return out;
}

let touched = 0;
for (const lang of ["en", "pt"]) {
  const titles = byTitle[lang];
  for (const file of await mdFiles(join(root, lang))) {
    const src = await readFile(file, "utf8");
    const self = "/" + relative(root, file).replace(/\.md$/, "");
    const lines = src.split("\n");
    let inRelated = false;
    let changed = false;

    const out = lines.map((line) => {
      if (/^## (Related|Relacionado)\s*$/.test(line)) { inRelated = true; return line; }
      if (/^## /.test(line)) inRelated = false;

      // "- Título" ou "- Título — nota"
      if (inRelated) {
        const m = line.match(/^- ([^[\n—]+?)(\s+—\s+.*)?$/);
        if (m) {
          const link = titles.get(m[1].trim());
          if (link && link !== self) {
            changed = true;
            return `- [${m[1].trim()}](${link})${m[2] ?? ""}`;
          }
        }
        return line;
      }

      // "See Título." / "Veja Título."
      return line.replace(/\b(See|Veja) ([A-ZÀ-Ú][^.\n]*?)\.(?=\s|$)/g, (whole, verb, title) => {
        const link = titles.get(title.trim());
        if (!link || link === self) return whole;
        changed = true;
        return `${verb} [${title.trim()}](${link}).`;
      });
    });

    if (changed) {
      await writeFile(file, out.join("\n"));
      console.log(`  ${relative(root, file)}`);
      touched++;
    }
  }
}
console.log(touched ? `\n${touched} arquivo(s) religado(s).` : "Nada a religar.");
