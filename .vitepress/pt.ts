import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";
import { href, sidebar } from "./ia.js";
import { github, npmMenu } from "./shared.js";

export const pt: LocaleSpecificConfig<DefaultTheme.Config> & { label: string } = {
  label: "Português",
  lang: "pt-BR",
  description:
    "Framework TypeScript para agentes de LLM: isolamento por execução, orçamentos, cancelamento e um report completo.",

  themeConfig: {
    nav: [
      { text: "Começar", link: href("pt", "get-started", "introduction") },
      npmMenu,
    ],

    sidebar: sidebar("pt"),

    editLink: {
      pattern: "https://github.com/thenajs/thenajs.github.io/edit/main/:path",
      text: "Sugerir uma mudança nesta página",
    },

    outline: { level: [2, 3], label: "Nesta página" },
    docFooter: { prev: "Anterior", next: "Próxima" },

    footer: {
      message: "Publicado sob a licença MIT.",
      copyright: `<a href="${github}">ThenaJS no GitHub</a>`,
    },

    // Quem chega por um link de antes da reorganização cai aqui. As URLs
    // antigas não viraram redirecionamento — o site tinha menos de um mês —,
    // então esta página é o que resta para orientar.
    notFound: {
      title: "Página não encontrada",
      quote:
        "A documentação foi reorganizada e agora é dividida por idioma. Toda página fica sob /pt/ ou /en/.",
      linkText: "Ir para a documentação",
      linkLabel: "ir para a documentação em português",
    },

    lastUpdatedText: "Atualizado",
    darkModeSwitchLabel: "Tema",
    lightModeSwitchTitle: "Mudar para o tema claro",
    darkModeSwitchTitle: "Mudar para o tema escuro",
    sidebarMenuLabel: "Menu",
    returnToTopLabel: "Voltar ao topo",
    langMenuLabel: "Mudar de idioma",
  },
};
