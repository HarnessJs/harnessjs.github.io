import { defineConfig } from "vitepress";
import { en } from "./en.js";
import { pt } from "./pt.js";
import { shared } from "./shared.js";

/**
 * Os dois idiomas são prefixados — `/en/…` e `/pt/…` — e a raiz é uma página de
 * redirecionamento (`index.md`). Nenhum idioma mora em `/`.
 *
 * O motivo é o terceiro idioma: com `root` em inglês, acrescentar espanhol faria
 * o inglês continuar em `/` e o resto em `/xx/`, uma assimetria que aparece em
 * cada link e em cada checagem. Prefixando os dois desde já, acrescentar um
 * idioma é acrescentar um arquivo — nenhuma URL existente se move.
 *
 * `i18nRouting` fica no default (`true`): como os slugs são iguais nos dois
 * idiomas, o seletor troca `/en/` por `/pt/` e cai na página equivalente.
 */
export default defineConfig({
  ...shared,
  title: "ThenaJS",
  description: en.description,
  locales: { en, pt },
});
