# Retries and timeouts

**Retry is on by default.** A `429` or a momentary `503` is retried up to 3
times, with growing backoff.

That is a deliberate exception to the framework's usual "mechanism, not policy"
rule: a transient network failure taking down a whole run is almost never what
anyone wants.

```ts
super({
  host,
  model,
  retry: {
    maxAttempts: 5,
    timeoutMs: 120_000,
  },
});
```

`retry: false` turns it off.

## The policy

```ts
interface RetryPolicy {
  maxAttempts?: number; // default 3, including the first
  timeoutMs?: number; // NO default
  initialDelayMs?: number; // default 500
  maxDelayMs?: number; // default 8000
  factor?: number; // default 2
  respectRetryAfter?: boolean; // default true
  isRetryable?: (info: RetryAttempt) => boolean;
  onRetry?: (info: RetryAttempt) => void;
}
```

Backoff is exponential from `initialDelayMs`, multiplied by `factor`, capped at
`maxDelayMs`. With the defaults: 500ms, 1s, 2s.

`respectRetryAfter` means a provider that tells you when to come back is
obeyed — which matters more than your backoff curve on a rate-limited API.

## Timeout is opt-in, and that is the trap

::: warning `timeoutMs` has no default
An arbitrary ceiling would abort a slow local model that works fine today.
:::

The failure this causes is worth recognising: **a run that dies with
`fetch failed` after roughly 300 seconds**. The request hung, nothing rejected,
so retry never fired — the runtime's own socket limit eventually killed it.

```ts
retry: { maxAttempts: 3, timeoutMs: 120_000 }
```

Pick a value above what your model takes in the worst case. Too short a ceiling
aborts legitimate work, and each abort costs a full attempt.

Rough starting points: a hosted API is usually well under 60s; a local 7B model
on CPU can take minutes for a long generation.

## Seeing it happen

```ts
retry: {
  maxAttempts: 5,
  onRetry: (info) => console.warn(`[retry] attempt ${info.attempt}`),
}
```

Without `onRetry`, retries are invisible — a run that silently took three
attempts looks identical to one that worked first time, except for the duration.

The provider also reports `attempts` on the response, which reaches the `chat`
node in the report.

## Deciding what is retryable

The default covers the transient HTTP cases. Override when your backend signals
differently:

```ts
retry: {
  isRetryable: (info) =>
    info.status === 429 ||
    info.status === 503 ||
    info.error?.name === "AbortError",
}
```

Be careful making non-idempotent things retryable. This policy applies to the
model call, which is safe to repeat — but the same `HttpTransport` backs a
custom vector store, where a retried write
may not be.

## It applies to vector stores too

`Providers` and `VectorStore` both extend `HttpTransport`, so a store inherits
the policy without code:

```ts
export class ProjectMemory extends QdrantStore {
  constructor() {
    super({
      url: "http://localhost:6333",
      collection: "project",
      retry: { maxAttempts: 3, timeoutMs: 5_000 },
    });
  }
}
```

A vector store deserves a **much** shorter timeout than a model — it should
answer in milliseconds, so a 5-second ceiling is generous.

## Retry is not the model retrying

Two different things that both get called "retry":

| | Retry policy | The agent loop |
| --- | --- | --- |
| Retries | the HTTP call | the model's reasoning |
| Because | the network failed | a tool returned an error |
| Configured by | `retry` on the provider | `loop({ maxIterations })` |
| Costs | one attempt, same tokens | a full extra turn |

A tool that fails does **not** trigger the retry policy — that failure is an
observation the model reads, and the next attempt is a new turn. See
[Errors](/en/fundamentals/errors).

## In your own tools

The framework retries its own HTTP calls, not yours. A tool calling an external
API owns its own policy — and should pass the run's signal so retrying does not
outlive a cancellation:

```ts
async execute(@input() { url }: { url: string }, @context() ctx: Context) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: ctx.signal });
      if (res.ok) return res.text();
    } catch (err) {
      if (ctx.signal.aborted) throw err;      // do not retry a cancellation
      if (attempt === 3) {
        return { content: `Service unavailable after 3 attempts.`, isError: true };
      }
    }
  }
}
```

## Related

- [Providers](/en/fundamentals/providers)
- [Providers reference](/en/reference/providers) — the full `RetryPolicy`
- [HTTP transport](/en/advanced/http-transport)
- [Errors](/en/fundamentals/errors)
