# Steps

The building blocks of `@Workflow({ steps })`, plus the helpers for writing a
loop's stopping condition.

```ts
import {
  parallel,
  loop,
  untilAnswered,
  calledTool,
  turnOf,
  wasExhausted,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_FAILS,
} from "@thenajs/core";
```

## `parallel(steps)`

```ts
parallel([SecurityAgent, PerfAgent]);
```

Runs its steps at the same time, over the **same state**. Returns a
`ParallelStep` (`{ kind: "parallel", steps }`).

Because every branch writes `ctx.output`, the last write wins. Read the results
from the shared history, or have each agent write to a field of its own.

## `loop(options)`

```ts
loop({
  steps: [ExecutorAgent],
  until: untilAnswered,
  maxIterations: 8,
  onExhausted: (ctx, n) => console.warn(`ceiling after ${n}`),
  maxFails: 5,
  onFail: (ctx, info) => console.warn(info.message),
});
```

| Option | Type | Default |
| --- | --- | --- |
| `steps` | `WorkflowStep[]` | — |
| `until` | `(ctx, state?) => unknown` | — |
| `maxIterations` | `number` | `10` |
| `onExhausted` | `(ctx, iterations) => unknown` | — |
| `maxFails` | `number` | `5` |
| `onFail` | `(ctx, info: LoopFailure) => unknown` | — |

### `until`

**Returns `true` to stop.** The second parameter is the state declared in
`@Workflow({ state })`, when there is one.

```ts
until: (ctx, s: ReviewState) => s.approved;
```

Declaring that second parameter on a workflow with no `state` is caught before
the run starts, from the function's arity.

### `maxFails` and `LoopFailure`

`maxFails` counts **consecutive** tool failures — the signal of being stuck is
repetition, not accumulation. An agent that errs, corrects and moves on has a
high `total` and a low `consecutive`, which is the behaviour you want.
`Infinity` turns it off.

```ts
interface LoopFailure {
  consecutive: number; // a working tool resets this
  total: number; // since this loop began
  toolName?: string;
  message: string; // the error observation that went back to the model
}
```

### `LoopStopReason`

Recorded on the `loop` node in the report:

```ts
type LoopStopReason = "until" | "exhausted" | "fails" | "budget" | "stop";
```

## Stopping helpers

### `untilAnswered(ctx)`

Stop when the agent answered **without calling a tool**. The usual end of an
investigate-and-act loop.

```ts
export const untilAnswered = (ctx) => !calledTool(ctx);
```

::: warning An empty response counts as answered
A model that returns `""` will stop the loop. Be stricter when that matters:

```ts
until: (ctx) => {
  const t = turnOf(ctx);
  return !!t && !t.calledTool && !!t.response?.trim();
};
```

:::

### `turnOf(ctx)`

The last turn's summary, or `undefined`:

```ts
interface TurnInfo {
  calledTool: boolean;
  toolName?: string;
  toolError?: boolean;
  toolCallSource?: "native" | "rescued";
  response: string;
}
```

`toolCallSource` is how you measure a model's dependence on the text rescue.

### `calledTool(ctx)`

`true` when the model called a tool in the last turn.

### `wasExhausted(ctx)`

`true` when the most recent loop stopped at `maxIterations` rather than at
`until`. Useful in a step **after** the loop.

## Constants

| | Value | Applies to |
| --- | --- | --- |
| `DEFAULT_MAX_ITERATIONS` | `10` | `loop({ maxIterations })` |
| `DEFAULT_MAX_FAILS` | `5` | `loop({ maxFails })` |

## Related

- [Loops](/en/techniques/loops) — writing stopping conditions
- [Parallel execution](/en/techniques/parallel-execution)
- [`@Workflow`](/en/reference/workflow)
