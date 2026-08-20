# Memory

"Memory" means two different things in ThenaJS, and keeping them apart saves a
lot of confusion.

| | Where it lives | Does the model read it? |
| --- | --- | --- |
| **Run memory** — `run({ memory })` | in the run's state, serialised into the `system` message | **yes**, every turn |
| **Vector memory** — `VectorMemory` | in a vector database, outside the run | only what you `recall` and put in the prompt |

Neither is automatic in the sense that matters: nothing is retrieved and injected
on your behalf.

## Run memory

Durable context for this run. You seed it, and it is on the `system` message from
the first turn:

```ts
await app.run({
  input: { message: "What should I do next?" },
  memory: { userId: "123", plan: "pro" },
});
```

Agents and hooks can add to it during the run:

```ts
ctx.state.append("memory", "The user prefers short answers");
```

Because it goes to the model, it also goes into the report. Anything the model
should **not** see belongs in [`run({ data })`](/en/fundamentals/state-and-context#memory-vs-data)
instead.

Run memory is not persistent. It lasts as long as the run. Persisting it across
runs is your application's job — load it, pass it to `run({ memory })`, save
whatever changed.

## Vector memory

Semantic search: the agent stores texts and retrieves them **by similarity**
rather than by key. This is what you want for "have we seen something like this
before".

Register the store once, in the config:

```ts
import { QdrantStore } from "@thenajs/qdrant-client";

export class ProjectMemory extends QdrantStore {
  constructor() {
    super({ url: "http://localhost:6333", collection: "project" });
  }
}

export const config: ThenaConfig = { memory: [ProjectMemory] };
```

Each class is instantiated **once** and shared by every agent — one connection
and one collection setup, no matter how many agents exist.

The agent asks for it:

```ts
@Agent({ provider: LocalOllamaProvider, prompt: "./assistant.agent.md" })
export class AssistantAgent {
  constructor(@memory(ProjectMemory) private readonly vectors: VectorMemory) {}

  async beforePrompt(prompt: string, ctx: Context) {
    const question = ctx.state.history.at(-1)?.content ?? "";
    const hits = await this.vectors.recall(question, { limit: 3 });
    if (!hits.length) return;
    return `${prompt}\n\n## Related\n${hits.map((h) => h.text).join("\n")}`;
  }
}
```

That `beforePrompt` is the whole pattern: **you** decide when to search and how
to format what comes back. The framework never injects retrieved context on its
own.

### The API

```ts
await vectors.remember("text to store", { dataset: "notes" });
await vectors.rememberMany([{ text: "a" }, { text: "b" }]);

const hits = await vectors.recall("query", {
  limit: 5,
  dataset: "notes", // omit for the default; `null` searches all of them
  scoreThreshold: 0.7,
});

await vectors.forget({ dataset: "notes" });
```

Embeddings come from the agent's own `provider`, whose `embed()` is public. Point
it at a dedicated model with `embedModel` — most chat models are poor at
embeddings.

### Datasets

A dataset is a logical partition inside one collection, chosen per call. It is
the answer to "keep this run's scratch notes apart from the durable knowledge
base" without standing up a second store.

The most common bug: `remember` with no `dataset` writes to `"default"`, and
`recall({ dataset: "persistent" })` will not find it. `{ dataset: null }`
searches everything.

### Several stores

```ts
memory: [QdrantNomic, QdrantOpenAI];
```

Multiple stores make sense when they are mutually incompatible — typically
embedding models of different dimensions, which cannot share a collection.

Injection from that array is **positional**, and TypeScript cannot catch a
reorder because the parameters have the same type. Name the store instead:

```ts
constructor(@memory(QdrantOpenAI) private readonly v: VectorMemory) {}
```

::: warning A collection holds one embedding size
Two agents with different embedding models pointing at the same store gives you
`This store was prepared with 768 dimensions, but received embeddings of 1536`.
Each model needs its own store.
:::

## When you need neither

Most agents. A single-turn agent, or a workflow whose steps share everything
through the conversation history, needs no memory configuration at all.

Reach for run memory when a fact must survive across steps and be visible to the
model. Reach for vector memory when the knowledge is too large to fit in a prompt
and you need to retrieve the relevant slice.

## Related

- [State and context](/en/fundamentals/state-and-context) — `memory` vs `data`
