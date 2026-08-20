# Glossary

The vocabulary used across these docs. It is also the translation contract: the
Portuguese pages use exactly the equivalents in the last column, and never
alternate between two words for the same thing.

## Core concepts

| Term | What it means | Portuguese |
| --- | --- | --- |
| **Agent** | A class decorated with `@Agent`, pairing a provider, a set of tools and a markdown prompt. One step of a workflow. | Agente |
| **Tool** | A class decorated with `@Tool`. An action the model may ask for, described by a name, a description and a Zod schema. | Tool |
| **Workflow** | A class decorated with `@Workflow`. Declares the order of the steps and the shared state. | Workflow |
| **Provider** | What talks to the model. `OllamaProvider`, `OpenAIProvider`, or your own. | Provider |
| **Run** | One execution of a workflow, from `app.run(...)` to its result. Has its own context, budget, cancellation and recorder. | Execução |
| **Step** | A unit inside `@Workflow({ steps })`: an agent, a `parallel` block or a `loop` block. | Passo |
| **Turn** | One round of the agent: a model call plus the tool it may have triggered. Summarised in `ctx.turn`. | Turno |

## Execution

| Term | What it means | Portuguese |
| --- | --- | --- |
| **Context** (`ctx`) | The object that crosses every step of a run. Carries `state`, `output`, `turn`, `data`, `signal` and the run controls. | Contexto |
| **State** | The class declared in `@Workflow({ state })`, instantiated once per run and injected with `@state()`. | Estado |
| **Memory** | The agent's working memory: `run({ memory })`, read by the model in every turn of this run, gone when it ends. | Memória |
| **Vector memory** | Long-term memory: `VectorMemory`, injected by `@memory()`, searched by similarity and outliving the run. The databases behind it are `ThenaConfig.stores`. | Memória vetorial |
| **Data** | `run({ data })`. The run's own data channel. Never goes to the model, never reaches the report. | Data |
| **Budget** | A ceiling for the whole run — time, calls, tokens, cost. | Orçamento |
| **Hook** | An optional method on the agent class (`beforePrompt`, `beforeTool`, `afterTool`, `afterResponse`, `onError`). | Hook |
| **Middleware** | A function wrapping every tool run (`tool`) or every model call (`chat`), registered through `app.use`. | Middleware |
| **Plugin** | An object passed to `app.use`. Observes (`onEvent`) and/or intercepts (`tool`, `chat`). | Plugin |
| **Runtime** | The layer that compiles a workflow and runs its steps. Reachable as `WorkflowRuntime` for nested runs. | Runtime |

## Observability

| Term | What it means | Portuguese |
| --- | --- | --- |
| **Report** | The HTML + JSON record written at the end of a run. | Report |
| **Recorder** | What builds the execution tree while the run happens. | Gravador |
| **Execution event** | An `ExecutionEvent`: the start or end of a step, delivered to `onEvent`, to `log` and to plugins. | Evento de execução |
| **Node** | An entry in the execution tree — `workflow`, `agent`, `chat`, `tool`, `loop`, `parallel`. | Nó |
| **Redaction** | Masking known secrets in captured content before it reaches the report, the log or a plugin. | Mascaramento |
| **Rescue** | Recovering a tool call the model wrote as text instead of a structured field. Shows up as `toolCallSource: "rescued"`. | Resgate |

## Vector memory

| Term | What it means | Portuguese |
| --- | --- | --- |
| **Vector store** | The backing database. `VectorStore` is the contract; `@thenajs/qdrant-client` is one implementation. | Banco vetorial |
| **Collection** | Where documents live in the store. Holds one embedding size. | Collection |
| **Dataset** | A logical partition inside a collection, chosen per `remember` / `recall`. | Dataset |
| **Embedding** | The vector representation of a text, produced by the provider's `embed()`. | Embedding |
| **Recall** | Retrieving by similarity. | Recall |
| **Remember** | Writing a document to the store. | Remember |

## Words we deliberately do not use

- **"Chain"** — the framework has workflows and steps. No chains.
- **"Prompt engineering"** — the prompt is a markdown file you edit. We say
  writing a prompt.
- **"LLM"** in body text — we say **model**. `LLM` appears only where it names
  the category, as in "a framework for LLM agents".
- **"Session"** — a run is a run. What persists between runs is memory.

## Notes for translators

Portuguese pages keep the English form for terms that are already the name of an
API symbol — `Tool`, `Workflow`, `Provider`, `Hook`, `Middleware`, `Plugin`,
`Runtime`, `Report`, `Dataset`, `Embedding`. Translating those would break the
link between the prose and the code the reader is looking at.

Terms that name a *concept* rather than a symbol are translated: Agent → Agente,
Run → Execução, Step → Passo, State → Estado, Context → Contexto, Budget →
Orçamento.

`Agente` is the one exception to the rule above, and it is deliberate: the word is
overwhelmingly used in Portuguese technical writing, and `@Agent` stays in English
in the code anyway.
