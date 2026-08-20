# Your first agent

You want a program that answers questions about a codebase. Not a chatbot — a
thing you can call from your own code, that reads files and tells you what it
found.

The smallest useful version of that is one agent.

## Two files

In ThenaJS an agent is a class, and its behaviour lives next to it in markdown.

```ts
// src/agents/explorer/explorer.agent.ts
import { Agent } from "@thenajs/core";
import { LocalOllamaProvider } from "../../providers/ollama.provider";

@Agent({
  provider: LocalOllamaProvider,
  tools: [],
  prompt: "./explorer.agent.md",
})
export class ExplorerAgent {}
```

```md
<!-- src/agents/explorer/explorer.agent.md -->

You explore software projects.

Answer in one short paragraph. If you are not sure, say so.
```

The split is deliberate. Prompts change constantly — a word here, an example
there — and they change for different reasons than code does. Keeping them in a
`.md` means a prompt tweak is a prompt diff, not a string edit buried in a
class.

The path is relative to the agent file, so the two live side by side.

## Running it

An agent runs inside a workflow. For a single agent, the workflow is one line:

```ts
// src/workflows/explorer.workflow.ts
import { Workflow } from "@thenajs/core";
import { ExplorerAgent } from "../agents/explorer/explorer.agent";

@Workflow({ steps: [ExplorerAgent] })
export class ExplorerWorkflow {}
```

```ts
// src/main.ts
import { Thena } from "@thenajs/core";
import { ExplorerWorkflow } from "./workflows/explorer.workflow";

async function bootstrap() {
  const app = Thena.create(ExplorerWorkflow, { log: true });

  console.log(await app.run({ input: { message: "What does this project do?" } }));

  await app.dispose();
}

bootstrap();
```

```bash
npm start
```

```
[thena] ▸ workflow ExplorerWorkflow
[thena]   ▸ agent ExplorerAgent
[thena]     ▸ chat
[thena]     ◂ chat  1.42s ✓
[thena]   ◂ agent ExplorerAgent  1.42s ✓
[thena] ◂ workflow ExplorerWorkflow  1.42s ✓

It looks like a TypeScript project, but I cannot read any files to be sure.
```

It answered. And it told you exactly what is wrong.

## What just happened

You wrote no code to build a `messages` array, call an HTTP endpoint, parse a
response or handle a retry. `Thena.create` compiled the workflow, `app.run`
opened a run, and the agent took one turn.

Two details that matter later:

- **`Thena.create` is not async.** There is nothing to wait for when you build
  the app. What you wait for is `app.run`.
- **`app.dispose()` matters.** It drains in-flight runs and shuts down plugins.
  In a script you can skip it; in a server you cannot.

## The problem

Read that answer again:

> I cannot read any files to be sure.

The agent is right. A model produces text. It has no filesystem, no network, no
way to touch anything. Ask it what is in `README.md` and it will guess — often
convincingly, which is worse.

To do anything, it needs something you hand it.

**Next: [give it a tool](/en/get-started/first-tool).**
