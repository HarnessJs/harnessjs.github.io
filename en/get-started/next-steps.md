# Next steps

You have an agent, a tool, a workflow and a configured run. That is the whole
surface you need for something real — everything past this point is depth.

## Read this next

**[What runs without me writing it?](/en/help/faq#what-runs-without-me-writing-it)**
— every framework hides something. The problem is not hiding it; it is not
knowing what was hidden. This is the exact list.

**[Troubleshooting](/en/help/troubleshooting)** — the errors people actually hit
on the first few runs, and what causes them.

**[Glossary](/en/help/glossary)** — the terms used throughout these docs, in
English and Portuguese, so the vocabulary stays fixed.

## Things worth knowing exist

Each of these is a real, shipped feature. Until its page lands here, the
[README](https://github.com/thenajs/ThenaJS#readme) documents it in full.

| | |
| --- | --- |
| **Hooks** | `beforePrompt`, `beforeTool`, `afterTool`, `afterResponse`, `onError` on the agent class — intercept without changing the framework |
| **Injection** | `@input()`, `@context()`, `@state()`, `@memory()` on tool and agent parameters, so order stops being a contract |
| **Middleware and plugins** | `app.use({ name, tool, chat })` wraps every tool run and every model call — caching, rate limiting, metrics |
| **Streaming** | `for await (const token of app.run({...}).textStream)` — tokens as the model writes them |
| **Cancellation** | `abort()` reaches your tool's `fetch` through `ctx.signal`; `stop()` ends the run gracefully instead |
| **Vector memory** | `@thenajs/qdrant-client` plus `@memory()` for semantic recall |
| **Live view** | `await app.use(thenaFlow())` from `@thenajs/flow` — the run as a graph in the browser |
| **Nested runs** | a tool that starts its own workflow, with its own history and its own budget |

## When something goes wrong

1. Turn on `log: "verbose"` — it shows the prompt and the tool I/O, which is
   usually enough.
2. Turn on `report: true` and open `report/index.html` — it lists every run, and
   each links to its own tree with durations and token cost.
3. Check [Troubleshooting](/en/help/troubleshooting).
4. Still stuck: [get support](/en/help/support).

## Contributing

The framework is at 0.9.x and moving. Issues, reproductions and pull requests are
welcome at [thenajs/ThenaJS](https://github.com/thenajs/ThenaJS); the docs live
separately at
[thenajs/thenajs.github.io](https://github.com/thenajs/thenajs.github.io).
