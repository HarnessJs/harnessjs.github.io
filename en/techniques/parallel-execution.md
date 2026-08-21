# Parallel execution

```ts
import { parallel } from "@thenajs/core";

@Workflow({
  steps: [parallel([SecurityAgent, PerformanceAgent, StyleAgent])],
})
export class ReviewWorkflow {}
```

All three run at the same time, and the block is deterministic: every branch
reads the same history, and their writes land in the order you declared them.

## When it pays

Parallel helps when the branches are **independent** and each is slow — three
analysts looking at the same input from different angles. Three model calls that
would take 6 seconds in sequence take about 2.

It does not help when a later branch needs what an earlier one found. That is a
sequence, and writing it as `parallel` produces agents reasoning from an
incomplete history.

## What the block guarantees

Three things, and they hold whatever the model's latency does:

| | |
| --- | --- |
| **One read** | Every branch sees the history as it was when the block opened. A branch that awaits before reading still cannot see a sibling. |
| **Ordered writes** | `parallel([A, B, C])` appends `A`, `B`, `C` to the history in that order, even if `C` answers first. |
| **All or nothing** | A branch that throws cancels its siblings, and nothing from the block is appended. |

`ctx.output` and `ctx.turn` are the **last declared** branch's — `C` in the
example. That is stable, but it is still one branch's answer out of three, so it
is rarely what you want.

## Collecting the results

Two ways, and both are better than reading `ctx.output`.

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

::: warning The state object is shared, and it is written in completion order
The ordering guarantee covers the **history**, not your own state object. The
branches still run concurrently, so `this.s.findings.security = …` on a distinct
key is safe, while `push`-ing to one shared array from three branches still
gives you a non-deterministic order. Assign to keys; do not append to a list.
:::

## History

All branches append to the same `history`, and the block puts their turns in
**declaration order**. With `parallel([Security, Performance, Style])` the parent
conversation reads `Security`, `Performance`, `Style` on every run — so a prompt
that says "the first opinion is the security one" holds, and the run is
reproducible at `temperature: 0`.

If you would rather keep the branches out of the transcript entirely and promote
their outputs to context:

```ts
afterResponse(response: string, ctx: Context) {
  ctx.state.set("history", ctx.state.history.slice(0, -1));
  ctx.security = response;
}
```

The branch then contributes nothing to the parent history — it trims its own
copy, and only what a branch adds is merged back.

For a branch that also needs its own `ctx` and its own budget line, use a
[nested run](/en/techniques/nested-runs).

## Failure

A branch that throws fails the block, and therefore the run. The siblings are
**cancelled** — an in-flight model call is aborted rather than left to finish and
bill you for an answer nobody will read — and nothing from the block reaches the
history.

There is no "continue with the ones that worked". If you want that, catch inside
the agent, which keeps the branch from ever failing:

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

**Reading `ctx.output` after the block.** It is the last declared branch's, and
the other N-1 answers are gone. Collect into keys instead.

**Using `parallel` for a pipeline.** If B needs A's finding, it is a sequence —
and here the guarantee works against you: B is reading the history from before
the block, so it cannot see A even by accident.

**`push`-ing to a shared array from every branch.** The history is ordered; your
own state object is not.

## Related

- [Workflows](/en/fundamentals/workflows)
- [Multi-agent systems](/en/techniques/multi-agent-systems)
- [Steps](/en/reference/steps)
