# Logging

```ts
export const config: ThenaConfig = { log: true };
```

```
[thena] ▸ workflow ReviewWorkflow
[thena]   ▸ agent PlannerAgent
[thena]     ▸ chat
[thena]     ◂ chat  1.20s ✓
[thena]   ◂ agent PlannerAgent  1.21s ✓
[thena]   ▸ loop
[thena]     ▸ agent ReviewerAgent
[thena]       ▸ chat
[thena]         ▸ tool read_file
[thena]         ◂ tool read_file  8ms ✓
```

`▸` opens a step, `◂` closes it with its duration and status.

## Three modes

```ts
type LogConfig = boolean | "verbose" | ((event: ExecutionEvent) => void);
```

| Value | What you get |
| --- | --- |
| `true` | the structure — which steps ran, how long, ok or error |
| `"verbose"` | the same, plus the prompt, the response and the tool I/O |
| function | every event, for your own sink |

`"verbose"` is the debugging default. It is also the fastest way to answer "why
did it do that", because it shows the prompt the model actually received —
including whatever `beforePrompt` added.

## Your own sink

```ts
import pino from "pino";
const logger = pino();

export const config: ThenaConfig = {
  log: (event) => {
    if (event.phase !== "end") return;
    logger.info({
      runId: event.runId,
      kind: event.kind,
      name: event.name,
      durationMs: event.durationMs,
      status: event.status,
    });
  },
};
```

```ts
interface ExecutionEvent {
  phase: "start" | "end";
  kind: "workflow" | "loop" | "parallel" | "agent" | "chat" | "tool";
  name: string;
  runId: string;
  depth: number; // 0 = root, useful for indentation
  id: string;
  parentId?: string;
  durationMs?: number; // on `end`
  status?: "ok" | "error"; // on `end`
  error?: string; // on `end`
  data?: Record<string, unknown>; // on `end`
}
```

`id` and `parentId` are what make the tree reconstructible. `runId` is what keeps
concurrent runs apart — without it, a consumer receiving events from several runs
has no way to separate them.

::: warning A `log` function is called on the hot path
It is synchronous and inside the run. Keep it cheap: push to a queue, do not
`await` a network call. An exception thrown here is **not** isolated the way a
plugin's `onEvent` is.
:::

## Per run

`log` is one of the options you can override per execution, which is how you
debug one request in production without turning the whole service loud:

```ts
await app.run({
  input,
  log: req.header("x-debug") ? "verbose" : false,
});
```

See [Per-run configuration](/en/techniques/per-run-configuration).

## Logging is observation

Turning on `log` also turns on **observation** — the run builds its execution
tree and asks the provider to stream. That is the mechanism behind
`onEvent`/`textStream` working without an explicit `observe: true`.

The reverse matters too: with no `log`, no `report` and no plugin, a run emits
nothing at all. See [Streaming](/en/fundamentals/streaming).

## Log or plugin?

Both receive the same stream. The difference:

| | `log` function | Plugin `onEvent` |
| --- | --- | --- |
| How many | one | as many as you like |
| On throw | propagates | swallowed, run unaffected |
| Lifecycle | none | `setup()` and `dispose()` |

For anything that opens a connection, use a
plugin. For a formatting tweak or a quick pipe to
an existing logger, `log` is enough.

## Secrets

Everything captured passes through redaction first,
which is on by default and knows `Bearer …`, `sk-…`, `ghp_…`, JWTs, connection
strings and fields named like `api_key`.

That is a safety net, not a guarantee. `"verbose"` prints prompts and tool I/O,
so a run over real customer data prints real customer data.

## Related

- [Report](/en/devtools/report) — the same events, persisted
- [Flow](/en/devtools/flow) — the same events, as a live graph
- [Debugging](/en/devtools/debugging)
