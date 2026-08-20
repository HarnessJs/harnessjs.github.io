# ThenaJS documentation

The site published at [thenajs.github.io](https://thenajs.github.io). VitePress,
bilingual (English and Portuguese), deployed by GitHub Actions on every push to
`main`.

```bash
npm ci
npm run dev      # local, with hot reload
npm run check    # parity, links, sidebar integrity
npm run build    # check + vitepress build
```

The framework itself lives at
[thenajs/ThenaJS](https://github.com/thenajs/ThenaJS).

## How the site is put together

**Both languages are prefixed** — `/en/…` and `/pt/…`. The root is a shell that
redirects. No language lives at `/`, deliberately: with English at the root,
adding a third language would leave English at `/` and everything else at
`/xx/`, an asymmetry that shows up in every link and every check. Adding
Spanish is a new locale file plus one key; no existing URL moves.

**Slugs are mirrored across languages.** `/en/fundamentals/agents` and
`/pt/fundamentals/agents`. This is what makes VitePress's `i18nRouting` land the
language switcher on the equivalent page, gives correct `hreflang` alternates
for free, and reduces the parity check to a file diff.

**One manifest generates both sidebars** — [.vitepress/ia.js](.vitepress/ia.js).
The structure cannot drift between languages because it is not typed twice. It
is JavaScript with JSDoc rather than TypeScript so that `scripts/check-docs.mjs`
can import it under plain Node, with no build step and no experimental flag.

```
.vitepress/
  ia.js        the section/page tree, titles per language
  shared.ts    head, sitemap, search, everything language-neutral
  en.ts        English nav, sidebar, theme strings
  pt.ts        Portuguese equivalent
  config.ts    puts the three together
```

**Terminology is fixed by the [glossary](en/help/glossary.md)**, which doubles as
the EN/PT translation contract: which terms are translated (Run → Execução) and
which keep their English form because they name an API symbol (`Tool`,
`Workflow`, `Hook`).

## Adding a page

1. Write it in **both** `en/` and `pt/`, in the same pass. Parity is enforced;
   catching up later is how one language becomes second-class.
2. Add it to the right section's `pages` in [.vitepress/ia.js](.vitepress/ia.js).
3. `npm run check && npm run build` must both be green.

`SHIPPED` in the same file lists all nine sections. It exists so a future tenth
section can land incrementally — a section only appears in the sidebar once its
pages exist in both languages — but it is not filtering anything today.

## What `npm run check` enforces

[scripts/check-docs.mjs](scripts/check-docs.mjs), no dependencies:

- **parity** — every `en/**/*.md` has a `pt/` twin, and the reverse
- **internal links** — every `](/…)` resolves to a real file
- **language leakage** — nothing in `en/` links to `/pt/…`, or the reverse
- **sidebar ↔ disk** — no dead sidebar link, no orphan file

It runs before the build in CI, because VitePress only validates *relative*
links and this site uses absolute ones everywhere — the path has to say which
language.

## Conventions

- **Terse and problem-first.** Lead with the problem the reader has, not a
  definition. The `get-started/*` pages set the register.
- **Code is the source of truth.** Every code block is checked against
  `packages/*/src` before it ships. No invented options, no invented imports.
  Prefer lifting snippets from the framework's `src/` and `examples/`.
- **Internal links are absolute and language-prefixed** (`/en/…`, `/pt/…`).
- **Portuguese pages are rewritten, not translated.** Terminology follows the
  glossary.

## Why old URLs 404

The pre-2026-08 URLs (`/guias/*`, `/referencia/*`, `/como-funciona/*`,
`/comecar/*`, `/concepts/*`, `/getting-started`, `/problemas-comuns`) return 404.

Redirect stubs were built for all 38 and then removed. The site was first
published on 2026-07-23 and the Portuguese pages on 2026-08-03 — under three
weeks old when the documentation was reorganised. They were Portuguese URLs for
a pre-1.0 framework that had just been renamed, so realistically nobody holds a
link to them; 38 files that are not pages cost more in repository noise than
they were worth, and each one built a ~33 KB page carrying the whole theme
bundle to display one sentence.

The residual case is handled by `themeConfig.notFound` in [en.ts](.vitepress/en.ts)
and [pt.ts](.vitepress/pt.ts), which explains the split and links to both homes.
One mechanism covering every old URL, including ones no redirect map anticipated.

> VitePress renders 404 on the client: `404.html` is a shell and the theme picks
> the language from the route after hydration. Both languages are embedded.
> Without JavaScript the 404 is blank — a VitePress limitation.
