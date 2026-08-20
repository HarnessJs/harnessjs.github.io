import type { DefaultTheme, UserConfig } from "vitepress";

export const github = "https://github.com/thenajs/ThenaJS";
export const site = "https://thenajs.github.io";

/**
 * Páginas que existem mas não são conteúdo: a raiz é só a casca que escolhe o
 * idioma, e a 404 não deve ser oferecida a buscador.
 *
 * As URLs das gerações anteriores do site (`/guias/…`, `/referencia/…`,
 * `/concepts/…`) **não** viraram redirecionamento. O site tinha menos de um mês
 * quando foi reorganizado, e 38 páginas de redirect custariam mais em ruído no
 * repositório do que valeriam em link preservado. Quem chegar por um link antigo
 * cai na `404.md`, que é bilíngue e leva às duas home.
 */
const NOT_CONTENT = [
  /^\/$/, // a casca que escolhe o idioma
  /^\/404$/,
];

/** O que não muda de idioma: identidade visual, SEO e links externos. */
export const shared: UserConfig<DefaultTheme.Config> = {
  // Publicado em thenajs.github.io (página de organização), logo na raiz.
  base: "/",
  cleanUrls: true,
  // O README é do repositório, não do site publicado.
  srcExclude: ["README.md"],
  lastUpdated: true,
  sitemap: {
    hostname: site,
    transformItems: (items) =>
      items.filter(({ url }) => {
        const path = url.startsWith("/") ? url : `/${url}`;
        return !NOT_CONTENT.some((re) => re.test(path));
      }),
  },

  head: [
    ["link", { rel: "icon", href: "/assets/logo.png" }],
    // Carmesim do logo. Era #5B8DEF — o site tinha uma identidade, o logo outra.
    ["meta", { name: "theme-color", content: "#FE374C" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:image", content: `${site}/assets/branding.png` }],
  ],

  themeConfig: {
    logo: "/assets/logo.png",
    socialLinks: [{ icon: "github", link: github }],
    outline: { level: [2, 3] },
    search: {
      provider: "local",
      // A busca local do VitePress particiona o índice por idioma sozinha: uma
      // página em `/pt/` não aparece na busca feita em `/en/`. O que fica por
      // conta daqui é o texto da interface.
      options: {
        locales: {
          pt: {
            translations: {
              button: {
                buttonText: "Buscar",
                buttonAriaLabel: "Buscar",
              },
              modal: {
                displayDetails: "Mostrar detalhes",
                resetButtonTitle: "Limpar busca",
                backButtonTitle: "Fechar",
                noResultsText: "Nenhum resultado para",
                footer: {
                  selectText: "para selecionar",
                  selectKeyAriaLabel: "enter",
                  navigateText: "para navegar",
                  navigateUpKeyAriaLabel: "seta para cima",
                  navigateDownKeyAriaLabel: "seta para baixo",
                  closeText: "para fechar",
                  closeKeyAriaLabel: "escape",
                },
              },
            },
          },
        },
      },
    },
  },
};

/** Os pacotes publicados, iguais nos dois idiomas. */
export const npmMenu: DefaultTheme.NavItemWithChildren = {
  text: "npm",
  items: [
    { text: "@thenajs/core", link: "https://www.npmjs.com/package/@thenajs/core" },
    {
      text: "@thenajs/qdrant-client",
      link: "https://www.npmjs.com/package/@thenajs/qdrant-client",
    },
    { text: "@thenajs/flow", link: "https://www.npmjs.com/package/@thenajs/flow" },
    { text: "@thenajs/cli", link: "https://www.npmjs.com/package/@thenajs/cli" },
  ],
};
