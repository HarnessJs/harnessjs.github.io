# Observability

An agent's control flow is a model's decision, so "what happened" is not
inferable from your code. Everything below exists to make it inferable from data
instead.

## Three tools, three moments

| | When | Persists | Use for |
| --- | --- | --- | --- |
| [`log`](/en/devtools/logging) | live, terminal | no | development, and one request in production |
| [Flow](/en/devtools/flow) | live, browser graph | no | watching a slow or stuck run |
| [`report`](/en/devtools/report) | after | yes | debugging, measuring, bug reports |
| a plugin | live, anywhere | yours | production |

All four receive the same `ExecutionEvent` stream.

## Measure structure, not prose

The point of the structured node data is that answering "how often do tools fail"
should be a count, not a regex:

| Question | Signal |
| --- | --- |
| are loops converging? | `exhausted` on `loop` nodes |
| how often do tools fail? | `tool` nodes with `status: "error"` |
| is the provider unstable? | `attempts` present on `chat` nodes |
| is the model at its limit? | `toolCallSource: "rescued"` |
| is the history growing? | `promptTokens` per turn |
| what does a run cost? | `costUsd` on the `workflow` node |

`toolCallSource` deserves attention: `"rescued"` means the model wrote the tool
call as text and the framework recovered it. It works, but a rising rate is an
early warning that the task has outgrown the model.

## Production: a plugin, not the report

`report: true` writes a folder per run — right for development, wrong for a busy
service. Forward events instead:

```ts
export function otelPlugin(): ThenaPlugin {
  const spans = new Map<string, Span>();

  return {
    name: "otel",
    onEvent(event) {
      if (event.phase === "start") {
        const parent = event.parentId ? spans.get(event.parentId) : undefined;
        spans.set(event.id, tracer.startSpan(`${event.kind}:${event.name}`, { parent }));
        return;
      }
      const span = spans.get(event.id);
      if (!span) return;
      if (event.status === "error") span.recordException(event.error ?? "");
      span.end();
      spans.delete(event.id);
    },
  };
}
```

`id`/`parentId` rebuild the tree; `runId` keeps concurrent runs apart. Deleting on
`end` is not optional — a long-lived process that never cleans that map leaks.

Use `onEvent` rather than `tool`/`chat` middleware for observation: an exception
in `onEvent` is swallowed and cannot break a run. That guarantee is worth a lot
in production.

## Keep the report as a per-request opt-in

```ts
await app.run({
  input,
  log: req.header("x-debug") ? "verbose" : false,
  report: req.header("x-debug") ? { dir: `report/${req.id}` } : false,
});
```

Debugging one production request without a redeploy, a global flag, or noise from
everything else.

## Your own telemetry

`ctx.meta()` in a tool, `inv.meta()` in a middleware, writes onto that step's
node:

```ts
async execute(@input() args, @context() ctx: Context) {
  const rows = await db.query(args.sql);
  ctx.meta({ rowCount: rows.length, cached: false });
  return format(rows);
}
```

Without it, a cache that hits in 4ms can only be *inferred* from the duration.
It is a no-op when nothing is observing, so call it freely.

## Correlate with your system

`runId` is available synchronously, before the first turn:

```ts
const exec = app.run({ input, data: { requestId: req.id } });
req.log.info({ runId: exec.runId }, "agent run started");
```

Carrying your request id in `data` and the `runId` in your logs is what lets you
go from a user complaint to the exact execution tree.

## Observation is opt-in

Nothing is emitted unless someone is watching — `report`, `log`, a plugin with
`onEvent`, or `observe: true`. Otherwise the run skips the tree, the events and
the streaming request.

That is a deliberate ~2× CPU saving, and the reason `onEvent` warns once instead
of silently yielding nothing.

## Alerts worth having

| Alert | Why |
| --- | --- |
| `costUsd` per run, p95 | the first sign of a loop that stopped converging |
| rate of `exhausted: true` | the stopping condition is degrading |
| rate of `toolCallSource: "rescued"` | the model is slipping on this task |
| `attempts` present | provider instability, before it becomes failures |
| runs ending by budget | plan limits, or a real regression |

The last one needs `onExceeded` — a budget in `"stop"` mode resolves normally, so
a run that hit its ceiling is otherwise indistinguishable from one that finished.

```ts
budget: {
  maxCostUsd: 0.5,
  onExceeded: (info) => metrics.increment(`budget.${info.reason}`),
}
```

## Privacy

Everything captured passes through [redaction](/en/advanced/redaction) first,
which is on by default. That is a safety net for known shapes, not a guarantee —
there is no regex for a customer's name.

For sensitive runs, `report: { content: false }` keeps the tree, the durations
and the telemetry, and writes none of the text. You keep every metric on this
page and lose only the ability to read the conversation.

## Related

- [Report](/en/devtools/report)
- [Logging](/en/devtools/logging)
- [Writing plugins](/en/advanced/writing-plugins)
- [Production](/en/deployment/production)
