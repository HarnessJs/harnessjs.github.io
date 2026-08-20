# CLI

```bash
npm install -g @thenajs/cli
```

Two commands. The CLI scaffolds; it does not run or manage your project.

```
thena create <name>        Creates a new project in ./<name>
thena g agent <name>       Generates an agent in src/agents/<name>/

  -v, --version            Show the version
  -h, --help               Show help
```

## `thena create`

```bash
thena create my-agent
cd my-agent
npm install
npm start
```

Generates a project ready to edit:

```
my-agent/
  package.json
  tsconfig.json
  README.md
  .gitignore
  src/
    main.ts                     # entry point
    config.ts                   # log and report
    providers/
      ollama.provider.ts        # which model to use
    agents/
      assistant/
        assistant.agent.ts      # the logic
        assistant.agent.md      # the prompt
    workflows/
      assistant.workflow.ts     # the order of the steps
```

It refuses to overwrite: if the directory exists, it exits with an error.

The generated project targets a local Ollama. Change the model in
`src/providers/ollama.provider.ts`.

::: tip Generated projects are CommonJS
Since 0.9, matching the `nest new` default. This affects newly created projects
only — your `.ts` still uses `import` syntax, and TypeScript compiles it.
:::

## `thena g agent`

Run it **inside a project**:

```bash
thena g agent explorer
```

```
CREATE src/agents/explorer/explorer.agent.ts
CREATE src/agents/explorer/explorer.agent.md
```

The pair is the point: the class and its prompt, side by side. It also refuses to
overwrite an existing agent.

What it does **not** do is register the agent — you add it to a workflow's `steps`
yourself:

```ts
@Workflow({ steps: [ExplorerAgent] })
export class ExplorerWorkflow {}
```

There is no `thena g tool`, `thena g workflow` or `thena g provider`. A tool is a
class with three fields; the scaffolding would not save you much.

## Inside the monorepo

Contributors working on ThenaJS itself run it through npm:

```bash
npm run thena -- g agent explorer
```

## What the CLI is not

It does not run your app (`npm start` does), does not build, does not manage
migrations, and has no plugin system. It writes files and stops.

::: warning The CLI still prints Portuguese
`thena create` and `thena g` emit their usage text and errors in Portuguese
(`Uso:`, `Erro:`, `Criando o projeto…`) even though the rest of the framework's
user-facing strings were moved to English in 0.9. The commands and flags
themselves are English and work as documented here.
:::

## Related

- [Installation](/en/get-started/installation)
- [Your first agent](/en/get-started/first-agent)
- [Development workflow](/en/devtools/debugging)
