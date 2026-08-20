# Introduction

ThenaJS is a TypeScript framework for building **agents** — programs that take a
task, decide on their own which actions to run, run them, look at the result, and
keep going until they are done.

The central idea is to separate two things that usually get tangled together:

- **The logic lives in `.ts`** — which actions the agent may take, which model it
  uses, how the steps chain together.
- **The behaviour lives in `.md`** — the prompt, in markdown, which you edit
  without recompiling anything.

```ts
@Agent({
  provider: LocalOllamaProvider,
  tools: [ShellTool],
  prompt: "./explorer.agent.md",
})
export class ExplorerAgent {}
```

That file is the entire agent. What is missing — assembling the messages, calling
the model, noticing that it asked for a tool, validating the arguments, running
it, feeding the result back and repeating — is the framework's job.

## What you write, and what you don't

| You write | The framework does |
| --- | --- |
| the prompt, in markdown | assembles the messages (system, user, assistant, tool) |
| the action, with a Zod schema | detects that the model wants to call it |
| — | validates the arguments against the schema |
| — | runs the action and feeds the result back to the model |
| the order of the steps | runs the pipeline and shares the state |
| — | records the execution tree for you to inspect |

That split has one consequence worth calling out: **you never write an `if` to
find out whether the model asked for a tool, or which one.** That part is
deliberately closed — it is where most hand-rolled agents have their bugs, and
where different models disagree the most.

## When it fits

It fits when the task takes **several turns**: the agent investigates, decides,
acts, looks at the result and decides again. An assistant that reads files before
answering. A reviewer that runs the linter and comments. An operator that queries
a system and ships a deploy.

It does not fit if you only need **one call** to the model — transform a text,
classify it, extract a field. For that, the provider's own SDK is simpler and you
do not pay for an abstraction you never use.

## What's in the box

- **Providers** for Ollama and OpenAI, with retry and timeout. Or write your own.
- **Workflows** that chain agents in sequence, in parallel or in a loop.
- **Hooks** to intercept the prompt, the tools, the response and errors.
- **Report** in HTML with the execution tree, tokens and cost.
- **Vector memory** with a native Qdrant client, for semantic search.
- **Budgets** for time, calls, tokens and dollars, per run.
- **Live view** of a running execution as a graph in the browser.

All optional. An agent that only talks needs none of it.

## Requirements

- **Node 20.19 or newer**
- A model: [Ollama](https://ollama.com) running locally, or an OpenAI API key

If you have both, the next step is to [install](/en/get-started/installation).

## Status

ThenaJS is at **0.9.x**. The API described in these docs is what ships today, but
it has not reached 1.0 — expect breaking changes between minor versions, and read
the [migration notes](/en/help/migration) when you upgrade.
