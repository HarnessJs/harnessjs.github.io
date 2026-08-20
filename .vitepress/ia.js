/**
 * A árvore da documentação, em um lugar só.
 *
 * Os dois idiomas usam **os mesmos slugs** (`/en/fundamentals/agents` e
 * `/pt/fundamentals/agents`). Isso não é economia de digitação: é o que faz o
 * seletor de idioma do VitePress (`i18nRouting`) sempre cair na página
 * equivalente, e o que reduz a checagem de paridade a um diff de arquivos.
 *
 * Acrescentar um idioma é acrescentar um arquivo de locale que lê este mesmo
 * manifesto — a estrutura não é redigitada, então ela não diverge.
 *
 * O manifesto descreve a árvore **inteira** — inclusive o que ainda não foi
 * escrito. Quem decide o que vai para o ar é o `SHIPPED` no fim do arquivo: uma
 * seção só aparece na sidebar quando as suas páginas existem nos dois idiomas.
 * Assim o alvo fica registrado sem que o site quebre no meio do caminho, e o
 * `scripts/check-docs.mjs` cobra as duas direções (link morto na sidebar,
 * arquivo órfão sem sidebar).
 */

/**
 * É JavaScript com JSDoc, e não TypeScript, de propósito: este módulo é lido
 * pelo `config.ts` (que o esbuild empacota) **e** pelo `scripts/check-docs.mjs`,
 * que roda no Node puro, sem etapa de build e sem flag experimental.
 */

/**
 * Um idioma suportado. Acrescente aqui e em `.vitepress/config.ts`.
 * @typedef {"en" | "pt"} Lang
 */

/**
 * @typedef {object} Page
 * @property {string} slug Último segmento da URL. Igual em todos os idiomas.
 * @property {Record<Lang, string>} title Título na sidebar, por idioma.
 */

/**
 * @typedef {object} Section
 * @property {string} slug
 * @property {Record<Lang, string>} title
 * @property {Page[]} pages
 */

