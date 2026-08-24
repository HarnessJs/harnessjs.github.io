# Run and `RunHandle`

```ts
const app = Thena.create(MyWorkflow, config); // not async
const exec = app.run({ prompt: "hi" });
const result = await exec;
await app.dispose();
```

## `Thena.create(WorkflowClass, config?)`

Returns a `WorkflowApp`. **Not async** — building the app waits for nothing.

```ts
Thena.create<T = string, D extends RunData = RunData>(
  WorkflowClass, config?: ThenaConfig
): WorkflowApp<T, D>
```

`T` is the run's output type; `D` types `run({ data })` and `context<D>().data`.

::: tip `bootstrapWorkflow` is the deprecated `async` form
It still works so 0.6 code does not break. Use `Thena.create`.
:::

## `WorkflowApp`

| Member | What it does |
| --- | --- |
| `run(options)` | starts a run, returns a `RunHandle` **synchronously** |
| `use(plugin)` | attaches a plugin. `await` it, and call it **before** `run` |
| `dispose()` | aborts in-flight runs, waits for them, shuts plugins down |

Concurrent `run` calls are safe: each opens its own `RunContext`.

## `WorkflowRunOptions`

```ts
await app.run({
  prompt: "Review src/",
  state: { memory: ["userId: 123"] },
  data: { accountId: "acme" },
  budget: { maxChatCalls: 20 },
  signal: AbortSignal.timeout(30_000),
  observe: true,
  report: false,
  log: "verbose",
});
```

| Option | Type | Notes |
| --- | --- | --- |
| `prompt` | `string` | the first `user` message of the run. Not the agent's `prompt`, which is its system markdown |
| `state` | `Partial<State>` | where the run starts: `history`, `tasks`, `memory`. `handle.state` gives you the one to pass next |
| `data` | `D` | your channel — **never goes to the model or the report** |
| `budget` | `RunBudget` | without it, nothing is measured |
| `signal` | `AbortSignal` | combines with the handle's `abort()`; first to fire wins |
| `observe` | `boolean` | forces observation on |
| `report` | `boolean \| ReportOptions` | overrides `ThenaConfig` for this run |
| `log` | `LogConfig` | overrides `ThenaConfig` for this run |

## `RunHandle`

`PromiseLike`, so `await` gives the result. Without `await`, you have the run.

| Member | Type | Notes |
| --- | --- | --- |
| `runId` | `string` | **synchronous**, before the first turn |
| `result` | `Promise<T>` | a plain Promise — composes with `Promise.all` |
| `signal` | `AbortSignal` | yours combined with this handle's `abort()` |
| `abort(reason?)` | `void` | the reason arrives at the caller's `catch` |
| `onEvent(cb)` | `() => void` | returns the unsubscribe |
| `eventStream` | `AsyncIterable<ExecutionEvent>` | gives backpressure |
| `onToken(cb)` | `() => void` | returns the unsubscribe |
| `textStream` | `AsyncIterable<string>` | |
| `then` / `catch` / `finally` | | return plain Promises — chaining **discards** the handle |

Late subscribers receive what already happened before the new items, buffered up
to 500 events.

::: warning Nothing is emitted unless the run is observed
Observation turns on with `report`, `log`, a plugin with `onEvent`, or an
explicit `observe: true`. Otherwise the run takes the zero-cost path — no tree,
no events, no streaming — and you get a one-time console warning.
:::

See [Streaming](/en/fundamentals/streaming).

## `RunBudget`

```ts
budget: {
  maxDurationMs: 60_000,
  maxChatCalls: 20,
  maxToolCalls: 50,
  maxTokens: 100_000,
  maxCostUsd: 0.5,
  mode: "stop",
  onExceeded: (info) => console.warn(info.reason),
}
```

| Key | Notes |
| --- | --- |
| `maxDurationMs` | wall clock for the whole run |
| `maxChatCalls` | model calls |
| `maxToolCalls` | tool executions |
| `maxTokens` | prompt + completion, only what the provider reports |
| `maxCostUsd` | requires `costPer1kTokens` on the provider |
| `mode` | `"stop"` (default) ends gracefully; `"throw"` raises `BudgetExceededError` |
| `onExceeded` | called once, when the budget blows |

```ts
interface BudgetUsage {
  chatCalls: number;
  toolCalls: number;
  tokens: number;
  costUsd: number;
  elapsedMs: number;
}
```

Read it mid-run with `ctx.usage()` or `ctx.budget`.

::: warning The ceiling is a barrier, not a mid-sentence cut
Stopping is checked **between** units of work, and a model call is only counted
once it answers. A run can spend one call past the limit — and one more per level
of nesting when a tool starts a sub-workflow. It is a known, constant upper
bound.
:::

A nested run counts against its parent's budget. Pass an explicit `budget` to
`runtime.run()` to give it a ceiling of its own; whichever blows first wins.

## Related

- [Configuration](/en/get-started/configuration)
- [`ThenaConfig`](/en/reference/thena-config)
- [Budgets](/en/techniques/budgets)
- [Cancellation](/en/techniques/cancellation)
