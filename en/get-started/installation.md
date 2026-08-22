# Installation

## Create a project

```bash
npm install -g @thenajs/cli
thena create my-agent
cd my-agent
npm install
```

`thena create` generates a project that is ready to edit:

```
src/
  agents/
    assistant/
      assistant.agent.ts    # the logic
      assistant.agent.md    # the prompt
  providers/
    ollama.provider.ts      # which model to use
  workflows/
    assistant.workflow.ts   # the order of the steps
  config.ts                 # log and report
  main.ts                   # entry point
```

## Point it at a model

The project ships configured for a local [Ollama](https://ollama.com). If you do
not have the model yet:

```bash
ollama pull qwen2.5-coder:7b
```

Adjust `src/providers/ollama.provider.ts` if you use a different host or model:

```ts
import { OllamaProvider } from "@thenajs/core";

export class LocalOllamaProvider extends OllamaProvider {
  constructor() {
    super({
      host: "http://localhost:11434",
      model: "qwen2.5-coder:7b",
      sampling: { temperature: 0 }, // see the note below
    });
  }
}
```

::: tip Start at `temperature: 0`
An agent is not a chat: you want the same input to produce the same decision. We
measured this on `qwen2.5-coder:1.5b` — the same question three times gave **three
different answers** with no `sampling`, and **three identical ones** with
`temperature: 0` and a `seed`. Raise the temperature later, where you actually
want variety.
:::

For OpenAI instead of Ollama:

```ts
import { OpenAIProvider } from "@thenajs/core";

export class GptProvider extends OpenAIProvider {
  constructor() {
    super({
      apiKey: process.env.OPENAI_API_KEY!,
      model: "gpt-4o-mini",
      sampling: { temperature: 0 },
    });
  }
}
```

## Run it

```bash
npm start
```

You should see the agent answer in the terminal. If something fails here,
[Troubleshooting](/en/help/troubleshooting) covers the first-run errors.

## Add it to an existing project

If you would rather install into a project you already have, instead of using the
CLI:

```bash
npm install @thenajs/core zod
```

The other packages are optional: `@thenajs/tools` for ready-made tools such as
[`ParallelTool`](/en/techniques/batched-tool-calls), `@thenajs/qdrant-client` for
vector memory, `@thenajs/flow` to watch a run live, and `@thenajs/cli` for
scaffolding.

Then enable decorators in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "experimentalDecorators": true,
    "strict": true
  }
}
```

::: warning `experimentalDecorators`, not the Stage 3 decorators
ThenaJS uses TypeScript's legacy decorators, because it relies on **parameter**
decorators (`@input()`, `@context()`, `@state()`, `@memory()`) — and the Stage 3
proposal does not have those. Leaving `experimentalDecorators` off is the most
common cause of a project that will not compile.
:::

Next: [create your first agent](/en/get-started/first-agent).
