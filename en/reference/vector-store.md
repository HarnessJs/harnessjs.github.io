# Vector store

Two layers: `VectorStore` is the database contract, and `VectorMemory` is what
gets injected into agents — it pairs a store with a provider's `embed()`.

```ts
import type { VectorMemory, VectorStore } from "@thenajs/core";
import { QdrantStore } from "@thenajs/qdrant-client";
```

## `VectorMemory`

What `@memory()` delivers.

### `remember(text, options?)`

```ts
const id = await memory.remember("the deploy runs at 3am", {
  dataset: "notes",
  payload: { source: "runbook" },
  id: "runbook-1", // your own id, to overwrite an existing item
});
```

Returns the id. `rememberMany(items)` takes
`({ text } & RememberOptions)[]` and embeds them in parallel.

### `recall(query, options?)`

```ts
const hits = await memory.recall("when does the deploy run", {
  limit: 5,
  dataset: "notes", // omit for the default; `null` searches ALL datasets
  scoreThreshold: 0.7,
  where: { source: "runbook" },
});
```

```ts
interface RecallHit {
  text: string;
  score: number;
  dataset: string;
  id: string | number;
  payload?: Record<string, unknown>;
}
```

### `forget(selector?)`

```ts
await memory.forget({ ids: ["runbook-1"] });
await memory.forget({ dataset: "scratch" });
await memory.forget({ where: { source: "runbook" } });
```

### `store`

The underlying `VectorStore`, public so `@memory(Store)` can tell them apart.

## Datasets

A logical partition inside one collection, chosen per call. Vector databases
generally recommend partitioning by field rather than creating many collections.

| Call | Dataset used |
| --- | --- |
| `remember(t)` | the default, `"default"` |
| `recall(q)` | the default |
| `recall(q, { dataset: "x" })` | only `"x"` |
| `recall(q, { dataset: null })` | **all of them** |

The most common bug is writing to `"default"` and searching `"persistent"`.

## `VectorStoreCredentials`

```ts
interface VectorStoreCredentials extends TransportCredentials {
  url: string;
  apiKey?: string;
  collection?: string; // default "thena_memory"
  datasetField?: string; // default "dataset"
  retry?: RetryPolicy | boolean; // inherited, on by default
}
```

## `QdrantStore`

```ts
import { QdrantStore } from "@thenajs/qdrant-client";

export class ProjectMemory extends QdrantStore {
  constructor() {
    super({ url: "http://localhost:6333", collection: "project" });
  }
}
```

Register the class — not an instance — in the config:

```ts
export const config: ThenaConfig = { stores: [ProjectMemory] };
```

Instantiated **once** and shared by every agent.

## Writing your own store

Extend `VectorStore`, which extends `HttpTransport`, so retry and timeout come
for free.

```ts
interface VectorDocument {
  id: string | number;
  vector: number[];
  payload?: Record<string, unknown>;
}

interface VectorMatch {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
}

interface VectorSearch {
  vector: number[];
  limit?: number;
  where?: Record<string, unknown>; // simple equality on payload fields
  rawFilter?: unknown; // native format — WINS over `where`
  scoreThreshold?: number;
  withPayload?: boolean; // default true — the text lives there
}

interface CollectionOptions {
  size: number; // must match the embedding model
  distance?: VectorDistance; // "cosine" | "euclid" | "dot" | "manhattan"
}
```

See [Custom vector stores](/en/advanced/custom-vector-stores).

## Dimensions

```
This store was prepared with 768 dimensions, but received embeddings of 1536.
```

One collection holds one embedding size. Two agents with different embedding
models need two stores:

```ts
stores: [QdrantNomic, QdrantOpenAI];
```

Injection from that array is positional; `@memory(QdrantOpenAI)` names it
instead.

## Related

- [Memory](/en/fundamentals/memory) — the concept
- [Vector memory](/en/techniques/vector-memory) — patterns
- [Injection](/en/reference/injection)
