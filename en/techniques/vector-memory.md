# Vector memory

Semantic search: store texts, retrieve them by **similarity** rather than by key.
For when the knowledge is too large to fit in a prompt and you need the relevant
slice.

Nothing is retrieved automatically. You decide when to search and how to format
what comes back.

## Setup

```ts
// src/vector/project.store.ts
import { QdrantStore } from "@thenajs/qdrant-client";

export class ProjectMemory extends QdrantStore {
  constructor() {
    super({ url: "http://localhost:6333", collection: "project" });
  }
}
```

```ts
// src/config.ts
export const config: ThenaConfig = { stores: [ProjectMemory] };
```

The class — not an instance — is registered, and instantiated **once** for the
whole app.

```ts
@Agent({ provider: LocalOllamaProvider, prompt: "./assistant.agent.md" })
export class AssistantAgent {
  constructor(@memory(ProjectMemory) private readonly vectors: VectorMemory) {}
}
```

## The retrieval pattern

`beforePrompt` is where it goes:

```ts
async beforePrompt(prompt: string, ctx: Context) {
  const question = ctx.state.history.at(-1)?.content ?? "";
  const hits = await this.vectors.recall(question, { limit: 3 });
  if (!hits.length) return;                      // keep the prompt unchanged

  return `${prompt}

## Possibly relevant
${hits.map((h) => `- ${h.text}`).join("\n")}`;
}
```

Three decisions are yours and matter more than the store: **what** you search
with, **how many** hits you take, and **how** you format them.

## Searching with the right text

The last user message is the obvious query and often the wrong one. In a loop,
the last message may be a tool result; halfway through a conversation, "and what
about that one?" embeds to nothing useful.

Better queries, in rough order of effort:

```ts
// the original request, not the latest turn
const original = ctx.state.history.find((m) => m.role === "user")?.content;

// the last user message specifically
const lastUser = ctx.state.history.filter((m) => m.role === "user").at(-1)?.content;
```

For a conversational agent, embedding a short rolling summary beats embedding the
last line.

## Writing

```ts
await this.vectors.remember("The deploy runs at 3am UTC", {
  dataset: "runbook",
  payload: { source: "ops-wiki", updatedAt: Date.now() },
  id: "deploy-schedule", // your own id — writing again overwrites
});
```

Stable ids are what make re-indexing idempotent. Without one, re-ingesting a
document adds a duplicate that then competes with itself in every search.

`rememberMany` embeds in parallel and is much faster for a bulk load.

## Datasets

A logical partition inside one collection, chosen per call:

```ts
await vectors.remember(note, { dataset: "run-scratch" });
await vectors.recall(q, { dataset: "runbook" }); // only the runbook
await vectors.recall(q, { dataset: null }); // everything
```

Use it to keep a run's scratch notes apart from durable knowledge without
standing up a second store.

::: warning The most common bug
`remember` with no `dataset` writes to `"default"`. `recall({ dataset:
"persistent" })` will not find it, and returns empty with no error.
:::

## Tuning recall

**Start without `scoreThreshold`.** Look at the real scores first — a threshold
guessed before you have seen them either filters everything or nothing.

```ts
const hits = await vectors.recall(q, { limit: 10 });
console.log(hits.map((h) => [h.score, h.text.slice(0, 60)]));
```

Then set it from what you saw. Absolute values are not comparable between
embedding models.

**Keep `limit` small.** Three good chunks beat ten mediocre ones — recalled text
competes with the actual conversation for attention, and you pay for it every
turn.

**Filter with `where`** when the payload can narrow it before similarity does:

```ts
await vectors.recall(q, { where: { source: "ops-wiki" }, limit: 3 });
```

## Chunking

The framework stores what you give it. One 40KB document stored whole is one
embedding that means everything and matches nothing.

Split on structure — headings, paragraphs, functions — into pieces that each make
sense alone, then keep the identifying context in the text itself:

```ts
await vectors.rememberMany(
  sections.map((s) => ({
    text: `# ${doc.title} — ${s.heading}\n\n${s.body}`,
    dataset: "docs",
    id: `${doc.slug}#${s.slug}`,
    payload: { doc: doc.slug },
  })),
);
```

## Embeddings

They come from the agent's own `provider`. Point it at a dedicated model:

```ts
super({ host, model: "qwen2.5-coder:7b", embedModel: "nomic-embed-text" });
```

Without `embedModel`, Ollama uses the chat model — and most chat models are poor
at embeddings.

::: warning A collection holds one embedding size
```
This store was prepared with 768 dimensions, but received embeddings of 1536.
```
Two agents with different embedding models need two stores:
`stores: [QdrantNomic, QdrantOpenAI]`, injected by name with
`@memory(QdrantOpenAI)`.
:::

Changing embedding model means re-indexing everything. Old vectors are not
comparable to new ones.

## Cost and latency

Every `recall` is an embedding call plus a search. In a loop that runs ten times,
that is ten embedding calls — cheap per unit, not free. If the query has not
changed, cache it, or recall once before the loop rather than inside it.

## When not to use it

If everything fits in the prompt, put it in the prompt. A 20-line runbook belongs
in the agent's `.md`, or in `run({ memory })` — both are simpler, deterministic,
and cost nothing to retrieve.

Vector memory earns its complexity when the corpus is large enough that choosing
what to include is itself the problem.

## Related

- [Memory](/en/fundamentals/memory) — run memory vs vector memory
- [Vector store](/en/reference/vector-store) — the full API
- [Custom vector stores](/en/advanced/custom-vector-stores)
