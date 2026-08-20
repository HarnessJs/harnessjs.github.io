# Context

The object that crosses every step of a run. `Context` is the preferred name;
`AgentContext` is the same type, kept as an alias.

```ts
import type { Context } from "@thenajs/core";
```

## Shape

```
ctx                    ← run controls, runtime fields, and your own
 └─ ctx.state          ← the conversation the model actually sees
```

Any field you write is accepted, typed `unknown`:

```ts
ctx.attempts = ((ctx.attempts as number) ?? 0) + 1;
```

For what steps genuinely exchange, prefer the typed workflow state
(`@Workflow({ state })`).

## Run controls

These belong to the **run**, not the step. In a `parallel` block the step fields
are shared between branches; these apply to the whole execution.

| Member | Type | Notes |
| --- | --- | --- |
| `runId` | `string` | the same id in every `ExecutionEvent` |
| `data` | `D` | your channel. **Never goes to the model.** Always present — `{}` when not given |
| `signal` | `AbortSignal` | pass to your `fetch` so cancellation reaches inside |
| `usage()` | `BudgetUsage` | accumulated usage so far |
| `abort(reason?)` | `void` | cancels; the in-flight turn is interrupted |
| `stop()` | `void` | ends **gracefully** — later steps skipped, output kept, no throw |
| `onDispose(fn)` | `void` | cleanup for the end of the run, reverse order, like `defer` |
| `meta(data)` | `void` | telemetry onto this step's node; no-op when unobserved |

```ts
const conn = await pool.acquire();
ctx.onDispose(() => conn.release());
```

`data` is typed by you:

```ts
type MyRun = { accountId: string };
const app = Thena.create<string, MyRun>(Flow, config);
context<MyRun>().data.accountId; // string, no cast
```

::: tip Use `type`, not `interface extends`
An interface extending the run-data shape inherits its index signature, so a
misspelled field becomes `unknown` instead of a compile error.
:::

## Runtime fields

| Field | Type |
| --- | --- |
| `turn` | `TurnInfo` — last turn's summary |
| `output` | the last step's output |
| `budget` | `BudgetUsage`, present when there is a `budget` |

```ts
interface TurnInfo {
  calledTool: boolean;
  toolName?: string;
  toolError?: boolean;
  toolCallSource?: "native" | "rescued";
  response: string;
}
```

## `ctx.state`

Three buckets, each becoming part of the prompt:

| Bucket | Type | Reaches the model as |
| --- | --- | --- |
| `history` | `Message[]` | the messages, in order |
| `memory` | `string[]` | a `system` message at the top |
| `tasks` | `string[]` | a note inside the `system` message |

```ts
ctx.state.append("memory", "The user prefers short answers");
ctx.state.set("history", ctx.state.history.slice(0, -1));
```

`run({ memory })` seeds the `memory` bucket.

## `abort()` vs `stop()`

| | `abort(reason)` | `stop()` |
| --- | --- | --- |
| The run | rejects with `reason` | resolves with the output so far |
| Later steps | interrupted | skipped |
| In-flight turn | interrupted | finishes |

`stop()` is the same behaviour as a budget in `"stop"` mode.

## `context()` as a function

The same export is callable and returns the context from wherever you are:

```ts
provider: () => new OpenAIProvider({ apiKey: keyFor(context().data) });
```

Inside a step you get the step's context, with `state` and `turn`. Outside one —
in a provider factory, which runs at compile time — you get the run's, and
touching `state` throws with an explanation.

## Related

- [State and context](/en/fundamentals/state-and-context) — the concept
- [Injection](/en/reference/injection)
- [Run and RunHandle](/en/reference/run)
