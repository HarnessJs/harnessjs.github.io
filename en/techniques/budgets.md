# Budgets

`maxIterations` limits one loop. A `budget` limits the **whole run** — wall
clock, model calls, tool calls, tokens and dollars.

```ts
await app.run({
  input: { message: "Review src/" },
  budget: {
    maxDurationMs: 60_000,
    maxChatCalls: 20,
    maxCostUsd: 0.5,
  },
});
```

**Without a `budget`, nothing is measured and nothing is checked.** There is no
default ceiling, because an arbitrary one would cut off legitimate work.

## The limits

| Key | Counts |
| --- | --- |
| `maxDurationMs` | wall clock for the whole run |
| `maxChatCalls` | model calls |
| `maxToolCalls` | tool executions |
| `maxTokens` | prompt + completion, **only what the provider reports** |
| `maxCostUsd` | requires `costPer1kTokens` on the provider |

`maxCostUsd` silently measures nothing if the provider has no price:

```ts
super({
  apiKey,
  model: "gpt-4o-mini",
  costPer1kTokens: { input: 0.00015, output: 0.0006 },
});
```

## Stop or throw

```ts
budget: { maxChatCalls: 20, mode: "stop" }   // default
```

| Mode | What happens |
| --- | --- |
| `"stop"` | ends **gracefully** — remaining steps skipped, the output so far returned, no throw |
| `"throw"` | raises `BudgetExceededError` |

`"stop"` is the default because a partial answer usually beats no answer. Choose
`"throw"` when a truncated result is worse than a visible failure — a billing
operation, a migration.

```ts
import { BudgetExceededError } from "@thenajs/core";

try {
  await app.run({ input, budget: { maxCostUsd: 1, mode: "throw" } });
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.warn(`${err.info.reason}: ${err.info.value} of ${err.info.limit}`);
  }
}
```

## Knowing it happened

`mode: "stop"` returns normally, so a run that hit the ceiling and one that
finished look the same from the caller's side. `onExceeded` is how you tell:

```ts
budget: {
  maxCostUsd: 0.5,
  onExceeded: (info) => metrics.increment(`budget.${info.reason}`),
}
```

It is called **once**, at the moment the budget blows.

```ts
interface BudgetExceeded {
  reason: "maxDurationMs" | "maxChatCalls" | "maxToolCalls" | "maxTokens" | "maxCostUsd";
  limit: number;
  value: number;
  usage: BudgetUsage;
}
```

## Reading usage mid-run

```ts
interface BudgetUsage {
  chatCalls: number;
  toolCalls: number;
  tokens: number;
  costUsd: number;
  elapsedMs: number;
}
```

Available as `ctx.budget` and `ctx.usage()`, and only populated when the run has a
budget. This is where you write policy the framework deliberately does not:

```ts
// stop the loop early when it is getting expensive
until: (ctx, s: MyState) => s.done || (ctx.budget?.costUsd ?? 0) > 0.25;
```

```ts
// refuse an expensive tool late in an expensive run
async beforeTool(call: ToolCall, ctx: Context) {
  if (call.name === "deep_search" && ctx.usage().costUsd > 0.4) {
    throw new Error("too expensive to run a deep search now");
  }
}
```

The framework counts; you decide what counts as too much.

## Precision

::: warning The ceiling is a barrier, not a mid-sentence cut
Stopping is checked **between** units of work, and a model call is only counted
once it has answered — before that there is no usage to add. A run can spend one
call past the limit before stopping, and a tool that starts a sub-workflow allows
one more per level of nesting.

It is a known, constant upper bound, not proportional leakage.
:::

Set the ceiling where one extra call is acceptable. If it truly is not, the limit
you want is `maxDurationMs` combined with a `signal`.

## Nested runs

A sub-workflow started by a tool **counts against its parent's budget**. Without
its own it uses the parent's tracker; with one it gets a chained tracker, and
whichever blows first wins.

```ts
await this.runtime.run(DeployWorkflow, {
  input: { message: "deploy" },
  budget: { maxChatCalls: 5 },
});
```

This is what stops a `maxCostUsd` at the top from being walked around by any tool
that starts a sub-workflow. Older docs say the budget does not cross; it does,
since 0.9.

## Budget vs cancellation

They are different tools:

| | Budget | `signal` / `abort()` |
| --- | --- | --- |
| Trigger | consumption | time, a disconnect, your decision |
| Granularity | between units of work | reaches inside your tools |
| Default end | graceful `stop` | rejection |

For a hard wall-clock limit, `signal` is sharper:

```ts
app.run({ input, signal: AbortSignal.timeout(30_000) });
```

See [Cancellation](/en/techniques/cancellation).

## Related

- [Run and RunHandle](/en/reference/run) — the full `RunBudget` shape
- [Loops](/en/techniques/loops) — the other kind of ceiling
- [Cancellation](/en/techniques/cancellation)
