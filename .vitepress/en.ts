import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";
import { href, sidebar } from "./ia.js";
import { github, npmMenu } from "./shared.js";

export const en: LocaleSpecificConfig<DefaultTheme.Config> & { label: string } = {
  label: "English",
  lang: "en-US",
  description:
    "TypeScript framework for LLM agents: per-run isolation, budgets, cancellation and a full execution report.",

  themeConfig: {
    nav: [
      { text: "Get Started", link: href("en", "get-started", "introduction") },
      npmMenu,
    ],

    sidebar: sidebar("en"),

    editLink: {
      pattern: "https://github.com/thenajs/thenajs.github.io/edit/main/:path",
      text: "Suggest a change to this page",
    },

    outline: { level: [2, 3], label: "On this page" },
    docFooter: { prev: "Previous", next: "Next" },

    footer: {
      message: "Released under the MIT License.",
      copyright: `<a href="${github}">ThenaJS on GitHub</a>`,
    },

    // Quem chega por um link de antes da reorganização cai aqui. As URLs
    // antigas não viraram redirecionamento — o site tinha menos de um mês —,
    // então esta página é o que resta para orientar.
    notFound: {
      title: "Page not found",
      quote:
        "The documentation was reorganised and is now split by language. Every page lives under /en/ or /pt/.",
      linkText: "Go to the documentation",
      linkLabel: "go to the English documentation",
    },

    lastUpdatedText: "Updated",
    darkModeSwitchLabel: "Theme",
    lightModeSwitchTitle: "Switch to light theme",
    darkModeSwitchTitle: "Switch to dark theme",
    sidebarMenuLabel: "Menu",
    returnToTopLabel: "Back to top",
    langMenuLabel: "Change language",
  },
};
