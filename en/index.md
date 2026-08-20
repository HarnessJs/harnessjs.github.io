---
layout: home

hero:
  name: ThenaJS
  text: The TypeScript framework for LLM agents
  tagline: Declare an agent as a class and its prompt as markdown. Run it with isolation, budgets and cancellation built in.
  image:
    src: /assets/logo.png
    alt: ThenaJS
  actions:
    - theme: brand
      text: Build your first agent
      link: /en/get-started/first-agent
    - theme: alt
      text: Introduction
      link: /en/get-started/introduction
    - theme: alt
      text: GitHub
      link: https://github.com/thenajs/ThenaJS

features:
  - icon: 🛡️
    title: Limits are part of the API
    details: Budgets in time, calls, tokens and dollars. Cancellation that reaches inside your tools, not just between steps.
    link: /en/get-started/configuration
    linkText: Configure a run

  - icon: 🧵
    title: One process, many runs
    details: Each run gets its own context, budget and recorder. Concurrent requests never see each other's state.
    link: /en/get-started/first-workflow
    linkText: Orchestrate agents

  - icon: 🔍
    title: You can see what happened
    details: Every run can produce an HTML and JSON report — the full tree of agents, model calls and tool calls, with durations and token cost.
    link: /en/get-started/configuration
    linkText: Turn on the report
---

## Thirty seconds

```bash
npm install -g @thenajs/cli
thena create my-agent
cd my-agent && npm install && npm start
```

An agent is this:

```ts
// src/agents/explorer/explorer.agent.ts
import { Agent } from "@thenajs/core";
import { ShellTool } from "@thenajs/tools";
import { LocalOllamaProvider } from "../../providers/ollama.provider";

@Agent({
  provider: LocalOllamaProvider,
  tools: [ShellTool],
  prompt: "./explorer.agent.md", // the behaviour lives in the markdown
})
export class ExplorerAgent {}
```

```md
<!-- src/agents/explorer/explorer.agent.md -->

You explore software projects.

Use the shell to investigate before answering. Prefer read-only commands.
```

Not one line to handle messages, call the API, detect a tool call or validate
arguments. That is what the framework does.

## Why the name

**Thena** comes from **Athena** — and not by accident.

Athena is not the goddess of war. That is Ares. Athena is the goddess of
*strategic* war, of wisdom, and of craft. She is the one who plans before
acting, who hands the hero his tools, and who shows up to say when to stop.

That is the whole design brief. ThenaJS does not make your agent smarter. It
makes it **governed**: it plans (`@Workflow`), it acts through what you hand it
(`@Tool`), it knows its ceiling (`budget`), and it can be told to stop
(`abort`, `stop`).

## Where to go

| If you want to… | Go to |
| --- | --- |
| know whether it fits your case | [Introduction](/en/get-started/introduction) |
| get it running | [Installation](/en/get-started/installation) |
| build something, start to finish | [Your first agent](/en/get-started/first-agent) |
| see what to read next | [Next steps](/en/get-started/next-steps) |
