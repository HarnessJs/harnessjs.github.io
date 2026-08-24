# Performance

Almost all of an agent's time and all of its cost is the model. Optimising your
TypeScript is rarely the answer; reducing what you send and how often is.

## Measure first

The numbers are in the report, per `chat` node:

| Field | Tells you |
| --- | --- |
| `promptTokens` | how big the history has grown |
| `completionTokens` | how much the model is writing |
| `costUsd` | the number that matters |
| `attempts` | the network retried |
| `durationMs` | where the time went |

And per run: `chatCalls`, `toolCalls`, `elapsedMs`. A `loop` node's `iterations`
and `exhausted` tell you whether it converged.

`costPer1kTokens` on the provider is what turns tokens into money:

```ts
super({ apiKey, model, costPer1kTokens: { input: 0.00015, output: 0.0006 } });
```

## The levers, in order of effect

### 1. Fewer turns

Every turn is a full model call with the whole history. A loop that converges in
3 costs half of one that converges in 6.

If `exhausted: true` shows up regularly, the stopping condition is not working —
that is not a performance tweak, it is a bug. See
[Loops](/en/techniques/loops).

### 2. A smaller history

Every turn resends everything, so history size multiplies across turns. A tool
returning 4KB twelve times means the last call carries ~50KB of stale content.

Cheapest fix is in the tool:

```ts
return text.length <= MAX ? text : `${text.slice(0, MAX)}\n… [truncated]`;
```

General fix is [`contextWindow()`](/en/techniques/context-management) — but
measure `promptTokens` before reaching for it, because trimming changes agent
behaviour silently.

### 3. Fewer agents

Each split adds at least one model call per run. Multi-agent structures are the
easiest way to triple your cost without noticing. See
[Multi-agent systems](/en/techniques/multi-agent-systems).

### 4. A smaller model where it fits

`provider` is per agent, so a classification step does not need the model the
reasoning step needs:

```ts
@Agent({ provider: FastCheap, prompt: "./classifier.agent.md" })
@Agent({ provider: SlowSmart, prompt: "./reasoner.agent.md" })
```

### 5. Caching

Identical calls are more common than you would expect, especially at
`temperature: 0`:

```ts
await app.use({
  name: "cache",
  chat: async (inv, next) => {
    const key = hash(inv.messages);
    const hit = await cache.get(key);
    if (hit) {
      inv.meta({ cacheHit: true });
      return hit;
    }
    return cache.set(key, await next());
  },
});
```

`inv.meta()` is what makes the hit rate visible in the report — otherwise a 4ms
call is indistinguishable from a fast one.

## Prompt caching

Providers discount a repeated prefix. This is why `contextWindow()` **never
trims the leading `system` messages** — cutting from the top would invalidate the
discount every turn.

The practical rule: keep what is stable at the front, and let what changes
accumulate at the back. Putting a timestamp at the top of a prompt quietly
disables prompt caching for the whole run.

## Latency vs cost

They pull in different directions.

**`parallel`** reduces wall clock, not calls. Three 2-second branches take ~2
seconds instead of 6, for the same three calls. Worth it when the branches are
genuinely independent.

**Streaming** does not make anything faster, but time-to-first-token is what a
user perceives:

```ts
for await (const token of exec.textStream) res.write(token);
```

**Fewer, larger tool calls** beat many small ones — each round trip is a full
model call.

## Turn observation off when you do not need it

A run with no `report`, `log`, plugin or `observe: true` skips building the
execution tree, emitting events and requesting streaming. It is worth roughly
**2× in CPU time per run**.

```ts
await app.run({ prompt, log: false, report: debug ? { … } : false });
```

Also, `report: true` in a busy service is unbounded disk growth of files nobody
reads. Sample it, or forward events to a plugin instead.

## Concurrency

Runs are mostly `await`, so one process handles many concurrently. But unbounded
concurrency against a rate-limited provider produces `429`s, which retry then
backs off on — turning a fast overload into a slow one.

```ts
import pLimit from "p-limit";
const limit = pLimit(10);
```

For a local Ollama the useful number is small — often 1 or 2, since it serves one
generation at a time.

## What is not worth optimising

- **The framework's own overhead.** Schema conversion is memoised, node ids are a
  counter rather than `randomUUID`, and instrumentation is a no-op when
  unobserved. It is not your bottleneck.
- **`Thena.create`.** Synchronous, no I/O. Call it once anyway, because the
  workflow compiles and stores connect once.
- **Micro-optimising tool code.** A tool that takes 3ms next to a 1.8s model call
  is noise.

## Related

- [Scaling](/en/deployment/scaling)
- [Context management](/en/techniques/context-management)
- [Budgets](/en/techniques/budgets)
- [Report](/en/devtools/report)
