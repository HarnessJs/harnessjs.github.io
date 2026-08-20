# Parallel execution

```ts
import { parallel } from "@thenajs/core";

@Workflow({
  steps: [parallel([SecurityAgent, PerformanceAgent, StyleAgent])],
})
export class ReviewWorkflow {}
```

All three run at the same time, over the **same state**.

## When it pays

Parallel helps when the branches are **independent** and each is slow — three
analysts looking at the same input from different angles. Three model calls that
would take 6 seconds in sequence take about 2.

It does not help when a later branch needs what an earlier one found. That is a
sequence, and writing it as `parallel` produces agents reasoning from an
incomplete history.

## The shared-state catch

Every branch writes `ctx.output`, so **the last write wins** — and which one is
last is a race. Never read `ctx.output` after a `parallel` block expecting a
particular branch's answer.

Two ways to collect results properly.

**Each agent writes its own field:**

```ts
export class SecurityAgent {
  afterResponse(response: string, ctx: Context) {
    ctx.security = response;
  }
}
```

```ts
export class SummariserAgent {
  async beforePrompt(prompt: string, ctx: Context) {
    return `${prompt}

## Security
${ctx.security}

## Performance
${ctx.performance}`;
  }
}
```

**Or use the typed workflow state**, which is better when the shape matters:

```ts
export class ReviewState {
  findings: Record<string, string> = {};
}
```

```ts
export class SecurityAgent {
  constructor(@state() private readonly s: ReviewState) {}
  afterResponse(response: string) {
    this.s.findings.security = response;
  }
}
```

::: warning The state object is shared, not copied
Branches mutating the same array or object can interleave. Assigning to distinct
keys is safe; `push`-ing to one shared array from three branches gives you a
non-deterministic order.
:::

## History is shared too

All branches append to the same `history`. With three agents, the parent
conversation ends up with three assistant turns whose order varies between runs —
which makes the run non-reproducible even at `temperature: 0`.

If that matters, keep the branches out of the transcript and promote their
outputs to context:

```ts
afterResponse(response: string, ctx: Context) {
  ctx.state.set("history", ctx.state.history.slice(0, -1));
  ctx.security = response;
}
```

Or isolate each branch as a [nested run](/en/techniques/nested-runs), which gives
each its own history and returns a single string.

## Failure

A branch that throws fails the block, and therefore the run. There is no
"continue with the ones that worked" — if you want that, catch inside the agent:

```ts
async onError(error: Error, ctx: Context) {
  ctx.meta({ failed: error.name });
  return "This analysis could not be completed.";
}
```

## Cost

Parallel does not reduce the number of model calls; it reduces wall clock. Three
branches cost three calls, and against a rate-limited provider they may serialise
anyway — or trip a `429`, which the built-in retry will then back off on.

A `budget` counts them all:

```ts
budget: { maxChatCalls: 10, maxCostUsd: 0.25 }
```

## Nesting

`parallel` and `loop` compose in both directions:

```ts
loop({
  steps: [parallel([ExplorerA, ExplorerB]), ReviewerAgent],
  until: (_ctx, s: ReviewState) => s.approved,
  maxIterations: 3,
});
```

Watch the multiplication — 3 iterations × 2 branches + 3 reviews is 9 model
calls.

## Common mistakes

**Reading `ctx.output` after the block.** It is whichever branch finished last.

**Using `parallel` for a pipeline.** If B needs A's finding, it is a sequence.

**Expecting isolation.** State and history are shared. Isolation is a nested run.

## Related

- [Workflows](/en/fundamentals/workflows)
- [Multi-agent systems](/en/techniques/multi-agent-systems)
- [Steps](/en/reference/steps)