/** @type {Section[]} */
export const IA = [
  {
    slug: "get-started",
    title: { en: "Get Started", pt: "Começar" },
    pages: [
      {
        slug: "introduction",
        title: { en: "Introduction", pt: "Introdução" },
      },
      {
        slug: "installation",
        title: { en: "Installation", pt: "Instalação" },
      },
      {
        slug: "first-agent",
        title: { en: "Your first agent", pt: "Seu primeiro agente" },
      },
      {
        slug: "first-tool",
        title: { en: "Your first tool", pt: "Sua primeira tool" },
      },
      {
        slug: "first-workflow",
        title: { en: "Your first workflow", pt: "Seu primeiro workflow" },
      },
      {
        slug: "configuration",
        title: { en: "Configuration", pt: "Configuração" },
      },
      {
        slug: "next-steps",
        title: { en: "Next steps", pt: "Próximos passos" },
      },
    ],
  },
  {
    slug: "fundamentals",
    title: { en: "Fundamentals", pt: "Fundamentos" },
    pages: [
      { slug: "agents", title: { en: "Agents", pt: "Agentes" } },
      { slug: "tools", title: { en: "Tools", pt: "Tools" } },
      { slug: "workflows", title: { en: "Workflows", pt: "Workflows" } },
      { slug: "providers", title: { en: "Providers", pt: "Providers" } },
      { slug: "the-run", title: { en: "The run", pt: "A execução" } },
      {
        slug: "whats-automatic",
        title: { en: "What's automatic", pt: "O que é automático" },
      },
      {
        slug: "state-and-context",
        title: { en: "State and context", pt: "Estado e contexto" },
      },
      { slug: "memory", title: { en: "Memory", pt: "Memória" } },
      { slug: "hooks", title: { en: "Hooks", pt: "Hooks" } },
      {
        slug: "middleware",
        title: { en: "Middleware and plugins", pt: "Middleware e plugins" },
      },
      {
        slug: "dependency-injection",
        title: { en: "Dependency injection", pt: "Injeção de dependência" },
      },
      { slug: "streaming", title: { en: "Streaming", pt: "Streaming" } },
      { slug: "errors", title: { en: "Errors", pt: "Erros" } },
    ],
  },
  {
    slug: "techniques",
    title: { en: "Techniques", pt: "Técnicas" },
    pages: [
      { slug: "tool-design", title: { en: "Tool design", pt: "Projetar tools" } },
      { slug: "loops", title: { en: "Loops", pt: "Laços" } },
      {
        slug: "parallel-execution",
        title: { en: "Parallel execution", pt: "Execução paralela" },
      },
      {
        slug: "multi-agent-systems",
        title: { en: "Multi-agent systems", pt: "Sistemas multiagente" },
      },
      { slug: "nested-runs", title: { en: "Nested runs", pt: "Execuções aninhadas" } },
      { slug: "budgets", title: { en: "Budgets", pt: "Orçamentos" } },
      { slug: "cancellation", title: { en: "Cancellation", pt: "Cancelamento" } },
      {
        slug: "retries",
        title: { en: "Retries and timeouts", pt: "Retry e timeout" },
      },
      {
        slug: "context-management",
        title: { en: "Context management", pt: "Janela de contexto" },
      },
      {
        slug: "vector-memory",
        title: { en: "Vector memory", pt: "Memória vetorial" },
      },
      {
        slug: "per-run-configuration",
        title: { en: "Per-run configuration", pt: "Configuração por execução" },
      },
    ],
  },
  {
    slug: "best-practices",
    title: { en: "Best Practices", pt: "Boas Práticas" },
    pages: [
      { slug: "architecture", title: { en: "Architecture", pt: "Arquitetura" } },
      { slug: "prompt-design", title: { en: "Prompt design", pt: "Escrever prompts" } },
      {
        slug: "error-handling",
        title: { en: "Error handling", pt: "Tratamento de erros" },
      },
      { slug: "security", title: { en: "Security", pt: "Segurança" } },
      { slug: "performance", title: { en: "Performance", pt: "Desempenho" } },
      { slug: "testing", title: { en: "Testing", pt: "Testes" } },
      {
        slug: "observability",
        title: { en: "Observability", pt: "Observabilidade" },
      },
    ],
  },
  {
    slug: "devtools",
    title: { en: "DevTools", pt: "Ferramentas" },
    pages: [
      { slug: "cli", title: { en: "CLI", pt: "CLI" } },
      { slug: "flow", title: { en: "Flow", pt: "Flow" } },
      { slug: "report", title: { en: "Report", pt: "Report" } },
      { slug: "logging", title: { en: "Logging", pt: "Log" } },
      { slug: "debugging", title: { en: "Debugging", pt: "Depuração" } },
    ],
  },
  {
    slug: "advanced",
    title: { en: "Advanced", pt: "Avançado" },
    pages: [
      {
        slug: "execution-model",
        title: { en: "Execution model", pt: "Modelo de execução" },
      },
      {
        slug: "custom-providers",
        title: { en: "Custom providers", pt: "Providers próprios" },
      },
      {
        slug: "writing-plugins",
        title: { en: "Writing plugins", pt: "Escrever plugins" },
      },
      {
        slug: "custom-vector-stores",
        title: { en: "Custom vector stores", pt: "Bancos vetoriais próprios" },
      },
      {
        slug: "http-transport",
        title: { en: "HTTP transport", pt: "Transporte HTTP" },
      },
      { slug: "redaction", title: { en: "Redaction", pt: "Mascaramento" } },
    ],
  },
  {
    slug: "deployment",
    title: { en: "Deployment", pt: "Implantação" },
    pages: [
      { slug: "production", title: { en: "Production", pt: "Produção" } },
      {
        slug: "environment-variables",
        title: { en: "Environment variables", pt: "Variáveis de ambiente" },
      },
      { slug: "scaling", title: { en: "Scaling", pt: "Escala" } },
      { slug: "multi-tenancy", title: { en: "Multi-tenancy", pt: "Multi-tenancy" } },
    ],
  },
  {
    slug: "reference",
    title: { en: "Reference", pt: "Referência" },
    pages: [
      { slug: "agent", title: { en: "@Agent", pt: "@Agent" } },
      { slug: "tool", title: { en: "@Tool", pt: "@Tool" } },
      { slug: "workflow", title: { en: "@Workflow", pt: "@Workflow" } },
      { slug: "steps", title: { en: "Steps", pt: "Passos" } },
      { slug: "thena-config", title: { en: "ThenaConfig", pt: "ThenaConfig" } },
      { slug: "run", title: { en: "Run and RunHandle", pt: "Run e RunHandle" } },
      { slug: "context", title: { en: "Context", pt: "Contexto" } },
      { slug: "hooks", title: { en: "Hooks", pt: "Hooks" } },
      { slug: "injection", title: { en: "Injection", pt: "Injeção" } },
      { slug: "providers", title: { en: "Providers", pt: "Providers" } },
      { slug: "vector-store", title: { en: "Vector store", pt: "Banco vetorial" } },
    ],
  },
  {
    slug: "help",
    title: { en: "Help", pt: "Ajuda" },
    pages: [
      { slug: "faq", title: { en: "FAQ", pt: "Perguntas frequentes" } },
      {
        slug: "troubleshooting",
        title: { en: "Troubleshooting", pt: "Problemas comuns" },
      },
      { slug: "glossary", title: { en: "Glossary", pt: "Glossário" } },
      { slug: "migration", title: { en: "Migration", pt: "Migração" } },
      { slug: "support", title: { en: "Support", pt: "Suporte" } },
    ],
  },
];

/**
 * As seções já escritas nos dois idiomas — as únicas que entram na sidebar.
 *
 * Acrescente uma seção aqui **depois** de as páginas existirem em `en/` e em
 * `pt/`. O `npm run check` confere, e o build do VitePress quebraria de
 * qualquer forma num link morto.
 */
export const SHIPPED = ["get-started", "fundamentals", "techniques", "devtools", "advanced", "deployment", "best-practices", "reference", "help"];

/**
 * As seções publicadas, na ordem do manifesto.
 * @returns {Section[]}
 */
export function shippedSections() {
  return IA.filter((s) => SHIPPED.includes(s.slug));
}

/**
 * `/{lang}/{section}/{page}` — a única função que monta URL de página.
 * @param {Lang} lang
 * @param {string} section
 * @param {string} page
 * @returns {string}
 */
export function href(lang, section, page) {
  return `/${lang}/${section}/${page}`;
}

/**
 * A sidebar do VitePress para um idioma, derivada do manifesto acima.
 * @param {Lang} lang
 */
export function sidebar(lang) {
  return shippedSections().map((section) => ({
    text: section.title[lang],
    collapsed: false,
    items: section.pages.map((page) => ({
      text: page.title[lang],
      link: href(lang, section.slug, page.slug),
    })),
  }));
}

/**
 * Caminhos das páginas publicadas de um idioma. Usado pelo `check-docs.mjs`.
 * @param {Lang} lang
 * @returns {string[]}
 */
export function allPaths(lang) {
  return shippedSections().flatMap((s) =>
    s.pages.map((p) => href(lang, s.slug, p.slug)),
  );
}
