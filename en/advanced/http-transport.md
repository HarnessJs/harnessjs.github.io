# HTTP transport

`HttpTransport` is the base class under everything in ThenaJS that talks to an
external service. `Providers` and `VectorStore` both extend it, so a custom
implementation of either inherits retry and timeout without writing any.

```ts
import { HttpTransport } from "@thenajs/core";
```

## What it provides

```ts
protected configureTransport(credentials?: TransportCredentials): void;
protected request(url: string, init?: RequestInit): Promise<{
  response: Response;
  attempts: number;
}>;
```

That is the whole surface. `request()` wraps `fetch` with:

- **retry** on transient failures, up to `maxAttempts` (default 3)
- **exponential backoff** from `initialDelayMs`, times `factor`, capped at
  `maxDelayMs`
- **`Retry-After`** honoured when the server sends it
- **per-attempt timeout** via `AbortSignal.timeout`, when `timeoutMs` is set
- an **`attempts` count** returned alongside the response

## Using it

```ts
export class MyClient extends HttpTransport {
  constructor(credentials: TransportCredentials & { url: string }) {
    super();
    this.configureTransport(credentials); // ← do not skip this
    this.url = credentials.url;
  }

  async fetchThing(id: string) {
    const { response, attempts } = await this.request(`${this.url}/things/${id}`);
    if (!response.ok) throw new Error(`failed (${response.status})`);
    return { thing: await response.json(), attempts };
  }
}
```

::: warning `configureTransport` is easy to forget
Without it the instance keeps the default policy rather than the one in the
credentials — so a `retry: false` or a `timeoutMs` the user configured is
silently ignored. The method exists to make that omission explicit.
:::

## `TransportCredentials`

```ts
interface TransportCredentials {
  retry?: RetryPolicy | boolean; // default: on
}
```

Every credentials type in the framework extends this, which is why `retry` works
identically on `OllamaProvider`, `OpenAIProvider` and `QdrantStore`.

See [Retries and timeouts](/en/techniques/retries) for the full policy.

## Return `attempts`

```ts
return { content, toolCalls, usage, attempts };
```

It reaches the `chat` node in the report and is the only signal that a run
silently took three tries. A provider that drops it makes backend instability
invisible.

## Different timeouts for different services

The right ceiling depends entirely on what is on the other end:

| Service | Reasonable `timeoutMs` |
| --- | --- |
| hosted model API | 60_000 |
| local model on CPU | 300_000, or none |
| vector store | 5_000 |
| your own internal API | whatever its SLO is |

The default is **no timeout**, deliberately — an arbitrary ceiling would abort a
slow local model that works today. The cost of that choice is the run that dies
with `fetch failed` after ~300 seconds, having never retried because nothing
rejected.

## Cancellation

`request()` does not receive the run's `AbortSignal`. Its timeout is per attempt
and independent of the run.

In a provider, the run's signal reaches the model call through the framework's
own plumbing. In your own tool or client, pass `ctx.signal` yourself:

```ts
async execute(@input() { id }: { id: string }, @context() ctx: Context) {
  const res = await fetch(`${this.url}/things/${id}`, { signal: ctx.signal });
  return res.text();
}
```

A tool that does not is the most common reason "abort does not work".

## Idempotency

Retry repeats the request. That is safe for reads and for writes with a stable
id, and unsafe otherwise. For a non-idempotent endpoint, narrow the policy:

```ts
retry: {
  isRetryable: (info) => info.status === 429 || info.status === 503,
}
```

Or turn it off for that client entirely with `retry: false`.

## When not to use it

`HttpTransport` is for the framework's extension points — providers and vector
stores. Inside a tool, plain `fetch` plus `ctx.signal` is simpler and does not
pull a class hierarchy into what is otherwise a function.

## Related

- [Retries and timeouts](/en/techniques/retries)
- [Custom providers](/en/advanced/custom-providers)
- [Custom vector stores](/en/advanced/custom-vector-stores)
