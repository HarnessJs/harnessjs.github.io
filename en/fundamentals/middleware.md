# Middleware and plugins

[Hooks](/en/fundamentals/hooks) belong to one agent class. Middleware wraps
**every** tool run and **every** model call in the app — which is what you want
for a cache, a rate limiter, metrics, or an authorisation check.

Both arrive through the same door:

```ts
const app = Thena.create(MyWorkflow, config);
await app.use(myPlugin);
```

## A plugin

```ts
export interface ThenaPlugin {
  name: string;
  setup?(): void | Promise<void>;
  onEvent?(event: ExecutionEvent): void;
  tool?: ToolMiddleware;
  chat?: ChatMiddleware;
  dispose?(): void | Promise<void>;
}
```

Two modes, combinable in the same plugin:

- **observe** — `onEvent` receives the same stream `log` does. Isolated: if it
  throws, the exception is swallowed and neither the run nor the other plugins
  are affected.
- **intercept** — `tool` and `chat` wrap each execution and **participate**. A
  throw from there takes down the run; returning without calling `next()`
  replaces the execution.

Several plugins coexist, and none displaces another or the config's `log`. Call
`use` before `run`.

`setup` runs once, inside `use()`. If it throws, `use()` rejects — a
configuration failure should surface before the run, not in the middle of it.

## The onion

Middleware is koa-shaped: each layer gets the invocation and a `next()`, and
decides what to do before and after it.

```
record → hooks → count → error policy → [the real call]
```

```ts
await app.use({
  name: "cache",
  chat: async (inv, next) => {
    const hit = cache.get(key(inv.messages));
    if (hit) {
      inv.meta({ cacheHit: true }); // shows in the report and in Flow
      return hit; // never calls next() — replaces the call
    }
    return cache.set(key(inv.messages), await next());
  },
});
```

::: warning `next()` once, and only once
Calling it twice would run the rest of the chain — including the model call —
twice. The framework rejects with
`next() was called more than once in the same middleware` rather than billing you
silently.
:::

## Where your layer sits

Your middleware is not the outermost layer. The tool chain is:

```
recordTool             ← the node always opens; the report never omits a call
  toolHooks            ← the agent's beforeTool / afterTool
    [ your middleware ]
      countTool        ← counts only what was actually spent
        toolErrorPolicy
          [ execute ]
```

Each position is deliberate:

- **below `recordTool`** — a step that does not open a node disappears from the
  graph, and a report that omits calls is worse than no report
- **below `toolHooks`** — so a check sees the arguments that will **really**
  execute. A `beforeTool` that rewrote arguments after an authorisation check
  would make that check bypassable
- **above `countTool`** — a middleware that short-circuits (a cache) spent
  nothing and must not count against the budget, or `maxCostUsd` leaks

The second one is why **authorisation belongs in a tool middleware, not in a
`beforeTool` hook**. See [Security](/en/best-practices/security).

## What the invocation carries

**`ToolInvocation`** — `name`, `args` (mutable, so it can be rewritten),
`agent`, `ctx`, `run`, and `meta()`.

**`ChatInvocation`** — `messages`, `tools`, `sampling`, `signal`, `onToken`,
`agent`, `ctx`, `run`, and `meta()`.

`meta()` writes telemetry onto this step's node, so it shows in `report.json` and
in the Flow graph. It is how a middleware says what it did — without it, a cache
that hits in 4ms can only be *inferred* from the duration. It is a no-op when
nothing is observing.

::: tip If you call the provider yourself in a `chat` middleware
Pass `inv.signal` and `inv.onToken` through, or you break cancellation and
streaming for that call.
:::

## Denying a tool, recoverably

A `throw` from a middleware ends the run. To refuse in a way the model can read
and work around, return an error result instead:

```ts
await app.use({
  name: "guard",
  tool: async (inv, next) => {
    if (inv.name === "deploy" && !allowed(inv.run)) {
      return { content: "Deploy is not allowed in this run.", isError: true };
    }
    return next();
  },
});
```

That is the difference between "this run is over" and "try something else".

## `contextWindow()`

A shipped `chat` middleware that trims history to fit the window:

```ts
import { contextWindow } from "@thenajs/core";

await app.use({
  name: "window",
  chat: contextWindow({
    maxTurns: 12, // a tool turn takes two messages, so ~6 round trips
    maxChars: 60_000,
    maxCharsPerTool: 4_000,
  }),
});
```

It **always** preserves the leading `system` messages: they are the agent's
prompt and the state's projection, and cutting them would break the agent rather
than save anything. Preserving the head also keeps the prefix stable for the
provider's prompt cache.

It has no defaults on purpose — trimming history changes agent behaviour, and
silently. Measure first (`promptTokens` on the `chat` nodes in the report), then
turn it on when the numbers justify it.

## Observing

```ts
import { thenaFlow } from "@thenajs/flow";

await app.use(thenaFlow({ port: 4100 }));
```

A pure observer: `onEvent` only. See [Flow](/en/devtools/flow).

## Cleaning up

`dispose()` is called by `app.dispose()`. Close there whatever `setup` opened —
a server, a file handle, a connection. In a script you can skip `app.dispose()`;
in a server you cannot.

## Common mistakes

**Registering after `run`.** `use` must be called first.

**Throwing to deny.** It ends the run. Return `{ content, isError: true }` if
the model should recover.

**Forgetting `next()` returns the result.** A middleware that calls `next()` but
returns something else has replaced the output — sometimes intended, often not.

## Related

- [Hooks](/en/fundamentals/hooks) — the per-agent equivalent
