# Writing plugins

A plugin is an object with a `name` and at least one of four capabilities. There
is no registry, no base class, no build step.

```ts
import type { ThenaPlugin } from "@thenajs/core";

export function myPlugin(options: MyOptions = {}): ThenaPlugin {
  return {
    name: "my-plugin",
    async setup() {},
    onEvent(event) {},
    tool: async (inv, next) => next(),
    chat: async (inv, next) => next(),
    async dispose() {},
  };
}
```

```ts
await app.use(myPlugin());
```

The factory-function shape is convention, not requirement — it is just how you
take options.

## Observe or intercept

| | `onEvent` | `tool` / `chat` |
| --- | --- | --- |
| Participates in the run | no | **yes** |
| If it throws | swallowed; run unaffected | the run fails |
| Can change the outcome | no | yes |
| Cost | one call per step boundary | wraps every execution |

Prefer `onEvent` unless you need to change something. It cannot break a run, and
that guarantee is worth a lot in production.

## Observability plugin

```ts
export function otelPlugin(): ThenaPlugin {
  const spans = new Map<string, Span>();

  return {
    name: "otel",

    onEvent(event) {
      if (event.phase === "start") {
        const parent = event.parentId ? spans.get(event.parentId) : undefined;
        spans.set(event.id, tracer.startSpan(`${event.kind}:${event.name}`, { parent }));
        return;
      }
      const span = spans.get(event.id);
      if (!span) return;
      if (event.status === "error") span.recordException(event.error ?? "");
      span.end();
      spans.delete(event.id);
    },
  };
}
```

`id` and `parentId` are what let you rebuild the tree; `runId` keeps concurrent
runs apart. Delete on `end` — a long-lived process that never cleans that map
leaks.

## Interceptors

A `chat` cache:

```ts
chat: async (inv, next) => {
  const key = hash(inv.messages);
  const hit = await cache.get(key);
  if (hit) {
    inv.meta({ cacheHit: true }); // shows in the report and in Flow
    return hit; // no next() — the call never happens
  }
  const result = await next();
  await cache.set(key, result);
  return result;
};
```

A tool guard that the model can recover from:

```ts
tool: async (inv, next) => {
  if (inv.name === "deploy" && !allowed(inv.run)) {
    return { content: "Deploy is not allowed in this run.", isError: true };
  }
  return next();
};
```

Returning `isError` rather than throwing is the difference between "try something
else" and "this run is over".

## Rules that bite

**`next()` exactly once.** Twice rejects with
`next() was called more than once in the same middleware` — better than billing
you twice in silence. Zero times is legitimate: it replaces the execution.

**Return what `next()` returned**, unless replacing it is the point. A middleware
that calls `next()` and returns something else has silently swapped the output.

**Pass `inv.signal` and `inv.onToken` through** if you call the provider yourself
in a `chat` middleware. Dropping them breaks cancellation and streaming for that
call.

**`meta()` is a no-op when nothing is observing.** Call it freely; it costs
nothing on the zero-cost path.

## Lifecycle

`setup()` runs once, inside `use()`. A throw there rejects `use()` — a
configuration failure should surface before the run, not in the middle of one.

```ts
async setup() {
  this.client = await connect(this.url);   // fails now, not mid-run
}

async dispose() {
  await this.client?.close();
}
```

`dispose()` is called by `app.dispose()`. Anything `setup` opened closes here —
and a plugin holding a server or socket open is why a script does not exit.

## Ordering

Plugins wrap in registration order: the first registered is the outermost layer.

```ts
await app.use(metrics()); // sees the cache's timings
await app.use(cache()); // sees the real call's timings
```

Register measuring layers before caching layers, or your metrics will exclude
what the cache saved.

## Per-run behaviour

Plugins are app-level and cannot be added per run. A plugin that should only act
sometimes reads the run:

```ts
tool: async (inv, next) => {
  if (!inv.run.data.auditing) return next();
  return audited(inv, next);
};
```

`inv.run` is the `RunContext`; `inv.ctx` is the step context.

## Testing

Middleware is a plain function of an invocation and a `next`:

```ts
const inv = { name: "deploy", args: {}, run: fakeRun, ctx: fakeCtx, meta: () => {} };
const result = await guard.tool!(inv, async () => "should not reach here");
expect(result).toEqual({ content: expect.any(String), isError: true });
```

## Related

- [Middleware and plugins](/en/fundamentals/middleware) — the concept
- [Flow](/en/devtools/flow) — a plugin you can read
- [Execution model](/en/advanced/execution-model)
- [Observability](/en/best-practices/observability)
