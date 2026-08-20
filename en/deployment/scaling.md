# Scaling

An agent service is unusual: requests take seconds to minutes, cost real money,
and spend almost all their time waiting on someone else's API. That changes what
"scaling" means.

## The bottleneck is almost never Node

A run is mostly `await` on a model. One process handles a large number of
concurrent runs comfortably, because they are all idle at the same time.

The real ceilings, in the order you will hit them:

1. **the provider's rate limit** — `429`s, which retry backs off on
2. **cost** — money, long before CPU
3. **the model's own throughput** — a local Ollama serves roughly one generation
   at a time
4. **memory**, if you retain handles or reports
5. **CPU**, last, and usually only from observation overhead

Measure before you scale horizontally. Adding processes against a shared rate
limit makes `429`s more frequent, not less.

## Concurrency is free; safety is yours

```ts
const app = Thena.create(MyWorkflow, config); // once
await Promise.all(requests.map((r) => app.run({ input: r })));
```

Each run opens its own `RunContext` — state, budget, history, recorder, signal.
Nothing is shared.

::: warning What the framework cannot isolate
Module-level mutable state in **your** code:

```ts
let lastTenant = ""; // shared by every concurrent run
```

Everything per-run goes through `ctx.data` or the workflow state. This is the
number one cause of "works alone, breaks under load".
:::

## Limit concurrency deliberately

Unbounded concurrency against a rate-limited provider produces a burst of `429`s,
which retry then backs off on — turning a fast overload into a slow one.

Put a queue in front:

```ts
import pLimit from "p-limit";
const limit = pLimit(10);

await Promise.all(requests.map((r) => limit(() => app.run({ input: r }))));
```

For a local Ollama, the useful number is small — often 1 or 2. It serves one
generation at a time, so more concurrency just adds queueing you cannot see.

## Turn observation off where you do not need it

A run with no `report`, `log`, plugin or `observe: true` skips building the
execution tree, emitting events and requesting streaming. That is worth roughly
**2× in CPU time per run**.

For a high-volume service, that is the single biggest lever inside the framework:

```ts
await app.run({
  input,
  log: false,
  report: debug ? { dir: `report/${req.id}` } : false,
});
```

Sample instead of recording everything.

## The cost levers, in order of effect

**Fewer turns.** A `maxIterations` of 8 that usually finishes in 3 is fine; one
that usually finishes in 8 means the stopping condition is not working. Check
`exhausted` in the report.

**Fewer agents.** Every split adds at least one model call per run. See
[Multi-agent systems](/en/techniques/multi-agent-systems).

**Smaller history.** Every turn resends the whole conversation, so a bloated
history multiplies across turns. See
[Context management](/en/techniques/context-management).

**A smaller model where it fits.** Per-agent `provider` means a classifier step
does not need the model the reasoning step needs.

**Caching.** A `chat` middleware that memoises identical calls is a few lines,
and deterministic runs (`temperature: 0`) hit it far more often than you would
expect:

```ts
chat: async (inv, next) => {
  const key = hash(inv.messages);
  return (await cache.get(key)) ?? cache.set(key, await next());
};
```

## Horizontal scaling

The process is stateless between runs, so it scales like any Node service — as
long as you have not put state in a module variable.

What does not scale automatically:

| Thing | Note |
| --- | --- |
| POST+SSE handle map | in-process; the stream must hit the same instance (sticky sessions) |
| rate limits | shared across instances; per-instance limits multiply |
| `report/` on disk | local to each instance and usually not what you want |
| vector store | genuinely shared, and the one thing that must be external |

Long-running runs also make deploys awkward — drain with `app.dispose()` on
`SIGTERM` and give the container a `terminationGracePeriod` longer than your
`maxDurationMs`.

## Latency

Most of it is the model. What you control:

- **`parallel`** for independent branches — three 2s calls become ~2s, not 6s
- **streaming** so the user sees tokens rather than waiting for the whole answer
- **fewer, larger tool calls** rather than many small round trips
- **prompt caching**, which is why `contextWindow()` never trims the head — a
  stable prefix keeps the provider's discount

## What to watch

From the report or your plugin:

| Metric | Warning sign |
| --- | --- |
| `chatCalls` per run | climbing means loops are not converging |
| `exhausted: true` rate | the stopping condition is not working |
| `toolCallSource: "rescued"` | the model is at the edge of the task |
| `attempts` present | provider instability |
| `costUsd` per run | the number that decides everything else |

## Related

- [Production](/en/deployment/production)
- [Performance](/en/best-practices/performance)
- [Budgets](/en/techniques/budgets)
- [Observability](/en/best-practices/observability)
