# Loops

A `loop` repeats its steps until `until(ctx)` returns something truthy. Writing
that condition is where most of the thinking goes.

```ts
loop({
  steps: [ExecutorAgent],
  until: untilAnswered,
  maxIterations: 8,
});
```

## `true` means stop

The most common bug is reading it backwards. `until` answers *"are we done?"*,
not *"should we keep going?"*.

## The built-in condition

```ts
import { untilAnswered } from "@thenajs/core";
```

Stop when the agent answered **without calling a tool** — the natural end of an
investigate-then-answer loop. The model calls tools while it needs information,
and produces prose when it is ready.

::: warning An empty response counts as answered
A model that returns `""` stops the loop on the first turn. If that happens, be
stricter:

```ts
import { turnOf } from "@thenajs/core";

until: (ctx) => {
  const t = turnOf(ctx);
  return !!t && !t.calledTool && !!t.response?.trim();
};
```

:::

## Stopping on your own criterion

When "done" is a decision, not a shape, put it in the state:

```ts
export class ReviewState {
  approved = false;
  rounds = 0;
}
```

```ts
export class ReviewerAgent {
  constructor(@state() private readonly s: ReviewState) {}

  async afterResponse(response: string) {
    this.s.rounds++;
    this.s.approved = /\bAPPROVED\b/.test(response);
  }
}
```

```ts
loop({
  steps: [ReaderAgent, ReviewerAgent],
  until: (_ctx, s: ReviewState) => s.approved,
  maxIterations: 5,
});
```

Someone has to **write** what `until` reads. A loop that always hits the ceiling
almost always means nothing ever set the field.

## Always set a ceiling

`maxIterations` defaults to `10`. Leaving it implicit is fine; leaving
`onExhausted` off is how you fail to notice:

```ts
loop({
  steps: [ExecutorAgent],
  until: myCondition,
  maxIterations: 8,
  onExhausted: (ctx, n) => console.warn(`[app] ceiling after ${n} rounds`),
});
```

Without it, "the agent works but the answers are poor" and "the loop never
converges" look identical from the outside.

After the loop, `wasExhausted(ctx)` tells a later step which happened:

```ts
import { wasExhausted } from "@thenajs/core";

@Workflow({ steps: [loop({ … }), SummariserAgent] })
```

```ts
export class SummariserAgent {
  async beforePrompt(prompt: string, ctx: Context) {
    if (wasExhausted(ctx)) {
      return `${prompt}\n\nThe investigation did not converge. Say what is still unknown.`;
    }
  }
}
```

## Stopping on repeated failure

`maxFails` (default `5`) ends the loop after that many **consecutive** tool
failures:

```ts
loop({
  steps: [ExecutorAgent],
  until: untilAnswered,
  maxFails: 3,
  onFail: (ctx, info) => console.warn(`${info.consecutive}× — ${info.message}`),
});
```

Consecutive, not total, is the point: an agent that errs, corrects and moves on
has a high `total` and a low `consecutive`, and should not be cut off.
`Infinity` disables it.

## Composing conditions

`until` is a plain function, so combine freely:

```ts
until: (ctx, s: ReviewState) =>
  s.approved || s.rounds >= 3 || (ctx.budget?.costUsd ?? 0) > 0.25;
```

Reading `ctx.budget` inside `until` is how you write a cost policy the framework
does not opine on. It is only populated when the run has a `budget`.

## Why a loop at all

Without one, an agent step is a single turn: one model call and at most one tool.
The agent calls `read_file`, and the workflow ends with the file's contents as
the output — the model never got to interpret it.

```ts
@Workflow({ steps: [ReaderAgent] })                    // one turn
@Workflow({ steps: [loop({ steps: [ReaderAgent], … })] })  // investigates
```

## Loops inside loops

They nest, and the inner `until` runs on the same `ctx`:

```ts
loop({
  steps: [
    PlannerAgent,
    loop({ steps: [ExecutorAgent], until: untilAnswered, maxIterations: 5 }),
  ],
  until: (_ctx, s: MyState) => s.finished,
  maxIterations: 3,
});
```

Worth watching the multiplication: 3 × 5 is up to 15 executor turns. This is
where a run-level `budget` earns its place.

## Common mistakes

**The condition is inverted.** `true` stops.

**Nothing writes the field.** Add `onExhausted` and find out.

**`untilAnswered` on a workflow whose last step is not the agent.** The turn
summary is the *last* step's, so a `loop` ending in a non-agent step reads
whatever that left behind.

**Declaring a second `until` parameter with no `state`.** Caught before the run
starts, from the function's arity.

## Related

- [Steps](/en/reference/steps) — `loop`, `until` helpers, `LoopFailure`
- [Workflows](/en/fundamentals/workflows)
- [Budgets](/en/techniques/budgets)
