# Custom vector stores

`VectorStore` is the contract between the framework and a vector database.
`@thenajs/qdrant-client` is one implementation, written against the same public
interface you would use.

```ts
import { VectorStore } from "@thenajs/core";
import type {
  VectorStoreCredentials,
  VectorDocument,
  VectorMatch,
  VectorSearch,
  VectorSelector,
  CollectionOptions,
} from "@thenajs/core";

export class MyStore extends VectorStore {
  constructor(credentials: VectorStoreCredentials) {
    super();
    this.configureTransport(credentials); // retry and timeout
    this.url = credentials.url.replace(/\/$/, "");
    this.collection = credentials.collection ?? "thena_memory";
  }
}
```

## What you implement

| Method | Called when |
| --- | --- |
| `ensureCollection(options)` | before the first write, once per store |
| `upsert(documents)` | `remember` / `rememberMany` |
| `search(params)` | `recall` |
| `remove(selector)` | `forget` |

`VectorMemory` sits above this and handles embedding, dataset partitioning and
the shape of what agents receive. Your store deals only in vectors and payloads.

## The shapes

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
  distance?: "cosine" | "euclid" | "dot" | "manhattan";
}
```

`where` is the neutral filter and covers most cases — translate it to your
database's format. `rawFilter` is the escape hatch for what a neutral shape
cannot express (ranges, geo, nested boolean logic); when present it **wins over**
`where` rather than merging, so users get one predictable answer instead of a
combination rule to memorise.

## Transport comes free

`VectorStore` extends `HttpTransport`, the same base as `Providers`. Call
`this.configureTransport(credentials)` in the constructor and use
`this.request()`:

```ts
async search(params: VectorSearch): Promise<VectorMatch[]> {
  const { response } = await this.request(`${this.url}/collections/${this.collection}/points/search`, {
    method: "POST",
    headers: this.headers(),
    body: JSON.stringify(toNativeSearch(params)),
  });
  if (!response.ok) throw new Error(`search failed (${response.status})`);
  const data = await response.json();
  return data.result.map(toVectorMatch);
}
```

You inherit retry, exponential backoff, `Retry-After` and optional timeout.

::: warning Retry and writes
The default retry policy repeats failed requests. That is safe for `search`, and
safe for `upsert` **if your ids are stable** — which is why `remember({ id })`
exists. If your backend's write is not idempotent, narrow `isRetryable` for that
path.
:::

Give a store a much shorter `timeoutMs` than a model. It should answer in
milliseconds:

```ts
super({ url, collection, retry: { maxAttempts: 3, timeoutMs: 5_000 } });
```

## Datasets are a payload field

The framework does not create a collection per dataset. It writes a field —
`datasetField`, default `"dataset"` — into the payload and filters on it, because
vector databases generally recommend partitioning by field rather than by
collection.

Your `search` must honour `where` for this to work. If it ignores `where`,
`recall({ dataset })` silently searches everything.

## Dimensions

`ensureCollection({ size })` is called with the embedding model's dimension,
taken from the first vector produced. A collection holds one size:

```
This store was prepared with 768 dimensions, but received embeddings of 1536.
```

Your implementation should detect the mismatch and fail loudly rather than
writing vectors that will never match. Two embedding models need two stores.

## Registering it

Exactly like the bundled one — the class, not an instance:

```ts
export class ProjectMemory extends MyStore {
  constructor() {
    super({ url: "http://localhost:7777", collection: "project" });
  }
}

export const config: ThenaConfig = { memory: [ProjectMemory] };
```

Instantiated once and shared by every agent: one connection, one
`ensureCollection`, however many agents exist.

## Testing

The contract is four methods over plain data, so an in-memory implementation is
short — and it makes agent tests deterministic and offline:

```ts
export class MemoryStore extends VectorStore {
  private points: VectorDocument[] = [];

  async ensureCollection() {}
  async upsert(docs: VectorDocument[]) {
    this.points.push(...docs);
  }
  async search({ vector, limit = 5 }: VectorSearch) {
    return this.points
      .map((p) => ({ id: p.id, score: cosine(p.vector, vector), payload: p.payload }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  async remove() {
    this.points = [];
  }
}
```

## Related

- [Vector store](/en/reference/vector-store) — the full API
- [Vector memory](/en/techniques/vector-memory) — usage patterns
- [HTTP transport](/en/advanced/http-transport)
